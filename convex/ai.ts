import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread,
  saveMessage,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal, components } from "./_generated/api";
import { account, accessProfile } from "./access";
import { chatConfigured, chatModel, libraryConfigured } from "./modelPolicy";
import { hasOpenRouterConsent } from "../src/domain";
import { pendingPayload } from "./values";
import { insertRecord, upsertTask, validateRecord } from "./records";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export async function conversationAccess(
  ctx: QueryCtx | MutationCtx,
  id: Id<"conversations">,
) {
  const user = await account(ctx),
    row = await ctx.db.get(id);
  if (!row || row.userId !== user._id)
    throw new ConvexError("Conversation unavailable.");
  const { profile } = await accessProfile(ctx, row.profileId);
  return { row, user, profile };
}
export const configuration = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    libraryConnected: v.boolean(),
    premiumRequired: v.boolean(),
    model: v.string(),
  }),
  handler: async () => ({
    connected: chatConfigured(),
    libraryConnected: libraryConfigured(),
    premiumRequired: process.env.NEEM_AI_REQUIRE_PREMIUM === "true",
    model: "Neem AI",
  }),
});
export const list = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(
    v.object({
      id: v.id("conversations"),
      title: v.string(),
      updatedAt: v.number(),
      generating: v.boolean(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const { user } = await accessProfile(ctx, profileId);
    return (
      await ctx.db
        .query("conversations")
        .withIndex("by_userId_and_profileId_and_updatedAt", (q) =>
          q.eq("userId", user._id).eq("profileId", profileId),
        )
        .order("desc")
        .take(40)
    ).map((c) => ({
      id: c._id,
      title: c.title,
      updatedAt: c.updatedAt,
      generating: c.generating,
      ...(c.error ? { error: c.error } : {}),
    }));
  },
});
export const create = mutation({
  args: { profileId: v.id("profiles") },
  returns: v.id("conversations"),
  handler: async (ctx, { profileId }) => {
    const { user } = await accessProfile(ctx, profileId);
    const agentThreadId = await createThread(ctx, components.agent, {
      userId: user._id,
      title: "New conversation",
    });
    return ctx.db.insert("conversations", {
      profileId,
      userId: user._id,
      agentThreadId,
      title: "New conversation",
      updatedAt: Date.now(),
      generating: false,
    });
  },
});
export const messages = query({
  args: {
    threadId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { row } = await conversationAccess(ctx, args.threadId);
    const opts = { ...args, threadId: row.agentThreadId };
    return {
      ...(await listUIMessages(ctx, components.agent, opts)),
      streams: await syncStreams(ctx, components.agent, opts),
    };
  },
});
export const send = mutation({
  args: {
    threadId: v.id("conversations"),
    text: v.string(),
    requestId: v.string(),
    includeHistory: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { row, user, profile } = await conversationAccess(ctx, args.threadId);
    if (!hasOpenRouterConsent(profile.preferences))
      throw new ConvexError(
        "Please accept the updated AI privacy notice before sending.",
      );
    if (!chatConfigured())
      throw new ConvexError("The connection to Neem AI is being set up.");
    const text = args.text.trim();
    if (
      !text ||
      text.length > 3000 ||
      !args.requestId ||
      args.requestId.length > 100
    )
      throw new ConvexError(
        "Please enter a message of up to 3,000 characters.",
      );
    const duplicate = await ctx.db
      .query("aiRequests")
      .withIndex("by_conversationId_and_requestId", (q) =>
        q.eq("conversationId", row._id).eq("requestId", args.requestId),
      )
      .first();
    if (duplicate) return null;
    if (row.generating && Date.now() - (row.generationStartedAt || 0) < 180000)
      throw new ConvexError("Please wait for the current response.");
    if (process.env.NEEM_AI_REQUIRE_PREMIUM === "true") {
      const s = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (
        !s?.active ||
        s.expiresAt <= Date.now() ||
        Date.now() - s.checkedAt > 86400000
      )
        throw new ConvexError(
          "Please restore your purchase to verify premium access.",
        );
    }
    const day = new Date().toISOString().slice(0, 10),
      usage = await ctx.db
        .query("aiUsage")
        .withIndex("by_userId_and_day", (q) =>
          q.eq("userId", user._id).eq("day", day),
        )
        .unique();
    if ((usage?.count || 0) >= 30)
      throw new ConvexError(
        "You have reached today's message limit. Please return tomorrow.",
      );
    if (usage) await ctx.db.patch(usage._id, { count: usage.count + 1 });
    else await ctx.db.insert("aiUsage", { userId: user._id, day, count: 1 });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: row.agentThreadId,
      userId: user._id,
      message: { role: "user", content: text },
    });
    await ctx.db.insert("aiRequests", {
      conversationId: row._id,
      requestId: args.requestId,
      state: "queued",
    });
    await ctx.db.patch(row._id, {
      title: row.title === "New conversation" ? text.slice(0, 60) : row.title,
      updatedAt: Date.now(),
      generating: true,
      generationStartedAt: Date.now(),
      requestId: args.requestId,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.intelligence.respond, {
      conversationId: row._id,
      requestId: args.requestId,
      promptMessageId: messageId,
      text,
      includeHistory: args.includeHistory,
    });
    return null;
  },
});
export const routed = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    requestId: v.string(),
    model: v.string(),
    source: v.union(
      v.literal("rules"),
      v.literal("decision"),
      v.literal("fallback"),
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.model !== chatModel()) throw new ConvexError("Model unavailable.");
    const c = await ctx.db.get(args.conversationId);
    const r = await ctx.db
      .query("aiRequests")
      .withIndex("by_conversationId_and_requestId", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("requestId", args.requestId),
      )
      .unique();
    const p = c ? await ctx.db.get(c.profileId) : null;
    const membership = c
      ? await ctx.db
          .query("memberships")
          .withIndex("by_profileId_and_userId", (q) =>
            q.eq("profileId", c.profileId).eq("userId", c.userId),
          )
          .unique()
      : null;
    if (
      !c?.generating ||
      c.requestId !== args.requestId ||
      !hasOpenRouterConsent(p?.preferences) ||
      !membership ||
      !r ||
      r.state === "cancelled"
    )
      return false;
    await ctx.db.patch(r._id, {
      model: args.model,
      routeSource: args.source,
      state: "running",
    });
    return true;
  },
});
export const cancel = mutation({
  args: { threadId: v.id("conversations") },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const { row } = await conversationAccess(ctx, threadId);
    const r = row.requestId
      ? await ctx.db
          .query("aiRequests")
          .withIndex("by_conversationId_and_requestId", (q) =>
            q.eq("conversationId", threadId).eq("requestId", row.requestId!),
          )
          .first()
      : null;
    if (r) await ctx.db.patch(r._id, { state: "cancelled" });
    await ctx.db.patch(threadId, { generating: false });
    return null;
  },
});
export const runContext = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    requestId: v.string(),
    includeHistory: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.conversationId);
    if (!c || c.requestId !== args.requestId || !c.generating) return null;
    const req = await ctx.db
      .query("aiRequests")
      .withIndex("by_conversationId_and_requestId", (q) =>
        q.eq("conversationId", c._id).eq("requestId", args.requestId),
      )
      .first();
    const p = await ctx.db.get(c.profileId),
      m = await ctx.db
        .query("memberships")
        .withIndex("by_profileId_and_userId", (q) =>
          q.eq("profileId", c.profileId).eq("userId", c.userId),
        )
        .unique();
    if (
      !p ||
      !hasOpenRouterConsent(p.preferences) ||
      !m ||
      !req ||
      req.state === "cancelled"
    )
      return null;
    const records = args.includeHistory
      ? await ctx.db
          .query("readings")
          .withIndex("by_profileId_and_at", (q) => q.eq("profileId", p._id))
          .order("desc")
          .take(30)
      : [];
    return {
      agentThreadId: c.agentThreadId,
      userId: c.userId,
      profileId: c.profileId,
      health: args.includeHistory
        ? JSON.stringify(
            records.map((r) => ({
              kind: r.kind,
              value: r.value,
              secondary: r.secondary,
              height: r.height,
              at: r.at,
              context: r.context,
              source: r.source,
            })),
          )
        : "No health history shared. Do not infer readings.",
    };
  },
});
export const finish = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    requestId: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.conversationId),
      r = await ctx.db
        .query("aiRequests")
        .withIndex("by_conversationId_and_requestId", (q) =>
          q
            .eq("conversationId", args.conversationId)
            .eq("requestId", args.requestId),
        )
        .first();
    if (r && r.state !== "cancelled")
      await ctx.db.patch(r._id, { state: args.error ? "failed" : "done" });
    if (c?.requestId === args.requestId)
      await ctx.db.patch(c._id, {
        generating: false,
        ...(args.error ? { error: args.error } : {}),
      });
    return null;
  },
});
export const propose = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    requestId: v.string(),
    payload: pendingPayload,
  },
  returns: v.id("pendingActions"),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.conversationId);
    if (!c || c.userId !== args.userId)
      throw new ConvexError("Conversation unavailable.");
    const profile = await ctx.db.get(c.profileId);
    if (
      !c.generating ||
      c.requestId !== args.requestId ||
      !hasOpenRouterConsent(profile?.preferences)
    )
      throw new ConvexError("This AI request is no longer active.");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_profileId_and_userId", (q) =>
        q.eq("profileId", c.profileId).eq("userId", args.userId),
      )
      .unique();
    if (!membership || membership.role === "viewer")
      throw new ConvexError("This profile is read-only.");
    if (args.payload.type === "reading") validateRecord(args.payload.reading);
    if (
      args.payload.type === "appointment" &&
      (!args.payload.clinic.trim() ||
        args.payload.clinic.length > 160 ||
        !args.payload.reason.trim() ||
        args.payload.reason.length > 1000 ||
        !Number.isFinite(Date.parse(args.payload.startsAt)) ||
        Date.parse(args.payload.startsAt) <= Date.now())
    )
      throw new ConvexError("Check the appointment details and future date.");
    return ctx.db.insert("pendingActions", {
      conversationId: c._id,
      profileId: c.profileId,
      userId: args.userId,
      payload: args.payload,
      state: "pending",
      expiresAt: Date.now() + 900000,
    });
  },
});
export const proposals = query({
  args: { threadId: v.id("conversations") },
  returns: v.array(
    v.object({
      id: v.id("pendingActions"),
      payload: pendingPayload,
      state: v.string(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, { threadId }) => {
    await conversationAccess(ctx, threadId);
    return (
      await ctx.db
        .query("pendingActions")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", threadId))
        .order("desc")
        .take(20)
    ).map((p) => ({
      id: p._id,
      payload: p.payload,
      state: p.state,
      expiresAt: p.expiresAt,
    }));
  },
});
export const confirm = mutation({
  args: { id: v.id("pendingActions"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await account(ctx),
      a = await ctx.db.get(args.id);
    if (!a || a.userId !== user._id)
      throw new ConvexError("Action unavailable.");
    await accessProfile(ctx, a.profileId, true);
    if (a.state !== "pending") return null;
    if (a.expiresAt < Date.now())
      throw new ConvexError(
        "This request expired. Please ask Neem AI to prepare it again.",
      );
    if (args.accept) {
      if (a.payload.type === "reading")
        await insertRecord(ctx, a.profileId, a.payload.reading);
      if (a.payload.type === "task")
        await upsertTask(ctx, a.profileId, {
          id: `ai-${a._id}`,
          title: a.payload.title,
          dueAt: a.payload.dueAt,
        });
      if (a.payload.type === "appointment") {
        if (Date.parse(a.payload.startsAt) <= Date.now())
          throw new ConvexError("Please select a future appointment time.");
        await ctx.db.insert("appointments", {
          profileId: a.profileId,
          careType: a.payload.careType,
          clinic: a.payload.clinic,
          startsAt: a.payload.startsAt,
          reason: a.payload.reason,
          state: "requested",
          actionId: a._id,
        });
      }
    }
    await ctx.db.patch(a._id, {
      state: args.accept ? "confirmed" : "dismissed",
    });
    return null;
  },
});
export const appointments = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(
    v.object({
      id: v.id("appointments"),
      careType: v.string(),
      clinic: v.string(),
      startsAt: v.string(),
      reason: v.string(),
      state: v.string(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    await accessProfile(ctx, profileId);
    return (
      await ctx.db
        .query("appointments")
        .withIndex("by_profileId_and_startsAt", (q) =>
          q.eq("profileId", profileId),
        )
        .order("desc")
        .take(40)
    ).map((a) => ({
      id: a._id,
      careType: a.careType,
      clinic: a.clinic,
      startsAt: a.startsAt,
      reason: a.reason,
      state: a.state,
    }));
  },
});

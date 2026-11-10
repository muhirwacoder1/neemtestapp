import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { accessProfile } from "./access";
import { record, task, preferences } from "./values";
import { validateReading, type Reading, type CareTask } from "../src/domain";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export function validateRecord(
  r: Omit<Reading, "source"> & { source: string },
) {
  if (r.source !== "manual")
    throw new ConvexError(
      "Only manually entered measurements are accepted here.",
    );
  if (
    !r.id ||
    r.id.length > 100 ||
    r.context.length > 120 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(r.at)
  )
    throw new ConvexError("Invalid measurement.");
  const at = new Date(r.at);
  if (!Number.isFinite(at.getTime()))
    throw new ConvexError("Invalid measurement time.");
  const iso = at.toISOString();
  const err = validateReading(r.kind, {
    value: String(r.value),
    secondary: r.secondary === undefined ? "" : String(r.secondary),
    height: r.height === undefined ? "" : String(r.height),
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  });
  if (err) throw new ConvexError(err);
}
export async function insertRecord(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  r: Omit<Reading, "source"> & { source: "manual" },
) {
  validateRecord(r);
  const existing = await ctx.db
    .query("readings")
    .withIndex("by_profileId_and_externalId", (q) =>
      q.eq("profileId", profileId).eq("externalId", r.id),
    )
    .unique();
  if (existing) return;
  const { id, ...fields } = r;
  await ctx.db.insert("readings", { ...fields, profileId, externalId: id });
}
export async function upsertTask(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  t: CareTask,
) {
  if (
    !t.id ||
    t.id.length > 100 ||
    !t.title.trim() ||
    t.title.length > 160 ||
    !Number.isFinite(Date.parse(t.dueAt)) ||
    (t.completedAt &&
      (!Number.isFinite(Date.parse(t.completedAt)) ||
        Date.parse(t.completedAt) > Date.now() + 60000))
  )
    throw new ConvexError("Check the task title and dates.");
  const existing = await ctx.db
    .query("tasks")
    .withIndex("by_profileId_and_externalId", (q) =>
      q.eq("profileId", profileId).eq("externalId", t.id),
    )
    .unique();
  const { id, ...fields } = t;
  if (existing)
    await ctx.db.replace(existing._id, {
      ...fields,
      profileId,
      externalId: id,
    });
  else await ctx.db.insert("tasks", { ...fields, profileId, externalId: id });
}
export const dashboard = query({
  args: { profileId: v.id("profiles") },
  returns: v.object({
    readings: v.array(
      v.object({
        ...record.fields,
        source: v.union(v.literal("manual"), v.literal("device")),
      }),
    ),
    tasks: v.array(task),
    preferences,
    bookmarks: v.array(v.string()),
    readProgress: v.record(v.string(), v.boolean()),
    hasMoreReadings: v.boolean(),
  }),
  handler: async (ctx, { profileId }) => {
    const { profile } = await accessProfile(ctx, profileId);
    const rows = await ctx.db
      .query("readings")
      .withIndex("by_profileId_and_at", (q) => q.eq("profileId", profileId))
      .order("desc")
      .take(1001);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_profileId_and_dueAt", (q) => q.eq("profileId", profileId))
      .order("desc")
      .take(300);
    return {
      readings: rows
        .slice(0, 1000)
        .reverse()
        .map(({ _id, _creationTime, profileId: _, externalId, ...r }) => ({
          id: externalId,
          ...r,
        })),
      tasks: tasks
        .reverse()
        .map(({ _id, _creationTime, profileId: _, externalId, ...t }) => ({
          id: externalId,
          ...t,
        })),
      preferences: profile.preferences,
      bookmarks: profile.bookmarks,
      readProgress: profile.readProgress,
      hasMoreReadings: rows.length > 1000,
    };
  },
});
export const history = query({
  args: {
    profileId: v.id("profiles"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await accessProfile(ctx, args.profileId);
    return ctx.db
      .query("readings")
      .withIndex("by_profileId_and_at", (q) =>
        q.eq("profileId", args.profileId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const saveChanges = mutation({
  args: {
    profileId: v.id("profiles"),
    readings: v.array(record),
    tasks: v.array(task),
    preferences: v.optional(preferences),
    bookmarks: v.optional(v.array(v.string())),
    readProgress: v.optional(v.record(v.string(), v.boolean())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await accessProfile(ctx, args.profileId, true);
    if (
      args.readings.length > 50 ||
      args.tasks.length > 50 ||
      (args.bookmarks?.length ?? 0) > 500 ||
      Object.keys(args.readProgress ?? {}).length > 500
    )
      throw new ConvexError("Too many changes. Save a smaller batch.");
    for (const r of args.readings) await insertRecord(ctx, args.profileId, r);
    for (const t of args.tasks) await upsertTask(ctx, args.profileId, t);
    await ctx.db.patch(profile._id, {
      ...(args.preferences ? { preferences: args.preferences } : {}),
      ...(args.bookmarks ? { bookmarks: args.bookmarks } : {}),
      ...(args.readProgress ? { readProgress: args.readProgress } : {}),
    });
    return null;
  },
});

import { v, ConvexError } from "convex/values";
import {
  action,
  internalMutation,
  query,
  internalQuery,
} from "./_generated/server";
import { account } from "./access";
import { internal } from "./_generated/api";
export const status = query({
  args: { now: v.number() },
  returns: v.object({ active: v.boolean(), expiresAt: v.number() }),
  handler: async (ctx, { now }) => {
    const user = await account(ctx),
      s = await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
    return {
      active: !!s?.active && s.expiresAt > now,
      expiresAt: s?.expiresAt || 0,
    };
  },
});
export const identity = internalQuery({
  args: {},
  returns: v.object({ id: v.id("users"), clerkId: v.string() }),
  handler: async (ctx) => {
    const user = await account(ctx);
    return { id: user._id, clerkId: user.clerkId };
  },
});
export const save = internalMutation({
  args: { userId: v.id("users"), active: v.boolean(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing)
      await ctx.db.patch(existing._id, { ...args, checkedAt: Date.now() });
    else
      await ctx.db.insert("subscriptions", { ...args, checkedAt: Date.now() });
    return null;
  },
});
export const sync = action({
  args: {},
  returns: v.object({ active: v.boolean() }),
  handler: async (ctx): Promise<{ active: boolean }> => {
    const user = await ctx.runQuery(internal.subscriptions.identity, {}),
      key = process.env.REVENUECAT_SECRET_KEY;
    if (!key)
      throw new ConvexError("Store verification is not configured yet.");
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.clerkId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok)
      throw new ConvexError(
        "Your purchase could not be verified. Please try Restore purchases.",
      );
    const data = await res.json(),
      e =
        data.subscriber?.entitlements?.[
          process.env.REVENUECAT_ENTITLEMENT || "neem_premium"
        ];
    const expiresAt = e
      ? e.expires_date
        ? Date.parse(e.expires_date)
        : Date.now() + 86400000
      : 0;
    const active = Number.isFinite(expiresAt) && expiresAt > Date.now();
    await ctx.runMutation(internal.subscriptions.save, {
      userId: user.id,
      active,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    });
    return { active };
  },
});

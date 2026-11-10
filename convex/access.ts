import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export async function account(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Please sign in to Neem.");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user)
    throw new ConvexError(
      "Your account is still being set up. Please try again.",
    );
  if (user.disabled)
    throw new ConvexError(
      "Your Neem account is suspended. Contact your care team.",
    );
  return user;
}
export async function accessProfile(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<"profiles">,
  write = false,
) {
  const user = await account(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_profileId_and_userId", (q) =>
      q.eq("profileId", profileId).eq("userId", user._id),
    )
    .unique();
  if (!membership || (write && membership.role === "viewer"))
    throw new ConvexError("You do not have permission to access this profile.");
  const profile = await ctx.db.get(profileId);
  if (!profile) throw new ConvexError("Profile unavailable.");
  return { user, profile, membership };
}
export async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await account(ctx);
  const ids = (process.env.NEEM_ADMIN_CLERK_IDS || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (!ids.includes(user.clerkId))
    throw new ConvexError("Only Neem library administrators can do this.");
  return user;
}

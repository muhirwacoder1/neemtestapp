import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { account, accessProfile } from "./access";
import { defaults } from "../src/domain";
import { profile as profileValue, profileDetails } from "./values";
import { validateProfileDetails } from "../src/profile";

export const ensure = mutation({
  args: {},
  returns: v.id("profiles"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Please sign in to Neem.");
    let user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      const name = (identity.givenName || identity.name || "My profile")
        .trim()
        .slice(0, 60);
      const id = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        clerkId: identity.subject,
        name,
        ...(identity.email && identity.emailVerified
          ? { email: identity.email.toLowerCase() }
          : {}),
      });
      user = (await ctx.db.get(id))!;
    }
    if (user.disabled) throw new ConvexError("Your Neem account is suspended.");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", user!._id))
      .first();
    if (existing) return existing._id;
    const profileId = await ctx.db.insert("profiles", {
      owner: user._id,
      name: user.name,
      preferences: defaults,
      bookmarks: [],
      readProgress: {},
    });
    await ctx.db.insert("memberships", {
      profileId,
      userId: user._id,
      role: "owner",
    });
    return profileId;
  },
});
export const list = query({
  args: {},
  returns: v.array(profileValue),
  handler: async (ctx) => {
    const user = await account(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(50);
    const rows = await Promise.all(
      memberships.map(async (m) => {
        const p = await ctx.db.get(m.profileId);
        return p
          ? {
              id: p._id,
              name: p.name,
              ...(p.birthDate ? { birthDate: p.birthDate } : {}),
              ...(p.details ? { details: p.details } : {}),
              ...(p.onboardedAt ? { onboardedAt: p.onboardedAt } : {}),
              role: m.role,
            }
          : null;
      }),
    );
    return rows.filter((p): p is NonNullable<typeof p> => p !== null);
  },
});
export const rename = mutation({
  args: { profileId: v.id("profiles"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await accessProfile(ctx, args.profileId, true);
    const name = args.name.trim();
    if (!name || name.length > 60)
      throw new ConvexError("Enter a name of 1–60 characters.");
    await ctx.db.patch(args.profileId, { name });
    return null;
  },
});

export const saveSetup = mutation({
  args: {
    profileId: v.id("profiles"),
    details: profileDetails,
    complete: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await accessProfile(ctx, args.profileId, true);
    const error = validateProfileDetails(args.details);
    if (error) throw new ConvexError(error);
    const details = {
      ...args.details,
      firstName: args.details.firstName.trim(),
      lastName: args.details.lastName.trim(),
    };
    await ctx.db.patch(args.profileId, {
      name: [details.firstName, details.lastName].filter(Boolean).join(" "),
      details,
      ...(args.complete && !profile.onboardedAt
        ? { onboardedAt: Date.now() }
        : {}),
    });
    return null;
  },
});

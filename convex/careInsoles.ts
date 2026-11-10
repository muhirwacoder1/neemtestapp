import { v, ConvexError } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { query, mutation } from "./_generated/server";
import { careAdmin, audit, clean } from "./careAccess";
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      id: v.id("insoleRegistry"),
      hardwareId: v.string(),
      name: v.string(),
      state: v.string(),
      patient: v.optional(v.string()),
      profileId: v.optional(v.id("profiles")),
    }),
  ),
  handler: async (ctx, args) => {
    await careAdmin(ctx);
    const rows = await ctx.db
      .query("insoleRegistry")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...rows,
      page: await Promise.all(
        rows.page.map(async (r) => ({
          id: r._id,
          hardwareId: r.hardwareId,
          name: r.name,
          state: r.state,
          profileId: r.profileId,
          patient: r.profileId
            ? (await ctx.db.get(r.profileId))?.name
            : undefined,
        })),
      ),
    };
  },
});
export const register = mutation({
  args: { hardwareId: v.string(), name: v.string() },
  returns: v.id("insoleRegistry"),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx);
    const hardwareId = clean(args.hardwareId, 150),
      name = clean(args.name, 100);
    if (!hardwareId || !name)
      throw new ConvexError("Enter the insole name and exact hardware ID.");
    const row = await ctx.db
      .query("insoleRegistry")
      .withIndex("by_hardware", (q) => q.eq("hardwareId", hardwareId))
      .unique();
    if (row) throw new ConvexError("This hardware ID is already registered.");
    const device = await ctx.db
      .query("devices")
      .withIndex("by_hardwareId", (q) => q.eq("hardwareId", hardwareId))
      .unique();
    const id = await ctx.db.insert("insoleRegistry", {
      hardwareId,
      name,
      state: device
        ? device.active === false
          ? "retired"
          : "assigned"
        : "available",
      createdAt: Date.now(),
      ...(device ? { profileId: device.profileId, deviceId: device._id } : {}),
    });
    await audit(ctx, user._id, "insole.registered", id, device?.profileId);
    return id;
  },
});
export const assign = mutation({
  args: { id: v.id("insoleRegistry"), profileId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx),
      r = await ctx.db.get(args.id),
      p = await ctx.db.get(args.profileId);
    if (!r || !p) throw new ConvexError("Insole or patient unavailable.");
    if (r.state === "retired")
      throw new ConvexError("Reactivate this insole before assigning it.");
    if (r.profileId && r.profileId !== p._id)
      throw new ConvexError(
        "An insole with patient history cannot be transferred to another patient.",
      );
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_hardwareId", (q) => q.eq("hardwareId", r.hardwareId))
      .unique();
    if (existing && existing.profileId !== p._id)
      throw new ConvexError("This insole is linked to another patient.");
    const deviceId = existing
      ? existing._id
      : await ctx.db.insert("devices", {
          profileId: p._id,
          hardwareId: r.hardwareId,
          name: r.name,
          linkedAt: Date.now(),
          active: true,
        });
    await ctx.db.patch(r._id, {
      state: "assigned",
      profileId: p._id,
      deviceId,
    });
    await audit(ctx, user._id, "insole.assigned", r._id, p._id);
    return null;
  },
});
export const retire = mutation({
  args: { id: v.id("insoleRegistry"), retired: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx),
      r = await ctx.db.get(args.id);
    if (!r) throw new ConvexError("Insole unavailable.");
    await ctx.db.patch(r._id, {
      state: args.retired ? "retired" : r.profileId ? "assigned" : "available",
    });
    if (r.deviceId) await ctx.db.patch(r.deviceId, { active: !args.retired });
    await audit(
      ctx,
      user._id,
      args.retired ? "insole.retired" : "insole.reactivated",
      r._id,
      r.profileId,
    );
    return null;
  },
});

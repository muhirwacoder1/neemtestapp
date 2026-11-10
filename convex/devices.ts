import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accessProfile } from "./access";
import { sensor } from "./values";

export const link = mutation({
  args: {
    profileId: v.id("profiles"),
    hardwareId: v.string(),
    name: v.string(),
  },
  returns: v.id("devices"),
  handler: async (ctx, args) => {
    await accessProfile(ctx, args.profileId, true);
    if (
      !args.hardwareId ||
      args.hardwareId.length > 150 ||
      args.name.length > 100
    )
      throw new ConvexError("Invalid device identity.");
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_hardwareId", (q) => q.eq("hardwareId", args.hardwareId))
      .unique();
    if (existing) {
      if (existing.profileId !== args.profileId)
        throw new ConvexError(
          "This insole is already linked to another profile.",
        );
      if (existing.active === false)
        throw new ConvexError("This insole has been retired by the care team.");
      return existing._id;
    }
    const registered = await ctx.db
      .query("insoleRegistry")
      .withIndex("by_hardware", (q) => q.eq("hardwareId", args.hardwareId))
      .unique();
    if (registered)
      throw new ConvexError(
        "Ask your care team to assign this registered insole to your profile.",
      );
    return ctx.db.insert("devices", { ...args, linkedAt: Date.now() });
  },
});
export const saveFrame = mutation({
  args: {
    profileId: v.id("profiles"),
    deviceId: v.id("devices"),
    side: v.union(v.literal("left"), v.literal("right")),
    sensors: v.array(sensor),
    receivedAt: v.string(),
    sequence: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await accessProfile(ctx, args.profileId, true);
    const device = await ctx.db.get(args.deviceId);
    if (
      !device ||
      device.profileId !== args.profileId ||
      device.active === false
    )
      throw new ConvexError(
        "This device does not belong to the selected profile.",
      );
    if (
      !args.sequence ||
      args.sequence.length > 120 ||
      args.sensors.length < 1 ||
      args.sensors.length > 4 ||
      new Set(args.sensors.map((s) => s.region)).size !== args.sensors.length ||
      args.sensors.some(
        (s) => !Number.isFinite(s.value) || s.value < 0 || s.value > 100,
      ) ||
      !Number.isFinite(Date.parse(args.receivedAt)) ||
      Math.abs(Date.now() - Date.parse(args.receivedAt)) > 300000
    )
      throw new ConvexError("Invalid sensor frame.");
    const duplicate = await ctx.db
      .query("sensorFrames")
      .withIndex("by_deviceId_and_sequence", (q) =>
        q.eq("deviceId", args.deviceId).eq("sequence", args.sequence),
      )
      .first();
    if (!duplicate) await ctx.db.insert("sensorFrames", args);
    return null;
  },
});
export const history = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(
    v.object({
      side: v.union(v.literal("left"), v.literal("right")),
      sensors: v.array(sensor),
      receivedAt: v.string(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    await accessProfile(ctx, profileId);
    return (
      await ctx.db
        .query("sensorFrames")
        .withIndex("by_profileId_and_receivedAt", (q) =>
          q.eq("profileId", profileId),
        )
        .order("desc")
        .take(40)
    ).map(({ side, sensors, receivedAt }) => ({ side, sensors, receivedAt }));
  },
});
export const alerts = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(
    v.object({
      id: v.id("alerts"),
      level: v.string(),
      reason: v.string(),
      ruleVersion: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    await accessProfile(ctx, profileId);
    return (
      await ctx.db
        .query("alerts")
        .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
        .order("desc")
        .take(30)
    ).map((a) => ({
      id: a._id,
      level: a.level,
      reason: a.reason,
      ruleVersion: a.ruleVersion,
      at: a._creationTime,
    }));
  },
});

import { v, ConvexError } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { carePatient, careStaff, audit, clean } from "./careAccess";
import { availableSlot, videoReady } from "./consultations";
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    profileId: v.optional(v.id("profiles")),
  },
  returns: paginationResultValidator(
    v.object({
      id: v.id("consultations"),
      profileId: v.id("profiles"),
      patient: v.string(),
      clinician: v.string(),
      startsAt: v.number(),
      endsAt: v.number(),
      state: v.string(),
      reason: v.string(),
      canJoin: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const role = await careStaff(ctx);
    if (args.profileId) await carePatient(ctx, args.profileId);
    const rows = args.profileId
      ? await ctx.db
          .query("consultations")
          .withIndex("by_profileId_and_startsAt", (q) =>
            q.eq("profileId", args.profileId!),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : role.administrator
        ? await ctx.db
            .query("consultations")
            .withIndex("by_startsAt")
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("consultations")
            .withIndex("by_clinicianId_and_startsAt", (q) =>
              q.eq("clinicianId", role.clinician!._id),
            )
            .order("desc")
            .paginate(args.paginationOpts);
    return {
      ...rows,
      page: await Promise.all(
        rows.page
          .filter(
            (r) => role.administrator || r.clinicianId === role.clinician?._id,
          )
          .map(async (r) => ({
            id: r._id,
            profileId: r.profileId,
            patient: (await ctx.db.get(r.profileId))?.name ?? "Patient",
            clinician: (await ctx.db.get(r.clinicianId))?.name ?? "Care team",
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            state: r.state,
            reason: r.reason,
            canJoin: role.clinician?._id === r.clinicianId,
          })),
      ),
    };
  },
});
export const book = mutation({
  args: {
    profileId: v.id("profiles"),
    slotId: v.id("consultationSlots"),
    reason: v.string(),
  },
  returns: v.id("consultations"),
  handler: async (ctx, args) => {
    const { user, profile } = await carePatient(ctx, args.profileId);
    if (!videoReady()) throw new ConvexError("Video booking is not enabled.");
    const owner = await ctx.db.get(profile.owner);
    if (!owner || owner.disabled)
      throw new ConvexError("Patient account is unavailable.");
    const current = await ctx.db.get(args.slotId);
    if (current?.state === "booked" && current.consultationId) {
      const old = await ctx.db.get(current.consultationId);
      if (old?.profileId === profile._id && old.state === "booked")
        return old._id;
    }
    const slot = await availableSlot(
      ctx,
      args.slotId,
      profile.owner,
      profile._id,
    );
    const id = await ctx.db.insert("consultations", {
      profileId: profile._id,
      bookedBy: profile.owner,
      clinicianId: slot.clinicianId,
      slotId: slot._id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      reason: clean(args.reason, 1000),
      state: "booked",
    });
    await ctx.db.patch(slot._id, { state: "booked", consultationId: id });
    await audit(ctx, user._id, "appointment.booked", id, profile._id);
    return id;
  },
});
export const update = mutation({
  args: {
    id: v.id("consultations"),
    action: v.union(
      v.literal("cancel"),
      v.literal("complete"),
      v.literal("reschedule"),
    ),
    slotId: v.optional(v.id("consultationSlots")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const r = await careStaff(ctx),
      visit = await ctx.db.get(args.id);
    if (!visit || (!r.administrator && visit.clinicianId !== r.clinician?._id))
      throw new ConvexError("Appointment unavailable.");
    if (visit.state !== "booked")
      throw new ConvexError("This appointment is no longer booked.");
    if (args.action === "reschedule") {
      if (
        !args.slotId ||
        visit.lastJoinAt ||
        visit.startsAt < Date.now() + 300000
      )
        throw new ConvexError("This appointment can no longer be rescheduled.");
      const next = await availableSlot(
        ctx,
        args.slotId,
        visit.bookedBy,
        visit.profileId,
        visit._id,
      );
      if (next.clinicianId !== visit.clinicianId)
        throw new ConvexError("Choose the same clinician.");
      const old = await ctx.db.get(visit.slotId);
      if (old?.consultationId === visit._id)
        await ctx.db.patch(old._id, {
          state: "open",
          consultationId: undefined,
        });
      await ctx.db.patch(next._id, {
        state: "booked",
        consultationId: visit._id,
      });
      await ctx.db.patch(visit._id, {
        slotId: next._id,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
      });
    } else {
      if (args.action === "complete" && Date.now() < visit.startsAt)
        throw new ConvexError(
          "A future appointment cannot be marked complete.",
        );
      await ctx.db.patch(visit._id, {
        state: args.action === "cancel" ? "cancelled" : "completed",
      });
      const slot = await ctx.db.get(visit.slotId);
      if (slot?.consultationId === visit._id)
        await ctx.db.patch(slot._id, {
          state:
            args.action === "cancel" && slot.startsAt > Date.now()
              ? "open"
              : "closed",
          consultationId: undefined,
        });
      if (visit.lastJoinAt)
        await ctx.scheduler.runAfter(0, internal.daily.removeRoom, {
          id: visit._id,
        });
    }
    await audit(
      ctx,
      r.user._id,
      `appointment.${args.action}`,
      visit._id,
      visit.profileId,
    );
    return null;
  },
});

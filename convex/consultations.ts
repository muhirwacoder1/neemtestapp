import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { account, accessProfile } from "./access";
import {
  clinicianSummary,
  slotSummary,
  consultationSummary,
  consultationDocument,
} from "./consultationValues";
const MINUTE = 60_000,
  DAY = 86_400_000;
export const videoReady = () =>
  !!process.env.DAILY_API_KEY?.trim() &&
  process.env.DAILY_VIDEO_ENABLED === "true";
export const videoLimit = () => {
  const n = Number(process.env.DAILY_MONTHLY_PARTICIPANT_MINUTES || "9000");
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 9000) : 0;
};
const clinicianArgs = {
  clerkId: v.string(),
  name: v.string(),
  specialty: v.string(),
  timezone: v.string(),
  active: v.boolean(),
};
// Operator-only provisioning. Patients cannot grant themselves clinician access.
export const provisionClinician = internalMutation({
  args: clinicianArgs,
  returns: v.id("clinicians"),
  handler: async (ctx, a) => {
    if (
      !/^user_[A-Za-z0-9]+$/.test(a.clerkId) ||
      !a.name.trim() ||
      a.name.length > 80 ||
      !a.specialty.trim() ||
      a.specialty.length > 100
    )
      throw new ConvexError(
        "Enter a real Clerk user ID, clinician name and specialty.",
      );
    try {
      new Intl.DateTimeFormat("en", { timeZone: a.timezone });
    } catch {
      throw new ConvexError("Enter a valid timezone.");
    }
    const existing = await ctx.db
      .query("clinicians")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", a.clerkId))
      .unique();
    const values = { ...a, name: a.name.trim(), specialty: a.specialty.trim() };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return ctx.db.insert("clinicians", values);
  },
});
async function staff(ctx: QueryCtx | MutationCtx) {
  const user = await account(ctx);
  const clinician = await ctx.db
    .query("clinicians")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", user.clerkId))
    .unique();
  if (!clinician?.active)
    throw new ConvexError(
      "Only an assigned clinician can manage availability.",
    );
  return { user, clinician };
}
async function participant(
  ctx: QueryCtx | MutationCtx,
  id: Id<"consultations">,
) {
  const user = await account(ctx),
    visit = await ctx.db.get(id);
  if (!visit) throw new ConvexError("Appointment unavailable.");
  const clinician = await ctx.db.get(visit.clinicianId);
  const isClinician = clinician?.clerkId === user.clerkId && clinician.active;
  if (visit.bookedBy !== user._id && !isClinician)
    throw new ConvexError(
      "You do not have permission to access this appointment.",
    );
  if (!isClinician) await accessProfile(ctx, visit.profileId, true);
  return { user, visit, clinician, isClinician };
}
async function summary(
  ctx: QueryCtx,
  visit: Doc<"consultations">,
  userId: Id<"users">,
) {
  const clinician = await ctx.db.get(visit.clinicianId),
    profile = await ctx.db.get(visit.profileId);
  const user = await ctx.db.get(userId);
  const canManage =
    visit.bookedBy === userId ||
    !!(clinician?.active && clinician.clerkId === user?.clerkId);
  return {
    id: visit._id,
    clinicianId: visit.clinicianId,
    clinicianName: clinician?.name || "Care team",
    specialty: clinician?.specialty || "Consultation",
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    state: visit.state,
    reason: visit.reason,
    patientName: profile?.name || "Patient",
    canManage,
    canJoin: canManage && !!clinician?.active,
  };
}
export const configuration = query({
  args: { asOf: v.number() },
  returns: v.object({
    enabled: v.boolean(),
    clinicianId: v.union(v.id("clinicians"), v.null()),
    monthlyLimit: v.number(),
    reservedMinutes: v.number(),
  }),
  handler: async (ctx, { asOf }) => {
    const user = await account(ctx);
    const clinician = await ctx.db
      .query("clinicians")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", user.clerkId))
      .unique();
    const usage = clinician?.active
      ? await ctx.db
          .query("videoUsage")
          .withIndex("by_period", (q) =>
            q.eq("period", new Date(asOf).toISOString().slice(0, 7)),
          )
          .unique()
      : null;
    return {
      enabled: videoReady(),
      clinicianId: clinician?.active ? clinician._id : null,
      monthlyLimit: videoLimit(),
      reservedMinutes: usage?.reservedMinutes || 0,
    };
  },
});
export const clinicians = query({
  args: {},
  returns: v.array(clinicianSummary),
  handler: async (ctx) => {
    await account(ctx);
    return (
      await ctx.db
        .query("clinicians")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(60)
    ).map((c) => ({
      id: c._id,
      name: c.name,
      specialty: c.specialty,
      timezone: c.timezone,
    }));
  },
});
export const slots = query({
  args: { clinicianId: v.id("clinicians"), asOf: v.number() },
  returns: v.array(slotSummary),
  handler: async (ctx, a) => {
    const user = await account(ctx),
      c = await ctx.db.get(a.clinicianId);
    if (!c?.active) return [];
    const own = c.clerkId === user.clerkId;
    const rows = await ctx.db
      .query("consultationSlots")
      .withIndex("by_clinicianId_and_startsAt", (q) =>
        q
          .eq("clinicianId", a.clinicianId)
          .gte("startsAt", a.asOf)
          .lt("startsAt", a.asOf + 31 * DAY),
      )
      .take(150);
    return rows
      .filter((s) => own || s.state === "open")
      .map((s) => ({
        id: s._id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        state: s.state,
      }));
  },
});
export const publishSlot = mutation({
  args: { startsAt: v.number(), durationMinutes: v.number() },
  returns: v.id("consultationSlots"),
  handler: async (ctx, a) => {
    const { clinician } = await staff(ctx),
      now = Date.now();
    if (
      !Number.isSafeInteger(a.startsAt) ||
      a.startsAt < now + 15 * MINUTE ||
      a.startsAt > now + 30 * DAY ||
      ![15, 30, 45, 60].includes(a.durationMinutes)
    )
      throw new ConvexError(
        "Choose a slot 15 minutes to 30 days ahead, lasting 15, 30, 45 or 60 minutes.",
      );
    const endsAt = a.startsAt + a.durationMinutes * MINUTE;
    const nearby = await ctx.db
      .query("consultationSlots")
      .withIndex("by_clinicianId_and_startsAt", (q) =>
        q
          .eq("clinicianId", clinician._id)
          .gte("startsAt", a.startsAt - DAY)
          .lt("startsAt", endsAt),
      )
      .take(200);
    if (
      nearby.length === 200 ||
      nearby.some((s) => s.state !== "closed" && s.endsAt > a.startsAt)
    )
      throw new ConvexError("This time overlaps your availability.");
    return ctx.db.insert("consultationSlots", {
      clinicianId: clinician._id,
      startsAt: a.startsAt,
      endsAt,
      state: "open",
    });
  },
});
export const closeSlot = mutation({
  args: { id: v.id("consultationSlots") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { clinician } = await staff(ctx),
      slot = await ctx.db.get(id);
    if (!slot || slot.clinicianId !== clinician._id)
      throw new ConvexError("Slot unavailable.");
    if (slot.state === "booked")
      throw new ConvexError("Cancel the appointment before closing this slot.");
    await ctx.db.patch(id, { state: "closed" });
    return null;
  },
});
export const list = query({
  args: { profileId: v.id("profiles"), asOf: v.number() },
  returns: v.array(consultationSummary),
  handler: async (ctx, { profileId, asOf }) => {
    const { user } = await accessProfile(ctx, profileId);
    const rows = await ctx.db
      .query("consultations")
      .withIndex("by_profileId_and_startsAt", (q) =>
        q.eq("profileId", profileId).gte("startsAt", asOf - 7 * DAY),
      )
      .take(100);
    return Promise.all(rows.map((v) => summary(ctx, v, user._id)));
  },
});
export const clinicianVisits = query({
  args: { asOf: v.number() },
  returns: v.array(consultationSummary),
  handler: async (ctx, { asOf }) => {
    const { user, clinician } = await staff(ctx);
    const rows = await ctx.db
      .query("consultations")
      .withIndex("by_clinicianId_and_startsAt", (q) =>
        q.eq("clinicianId", clinician._id).gte("startsAt", asOf - 7 * DAY),
      )
      .take(100);
    return Promise.all(rows.map((v) => summary(ctx, v, user._id)));
  },
});
export async function availableSlot(
  ctx: MutationCtx,
  id: Id<"consultationSlots">,
  userId: Id<"users">,
  profileId: Id<"profiles">,
  exclude?: Id<"consultations">,
) {
  const slot = await ctx.db.get(id),
    user = await ctx.db.get(userId);
  if (!slot || slot.state !== "open" || slot.startsAt < Date.now() + 5 * MINUTE)
    throw new ConvexError(
      "This time is no longer available. Choose another slot.",
    );
  const c = await ctx.db.get(slot.clinicianId);
  if (!c?.active || c.clerkId === user?.clerkId)
    throw new ConvexError(
      "Choose an available clinician for your consultation.",
    );
  const overlaps = await ctx.db
    .query("consultations")
    .withIndex("by_bookedBy_and_startsAt", (q) =>
      q
        .eq("bookedBy", userId)
        .gte("startsAt", slot.startsAt - DAY)
        .lt("startsAt", slot.endsAt),
    )
    .take(100);
  if (
    overlaps.length === 100 ||
    overlaps.some(
      (v) =>
        v._id !== exclude && v.state === "booked" && v.endsAt > slot.startsAt,
    )
  )
    throw new ConvexError("You already have an appointment at this time.");
  const patientOverlaps = await ctx.db
    .query("consultations")
    .withIndex("by_profileId_and_startsAt", (q) =>
      q
        .eq("profileId", profileId)
        .gte("startsAt", slot.startsAt - DAY)
        .lt("startsAt", slot.endsAt),
    )
    .take(100);
  if (
    patientOverlaps.length === 100 ||
    patientOverlaps.some(
      (v) =>
        v._id !== exclude && v.state === "booked" && v.endsAt > slot.startsAt,
    )
  )
    throw new ConvexError(
      "This profile already has an appointment at this time.",
    );
  return slot;
}
export const book = mutation({
  args: {
    profileId: v.id("profiles"),
    slotId: v.id("consultationSlots"),
    reason: v.string(),
  },
  returns: v.id("consultations"),
  handler: async (ctx, a) => {
    const { user } = await accessProfile(ctx, a.profileId, true);
    if (!videoReady())
      throw new ConvexError(
        "Video consultations are being connected. Please try again when booking opens.",
      );
    if (a.reason.trim().length > 1000)
      throw new ConvexError("Keep your note under 1,000 characters.");
    const current = await ctx.db.get(a.slotId);
    if (current?.consultationId && current.state === "booked") {
      const visit = await ctx.db.get(current.consultationId);
      if (
        visit?.bookedBy === user._id &&
        visit.profileId === a.profileId &&
        visit.state === "booked"
      )
        return visit._id;
    }
    const slot = await availableSlot(ctx, a.slotId, user._id, a.profileId);
    const id = await ctx.db.insert("consultations", {
      profileId: a.profileId,
      bookedBy: user._id,
      clinicianId: slot.clinicianId,
      slotId: slot._id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      reason: a.reason.trim(),
      state: "booked",
    });
    await ctx.db.patch(slot._id, { state: "booked", consultationId: id });
    return id;
  },
});
export const cancel = mutation({
  args: { id: v.id("consultations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { visit } = await participant(ctx, id);
    if (visit.state !== "booked") return null;
    await ctx.db.patch(id, { state: "cancelled" });
    const slot = await ctx.db.get(visit.slotId);
    if (slot?.consultationId === id)
      await ctx.db.patch(slot._id, {
        state: slot.startsAt > Date.now() ? "open" : "closed",
        consultationId: undefined,
      });
    if (visit.lastJoinAt)
      await ctx.scheduler.runAfter(0, internal.daily.removeRoom, { id });
    return null;
  },
});
export const reschedule = mutation({
  args: { id: v.id("consultations"), slotId: v.id("consultationSlots") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const { visit } = await participant(ctx, a.id);
    if (
      visit.state !== "booked" ||
      visit.startsAt <= Date.now() + 5 * MINUTE ||
      visit.lastJoinAt
    )
      throw new ConvexError(
        "This appointment cannot be rescheduled. Cancel it and book a new time.",
      );
    const slot = await availableSlot(
      ctx,
      a.slotId,
      visit.bookedBy,
      visit.profileId,
      visit._id,
    );
    if (slot.clinicianId !== visit.clinicianId)
      throw new ConvexError("Choose another time with the same clinician.");
    const old = await ctx.db.get(visit.slotId);
    if (old?.consultationId === visit._id)
      await ctx.db.patch(old._id, { state: "open", consultationId: undefined });
    await ctx.db.patch(slot._id, {
      state: "booked",
      consultationId: visit._id,
    });
    await ctx.db.patch(visit._id, {
      slotId: slot._id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    return null;
  },
});
export const detail = query({
  args: { id: v.string() },
  returns: v.union(consultationSummary, v.null()),
  handler: async (ctx, { id }) => {
    const visitId = ctx.db.normalizeId("consultations", id);
    if (!visitId) return null;
    try {
      const { user, visit } = await participant(ctx, visitId);
      return summary(ctx, visit, user._id);
    } catch (e) {
      if (e instanceof ConvexError) return null;
      throw e;
    }
  },
});
export const authorizeJoin = internalQuery({
  args: { id: v.id("consultations"), now: v.number() },
  returns: v.object({
    visit: consultationDocument,
    userId: v.id("users"),
    role: v.union(v.literal("patient"), v.literal("clinician")),
  }),
  handler: async (ctx, { id, now }) => {
    const { user, visit, clinician, isClinician } = await participant(ctx, id);
    if (!videoReady())
      throw new ConvexError("Video consultations are being connected.");
    if (!clinician?.active || visit.state !== "booked")
      throw new ConvexError("This appointment is no longer available.");
    if (now < visit.startsAt - 5 * MINUTE || now >= visit.endsAt + 10 * MINUTE)
      throw new ConvexError(
        "Join from 5 minutes before your appointment until 10 minutes after its scheduled end.",
      );
    return {
      visit,
      userId: user._id,
      role: isClinician ? ("clinician" as const) : ("patient" as const),
    };
  },
});
export const reserveVideo = internalMutation({
  args: { id: v.id("consultations") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const { user, visit } = await participant(ctx, id),
      now = Date.now();
    if (
      !videoReady() ||
      visit.state !== "booked" ||
      now < visit.startsAt - 5 * MINUTE ||
      now >= visit.endsAt + 10 * MINUTE
    )
      throw new ConvexError("This appointment cannot be joined now.");
    if (
      visit.joinAttempts?.[user._id] &&
      now - visit.joinAttempts[user._id] < 5000
    )
      throw new ConvexError("Please wait a moment before reconnecting.");
    // Reserve the whole window in each UTC month it touches. This intentionally
    // overestimates month-boundary calls instead of silently undercounting them.
    if (!visit.budgetPeriod) {
      const periods = [
        ...new Set([
          new Date(visit.startsAt - 5 * MINUTE).toISOString().slice(0, 7),
          new Date(visit.endsAt + 10 * MINUTE).toISOString().slice(0, 7),
        ]),
      ];
      const minutes =
        2 * (Math.ceil((visit.endsAt - visit.startsAt) / MINUTE) + 15);
      for (const period of periods) {
        const usage = await ctx.db
          .query("videoUsage")
          .withIndex("by_period", (q) => q.eq("period", period))
          .unique();
        const total = (usage?.reservedMinutes || 0) + minutes;
        if (total > videoLimit())
          throw new ConvexError(
            "This month's video allowance is full. Contact your care team to arrange another way to meet.",
          );
        if (usage) await ctx.db.patch(usage._id, { reservedMinutes: total });
        else
          await ctx.db.insert("videoUsage", { period, reservedMinutes: total });
      }
      await ctx.db.patch(id, { budgetPeriod: periods.join(",") });
    }
    await ctx.db.patch(id, {
      lastJoinAt: now,
      joinAttempts: { ...visit.joinAttempts, [user._id]: now },
    });
    return null;
  },
});

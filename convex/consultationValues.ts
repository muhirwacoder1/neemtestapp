import { v } from "convex/values";
export const consultationState = v.union(
  v.literal("booked"),
  v.literal("cancelled"),
  v.literal("completed"),
);
export const clinicianSummary = v.object({
  id: v.id("clinicians"),
  name: v.string(),
  specialty: v.string(),
  timezone: v.string(),
});
export const slotSummary = v.object({
  id: v.id("consultationSlots"),
  startsAt: v.number(),
  endsAt: v.number(),
  state: v.union(v.literal("open"), v.literal("booked"), v.literal("closed")),
});
export const consultationSummary = v.object({
  id: v.id("consultations"),
  clinicianId: v.id("clinicians"),
  clinicianName: v.string(),
  specialty: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
  state: consultationState,
  reason: v.string(),
  patientName: v.string(),
  canJoin: v.boolean(),
  canManage: v.boolean(),
});
export const consultationDocument = v.object({
  _id: v.id("consultations"),
  _creationTime: v.number(),
  profileId: v.id("profiles"),
  bookedBy: v.id("users"),
  clinicianId: v.id("clinicians"),
  slotId: v.id("consultationSlots"),
  startsAt: v.number(),
  endsAt: v.number(),
  reason: v.string(),
  state: consultationState,
  budgetPeriod: v.optional(v.string()),
  lastJoinAt: v.optional(v.number()),
  joinAttempts: v.optional(v.record(v.string(), v.number())),
});

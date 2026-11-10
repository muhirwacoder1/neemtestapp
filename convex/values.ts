import { v } from "convex/values";

export const metric = v.union(
  v.literal("glucose"),
  v.literal("pressure"),
  v.literal("bmi"),
  v.literal("temperature"),
);
export const preferences = v.object({
  appearance: v.union(
    v.literal("light"),
    v.literal("dark"),
    v.literal("system"),
  ),
  reminders: v.boolean(),
  glucoseUnit: v.union(v.literal("mg/dL"), v.literal("mmol/L")),
  temperatureUnit: v.union(v.literal("°C"), v.literal("°F")),
  aiConsent: v.boolean(),
  aiConsentProvider: v.optional(v.literal("openrouter")),
});
export const record = v.object({
  id: v.string(),
  kind: metric,
  value: v.number(),
  secondary: v.optional(v.number()),
  height: v.optional(v.number()),
  at: v.string(),
  context: v.string(),
  source: v.literal("manual"),
});
export const task = v.object({
  id: v.string(),
  title: v.string(),
  dueAt: v.string(),
  completedAt: v.optional(v.string()),
  reminderId: v.optional(v.string()),
});
export const profileDetails = v.object({
  firstName: v.string(),
  lastName: v.string(),
  birthDate: v.optional(v.string()),
  assignedSex: v.optional(
    v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("intersex"),
      v.literal("prefer_not_to_say"),
    ),
  ),
  country: v.optional(v.string()),
  heightCm: v.optional(v.number()),
  weightKg: v.optional(v.number()),
});
export const profile = v.object({
  id: v.id("profiles"),
  name: v.string(),
  birthDate: v.optional(v.string()),
  details: v.optional(profileDetails),
  onboardedAt: v.optional(v.number()),
  role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
});
export const sensor = v.object({
  region: v.union(
    v.literal("heel"),
    v.literal("midfoot"),
    v.literal("forefoot"),
    v.literal("toes"),
  ),
  value: v.number(),
});
export const pendingPayload = v.union(
  v.object({ type: v.literal("reading"), reading: record }),
  v.object({
    type: v.literal("appointment"),
    careType: v.string(),
    clinic: v.string(),
    startsAt: v.string(),
    reason: v.string(),
  }),
  v.object({ type: v.literal("task"), title: v.string(), dueAt: v.string() }),
);

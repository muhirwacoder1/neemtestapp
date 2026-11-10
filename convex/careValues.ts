import { v } from "convex/values";
export const risk = v.union(
  v.literal("unassessed"),
  v.literal("low"),
  v.literal("moderate"),
  v.literal("high"),
);
export const priority = v.union(
  v.literal("routine"),
  v.literal("review"),
  v.literal("urgent"),
);
export const history = v.object({
  complaint: v.string(),
  presentingHistory: v.string(),
  medicalHistory: v.string(),
  medications: v.string(),
  allergies: v.string(),
  socialHistory: v.string(),
  footExamination: v.string(),
  assessment: v.string(),
  plan: v.string(),
  risk,
  rationale: v.string(),
  priority,
  consentRecorded: v.boolean(),
});
export const encounterFields = {
  profileId: v.id("profiles"),
  clinicianId: v.id("clinicians"),
  authorName: v.optional(v.string()),
  history,
  state: v.union(v.literal("draft"), v.literal("signed")),
  revision: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  signedAt: v.optional(v.number()),
};
export const invoiceFields = {
  profileId: v.id("profiles"),
  createdBy: v.id("users"),
  clinicianId: v.optional(v.id("clinicians")),
  description: v.string(),
  amountRwf: v.number(),
  dueAt: v.number(),
  createdAt: v.number(),
  state: v.union(v.literal("issued"), v.literal("paid"), v.literal("void")),
  paidAt: v.optional(v.number()),
  activePaymentId: v.optional(v.id("mobileMoneyPayments")),
};
export const paymentFields = {
  invoiceId: v.id("careInvoices"),
  profileId: v.id("profiles"),
  payerId: v.id("users"),
  depositId: v.string(),
  amountRwf: v.number(),
  provider: v.string(),
  phone: v.string(),
  state: v.union(
    v.literal("pending"),
    v.literal("uncertain"),
    v.literal("failed"),
    v.literal("completed"),
    v.literal("review"),
  ),
  createdAt: v.number(),
  checkedAt: v.optional(v.number()),
};
export const invoiceValue = v.object({
  _id: v.id("careInvoices"),
  _creationTime: v.number(),
  ...invoiceFields,
});
export const encounterValue = v.object({
  _id: v.id("clinicalEncounters"),
  _creationTime: v.number(),
  ...encounterFields,
});
export const patientSummary = v.object({
  id: v.id("profiles"),
  name: v.string(),
  risk,
  priority: v.optional(priority),
  assessedAt: v.optional(v.number()),
  disabled: v.boolean(),
});
export const clinicianValue = v.object({
  id: v.id("clinicians"),
  name: v.string(),
  specialty: v.string(),
  timezone: v.string(),
  active: v.boolean(),
});

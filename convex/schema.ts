import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  metric,
  preferences,
  pendingPayload,
  sensor,
  profileDetails,
} from "./values";

import {
  risk,
  priority,
  encounterFields,
  invoiceFields,
  paymentFields,
} from "./careValues";
export default defineSchema({
  careAssignments: defineTable({
    profileId: v.id("profiles"),
    clinicianId: v.id("clinicians"),
    active: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_profile_clinician", ["profileId", "clinicianId"])
    .index("by_clinician_active", ["clinicianId", "active"])
    .index("by_profile", ["profileId"]),
  careCases: defineTable({
    profileId: v.id("profiles"),
    risk,
    priority,
    rationale: v.string(),
    updatedAt: v.number(),
    encounterId: v.id("clinicalEncounters"),
  })
    .index("by_profile", ["profileId"])
    .index("by_priority", ["priority", "updatedAt"])
    .index("by_risk", ["risk", "updatedAt"]),
  clinicalEncounters: defineTable(encounterFields).index("by_profile", [
    "profileId",
    "updatedAt",
  ]),
  careInvoices: defineTable(invoiceFields)
    .index("by_profile", ["profileId", "createdAt"])
    .index("by_state", ["state", "createdAt"])
    .index("by_clinician", ["clinicianId", "createdAt"]),
  mobileMoneyPayments: defineTable(paymentFields)
    .index("by_deposit", ["depositId"])
    .index("by_payer_created", ["payerId", "createdAt"]),
  careAudit: defineTable({
    actor: v.id("users"),
    action: v.string(),
    entityId: v.string(),
    profileId: v.optional(v.id("profiles")),
    at: v.number(),
  }).index("by_at", ["at"]),
  insoleRegistry: defineTable({
    hardwareId: v.string(),
    name: v.string(),
    state: v.union(
      v.literal("available"),
      v.literal("assigned"),
      v.literal("retired"),
    ),
    profileId: v.optional(v.id("profiles")),
    deviceId: v.optional(v.id("devices")),
    createdAt: v.number(),
  })
    .index("by_hardware", ["hardwareId"])
    .index("by_profile", ["profileId"]),
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    disabled: v.optional(v.boolean()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkId", ["clerkId"]),
  profiles: defineTable({
    owner: v.id("users"),
    name: v.string(),
    birthDate: v.optional(v.string()),
    details: v.optional(profileDetails),
    onboardedAt: v.optional(v.number()),
    preferences,
    bookmarks: v.array(v.string()),
    readProgress: v.record(v.string(), v.boolean()),
  })
    .index("by_owner", ["owner"])
    .searchIndex("search_name", { searchField: "name" }),
  memberships: defineTable({
    profileId: v.id("profiles"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  })
    .index("by_userId", ["userId"])
    .index("by_profileId_and_userId", ["profileId", "userId"]),
  readings: defineTable({
    profileId: v.id("profiles"),
    externalId: v.string(),
    kind: metric,
    value: v.number(),
    secondary: v.optional(v.number()),
    height: v.optional(v.number()),
    at: v.string(),
    context: v.string(),
    source: v.union(v.literal("manual"), v.literal("device")),
  })
    .index("by_profileId_and_at", ["profileId", "at"])
    .index("by_profileId_and_externalId", ["profileId", "externalId"]),
  tasks: defineTable({
    profileId: v.id("profiles"),
    externalId: v.string(),
    title: v.string(),
    dueAt: v.string(),
    completedAt: v.optional(v.string()),
    reminderId: v.optional(v.string()),
  })
    .index("by_profileId_and_dueAt", ["profileId", "dueAt"])
    .index("by_profileId_and_externalId", ["profileId", "externalId"]),
  devices: defineTable({
    profileId: v.id("profiles"),
    hardwareId: v.string(),
    name: v.string(),
    linkedAt: v.number(),
    active: v.optional(v.boolean()),
  })
    .index("by_hardwareId", ["hardwareId"])
    .index("by_profileId", ["profileId"]),
  sensorFrames: defineTable({
    profileId: v.id("profiles"),
    deviceId: v.id("devices"),
    side: v.union(v.literal("left"), v.literal("right")),
    sensors: v.array(sensor),
    receivedAt: v.string(),
    sequence: v.string(),
  })
    .index("by_profileId_and_receivedAt", ["profileId", "receivedAt"])
    .index("by_deviceId_and_sequence", ["deviceId", "sequence"]),
  alerts: defineTable({
    profileId: v.id("profiles"),
    level: v.union(v.literal("review"), v.literal("contact_care_team")),
    reason: v.string(),
    ruleVersion: v.string(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("clinicians")),
    reviewNote: v.optional(v.string()),
  })
    .index("by_profileId", ["profileId"])
    .index("by_reviewed", ["reviewedAt"]),
  conversations: defineTable({
    profileId: v.id("profiles"),
    userId: v.id("users"),
    agentThreadId: v.string(),
    title: v.string(),
    updatedAt: v.number(),
    generating: v.boolean(),
    error: v.optional(v.string()),
    requestId: v.optional(v.string()),
    generationStartedAt: v.optional(v.number()),
  }).index("by_userId_and_profileId_and_updatedAt", [
    "userId",
    "profileId",
    "updatedAt",
  ]),
  pendingActions: defineTable({
    conversationId: v.id("conversations"),
    profileId: v.id("profiles"),
    userId: v.id("users"),
    payload: pendingPayload,
    state: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("dismissed"),
    ),
    expiresAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),
  appointments: defineTable({
    profileId: v.id("profiles"),
    careType: v.string(),
    clinic: v.string(),
    startsAt: v.string(),
    reason: v.string(),
    state: v.union(v.literal("requested"), v.literal("cancelled")),
    actionId: v.id("pendingActions"),
  })
    .index("by_profileId_and_startsAt", ["profileId", "startsAt"])
    .index("by_actionId", ["actionId"]),
  clinicians: defineTable({
    clerkId: v.string(),
    name: v.string(),
    specialty: v.string(),
    timezone: v.string(),
    active: v.boolean(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_active", ["active"]),
  consultationSlots: defineTable({
    clinicianId: v.id("clinicians"),
    startsAt: v.number(),
    endsAt: v.number(),
    state: v.union(v.literal("open"), v.literal("booked"), v.literal("closed")),
    consultationId: v.optional(v.id("consultations")),
  }).index("by_clinicianId_and_startsAt", ["clinicianId", "startsAt"]),
  consultations: defineTable({
    profileId: v.id("profiles"),
    bookedBy: v.id("users"),
    clinicianId: v.id("clinicians"),
    slotId: v.id("consultationSlots"),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.string(),
    state: v.union(
      v.literal("booked"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    budgetPeriod: v.optional(v.string()),
    lastJoinAt: v.optional(v.number()),
    joinAttempts: v.optional(v.record(v.string(), v.number())),
  })
    .index("by_profileId_and_startsAt", ["profileId", "startsAt"])
    .index("by_clinicianId_and_startsAt", ["clinicianId", "startsAt"])
    .index("by_bookedBy_and_startsAt", ["bookedBy", "startsAt"])
    .index("by_startsAt", ["startsAt"]),
  videoUsage: defineTable({
    period: v.string(),
    reservedMinutes: v.number(),
  }).index("by_period", ["period"]),
  aiUsage: defineTable({
    userId: v.id("users"),
    day: v.string(),
    count: v.number(),
  }).index("by_userId_and_day", ["userId", "day"]),
  aiRequests: defineTable({
    conversationId: v.id("conversations"),
    requestId: v.string(),
    model: v.optional(v.string()),
    routeSource: v.optional(
      v.union(v.literal("rules"), v.literal("decision"), v.literal("fallback")),
    ),
    state: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
  }).index("by_conversationId_and_requestId", ["conversationId", "requestId"]),
  aiBudgets: defineTable({
    period: v.string(),
    reservedMicroUsd: v.number(),
    calls: v.number(),
  }).index("by_period", ["period"]),
  aiCalls: defineTable({
    model: v.string(),
    inputBytes: v.number(),
    outputTokens: v.number(),
    reservedMicroUsd: v.number(),
    state: v.union(
      v.literal("reserved"),
      v.literal("accepted"),
      v.literal("failed"),
    ),
    status: v.optional(v.number()),
  }),
  subscriptions: defineTable({
    userId: v.id("users"),
    active: v.boolean(),
    expiresAt: v.number(),
    checkedAt: v.number(),
  }).index("by_userId", ["userId"]),
  knowledgeDocs: defineTable({
    title: v.string(),
    author: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    state: v.union(
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("indexing"),
      v.literal("ready"),
      v.literal("failed"),
      v.literal("deleting"),
    ),
    totalChunks: v.number(),
    indexedChunks: v.number(),
    error: v.optional(v.string()),
    model: v.string(),
    uploadedBy: v.id("users"),
  }).index("by_state", ["state"]),
  knowledgeChunks: defineTable({
    docId: v.id("knowledgeDocs"),
    ordinal: v.number(),
    page: v.number(),
    text: v.string(),
    embedding: v.optional(v.array(v.float64())),
    published: v.boolean(),
  })
    .index("by_docId_and_ordinal", ["docId", "ordinal"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["published"],
    }),
});

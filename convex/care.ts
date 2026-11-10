import { v, ConvexError } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { query, mutation } from "./_generated/server";
import {
  careRole,
  careAdmin,
  careStaff,
  carePatient,
  audit,
  clean,
} from "./careAccess";
import { profileDetails } from "./values";
import {
  patientSummary,
  clinicianValue,
  encounterValue,
  history,
} from "./careValues";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
const page = paginationResultValidator;
async function summary(ctx: QueryCtx, p: Doc<"profiles">) {
  const [c, u] = await Promise.all([
    ctx.db
      .query("careCases")
      .withIndex("by_profile", (q) => q.eq("profileId", p._id))
      .unique(),
    ctx.db.get(p.owner),
  ]);
  return {
    id: p._id,
    name: p.name,
    risk: c?.risk ?? ("unassessed" as const),
    disabled: !!u?.disabled,
    ...(c ? { priority: c.priority, assessedAt: c.updatedAt } : {}),
  };
}
export const permissions = query({
  args: {},
  returns: v.object({
    administrator: v.boolean(),
    clinician: v.boolean(),
    clinicianId: v.optional(v.id("clinicians")),
  }),
  handler: async (ctx) => {
    const r = await careRole(ctx);
    return {
      administrator: r.administrator,
      clinician: !!r.clinician,
      ...(r.clinician ? { clinicianId: r.clinician._id } : {}),
    };
  },
});
export const patients = query({
  args: { paginationOpts: paginationOptsValidator, search: v.string() },
  returns: page(patientSummary),
  handler: async (ctx, args) => {
    const r = await careStaff(ctx);
    if (r.administrator) {
      const results = args.search.trim()
        ? await ctx.db
            .query("profiles")
            .withSearchIndex("search_name", (q) =>
              q.search("name", args.search.trim().slice(0, 80)),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("profiles")
            .order("desc")
            .paginate(args.paginationOpts);
      return {
        ...results,
        page: await Promise.all(results.page.map((p) => summary(ctx, p))),
      };
    }
    const results = await ctx.db
      .query("careAssignments")
      .withIndex("by_clinician_active", (q) =>
        q.eq("clinicianId", r.clinician!._id).eq("active", true),
      )
      .paginate(args.paginationOpts);
    const profiles = await Promise.all(
      results.page.map((a) => ctx.db.get(a.profileId)),
    );
    return {
      ...results,
      page: await Promise.all(
        profiles
          .filter((p): p is Doc<"profiles"> => !!p)
          .map((p) => summary(ctx, p)),
      ),
    };
  },
});
export const riskQueue = query({
  args: {
    filter: v.union(
      v.literal("high"),
      v.literal("urgent"),
      v.literal("review"),
      v.literal("routine"),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: page(patientSummary),
  handler: async (ctx, args) => {
    await careAdmin(ctx);
    const results =
      args.filter === "high"
        ? await ctx.db
            .query("careCases")
            .withIndex("by_risk", (q) => q.eq("risk", "high"))
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("careCases")
            .withIndex("by_priority", (q) =>
              q.eq("priority", args.filter as "routine" | "review" | "urgent"),
            )
            .order("desc")
            .paginate(args.paginationOpts);
    const profiles = await Promise.all(
      results.page.map((c) => ctx.db.get(c.profileId)),
    );
    return {
      ...results,
      page: await Promise.all(
        profiles
          .filter((p): p is Doc<"profiles"> => !!p)
          .map((p) => summary(ctx, p)),
      ),
    };
  },
});
export const clinicians = query({
  args: {},
  returns: v.array(clinicianValue),
  handler: async (ctx) => {
    await careStaff(ctx);
    return (await ctx.db.query("clinicians").take(100)).map((c) => ({
      id: c._id,
      name: c.name,
      specialty: c.specialty,
      timezone: c.timezone,
      active: c.active,
    }));
  },
});
export const accounts = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: page(
    v.object({
      id: v.id("users"),
      name: v.string(),
      email: v.optional(v.string()),
      disabled: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await careAdmin(ctx);
    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        disabled: !!u.disabled,
      })),
    };
  },
});
export const saveClinician = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    specialty: v.string(),
    timezone: v.string(),
    active: v.boolean(),
  },
  returns: v.id("clinicians"),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx),
      target = await ctx.db.get(args.userId);
    if (!target || target.disabled)
      throw new ConvexError("Choose an active registered Neem account.");
    const name = clean(args.name, 100),
      specialty = clean(args.specialty, 100),
      timezone = clean(args.timezone, 80);
    if (!name || !specialty)
      throw new ConvexError("Name and specialty are required.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new ConvexError("Enter a valid timezone, such as Africa/Kigali.");
    }
    const existing = await ctx.db
      .query("clinicians")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", target.clerkId))
      .unique();
    const values = {
      clerkId: target.clerkId,
      name,
      specialty,
      timezone,
      active: args.active,
    };
    const id = existing
      ? existing._id
      : await ctx.db.insert("clinicians", values);
    if (existing) await ctx.db.patch(id, values);
    await audit(
      ctx,
      user._id,
      args.active ? "clinician.enabled" : "clinician.disabled",
      id,
    );
    return id;
  },
});
export const setClinicianActive = mutation({
  args: { id: v.id("clinicians"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx);
    if (!(await ctx.db.get(args.id)))
      throw new ConvexError("Clinician unavailable.");
    await ctx.db.patch(args.id, { active: args.active });
    await audit(ctx, user._id, "clinician.access_changed", args.id);
    return null;
  },
});
export const assign = mutation({
  args: {
    profileId: v.id("profiles"),
    clinicianId: v.id("clinicians"),
    active: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx);
    if (!(await ctx.db.get(args.profileId)))
      throw new ConvexError("Patient unavailable.");
    const c = await ctx.db.get(args.clinicianId);
    if (!c || (!c.active && args.active))
      throw new ConvexError("Choose an active clinician.");
    const row = await ctx.db
      .query("careAssignments")
      .withIndex("by_profile_clinician", (q) =>
        q.eq("profileId", args.profileId).eq("clinicianId", args.clinicianId),
      )
      .unique();
    if (row)
      await ctx.db.patch(row._id, {
        active: args.active,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("careAssignments", {
        ...args,
        updatedAt: Date.now(),
      });
    await audit(
      ctx,
      user._id,
      args.active ? "patient.assigned" : "patient.unassigned",
      args.clinicianId,
      args.profileId,
    );
    return null;
  },
});
export const patient = query({
  args: { profileId: v.id("profiles") },
  returns: v.object({
    summary: patientSummary,
    birthDate: v.optional(v.string()),
    details: v.optional(profileDetails),
    assignments: v.array(
      v.object({
        id: v.id("clinicians"),
        name: v.string(),
        active: v.boolean(),
      }),
    ),
    readings: v.array(
      v.object({
        kind: v.string(),
        value: v.number(),
        at: v.string(),
        source: v.string(),
      }),
    ),
    alerts: v.array(
      v.object({
        id: v.id("alerts"),
        reason: v.string(),
        level: v.string(),
        at: v.number(),
        reviewedAt: v.optional(v.number()),
        reviewNote: v.optional(v.string()),
      }),
    ),
    devices: v.array(
      v.object({
        id: v.id("devices"),
        name: v.string(),
        hardwareId: v.string(),
        active: v.boolean(),
      }),
    ),
    riskRationale: v.optional(v.string()),
  }),
  handler: async (ctx, { profileId }) => {
    const { profile } = await carePatient(ctx, profileId);
    const [assignments, readings, alerts, devices, caseRow] = await Promise.all(
      [
        ctx.db
          .query("careAssignments")
          .withIndex("by_profile", (q) => q.eq("profileId", profileId))
          .take(100),
        ctx.db
          .query("readings")
          .withIndex("by_profileId_and_at", (q) => q.eq("profileId", profileId))
          .order("desc")
          .take(30),
        ctx.db
          .query("alerts")
          .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
          .order("desc")
          .take(30),
        ctx.db
          .query("devices")
          .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
          .take(30),
        ctx.db
          .query("careCases")
          .withIndex("by_profile", (q) => q.eq("profileId", profileId))
          .unique(),
      ],
    );
    return {
      summary: await summary(ctx, profile),
      birthDate: profile.birthDate,
      details: profile.details,
      assignments: (
        await Promise.all(
          assignments.map(async (a) => {
            const c = await ctx.db.get(a.clinicianId);
            return c ? { id: c._id, name: c.name, active: a.active } : null;
          }),
        )
      ).filter((a): a is NonNullable<typeof a> => !!a),
      readings: readings.map((r) => ({
        kind: r.kind,
        value: r.value,
        at: r.at,
        source: r.source,
      })),
      alerts: alerts.map((a) => ({
        id: a._id,
        reason: a.reason,
        level: a.level,
        at: a._creationTime,
        reviewedAt: a.reviewedAt,
        reviewNote: a.reviewNote,
      })),
      devices: devices.map((d) => ({
        id: d._id,
        name: d.name,
        hardwareId: d.hardwareId,
        active: d.active !== false,
      })),
      riskRationale: caseRow?.rationale,
    };
  },
});
export const renamePatient = mutation({
  args: { profileId: v.id("profiles"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx);
    if (!(await ctx.db.get(args.profileId)))
      throw new ConvexError("Patient unavailable.");
    const name = clean(args.name, 60);
    if (!name) throw new ConvexError("Name required.");
    await ctx.db.patch(args.profileId, { name });
    await audit(
      ctx,
      user._id,
      "patient.name_updated",
      args.profileId,
      args.profileId,
    );
    return null;
  },
});
export const suspend = mutation({
  args: { profileId: v.id("profiles"), disabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await careAdmin(ctx),
      p = await ctx.db.get(args.profileId);
    if (!p) throw new ConvexError("Patient unavailable.");
    const target = await ctx.db.get(p.owner);
    if (!target) throw new ConvexError("Account unavailable.");
    const admins = (process.env.NEEM_CARE_ADMIN_CLERK_IDS || "")
      .split(",")
      .map((s: string) => s.trim());
    if (admins.includes(target.clerkId))
      throw new ConvexError(
        "Administrator access must be managed by the deployment operator.",
      );
    await ctx.db.patch(target._id, { disabled: args.disabled });
    if (args.disabled) {
      const clinician = await ctx.db
        .query("clinicians")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", target.clerkId))
        .unique();
      if (clinician?.active)
        await ctx.db.patch(clinician._id, { active: false });
    }
    await audit(
      ctx,
      user._id,
      args.disabled ? "account.suspended" : "account.restored",
      target._id,
      p._id,
    );
    return null;
  },
});
export const encounters = query({
  args: { profileId: v.id("profiles") },
  returns: v.array(encounterValue),
  handler: async (ctx, { profileId }) => {
    const r = await carePatient(ctx, profileId);
    const rows = await ctx.db
      .query("clinicalEncounters")
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .order("desc")
      .take(40);
    return rows.filter(
      (e) => e.state === "signed" || e.clinicianId === r.clinician?._id,
    );
  },
});
export const saveHistory = mutation({
  args: {
    profileId: v.id("profiles"),
    id: v.optional(v.id("clinicalEncounters")),
    revision: v.optional(v.number()),
    history,
    sign: v.boolean(),
  },
  returns: v.id("clinicalEncounters"),
  handler: async (ctx, args) => {
    const r = await carePatient(ctx, args.profileId, true);
    const h = { ...args.history };
    for (const key of Object.keys(h) as (keyof typeof h)[]) {
      if (typeof h[key] === "string") clean(h[key] as string);
    }
    if (
      args.sign &&
      (!h.consentRecorded ||
        !h.complaint.trim() ||
        !h.assessment.trim() ||
        !h.plan.trim() ||
        (h.risk !== "unassessed" && !h.rationale.trim()))
    )
      throw new ConvexError(
        "Before signing, record consent, complaint, assessment, plan, and the risk rationale.",
      );
    const existing = args.id ? await ctx.db.get(args.id) : null;
    if (
      args.id &&
      (!existing ||
        existing.profileId !== args.profileId ||
        existing.clinicianId !== r.clinician!._id)
    )
      throw new ConvexError("History unavailable.");
    if (
      existing &&
      (existing.state === "signed" || existing.revision !== args.revision)
    )
      throw new ConvexError(
        "This record is signed or has changed. Reload before editing.",
      );
    const now = Date.now();
    const values = {
      profileId: args.profileId,
      clinicianId: r.clinician!._id,
      authorName: r.clinician!.name,
      history: h,
      state: args.sign ? ("signed" as const) : ("draft" as const),
      revision: (existing?.revision ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(args.sign ? { signedAt: now } : {}),
    };
    const id = existing
      ? existing._id
      : await ctx.db.insert("clinicalEncounters", values);
    if (existing) await ctx.db.patch(id, values);
    if (args.sign) {
      const current = await ctx.db
        .query("careCases")
        .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
        .unique();
      const c = {
        profileId: args.profileId,
        risk: h.risk,
        priority: h.priority,
        rationale: clean(h.rationale),
        updatedAt: now,
        encounterId: id,
      };
      if (current) await ctx.db.patch(current._id, c);
      else await ctx.db.insert("careCases", c);
    }
    await audit(
      ctx,
      r.user._id,
      args.sign ? "history.signed" : "history.draft_saved",
      id,
      args.profileId,
    );
    return id;
  },
});
export const reviewAlert = mutation({
  args: { id: v.id("alerts"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.id);
    if (!a) throw new ConvexError("Alert unavailable.");
    const r = await carePatient(ctx, a.profileId, true);
    const note = clean(args.note, 1000);
    if (!note) throw new ConvexError("Record your review.");
    await ctx.db.patch(a._id, {
      reviewedAt: Date.now(),
      reviewedBy: r.clinician!._id,
      reviewNote: note,
    });
    await audit(ctx, r.user._id, "alert.reviewed", a._id, a.profileId);
    return null;
  },
});
export const activity = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: page(
    v.object({
      id: v.id("careAudit"),
      actor: v.string(),
      action: v.string(),
      at: v.number(),
      entityId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await careAdmin(ctx);
    const results = await ctx.db
      .query("careAudit")
      .withIndex("by_at")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...results,
      page: await Promise.all(
        results.page.map(async (a) => ({
          id: a._id,
          actor: (await ctx.db.get(a.actor))?.name ?? "Care team",
          action: a.action,
          at: a.at,
          entityId: a.entityId,
        })),
      ),
    };
  },
});
export const alertQueue = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: page(
    v.object({
      id: v.id("alerts"),
      profileId: v.id("profiles"),
      patient: v.string(),
      reason: v.string(),
      level: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await careAdmin(ctx);
    const rows = await ctx.db
      .query("alerts")
      .withIndex("by_reviewed", (q) => q.eq("reviewedAt", undefined))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...rows,
      page: await Promise.all(
        rows.page.map(async (a) => ({
          id: a._id,
          profileId: a.profileId,
          patient: (await ctx.db.get(a.profileId))?.name ?? "Patient",
          reason: a.reason,
          level: a.level,
          at: a._creationTime,
        })),
      ),
    };
  },
});

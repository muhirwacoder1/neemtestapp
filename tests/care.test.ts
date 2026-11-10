import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const paginationOpts = { numItems: 20, cursor: null };
const history = {
  complaint: "Test complaint",
  presentingHistory: "Test only",
  medicalHistory: "Not recorded",
  medications: "Not recorded",
  allergies: "Not recorded",
  socialHistory: "Not recorded",
  footExamination: "Test examination",
  assessment: "Test assessment",
  plan: "Test follow up",
  risk: "low" as const,
  rationale: "Test clinician assessment",
  priority: "routine" as const,
  consentRecorded: true,
};
async function setup() {
  const t = convexTest(schema, modules);
  const admin = t.withIdentity({
      subject: "user_admin",
      issuer: "https://clerk.test",
      name: "Administrator",
    }),
    patient = t.withIdentity({
      subject: "user_patient",
      issuer: "https://clerk.test",
      name: "Patient",
    }),
    other = t.withIdentity({
      subject: "user_other",
      issuer: "https://clerk.test",
      name: "Other",
    }),
    clinician = t.withIdentity({
      subject: "user_clinician",
      issuer: "https://clerk.test",
      name: "Clinician",
    });
  await admin.mutation(api.profiles.ensure, {});
  const profileId = await patient.mutation(api.profiles.ensure, {}),
    otherProfile = await other.mutation(api.profiles.ensure, {});
  await clinician.mutation(api.profiles.ensure, {});
  const clinicianUser = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", "user_clinician"))
      .unique(),
  );
  const clinicianId = await admin.mutation(api.care.saveClinician, {
    userId: clinicianUser!._id,
    name: "Test Clinician",
    specialty: "Test foot care",
    timezone: "Africa/Kigali",
    active: true,
  });
  return {
    t,
    admin,
    patient,
    other,
    clinician,
    profileId,
    otherProfile,
    clinicianId,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T08:00:00Z"));
  vi.stubEnv("NEEM_CARE_ADMIN_CLERK_IDS", "user_admin");
  vi.stubEnv("DAILY_API_KEY", "test-only");
  vi.stubEnv("DAILY_VIDEO_ENABLED", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("care access and medical records", () => {
  it("requires staff roles and never accepts an email as administrator identity", async () => {
    const s = await setup();
    await expect(
      s.patient.query(api.care.patients, { paginationOpts, search: "" }),
    ).rejects.toThrow(/Care team/);
    await expect(
      s.patient.mutation(api.care.saveClinician, {
        userId: await s.t.run(
          async (ctx) => (await ctx.db.query("users").first())!._id,
        ),
        name: "No",
        specialty: "No",
        timezone: "Africa/Kigali",
        active: true,
      }),
    ).rejects.toThrow(/Administrator/);
    const forged = s.t.withIdentity({
      subject: "user_impostor",
      issuer: "https://clerk.test",
      email: "muhirwaalex7@gmail.com",
      emailVerified: true,
    });
    await forged.mutation(api.profiles.ensure, {});
    expect((await forged.query(api.care.permissions, {})).administrator).toBe(
      false,
    );
    expect((await s.admin.query(api.care.permissions, {})).administrator).toBe(
      true,
    );
  });
  it("revokes all assigned patient reads when assignment or clinician access is disabled", async () => {
    const s = await setup();
    await expect(
      s.clinician.query(api.care.patient, { profileId: s.profileId }),
    ).rejects.toThrow(/not assigned/);
    await s.admin.mutation(api.care.assign, {
      profileId: s.profileId,
      clinicianId: s.clinicianId,
      active: true,
    });
    expect(
      (
        await s.clinician.query(api.care.patients, {
          paginationOpts,
          search: "",
        })
      ).page.map((p) => p.id),
    ).toEqual([s.profileId]);
    await expect(
      s.clinician.query(api.care.patient, { profileId: s.otherProfile }),
    ).rejects.toThrow(/not assigned/);
    await s.admin.mutation(api.care.assign, {
      profileId: s.profileId,
      clinicianId: s.clinicianId,
      active: false,
    });
    await expect(
      s.clinician.query(api.care.encounters, { profileId: s.profileId }),
    ).rejects.toThrow(/not assigned/);
    await s.admin.mutation(api.care.setClinicianActive, {
      id: s.clinicianId,
      active: false,
    });
    expect((await s.clinician.query(api.care.permissions, {})).clinician).toBe(
      false,
    );
  });
  it("starts unassessed, preserves signed history, rejects stale edits and audits changes", async () => {
    const s = await setup();
    expect(
      (await s.admin.query(api.care.patient, { profileId: s.profileId }))
        .summary.risk,
    ).toBe("unassessed");
    await expect(
      s.admin.mutation(api.care.saveHistory, {
        profileId: s.profileId,
        history,
        sign: true,
      }),
    ).rejects.toThrow(/not assigned/);
    await s.admin.mutation(api.care.assign, {
      profileId: s.profileId,
      clinicianId: s.clinicianId,
      active: true,
    });
    const id = await s.clinician.mutation(api.care.saveHistory, {
      profileId: s.profileId,
      history,
      sign: false,
    });
    await expect(
      s.clinician.mutation(api.care.saveHistory, {
        profileId: s.profileId,
        id,
        revision: 0,
        history,
        sign: false,
      }),
    ).rejects.toThrow(/changed/);
    await expect(
      s.clinician.mutation(api.care.saveHistory, {
        profileId: s.profileId,
        id,
        revision: 1,
        history: { ...history, consentRecorded: false },
        sign: true,
      }),
    ).rejects.toThrow(/consent/);
    await s.clinician.mutation(api.care.saveHistory, {
      profileId: s.profileId,
      id,
      revision: 1,
      history: { ...history, risk: "high", priority: "review" },
      sign: true,
    });
    await expect(
      s.clinician.mutation(api.care.saveHistory, {
        profileId: s.profileId,
        id,
        revision: 2,
        history,
        sign: false,
      }),
    ).rejects.toThrow(/signed/);
    expect(
      (
        await s.admin.query(api.care.riskQueue, {
          paginationOpts,
          filter: "high",
        })
      ).page.map((p) => p.id),
    ).toEqual([s.profileId]);
    expect(
      (await s.admin.query(api.care.activity, { paginationOpts })).page.some(
        (r) => r.action === "history.signed",
      ),
    ).toBe(true);
    await expect(
      s.other.query(api.care.encounters, { profileId: s.profileId }),
    ).rejects.toThrow();
  });
  it("suspends backend access without deleting medical records and protects administrator accounts", async () => {
    const s = await setup();
    await s.admin.mutation(api.care.suspend, {
      profileId: s.profileId,
      disabled: true,
    });
    await expect(s.patient.mutation(api.profiles.ensure, {})).rejects.toThrow(
      /suspended/,
    );
    await expect(s.patient.query(api.profiles.list, {})).rejects.toThrow(
      /suspended/,
    );
    expect(await s.t.run((ctx) => ctx.db.get(s.profileId))).toBeTruthy();
    const adminProfile = await s.admin.mutation(api.profiles.ensure, {});
    await expect(
      s.admin.mutation(api.care.suspend, {
        profileId: adminProfile,
        disabled: true,
      }),
    ).rejects.toThrow(/deployment operator/);
    await s.admin.mutation(api.care.suspend, {
      profileId: s.profileId,
      disabled: false,
    });
    expect(await s.patient.query(api.profiles.list, {})).toHaveLength(1);
  });
  it("limits alert review to an assigned clinician and removes reviewed alerts from the queue", async () => {
    const s = await setup();
    const id = await s.t.run((ctx) =>
      ctx.db.insert("alerts", {
        profileId: s.profileId,
        level: "review",
        reason: "Test recorded alert",
        ruleVersion: "test",
      }),
    );
    expect(
      (await s.admin.query(api.care.alertQueue, { paginationOpts })).page,
    ).toHaveLength(1);
    await expect(
      s.admin.mutation(api.care.reviewAlert, { id, note: "Reviewed" }),
    ).rejects.toThrow(/not assigned/);
    await s.admin.mutation(api.care.assign, {
      profileId: s.profileId,
      clinicianId: s.clinicianId,
      active: true,
    });
    await s.clinician.mutation(api.care.reviewAlert, {
      id,
      note: "Test review",
    });
    expect(
      (await s.admin.query(api.care.alertQueue, { paginationOpts })).page,
    ).toHaveLength(0);
  });
});
describe("insole registration and staff booking", () => {
  it("prevents duplicate registration, cross-patient transfer, and retired device writes", async () => {
    const s = await setup();
    const id = await s.admin.mutation(api.careInsoles.register, {
      hardwareId: "TEST-SERIAL",
      name: "neem",
    });
    await expect(
      s.admin.mutation(api.careInsoles.register, {
        hardwareId: "TEST-SERIAL",
        name: "neem",
      }),
    ).rejects.toThrow(/already registered/);
    await expect(
      s.patient.mutation(api.devices.link, {
        profileId: s.profileId,
        hardwareId: "TEST-SERIAL",
        name: "neem",
      }),
    ).rejects.toThrow(/care team/);
    await s.admin.mutation(api.careInsoles.assign, {
      id,
      profileId: s.profileId,
    });
    await expect(
      s.admin.mutation(api.careInsoles.assign, {
        id,
        profileId: s.otherProfile,
      }),
    ).rejects.toThrow(/transferred/);
    const device = await s.patient.mutation(api.devices.link, {
      profileId: s.profileId,
      hardwareId: "TEST-SERIAL",
      name: "neem",
    });
    await s.admin.mutation(api.careInsoles.retire, { id, retired: true });
    await expect(
      s.patient.mutation(api.devices.link, {
        profileId: s.profileId,
        hardwareId: "TEST-SERIAL",
        name: "neem",
      }),
    ).rejects.toThrow(/retired/);
    await expect(
      s.patient.mutation(api.devices.saveFrame, {
        profileId: s.profileId,
        deviceId: device,
        side: "left",
        sequence: "test",
        receivedAt: new Date().toISOString(),
        sensors: [{ region: "heel", value: 20 }],
      }),
    ).rejects.toThrow();
  });
  it("books on behalf of the patient with patient call permissions, preserves conflicts and supports staff rescheduling", async () => {
    const s = await setup(),
      startsAt = Date.now() + 3600000;
    const slot = await s.clinician.mutation(api.consultations.publishSlot, {
      startsAt,
      durationMinutes: 30,
    });
    const id = await s.admin.mutation(api.careAppointments.book, {
      profileId: s.profileId,
      slotId: slot,
      reason: "Test appointment",
    });
    expect(
      (await s.patient.query(api.consultations.detail, { id }))?.canJoin,
    ).toBe(true);
    expect(await s.admin.query(api.consultations.detail, { id })).toBeNull();
    await expect(
      s.admin.mutation(api.careAppointments.book, {
        profileId: s.otherProfile,
        slotId: slot,
        reason: "",
      }),
    ).rejects.toThrow(/no longer available/);
    await expect(
      s.admin.mutation(api.careAppointments.update, { id, action: "complete" }),
    ).rejects.toThrow(/future/);
    const next = await s.clinician.mutation(api.consultations.publishSlot, {
      startsAt: startsAt + 3600000,
      durationMinutes: 30,
    });
    await s.admin.mutation(api.careAppointments.update, {
      id,
      action: "reschedule",
      slotId: next,
    });
    expect(
      (await s.patient.query(api.consultations.detail, { id }))?.startsAt,
    ).toBe(startsAt + 3600000);
    await s.admin.mutation(api.careAppointments.update, {
      id,
      action: "cancel",
    });
    expect(
      (await s.patient.query(api.consultations.detail, { id }))?.state,
    ).toBe("cancelled");
  });
});
async function billingSetup() {
  const s = await setup();
  const invoiceId = await s.admin.mutation(api.billing.issue, {
    profileId: s.profileId,
    description: "Test consultation",
    amountRwf: 10000,
    dueAt: Date.now() + 86400000,
  });
  return { ...s, invoiceId };
}
const providerConf = {
  signatureConfiguration: { signedRequestsOnly: false },
  countries: [
    {
      country: "RWA",
      providers: [
        {
          provider: "MTN_MOMO_RWA",
          displayName: "MTN",
          currencies: [
            {
              currency: "RWF",
              operationTypes: {
                DEPOSIT: {
                  authType: "PROVIDER_AUTH",
                  minAmount: "100",
                  maxAmount: "1000000",
                },
              },
            },
          ],
        },
      ],
    },
  ],
};
function enablePayments() {
  vi.stubEnv("PAWAPAY_ENVIRONMENT", "production");
  vi.stubEnv("PAWAPAY_CHECKOUT_ENABLED", "true");
  vi.stubEnv("PAWAPAY_API_TOKEN", "test-only-not-a-real-token");
}
describe("RWF invoices and mobile money", () => {
  it("gates checkout, enforces amounts and prevents patient/staff scope escalation", async () => {
    const s = await billingSetup();
    expect((await s.patient.query(api.billing.configuration, {})).enabled).toBe(
      false,
    );
    await expect(
      s.patient.mutation(api.billing.issue, {
        profileId: s.profileId,
        description: "No",
        amountRwf: 1,
        dueAt: Date.now(),
      }),
    ).rejects.toThrow(/Care team/);
    await expect(
      s.admin.mutation(api.billing.issue, {
        profileId: s.profileId,
        description: "No",
        amountRwf: 1.5,
        dueAt: Date.now(),
      }),
    ).rejects.toThrow(/whole RWF/);
    await expect(
      s.other.query(api.billing.invoices, {
        profileId: s.profileId,
        paginationOpts,
      }),
    ).rejects.toThrow(/permission/);
    expect(
      (
        await s.patient.query(api.billing.invoices, {
          profileId: s.profileId,
          paginationOpts,
        })
      ).page[0].invoice.state,
    ).toBe("issued");
    await expect(
      s.patient.mutation(internal.billing.begin, {
        invoiceId: s.invoiceId,
        provider: "MTN_MOMO_RWA",
        phone: "250788123456",
        depositId: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/merchant/);
  });
  it("persists one deposit before requesting payment and only verifies completed matching provider records", async () => {
    const s = await billingSetup();
    enablePayments();
    let postCount = 0;
    let uuid = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        if (_url.includes("active-conf"))
          return new Response(JSON.stringify(providerConf));
        if (options?.method === "POST") {
          postCount++;
          uuid = JSON.parse(options.body as string).depositId;
          return new Response(
            JSON.stringify({ depositId: uuid, status: "ACCEPTED" }),
          );
        }
        return new Response(
          JSON.stringify({
            status: "FOUND",
            data: {
              depositId: uuid,
              status: "COMPLETED",
              amount: "10000",
              currency: "RWF",
              payer: {
                accountDetails: {
                  provider: "MTN_MOMO_RWA",
                  phoneNumber: "250788123456",
                },
              },
            },
          }),
        );
      }),
    );
    const request = {
      invoiceId: s.invoiceId,
      provider: "MTN_MOMO_RWA",
      phone: "0788123456",
      consent: true,
    };
    await s.patient.action(api.mobileMoney.checkout, request);
    await s.patient.action(api.mobileMoney.checkout, request);
    expect(postCount).toBe(1);
    const jobs = await s.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(jobs.filter((job) => job.name.includes("mobileMoney"))).toHaveLength(
      1,
    );
    expect((await s.t.run((ctx) => ctx.db.get(s.invoiceId)))?.state).toBe(
      "issued",
    );
    await expect(
      s.admin.mutation(api.billing.voidInvoice, { id: s.invoiceId }),
    ).rejects.toThrow(/pending/);
    await s.patient.action(api.mobileMoney.refresh, { invoiceId: s.invoiceId });
    expect((await s.t.run((ctx) => ctx.db.get(s.invoiceId)))?.state).toBe(
      "paid",
    );
    await s.patient.action(api.mobileMoney.refresh, { invoiceId: s.invoiceId });
    expect(
      (
        await s.patient.query(api.billing.invoices, {
          profileId: s.profileId,
          paginationOpts,
        })
      ).page[0].paymentState,
    ).toBe("completed");
    expect(
      (await s.admin.query(api.care.activity, { paginationOpts })).page.filter(
        (a) => a.action === "payment.verified",
      ),
    ).toHaveLength(1);
  });
  it("does not mark mismatched, timed-out, or sandbox transactions paid", async () => {
    const s = await billingSetup();
    enablePayments();
    let uuid = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (url.includes("active-conf"))
          return new Response(JSON.stringify(providerConf));
        if (options?.method === "POST") {
          uuid = JSON.parse(options.body as string).depositId;
          throw new Error("network timeout");
        }
        return new Response(
          JSON.stringify({
            status: "FOUND",
            data: {
              depositId: uuid,
              status: "COMPLETED",
              amount: "1",
              currency: "RWF",
              payer: {
                accountDetails: {
                  provider: "MTN_MOMO_RWA",
                  phoneNumber: "250788123456",
                },
              },
            },
          }),
        );
      }),
    );
    await s.patient.action(api.mobileMoney.checkout, {
      invoiceId: s.invoiceId,
      provider: "MTN_MOMO_RWA",
      phone: "0788123456",
      consent: true,
    });
    vi.setSystemTime(Date.now() + 11000);
    await s.patient.action(api.mobileMoney.refresh, { invoiceId: s.invoiceId });
    const invoice = await s.t.run((ctx) => ctx.db.get(s.invoiceId));
    expect(invoice?.state).toBe("issued");
    expect(
      (await s.t.run((ctx) => ctx.db.get(invoice!.activePaymentId!)))?.state,
    ).toBe("review");
    vi.stubEnv("PAWAPAY_ENVIRONMENT", "sandbox");
    expect((await s.patient.query(api.billing.configuration, {})).enabled).toBe(
      false,
    );
  });
  it("limits new payment attempts while preserving one durable verification job per request", async () => {
    const s = await billingSetup();
    enablePayments();
    for (let i = 0; i < 5; i++) {
      const result = await s.patient.mutation(internal.billing.begin, {
        invoiceId: s.invoiceId,
        provider: "MTN_MOMO_RWA",
        phone: "250788123456",
        depositId: crypto.randomUUID(),
      });
      expect(result.created).toBe(true);
      await s.t.mutation(internal.billing.reconcile, {
        id: result.payment._id,
        state: "failed",
      });
      vi.setSystemTime(Date.now() + 11000);
    }
    await expect(
      s.patient.mutation(internal.billing.begin, {
        invoiceId: s.invoiceId,
        provider: "MTN_MOMO_RWA",
        phone: "250788123456",
        depositId: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/five new requests/);
    expect((await s.t.run((ctx) => ctx.db.get(s.invoiceId)))?.state).toBe(
      "issued",
    );
  });
  it("requires consent and authenticates before any external checkout request", async () => {
    const s = await billingSetup();
    enablePayments();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.patient.action(api.mobileMoney.checkout, {
        invoiceId: s.invoiceId,
        provider: "MTN_MOMO_RWA",
        phone: "0788123456",
        consent: false,
      }),
    ).rejects.toThrow(/Confirm/);
    await expect(
      s.other.action(api.mobileMoney.checkout, {
        invoiceId: s.invoiceId,
        provider: "MTN_MOMO_RWA",
        phone: "0788123456",
        consent: true,
      }),
    ).rejects.toThrow(/permission/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { localSlotTime } from "../src/consultations";
const modules = import.meta.glob("../convex/**/*.ts");
const MINUTE = 60_000;
async function setup() {
  const t = convexTest(schema, modules);
  const patient = t.withIdentity({
    subject: "user_patient",
    issuer: "https://clerk.test",
    name: "Test Patient",
  });
  const other = t.withIdentity({
    subject: "user_other",
    issuer: "https://clerk.test",
    name: "Other",
  });
  const clinician = t.withIdentity({
    subject: "user_clinician",
    issuer: "https://clerk.test",
    name: "Test Clinician",
  });
  const profileId = await patient.mutation(api.profiles.ensure, {}),
    otherProfile = await other.mutation(api.profiles.ensure, {});
  await clinician.mutation(api.profiles.ensure, {});
  const clinicianId = await t.mutation(
    internal.consultations.provisionClinician,
    {
      clerkId: "user_clinician",
      name: "Test clinician",
      specialty: "Test care",
      timezone: "Africa/Kigali",
      active: true,
    },
  );
  const startsAt = Date.now() + 30 * MINUTE;
  const slotId = await clinician.mutation(api.consultations.publishSlot, {
    startsAt,
    durationMinutes: 30,
  });
  const visit = () =>
    patient.mutation(api.consultations.book, {
      profileId,
      slotId,
      reason: "Private test note",
    });
  return {
    t,
    patient,
    other,
    clinician,
    profileId,
    otherProfile,
    clinicianId,
    startsAt,
    slotId,
    visit,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T08:00:00Z"));
  vi.stubEnv("DAILY_API_KEY", "test-only-daily-key");
  vi.stubEnv("DAILY_VIDEO_ENABLED", "true");
  vi.stubEnv("DAILY_MONTHLY_PARTICIPANT_MINUTES", "9000");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("private consultations", () => {
  it("requires authentication, real availability and provider configuration", async () => {
    const s = await setup();
    await expect(s.t.query(api.consultations.clinicians, {})).rejects.toThrow(
      /sign in/,
    );
    await expect(
      s.patient.mutation(api.consultations.publishSlot, {
        startsAt: s.startsAt,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/assigned clinician/);
    vi.stubEnv("DAILY_API_KEY", "");
    expect(
      (
        await s.patient.query(api.consultations.configuration, {
          asOf: Date.now(),
        })
      ).enabled,
    ).toBe(false);
    await expect(s.visit()).rejects.toThrow(/being connected/);
    expect(
      await s.patient.query(api.consultations.list, {
        profileId: s.profileId,
        asOf: Date.now(),
      }),
    ).toEqual([]);
  });
  it("prevents overlapping clinician slots and double bookings, and retries idempotently", async () => {
    const s = await setup();
    await expect(
      s.clinician.mutation(api.consultations.publishSlot, {
        startsAt: s.startsAt + MINUTE,
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/overlaps/);
    const id = await s.visit();
    expect(await s.visit()).toBe(id);
    await expect(
      s.other.mutation(api.consultations.book, {
        profileId: s.otherProfile,
        slotId: s.slotId,
        reason: "",
      }),
    ).rejects.toThrow(/no longer available/);
    expect(
      await s.patient.query(api.consultations.slots, {
        clinicianId: s.clinicianId,
        asOf: Date.now(),
      }),
    ).toEqual([]);
    const slots = await s.clinician.query(api.consultations.slots, {
      clinicianId: s.clinicianId,
      asOf: Date.now(),
    });
    expect(slots[0].state).toBe("booked");
  });
  it("denies cross-profile bookings, appointment reads, cancellation and room access", async () => {
    const s = await setup(),
      id = await s.visit();
    await expect(
      s.other.query(api.consultations.list, {
        profileId: s.profileId,
        asOf: Date.now(),
      }),
    ).rejects.toThrow(/permission/);
    expect(await s.other.query(api.consultations.detail, { id })).toBeNull();
    await expect(
      s.other.mutation(api.consultations.cancel, { id }),
    ).rejects.toThrow(/permission/);
    await expect(
      s.other.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/permission/);
    await expect(
      s.other.mutation(api.consultations.book, {
        profileId: s.profileId,
        slotId: s.slotId,
        reason: "",
      }),
    ).rejects.toThrow(/permission/);
    await expect(
      s.patient.query(api.consultations.clinicianVisits, { asOf: Date.now() }),
    ).rejects.toThrow(/assigned clinician/);
    expect(
      (
        await s.clinician.query(api.consultations.clinicianVisits, {
          asOf: Date.now(),
        })
      )[0].reason,
    ).toBe("Private test note");
    expect(
      (await s.patient.query(api.consultations.clinicians, {}))[0],
    ).not.toHaveProperty("clerkId");
  });
  it("moves a booking atomically and releases a cancelled slot", async () => {
    const s = await setup(),
      id = await s.visit();
    const next = await s.clinician.mutation(api.consultations.publishSlot, {
      startsAt: s.startsAt + 60 * MINUTE,
      durationMinutes: 30,
    });
    await s.patient.mutation(api.consultations.reschedule, {
      id,
      slotId: next,
    });
    expect(
      (await s.patient.query(api.consultations.detail, { id }))?.startsAt,
    ).toBe(s.startsAt + 60 * MINUTE);
    expect(
      (
        await s.patient.query(api.consultations.slots, {
          clinicianId: s.clinicianId,
          asOf: Date.now(),
        })
      ).map((v) => v.id),
    ).toEqual([s.slotId]);
    await s.clinician.mutation(api.consultations.cancel, { id });
    expect(
      (await s.patient.query(api.consultations.detail, { id }))?.state,
    ).toBe("cancelled");
    expect(
      await s.patient.query(api.consultations.slots, {
        clinicianId: s.clinicianId,
        asOf: Date.now(),
      }),
    ).toHaveLength(2);
  });
  it("requires explicit consent, enforces the join window and rejects disabled clinicians", async () => {
    const s = await setup(),
      id = await s.visit(),
      fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.patient.action(api.daily.join, { id, consent: false }),
    ).rejects.toThrow(/privacy/);
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/5 minutes/);
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    await s.t.run(async (ctx) => {
      await ctx.db.patch(s.clinicianId, { active: false });
    });
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/no longer available/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("creates private expiring rooms, scopes tokens and sends no medical note or identity", async () => {
    const s = await setup(),
      id = await s.visit();
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    const name = `neem-${id}`;
    const requests: Array<{ url: string; body: any }> = [];
    const fetcher = vi.fn(async (url: string, init: any) => {
      requests.push({ url, body: init.body ? JSON.parse(init.body) : null });
      if (init.method === "GET") return new Response("", { status: 404 });
      if (url.endsWith("/rooms"))
        return Response.json({
          url: `https://neem-test.daily.co/${name}`,
          privacy: "private",
        });
      return Response.json({ token: "short-lived-test-token" });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await s.patient.action(api.daily.join, {
      id,
      consent: true,
    });
    expect(result.token).toBe("short-lived-test-token");
    expect(result.expiresAt).toBe(s.startsAt + 40 * MINUTE);
    const room = requests.find((r) => r.url.endsWith("/rooms"))!.body;
    expect(room.privacy).toBe("private");
    expect(room.properties).toMatchObject({
      max_participants: 2,
      enable_recording: false,
      enable_knocking: false,
      eject_at_room_exp: true,
    });
    const token = requests.find((r) => r.url.endsWith("meeting-tokens"))!.body
      .properties;
    expect(token).toMatchObject({
      room_name: name,
      is_owner: false,
      user_name: "Patient",
      user_id: `${id}-patient`,
      enable_recording_ui: false,
      start_audio_off: true,
      start_video_off: true,
      eject_at_token_exp: true,
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /Private test note|Test Patient|clerk\.test|profileId/,
    );
    expect(
      (
        await s.patient.query(api.consultations.list, {
          profileId: s.profileId,
          asOf: Date.now(),
        })
      )[0],
    ).not.toHaveProperty("token");
  });
  it("reserves both participants including waiting time only once and enforces the free guard", async () => {
    const s = await setup(),
      id = await s.visit();
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    vi.stubEnv("DAILY_MONTHLY_PARTICIPANT_MINUTES", "89");
    await expect(
      s.patient.mutation(internal.consultations.reserveVideo, { id }),
    ).rejects.toThrow(/allowance is full/);
    vi.stubEnv("DAILY_MONTHLY_PARTICIPANT_MINUTES", "90");
    await s.patient.mutation(internal.consultations.reserveVideo, { id });
    await s.clinician.mutation(internal.consultations.reserveVideo, { id });
    expect(
      (
        await s.clinician.query(api.consultations.configuration, {
          asOf: Date.now(),
        })
      ).reservedMinutes,
    ).toBe(90);
    await expect(
      s.patient.mutation(internal.consultations.reserveVideo, { id }),
    ).rejects.toThrow(/wait a moment/);
  });
  it("does not issue a token if cancellation races the provider request", async () => {
    const s = await setup(),
      id = await s.visit();
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("meeting-tokens")) {
          await s.patient.mutation(api.consultations.cancel, { id });
          return Response.json({ token: "must-not-return" });
        }
        return Response.json({
          url: `https://neem-test.daily.co/neem-${id}`,
          privacy: "private",
        });
      }),
    );
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/no longer available/);
  });
  it("rejects untrusted room URLs and allows retries after a provider failure", async () => {
    const s = await setup(),
      id = await s.visit();
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    const fetcher = vi.fn(async () =>
      Response.json({
        url: "https://attacker.example/room",
        privacy: "private",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/could not be verified/);
    vi.setSystemTime(Date.now() + 6000);
    fetcher.mockImplementation(async () => new Response("", { status: 503 }));
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/could not be prepared/);
  });
  it("rejects malformed calendar dates and invalid durations", async () => {
    expect(Number.isNaN(localSlotTime("2026-02-31", "10:00"))).toBe(true);
    expect(Number.isNaN(localSlotTime("2026-11-01", "25:00"))).toBe(true);
    const s = await setup();
    await expect(
      s.clinician.mutation(api.consultations.publishSlot, {
        startsAt: s.startsAt + 60 * MINUTE,
        durationMinutes: 999,
      }),
    ).rejects.toThrow(/Choose a slot/);
  });
  it("revokes a former editor's video access and handles an invalid appointment link", async () => {
    const s = await setup(),
      id = await s.visit();
    await s.t.run(async (ctx) => {
      const visit = await ctx.db.get(id);
      const member = await ctx.db
        .query("memberships")
        .withIndex("by_profileId_and_userId", (q) =>
          q.eq("profileId", s.profileId).eq("userId", visit!.bookedBy),
        )
        .unique();
      await ctx.db.patch(member!._id, { role: "viewer" });
    });
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    await expect(
      s.patient.action(api.daily.join, { id, consent: true }),
    ).rejects.toThrow(/permission/);
    expect(
      await s.patient.query(api.consultations.detail, { id: "invalid-link" }),
    ).toBeNull();
  });
  it("reserves month-boundary call windows against both months", async () => {
    vi.setSystemTime(new Date("2026-10-31T23:20:00Z"));
    const s = await setup(),
      id = await s.visit();
    vi.setSystemTime(s.startsAt - 5 * MINUTE);
    await s.patient.mutation(internal.consultations.reserveVideo, { id });
    const october = await s.clinician.query(api.consultations.configuration, {
      asOf: new Date("2026-10-31T23:59:00Z").getTime(),
    });
    const november = await s.clinician.query(api.consultations.configuration, {
      asOf: new Date("2026-11-01T00:01:00Z").getTime(),
    });
    expect(october.reservedMinutes).toBe(90);
    expect(november.reservedMinutes).toBe(90);
  });
});

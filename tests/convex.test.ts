import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import agent from "@convex-dev/agent/test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  agent.register(t);
  const first = t.withIdentity({
    subject: "user_first",
    issuer: "https://clerk.test",
    name: "First",
  });
  const second = t.withIdentity({
    subject: "user_second",
    issuer: "https://clerk.test",
    name: "Second",
  });
  return { t, first, second };
}
const reading = {
  id: "one",
  kind: "pressure" as const,
  value: 120,
  secondary: 80,
  at: new Date(Date.now() - 60000).toISOString(),
  context: "At rest",
  source: "manual" as const,
};
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("private health records", () => {
  it("creates one empty profile per identity and denies cross-account access", async () => {
    const { t, first, second } = setup();
    const a = await first.mutation(api.profiles.ensure, {}),
      b = await second.mutation(api.profiles.ensure, {});
    expect(await first.mutation(api.profiles.ensure, {})).toBe(a);
    expect((await first.query(api.profiles.list, {})).map((p) => p.id)).toEqual(
      [a],
    );
    expect(
      (await first.query(api.records.dashboard, { profileId: a })).readings,
    ).toEqual([]);
    await expect(
      second.query(api.records.dashboard, { profileId: a }),
    ).rejects.toThrow(/permission/);
    await expect(
      first.mutation(api.records.saveChanges, {
        profileId: b,
        readings: [reading],
        tasks: [],
      }),
    ).rejects.toThrow(/permission/);
    await expect(t.query(api.profiles.list, {})).rejects.toThrow(/sign in/);
  });
  it("deduplicates writes, validates measurements and rolls back invalid batches", async () => {
    const { first } = setup();
    const id = await first.mutation(api.profiles.ensure, {});
    await first.mutation(api.records.saveChanges, {
      profileId: id,
      readings: [reading, reading],
      tasks: [],
    });
    expect(
      (await first.query(api.records.dashboard, { profileId: id })).readings,
    ).toHaveLength(1);
    await expect(
      first.mutation(api.records.saveChanges, {
        profileId: id,
        readings: [{ ...reading, id: "invalid", value: 70, secondary: 90 }],
        tasks: [
          { id: "task", title: "Check feet", dueAt: new Date().toISOString() },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (await first.query(api.records.dashboard, { profileId: id })).tasks,
    ).toHaveLength(0);
    await expect(
      first.mutation(api.records.saveChanges, {
        profileId: id,
        readings: [{ ...reading, source: "device" } as any],
        tasks: [],
      }),
    ).rejects.toThrow();
  });
  it("rejects device identity reuse and cross-profile sensor writes", async () => {
    const { first, second } = setup();
    const a = await first.mutation(api.profiles.ensure, {}),
      b = await second.mutation(api.profiles.ensure, {});
    const d = await first.mutation(api.devices.link, {
      profileId: a,
      hardwareId: "test-insole",
      name: "Test insole",
    });
    await expect(
      second.mutation(api.devices.link, {
        profileId: b,
        hardwareId: "test-insole",
        name: "Test",
      }),
    ).rejects.toThrow(/already linked/);
    const frame = {
      profileId: a,
      deviceId: d,
      side: "left" as const,
      sensors: [{ region: "heel" as const, value: 42 }],
      receivedAt: new Date().toISOString(),
      sequence: "1",
    };
    await first.mutation(api.devices.saveFrame, frame);
    await first.mutation(api.devices.saveFrame, frame);
    expect(
      await first.query(api.devices.history, { profileId: a }),
    ).toHaveLength(1);
    await expect(
      second.mutation(api.devices.saveFrame, { ...frame, profileId: b }),
    ).rejects.toThrow(/does not belong/);
    await expect(
      first.mutation(api.devices.saveFrame, {
        ...frame,
        sequence: "2",
        sensors: [{ region: "heel", value: 101 }],
      }),
    ).rejects.toThrow(/Invalid sensor/);
  });
});
describe("AI and knowledge access", () => {
  it("requires current provider consent and configured OpenRouter access before sending", async () => {
    const { first } = setup();
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const p = await first.mutation(api.profiles.ensure, {}),
      c = await first.mutation(api.ai.create, { profileId: p });
    await expect(
      first.mutation(api.ai.send, {
        threadId: c,
        text: "Hello",
        requestId: "one",
        includeHistory: false,
      }),
    ).rejects.toThrow(/privacy/);
    const d = await first.query(api.records.dashboard, { profileId: p });
    await first.mutation(api.records.saveChanges, {
      profileId: p,
      readings: [],
      tasks: [],
      preferences: {
        ...d.preferences,
        aiConsent: true,
        aiConsentProvider: "openrouter",
      },
    });
    await expect(
      first.mutation(api.ai.send, {
        threadId: c,
        text: "Hello",
        requestId: "one",
        includeHistory: false,
      }),
    ).rejects.toThrow(/being set up/);
  });
  it("requires renewed consent before sharing an existing Lovable conversation with OpenRouter", async () => {
    const { t, first } = setup();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const profileId = await first.mutation(api.profiles.ensure, {});
    const d = await first.query(api.records.dashboard, { profileId });
    await first.mutation(api.records.saveChanges, {
      profileId,
      readings: [],
      tasks: [],
      preferences: { ...d.preferences, aiConsent: true },
    });
    const threadId = await first.mutation(api.ai.create, { profileId });
    await expect(
      first.mutation(api.ai.send, {
        threadId,
        text: "Hello",
        requestId: "renew-consent",
        includeHistory: true,
      }),
    ).rejects.toThrow(/updated AI privacy/);
    expect(
      await t.run((ctx) => ctx.db.query("aiRequests").take(5)),
    ).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("aiUsage").take(5))).toHaveLength(
      0,
    );
  });
  it("isolates messages and requires explicit, idempotent confirmation to save AI proposals", async () => {
    const { t, first, second } = setup();
    const p = await first.mutation(api.profiles.ensure, {});
    await second.mutation(api.profiles.ensure, {});
    const c = await first.mutation(api.ai.create, { profileId: p });
    await expect(
      second.query(api.ai.proposals, { threadId: c }),
    ).rejects.toThrow(/unavailable/);
    const review = await t.run(async (ctx) => {
      const conversation = await ctx.db.get(c);
      return ctx.db.insert("pendingActions", {
        conversationId: c,
        profileId: p,
        userId: conversation!.userId,
        payload: {
          type: "task",
          title: "Inspect feet",
          dueAt: new Date().toISOString(),
        },
        state: "pending",
        expiresAt: Date.now() + 60000,
      });
    });
    expect(
      (await first.query(api.records.dashboard, { profileId: p })).tasks,
    ).toHaveLength(0);
    await expect(
      second.mutation(api.ai.confirm, { id: review, accept: true }),
    ).rejects.toThrow(/unavailable/);
    await first.mutation(api.ai.confirm, { id: review, accept: true });
    await first.mutation(api.ai.confirm, { id: review, accept: true });
    expect(
      (await first.query(api.records.dashboard, { profileId: p })).tasks,
    ).toHaveLength(1);
  });
  it("blocks viewer writes and expired review cards", async () => {
    const { t, first, second } = setup();
    const p = await first.mutation(api.profiles.ensure, {});
    await second.mutation(api.profiles.ensure, {});
    await t.run(async (ctx) => {
      const u = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", "https://clerk.test|user_second"),
        )
        .unique();
      await ctx.db.insert("memberships", {
        profileId: p,
        userId: u!._id,
        role: "viewer",
      });
    });
    await expect(
      second.mutation(api.records.saveChanges, {
        profileId: p,
        readings: [reading],
        tasks: [],
      }),
    ).rejects.toThrow(/permission/);
    const c = await first.mutation(api.ai.create, { profileId: p });
    const review = await t.run(async (ctx) => {
      const conversation = await ctx.db.get(c);
      return ctx.db.insert("pendingActions", {
        conversationId: c,
        profileId: p,
        userId: conversation!.userId,
        payload: { type: "reading", reading },
        state: "pending",
        expiresAt: Date.now() - 1000,
      });
    });
    await expect(
      first.mutation(api.ai.confirm, { id: review, accept: true }),
    ).rejects.toThrow(/expired/);
  });
  it("limits library administration and excludes unfinished books from retrieval", async () => {
    const { t, first } = setup();
    await first.mutation(api.profiles.ensure, {});
    expect(await first.query(api.library.permissions, {})).toEqual({
      admin: false,
    });
    await expect(first.mutation(api.library.uploadUrl, {})).rejects.toThrow(
      /administrators/,
    );
    vi.stubEnv("NEEM_ADMIN_CLERK_IDS", "user_first");
    expect(await first.query(api.library.permissions, {})).toEqual({
      admin: true,
    });
    const chunk = await t.run(async (ctx) => {
      const u = (await ctx.db.query("users").take(1))[0];
      const storageId = await ctx.storage.store(new Blob(["A test book"]));
      const id = await ctx.db.insert("knowledgeDocs", {
        title: "Test book",
        author: "Test",
        storageId,
        fileName: "test.txt",
        contentType: "text/plain",
        state: "indexing",
        totalChunks: 1,
        indexedChunks: 0,
        model: "test",
        uploadedBy: u._id,
      });
      return ctx.db.insert("knowledgeChunks", {
        docId: id,
        ordinal: 0,
        page: 1,
        text: "Test passage",
        published: true,
      });
    });
    expect(await t.query(internal.library.passages, { ids: [chunk] })).toEqual(
      [],
    );
  });
});

describe("profile onboarding", () => {
  const details = {
    firstName: "Aline",
    lastName: "Test",
    birthDate: "1995-06-12",
    assignedSex: "female" as const,
    country: "RW",
    heightCm: 170,
    weightKg: 65,
  };
  it("saves private setup details, preserves them on sign-in and does not create measurement records", async () => {
    const { first, second } = setup();
    const id = await first.mutation(api.profiles.ensure, {});
    await first.mutation(api.profiles.saveSetup, {
      profileId: id,
      details,
      complete: true,
    });
    const profile = (await first.query(api.profiles.list, {}))[0];
    expect(profile.name).toBe("Aline Test");
    expect(profile.details).toEqual(details);
    expect(profile.onboardedAt).toBeGreaterThan(0);
    await first.mutation(api.profiles.ensure, {});
    expect((await first.query(api.profiles.list, {}))[0].details).toEqual(
      details,
    );
    expect(
      (await first.query(api.records.dashboard, { profileId: id })).readings,
    ).toEqual([]);
    await second.mutation(api.profiles.ensure, {});
    await expect(
      second.mutation(api.profiles.saveSetup, {
        profileId: id,
        details,
        complete: true,
      }),
    ).rejects.toThrow(/permission/);
  });
  it("allows skipping optional questions and clearing them later without losing completion", async () => {
    const { first } = setup();
    const id = await first.mutation(api.profiles.ensure, {});
    await first.mutation(api.profiles.saveSetup, {
      profileId: id,
      details,
      complete: true,
    });
    const before = (await first.query(api.profiles.list, {}))[0].onboardedAt;
    await first.mutation(api.profiles.saveSetup, {
      profileId: id,
      details: { firstName: "  Aline  ", lastName: "" },
      complete: false,
    });
    const after = (await first.query(api.profiles.list, {}))[0];
    expect(after.details).toEqual({ firstName: "Aline", lastName: "" });
    expect(after.onboardedAt).toBe(before);
  });
  it("rejects invalid dates, countries, body values and viewer writes", async () => {
    const { t, first, second } = setup();
    const id = await first.mutation(api.profiles.ensure, {});
    await second.mutation(api.profiles.ensure, {});
    for (const invalid of [
      { firstName: "" },
      { birthDate: "2026-02-30" },
      { birthDate: "2099-01-01" },
      { country: "ZZ" },
      { heightCm: 0 },
      { weightKg: -1 },
    ]) {
      await expect(
        first.mutation(api.profiles.saveSetup, {
          profileId: id,
          details: { ...details, ...invalid },
          complete: true,
        }),
      ).rejects.toThrow();
    }
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").take(3);
      const user = users.find((u) => u.clerkId === "user_second")!;
      await ctx.db.insert("memberships", {
        profileId: id,
        userId: user._id,
        role: "viewer",
      });
    });
    await expect(
      second.mutation(api.profiles.saveSetup, {
        profileId: id,
        details,
        complete: true,
      }),
    ).rejects.toThrow(/permission/);
    expect(
      (await first.query(api.profiles.list, {}))[0].onboardedAt,
    ).toBeUndefined();
  });
});

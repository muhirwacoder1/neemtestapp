import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import agent from "@convex-dev/agent/test";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { ActionCtx } from "../convex/_generated/server";
import {
  meteredFetch,
  openRouterProvider,
  embedWithLovable,
  AIAllowanceError,
  AIServiceError,
  OPENROUTER_BASE_URL,
} from "../convex/gateway";
import { chooseModel } from "../convex/routing";
import {
  DEFAULT_CHAT_MODEL,
  EMBEDDING_MODEL,
  NEMOTRON_FALLBACK_MODEL,
  chatConfigured,
  chatModel,
  dataCollection,
  fallbackChatModel,
} from "../convex/modelPolicy";
const modules = import.meta.glob("../convex/**/*.ts");
const secret = "test-openrouter-server-key";
const bridge = "https://bridge.test/api/neem-gateway";
const reservation = {
  model: DEFAULT_CHAT_MODEL,
  inputBytes: 1000,
  outputTokens: 128,
};
function setup() {
  const t = convexTest(schema, modules);
  agent.register(t);
  vi.stubEnv("OPENROUTER_API_KEY", secret);
  vi.stubEnv("OPENROUTER_CHAT_MODEL", DEFAULT_CHAT_MODEL);
  vi.stubEnv("NEEM_AI_LIBRARY_ENABLED", "false");
  const ctx = {
    runMutation: (fn: any, args: any) => t.mutation(fn, args),
  } as unknown as ActionCtx;
  return { t, ctx };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function useOpenRouter(upstream: (body: any) => Response | Promise<Response>) {
  const network = vi.fn(async (input: any, init: RequestInit) => {
    expect(String(input)).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    expect(new Headers(init.headers).get("Authorization")).toBe(
      `Bearer ${secret}`,
    );
    expect(init.redirect).toBe("error");
    const body = JSON.parse(String(init.body));
    expect(body.provider).toEqual({
      require_parameters: true,
      data_collection: dataCollection(),
      max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
    });
    expect(body.model).toBe(chatModel());
    expect(body.max_tokens).toBeLessThanOrEqual(2400);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.store).toBeUndefined();
    expect(body.plugins).toBeUndefined();
    const fallback = fallbackChatModel();
    if (fallback) expect(body.models).toEqual([chatModel(), fallback]);
    else expect(body.models).toBeUndefined();
    return upstream(body);
  });
  vi.stubGlobal("fetch", network);
  return network;
}
function chatResponse(content: string | null, calls?: unknown[]) {
  return new Response(
    JSON.stringify({
      id: "chat-1",
      created: 1700000000,
      model: "test/actual-free-model:free",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
            ...(calls ? { tool_calls: calls } : {}),
          },
          finish_reason: calls ? "tool_calls" : "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
function streamResponse(delta: object, finish: string = "stop") {
  const chunk = (changes: object, reason: string | null) => ({
    id: "chat-stream",
    created: 1700000000,
    model: "test/actual-free-model:free",
    choices: [{ index: 0, delta: changes, finish_reason: reason }],
    ...(reason
      ? {
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        }
      : {}),
  });
  return new Response(
    [chunk({ role: "assistant", ...delta }, null), chunk({}, finish)]
      .map((p) => `data: ${JSON.stringify(p)}\n\n`)
      .join("") + "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
describe("shared atomic free-model allowance", () => {
  it("enforces concurrent call caps without partial increments, even when token cost is zero", async () => {
    const { t } = setup();
    vi.stubEnv("NEEM_AI_MONTHLY_CALL_LIMIT", "2");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        t.mutation(internal.aiBudget.reserve, reservation),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const rows = await t.run((ctx) => ctx.db.query("aiBudgets").take(5));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.calls === 2 && r.reservedMicroUsd === 0)).toBe(
      true,
    );
    expect(await t.run((ctx) => ctx.db.query("aiCalls").take(10))).toHaveLength(
      2,
    );
  });
  it("zero or invalid call and reserve limits close access", async () => {
    const { t } = setup();
    for (const name of [
      "NEEM_AI_DAILY_CALL_LIMIT",
      "NEEM_AI_DAILY_RESERVE_MICRO_USD",
    ]) {
      for (const value of ["0", "invalid", "-1"]) {
        vi.stubEnv(name, value);
        await expect(
          t.mutation(internal.aiBudget.reserve, reservation),
        ).rejects.toThrow(/allowance/);
      }
      vi.stubEnv(name, "50");
    }
    expect(await t.run((ctx) => ctx.db.query("aiCalls").take(5))).toHaveLength(
      0,
    );
  });
  it.each(["minute", "day"])(
    "blocks an exhausted %s window before network access",
    async (period) => {
      const { t, ctx } = setup();
      const now = new Date().toISOString();
      await t.run((ctx) =>
        ctx.db.insert("aiBudgets", {
          period: `openrouter:${period}:${now.slice(0, period === "day" ? 10 : 16)}`,
          reservedMicroUsd: 0,
          calls: period === "day" ? 50 : 20,
        }),
      );
      const network = vi.fn();
      vi.stubGlobal("fetch", network);
      await expect(
        meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          body: JSON.stringify({ model: DEFAULT_CHAT_MODEL, messages: [] }),
        }),
      ).rejects.toBeInstanceOf(AIAllowanceError);
      expect(network).not.toHaveBeenCalled();
      expect(
        await t.run((ctx) => ctx.db.query("aiBudgets").take(5)),
      ).toHaveLength(1);
    },
  );
  it("keeps failed requests counted without saving their prompts or credentials", async () => {
    const { t, ctx } = setup();
    const network = useOpenRouter(
      () => new Response("PRIVATE_PROVIDER_ERROR", { status: 429 }),
    );
    await expect(
      meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        body: JSON.stringify({
          model: DEFAULT_CHAT_MODEL,
          messages: [{ role: "user", content: "PRIVATE_HEALTH" }],
          max_tokens: 80,
        }),
      }),
    ).rejects.toThrow(/request limit/);
    expect(network).toHaveBeenCalledTimes(1);
    const calls = await t.run((ctx) => ctx.db.query("aiCalls").take(5));
    expect(calls[0]).toMatchObject({
      model: DEFAULT_CHAT_MODEL,
      state: "failed",
      status: 429,
      outputTokens: 80,
    });
    expect(JSON.stringify(calls)).not.toMatch(
      /PRIVATE_HEALTH|PRIVATE_PROVIDER_ERROR|test-openrouter-server-key/,
    );
    expect(
      (await t.run((ctx) => ctx.db.query("aiBudgets").take(5))).every(
        (b) => b.calls === 1,
      ),
    ).toBe(true);
  });
});
describe("OpenRouter adapter and free-only policy", () => {
  it("defaults to Gemma 4 31B (free) and still accepts the openrouter/free router", () => {
    setup();
    vi.stubEnv("OPENROUTER_CHAT_MODEL", "");
    expect(chatModel()).toBe("google/gemma-4-31b-it:free");
    expect(chatConfigured()).toBe(true);
    vi.stubEnv("OPENROUTER_CHAT_MODEL", "openrouter/free");
    expect(chatModel()).toBe("openrouter/free");
    vi.stubEnv("OPENROUTER_CHAT_MODEL", "google/gemma-4-31b-it");
    expect(chatConfigured()).toBe(false);
  });
  it("uses the configured free model without a classifier call and rejects paid routes", async () => {
    setup();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect(chooseModel()).toEqual({
      model: DEFAULT_CHAT_MODEL,
      source: "rules",
    });
    vi.stubEnv("OPENROUTER_CHAT_MODEL", "test/model:free");
    expect(chooseModel().model).toBe("test/model:free");
    for (const paid of [
      "openrouter/auto",
      "openai/gpt-6-sol",
      "test/model:free:online",
    ]) {
      vi.stubEnv("OPENROUTER_CHAT_MODEL", paid);
      expect(chatConfigured()).toBe(false);
      expect(() => chooseModel()).toThrow(/Only free/);
    }
    expect(network).not.toHaveBeenCalled();
  });
  it("asks OpenRouter to fall back to free Nemotron in the same request", async () => {
    const { t, ctx } = setup();
    const network = useOpenRouter((body) => {
      expect(body.models).toEqual([
        "google/gemma-4-31b-it:free",
        NEMOTRON_FALLBACK_MODEL,
      ]);
      return chatResponse("Hello");
    });
    await meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ model: chatModel(), messages: [] }),
    });
    expect(network).toHaveBeenCalledTimes(1);
    // One reservation covers the primary attempt and its fallback.
    expect(await t.run((c) => c.db.query("aiCalls").take(5))).toHaveLength(1);
  });
  it("only uses a distinct free fallback and can disable it", () => {
    setup();
    expect(fallbackChatModel()).toBe(NEMOTRON_FALLBACK_MODEL);
    for (const [fallback, primary] of [
      ["none", DEFAULT_CHAT_MODEL],
      ["openai/gpt-6-sol", DEFAULT_CHAT_MODEL],
      ["openrouter/free", DEFAULT_CHAT_MODEL],
      ["nvidia/nemotron-3-ultra-550b-a55b", DEFAULT_CHAT_MODEL],
      [NEMOTRON_FALLBACK_MODEL, NEMOTRON_FALLBACK_MODEL],
      [NEMOTRON_FALLBACK_MODEL, "openrouter/free"],
    ]) {
      vi.stubEnv("OPENROUTER_CHAT_MODEL", primary);
      vi.stubEnv("OPENROUTER_FALLBACK_MODEL", fallback);
      expect(fallbackChatModel()).toBeUndefined();
    }
  });
  it("keeps data collection denied unless explicitly allowed", async () => {
    const { ctx } = setup();
    expect(dataCollection()).toBe("deny");
    for (const value of ["", "false", "yes", "deny"]) {
      vi.stubEnv("NEEM_AI_DATA_COLLECTION", value);
      expect(dataCollection()).toBe("deny");
    }
    vi.stubEnv("NEEM_AI_DATA_COLLECTION", "true");
    expect(dataCollection()).toBe("allow");
    const network = useOpenRouter(() => chatResponse("Hello"));
    await meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        model: chatModel(),
        messages: [],
        provider: { data_collection: "deny" },
      }),
    });
    expect(JSON.parse(String(network.mock.calls[0][1].body)).provider).toEqual({
      require_parameters: true,
      data_collection: "allow",
      max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
    });
  });
  it("cannot call paid models, alternate hosts, Responses or embeddings through the chat adapter", async () => {
    const { ctx } = setup();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    for (const [url, model] of [
      [`${OPENROUTER_BASE_URL}/chat/completions`, "openai/gpt-6-sol"],
      ["https://untrusted.test/chat/completions", DEFAULT_CHAT_MODEL],
      [`${OPENROUTER_BASE_URL}/responses`, DEFAULT_CHAT_MODEL],
      [`${OPENROUTER_BASE_URL}/embeddings`, EMBEDDING_MODEL],
    ])
      await expect(
        meteredFetch(ctx)(url, {
          method: "POST",
          body: JSON.stringify({ model }),
        }),
      ).rejects.toThrow(/not enabled/);
    expect(network).not.toHaveBeenCalled();
  });
  it("overrides paid fallbacks, plugins, privacy settings and excessive output allowances", async () => {
    const { ctx } = setup();
    const network = useOpenRouter((body) => {
      expect(body.max_tokens).toBe(2400);
      return chatResponse("Hello");
    });
    await meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
      body: JSON.stringify({
        model: DEFAULT_CHAT_MODEL,
        messages: [],
        max_completion_tokens: 99999,
        models: ["paid/model"],
        plugins: [{ id: "web" }],
        store: true,
        provider: { data_collection: "allow", max_price: { prompt: 100 } },
      }),
    });
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized input and aborted requests before network access", async () => {
    const { ctx } = setup();
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    await expect(
      meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        body: JSON.stringify({
          model: DEFAULT_CHAT_MODEL,
          messages: "x".repeat(120_001),
        }),
      }),
    ).rejects.toThrow(/too large/);
    await expect(
      meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        body: "{}",
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });
  it("keeps missing-key configuration pending without leaking the key", async () => {
    const { t, ctx } = setup();
    expect(await t.query(api.ai.configuration, {})).toMatchObject({
      connected: true,
      libraryConnected: false,
    });
    expect(
      JSON.stringify(await t.query(api.ai.configuration, {})),
    ).not.toContain(secret);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await t.query(api.ai.configuration, {})).toMatchObject({
      connected: false,
    });
    expect(() => openRouterProvider(ctx)).toThrow(/being set up/);
  });
  it.each([401, 402, 403, 404, 503])(
    "returns a safe error for provider status %s",
    async (status) => {
      const { ctx } = setup();
      const network = useOpenRouter(
        () => new Response("PRIVATE_PROVIDER_ERROR", { status }),
      );
      await expect(
        meteredFetch(ctx)(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          body: JSON.stringify({ model: DEFAULT_CHAT_MODEL }),
        }),
      ).rejects.toBeInstanceOf(AIServiceError);
      expect(network).toHaveBeenCalledTimes(1);
    },
  );
  it("executes function tools and replays their results with the actual AI SDK", async () => {
    const { t, ctx } = setup();
    let step = 0;
    const lookup = vi.fn(async () => ({
      title: "Neem guide",
      page: 2,
      text: "Inspect feet daily.",
    }));
    useOpenRouter((body) => {
      if (++step === 1)
        return chatResponse(null, [
          {
            id: "call-1",
            type: "function",
            function: {
              name: "search_library",
              arguments: '{"query":"daily care"}',
            },
          },
        ]);
      expect(JSON.stringify(body.messages)).toContain("Neem guide");
      return chatResponse("Inspect feet daily. (Neem guide, p. 2)");
    });
    const result = await generateText({
      model: openRouterProvider(ctx).chat(DEFAULT_CHAT_MODEL),
      prompt: "Daily foot care?",
      maxOutputTokens: 1600,
      maxRetries: 0,
      stopWhen: stepCountIs(3),
      tools: {
        search_library: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: lookup,
        }),
      },
    });
    expect(result.text).toContain("p. 2");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(await t.run((ctx) => ctx.db.query("aiCalls").take(5))).toHaveLength(
      2,
    );
  });
});
describe("scheduled Neem chat", () => {
  it.each(["cancel", "revoke", "rate-limit"])(
    "stops cleanly on %s without another provider call",
    async (mode) => {
      const { t } = setup();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const person = t.withIdentity({
        subject: "stop-test",
        issuer: "https://clerk.test",
        name: "Test",
      });
      const profileId = await person.mutation(api.profiles.ensure, {});
      const dashboard = await person.query(api.records.dashboard, {
        profileId,
      });
      const preferences = {
        ...dashboard.preferences,
        aiConsent: true,
        aiConsentProvider: "openrouter" as const,
      };
      await person.mutation(api.records.saveChanges, {
        profileId,
        readings: [],
        tasks: [],
        preferences,
      });
      const threadId = await person.mutation(api.ai.create, { profileId });
      const network = useOpenRouter(async () => {
        if (mode === "rate-limit")
          return new Response("PRIVATE_UPSTREAM_ERROR", { status: 429 });
        if (mode === "cancel")
          await person.mutation(api.ai.cancel, { threadId });
        else
          await person.mutation(api.records.saveChanges, {
            profileId,
            readings: [],
            tasks: [],
            preferences: { ...preferences, aiConsent: false },
          });
        return streamResponse(
          {
            tool_calls: [
              {
                index: 0,
                id: "call-page",
                type: "function",
                function: {
                  name: "open_page",
                  arguments: '{"page":"Tasks"}',
                },
              },
            ],
          },
          "tool_calls",
        );
      });
      await person.mutation(api.ai.send, {
        threadId,
        text: "Open my care tasks",
        requestId: "stop-one",
        includeHistory: false,
      });
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
      const conversations = await person.query(api.ai.list, { profileId });
      expect(conversations[0].generating).toBe(false);
      if (mode === "rate-limit")
        expect(conversations[0].error).toContain("request limit");
      expect(JSON.stringify(conversations)).not.toContain(
        "PRIVATE_UPSTREAM_ERROR",
      );
      expect(network).toHaveBeenCalledTimes(1);
      expect(
        await t.run((ctx) => ctx.db.query("aiCalls").take(5)),
      ).toHaveLength(1);
    },
  );
  it.each([false, true])(
    "saves streamed replies and confirmation cards; include readings = %s",
    async (includeHistory) => {
      const { t } = setup();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const person = t.withIdentity({
        subject: "stream-test",
        issuer: "https://clerk.test",
        name: "Test",
      });
      const profileId = await person.mutation(api.profiles.ensure, {});
      const dashboard = await person.query(api.records.dashboard, {
        profileId,
      });
      await person.mutation(api.records.saveChanges, {
        profileId,
        readings: [
          {
            id: "reading",
            kind: "glucose",
            value: 110,
            at: new Date().toISOString(),
            context: "PRIVATE_READING_MARKER",
            source: "manual",
          },
        ],
        tasks: [],
        preferences: {
          ...dashboard.preferences,
          aiConsent: true,
          aiConsentProvider: "openrouter",
        },
      });
      let step = 0;
      useOpenRouter((body) => {
        expect(body.stream).toBe(true);
        expect(
          JSON.stringify(body.messages).includes("PRIVATE_READING_MARKER"),
        ).toBe(includeHistory);
        expect(
          body.tools.some((t: any) => t.function.name === "search_library"),
        ).toBe(false);
        if (++step === 1)
          return streamResponse(
            {
              tool_calls: [
                {
                  index: 0,
                  id: "call-task",
                  type: "function",
                  function: {
                    name: "propose_task",
                    arguments: JSON.stringify({
                      title: "Inspect feet",
                      dueAt: new Date().toISOString(),
                    }),
                  },
                },
              ],
            },
            "tool_calls",
          );
        return streamResponse({
          content: "Review the care task and press Confirm to save it.",
        });
      });
      const threadId = await person.mutation(api.ai.create, { profileId });
      await person.mutation(api.ai.send, {
        threadId,
        text: "Remind me to inspect my feet",
        requestId: "stream-one",
        includeHistory,
      });
      await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
      const conversations = await person.query(api.ai.list, { profileId });
      expect(conversations[0]).toMatchObject({ generating: false });
      expect(conversations[0].error).toBeUndefined();
      const messages = await person.query(api.ai.messages, {
        threadId,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(JSON.stringify(messages)).toContain("Review the care task");
      const proposals = await person.query(api.ai.proposals, { threadId });
      expect(proposals).toHaveLength(1);
      expect(proposals[0].state).toBe("pending");
      expect(
        (await person.query(api.records.dashboard, { profileId })).tasks,
      ).toHaveLength(0);
      await person.mutation(api.ai.confirm, {
        id: proposals[0].id,
        accept: true,
      });
      expect(
        (await person.query(api.records.dashboard, { profileId })).tasks,
      ).toHaveLength(1);
      const request = await t.run((ctx) =>
        ctx.db
          .query("aiRequests")
          .withIndex("by_conversationId_and_requestId", (q) =>
            q.eq("conversationId", threadId).eq("requestId", "stream-one"),
          )
          .unique(),
      );
      expect(request).toMatchObject({
        state: "done",
        model: DEFAULT_CHAT_MODEL,
        routeSource: "rules",
      });
      expect(step).toBe(2);
    },
  );
});
describe("owner connection diagnostic", () => {
  it("checks a real SDK tool-and-reply loop without accessing patient records", async () => {
    const { t } = setup();
    let step = 0;
    useOpenRouter(() =>
      ++step === 1
        ? chatResponse(null, [
            {
              id: "call-check",
              type: "function",
              function: {
                name: "check_connection",
                arguments: '{"status":"ok"}',
              },
            },
          ])
        : chatResponse("Neem connection OK"),
    );
    expect(
      await t.action(internal.aiDiagnostics.checkConnection, {}),
    ).toMatchObject({
      configured: true,
      ok: true,
      toolsWorking: true,
    });
    expect(await t.run((ctx) => ctx.db.query("users").take(1))).toHaveLength(0);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(
      await t.action(internal.aiDiagnostics.checkConnection, {}),
    ).toMatchObject({
      configured: false,
      ok: false,
      toolsWorking: false,
    });
    expect(step).toBe(2);
  });
});
describe("separate optional book embeddings", () => {
  it("does not send anything when the library connection is disabled", async () => {
    const { ctx } = setup();
    vi.stubEnv("NEEM_AI_BRIDGE_URL", bridge);
    vi.stubEnv("NEEM_AI_BRIDGE_SECRET", "test-bridge-key");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    await expect(embedWithLovable(ctx, ["guide"])).rejects.toThrow(
      /Book search is not connected/,
    );
    expect(network).not.toHaveBeenCalled();
  });
  it("uses the existing embedding model and separate credentials only after explicit enablement", async () => {
    const { t, ctx } = setup();
    vi.stubEnv("NEEM_AI_LIBRARY_ENABLED", "true");
    vi.stubEnv("NEEM_AI_BRIDGE_URL", bridge);
    vi.stubEnv("NEEM_AI_BRIDGE_SECRET", "test-bridge-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: any, init: RequestInit) => {
        expect(String(url)).toBe(`${bridge}/embeddings`);
        expect(new Headers(init.headers).get("Authorization")).toBe(
          "Bearer test-bridge-key",
        );
        expect(JSON.parse(String(init.body)).model).toBe(EMBEDDING_MODEL);
        return new Response(
          JSON.stringify({
            data: [{ index: 0, embedding: Array(3072).fill(0.1) }],
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    expect((await embedWithLovable(ctx, ["guide"]))[0]).toHaveLength(3072);
    expect(await t.query(api.ai.configuration, {})).toMatchObject({
      libraryConnected: true,
    });
    vi.stubEnv("NEEM_AI_DAILY_RESERVE_MICRO_USD", "0");
    await expect(embedWithLovable(ctx, ["guide"])).rejects.toBeInstanceOf(
      AIAllowanceError,
    );
  });
});

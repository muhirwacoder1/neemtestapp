import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mobileGateway } from "./mobile-gateway.server";
import { readFileSync } from "node:fs";
const webSource = readFileSync(new URL("./neem-chat.server.ts", import.meta.url), "utf8");

const SECRET = "test-bridge-secret-0123456789abcdef-xyz";
const auth = { Authorization: `Bearer ${SECRET}` };
const req = (body: unknown, headers: Record<string, string> = auth, signal?: AbortSignal) =>
  new Request("http://x/api", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body), signal: signal ?? null });

const SOL = "openai/gpt-6-sol";
const FLASH = "google/gemini-3.8-flash";
const ASTRA = "openai/gpt-6-astra";
const sol = (extra: Record<string, unknown> = {}) => ({ model: SOL, input: "hi", ...extra });
const flash = (extra: Record<string, unknown> = {}) => ({ model: FLASH, messages: [{ role: "user", content: "hi" }], ...extra });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env["NEEM_AI_BRIDGE_SECRET"] = SECRET;
  process.env["LOVABLE_API_KEY"] = "test-key";
  fetchMock = vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const sentUrl = () => fetchMock.mock.calls[0]![0] as string;
const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body);
const status = async (body: unknown, op: "chat" | "responses" | "embeddings") => (await mobileGateway(req(body), op)).status;

describe("auth and configuration", () => {
  it("returns 503 when the secret or the API key is missing", async () => {
    delete process.env["NEEM_AI_BRIDGE_SECRET"];
    expect((await mobileGateway(req({}), "status")).status).toBe(503);
    process.env["NEEM_AI_BRIDGE_SECRET"] = SECRET;
    delete process.env["LOVABLE_API_KEY"];
    expect((await mobileGateway(req(sol()), "responses")).status).toBe(503);
  });
  it("rejects missing and wrong auth with 401 before reading the body", async () => {
    expect((await mobileGateway(req("{not json", {}), "responses")).status).toBe(401);
    expect((await mobileGateway(req(sol(), { Authorization: "Bearer wrong" }), "chat")).status).toBe(401);
    expect((await mobileGateway(req({}, { Authorization: "Bearer " + "a".repeat(400) }), "status")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("status returns only ready:true", async () => {
    const res = await mobileGateway(new Request("http://x", { headers: auth }), "status");
    expect(await res.json()).toEqual({ ready: true });
  });
  it("rejects bodies over 120000 bytes with 413", async () => {
    expect(await status(sol({ input: "a".repeat(120_001) }), "responses")).toBe(413);
  });
});

describe("endpoint/model allowlists", () => {
  it("chat/completions accepts only google/gemini-3.8-flash and calls /v1/chat/completions", async () => {
    expect(await status(flash(), "chat")).toBe(200);
    expect(sentUrl()).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    for (const m of [SOL, ASTRA, "google/gemini-3-flash-preview"]) expect(await status(flash({ model: m }), "chat")).toBe(400);
  });
  it("responses accepts only openai/gpt-6-sol and calls /v1/responses", async () => {
    expect(await status(sol(), "responses")).toBe(200);
    expect(sentUrl()).toBe("https://ai.gateway.lovable.dev/v1/responses");
    for (const m of [FLASH, ASTRA, "openai/gpt-6-luna"]) expect(await status(sol({ model: m }), "responses")).toBe(400);
  });
  it("embeddings accepts only google/gemini-embedding-2", async () => {
    expect(await status({ model: "google/gemini-embedding-2", input: ["a"] }, "embeddings")).toBe(200);
    expect(await status({ model: SOL, input: ["a"] }, "embeddings")).toBe(400);
    expect(await status({ model: "google/gemini-embedding-2", input: Array(33).fill("a") }, "embeddings")).toBe(400);
  });
  it("rejects Astra smuggled via nested or alternate model fields", async () => {
    fetchMock.mockClear();
    expect(await status(sol({ models: [ASTRA] }), "responses")).toBe(400);
    expect(await status(sol({ input: [{ role: "user", content: "hi", model: ASTRA }] }), "responses")).toBe(400);
    expect(await status(flash({ fallback_models: [ASTRA] }), "chat")).toBe(400);
    expect(await status(flash({ messages: [{ role: "user", content: "hi", model: ASTRA }] }), "chat")).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("web chat uses GPT-6 Sol, not Astra", () => {
    expect(webSource).toContain(`WEB_CHAT_MODEL = "${SOL}"`);
  });
});

describe("reasoning and output enforcement", () => {
  it("forces low reasoning, store:false and clamps Sol output to 2400 (default 1600)", async () => {
    await mobileGateway(req(sol({ store: true, reasoning: { effort: "high", summary: "auto" }, max_output_tokens: 99999 })), "responses");
    expect(sentBody()).toMatchObject({ store: false, reasoning: { effort: "low", summary: "auto" }, max_output_tokens: 2400 });
    fetchMock.mockClear();
    await mobileGateway(req(sol()), "responses");
    expect(sentBody()).toMatchObject({ reasoning: { effort: "low" }, max_output_tokens: 1600 });
  });
  it("clamps Flash output to 2400 (default 1600) as max_completion_tokens", async () => {
    await mobileGateway(req(flash({ max_tokens: 50000 })), "chat");
    expect(sentBody().max_completion_tokens).toBe(2400);
    expect(sentBody().max_tokens).toBeUndefined();
    fetchMock.mockClear();
    await mobileGateway(req(flash()), "chat");
    expect(sentBody().max_completion_tokens).toBe(1600);
  });
});

describe("forbidden tools and inputs", () => {
  it("rejects built-in tools and allows local function tools", async () => {
    expect(await status(sol({ tools: [{ type: "web_search" }] }), "responses")).toBe(400);
    expect(await status(sol({ tools: [{ type: "file_search" }] }), "responses")).toBe(400);
    expect(await status(sol({ tool_choice: { type: "web_search" } }), "responses")).toBe(400);
    expect(await status(flash({ tools: [{ type: "google_search" }] }), "chat")).toBe(400);
    expect(await status(sol({ tools: [{ type: "function", name: "open_page", parameters: { type: "object" } }] }), "responses")).toBe(200);
    expect(await status(flash({ tools: [{ type: "function", function: { name: "open_page" } }] }), "chat")).toBe(200);
  });
  it("rejects previous_response_id and background", async () => {
    expect(await status(sol({ previous_response_id: "resp_1" }), "responses")).toBe(400);
    expect(await status(sol({ background: true }), "responses")).toBe(400);
  });
  it("rejects image, file and remote inputs", async () => {
    expect(await status(sol({ input: [{ role: "user", content: [{ type: "input_image", image_url: "https://x/y.png" }] }] }), "responses")).toBe(400);
    expect(await status(sol({ input: [{ role: "user", content: [{ type: "input_file", file_id: "f" }] }] }), "responses")).toBe(400);
    expect(await status(flash({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://x" } }] }] }), "chat")).toBe(400);
    expect(await status(sol({ input: [{ role: "user", content: [{ type: "input_text", text: "ok" }] }] }), "responses")).toBe(200);
  });
});

describe("upstream failures", () => {
  it("preserves 402 and 429 without leaking upstream details", async () => {
    fetchMock.mockResolvedValueOnce(new Response("secret details", { status: 402 }));
    const r402 = await mobileGateway(req(sol()), "responses");
    expect(r402.status).toBe(402);
    expect(await r402.text()).not.toContain("secret details");
    fetchMock.mockResolvedValueOnce(new Response("secret", { status: 429, headers: { "retry-after": "7" } }));
    const r429 = await mobileGateway(req(flash()), "chat");
    expect(r429.status).toBe(429);
    expect(r429.headers.get("retry-after")).toBe("7");
    expect(await r429.text()).not.toContain("secret");
  });
});

describe("streaming and disconnect", () => {
  it("streams the upstream body through with its content type", async () => {
    const stream = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode("data: a\n\n")); c.enqueue(new TextEncoder().encode("data: b\n\n")); c.close(); },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "text/event-stream" } }));
    const res = await mobileGateway(req(sol({ stream: true })), "responses");
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("data: a\n\ndata: b\n\n");
  });
  it("aborts the upstream request when the caller disconnects mid-stream", async () => {
    let upstreamSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(async (_u: string, init: RequestInit) => {
      upstreamSignal = init.signal!;
      return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("data: a\n\n")); } }), { headers: { "content-type": "text/event-stream" } });
    });
    const res = await mobileGateway(req(flash({ stream: true })), "chat");
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(upstreamSignal!.aborted).toBe(true);
  });
  it("aborts upstream when the incoming request signal aborts", async () => {
    const ac = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce(async (_u: string, init: RequestInit) => {
      upstreamSignal = init.signal!;
      return new Response(new ReadableStream({}), { headers: { "content-type": "text/event-stream" } });
    });
    await mobileGateway(req(sol({ stream: true }), auth, ac.signal), "responses");
    ac.abort();
    expect(upstreamSignal!.aborted).toBe(true);
  });
});

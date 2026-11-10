// Server-to-server AI bridge for the separate Neem mobile backend (Convex).
// Only callers holding NEEM_AI_BRIDGE_SECRET may use it. No browser/CORS access.
// Model routing (Flash vs Sol) happens inside Convex; this bridge only enforces
// a strict per-endpoint model allowlist and request shape.
export type MobileGatewayOperation = "chat" | "responses" | "embeddings" | "status";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const BRIDGE_FLASH_MODEL = "google/gemini-3.8-flash"; // /v1/chat/completions only
export const BRIDGE_SOL_MODEL = "openai/gpt-6-sol"; // /v1/responses only
export const BRIDGE_EMBED_MODEL = "google/gemini-embedding-2"; // /v1/embeddings only
export const MAX_BODY_BYTES = 120_000;
export const MAX_OUTPUT_TOKENS = 2400;
export const DEFAULT_OUTPUT_TOKENS = 1600;
const TIMEOUT_MS = 120_000;

const RESPONSES_KEYS = new Set([
  "model", "input", "instructions", "tools", "tool_choice", "parallel_tool_calls",
  "stream", "max_output_tokens", "text", "store", "reasoning", "include",
]);
const CHAT_KEYS = new Set([
  "model", "messages", "tools", "tool_choice", "parallel_tool_calls", "stream",
  "stream_options", "max_tokens", "max_completion_tokens", "response_format", "temperature", "top_p",
]);
const RESPONSES_ITEM_TYPES = new Set(["message", "function_call", "function_call_output", "reasoning"]);
const RESPONSES_PART_TYPES = new Set(["input_text", "output_text", "summary_text", "refusal"]);
const CHAT_ROLES = new Set(["system", "developer", "user", "assistant", "tool"]);
// Keys that would smuggle a model override or a remote/file input anywhere in the conversation.
const FORBIDDEN_NESTED = new Set([
  "model", "models", "fallback_models", "provider", "image_url", "file_url", "file_id",
  "file_data", "input_image", "input_file", "input_audio", "image", "audio", "file", "url",
]);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const fail = (status: number, error: string) => json({ error }, status);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function authorized(request: Request, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header || header.length > 300) return false;
  const m = /^Bearer ([^\s]+)$/.exec(header);
  if (!m) return false;
  const [a, b] = await Promise.all([sha256(m[1]!), sha256(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function readJson(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; res: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false, res: fail(413, "Payload too large") };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return { ok: false, res: fail(413, "Payload too large") };
  try {
    const v = JSON.parse(text);
    if (!isObj(v)) return { ok: false, res: fail(400, "Invalid JSON body") };
    return { ok: true, value: v };
  } catch {
    return { ok: false, res: fail(400, "Invalid JSON body") };
  }
}

export function clampOutputTokens(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return DEFAULT_OUTPUT_TOKENS;
  return Math.min(Math.floor(v) || 1, MAX_OUTPUT_TOKENS);
}

function hasForbiddenNested(v: unknown, depth = 0): boolean {
  if (depth > 40) return true;
  if (Array.isArray(v)) return v.some((x) => hasForbiddenNested(x, depth + 1));
  if (!isObj(v)) return false;
  for (const [k, val] of Object.entries(v)) {
    if (FORBIDDEN_NESTED.has(k)) return true;
    if (hasForbiddenNested(val, depth + 1)) return true;
  }
  return false;
}

function onlyKeys(body: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(body).every((k) => allowed.has(k));
}

// Only local function tools (no hosted web search, file search, code interpreter, MCP, etc.).
function functionToolsOnly(tools: unknown, chat: boolean) {
  if (tools === undefined) return true;
  if (!Array.isArray(tools) || tools.length > 64) return false;
  return tools.every((t) => {
    if (!isObj(t) || t["type"] !== "function") return false;
    const fn = chat ? t["function"] : t;
    return isObj(fn) && typeof fn["name"] === "string";
  });
}

function toolChoiceOk(choice: unknown) {
  if (choice === undefined || choice === "auto" || choice === "none" || choice === "required") return true;
  return isObj(choice) && choice["type"] === "function";
}

function textPartsOk(content: unknown, partTypes: Set<string>) {
  if (typeof content === "string") return true;
  if (!Array.isArray(content)) return false;
  return content.every((p) => isObj(p) && typeof p["type"] === "string" && partTypes.has(p["type"]));
}

export function validateResponsesBody(body: Record<string, unknown>): string | null {
  if (body["model"] !== BRIDGE_SOL_MODEL) return "Unsupported model";
  if (!onlyKeys(body, RESPONSES_KEYS)) return "Unsupported request field";
  if (!functionToolsOnly(body["tools"], false)) return "Only function tools are allowed";
  if (!toolChoiceOk(body["tool_choice"])) return "Unsupported tool_choice";
  const input = body["input"];
  if (typeof input !== "string") {
    if (!Array.isArray(input) || input.length === 0) return "input must be text or an array of text items";
    for (const item of input) {
      if (!isObj(item)) return "Invalid input item";
      const type = item["type"] ?? "message";
      if (typeof type !== "string" || !RESPONSES_ITEM_TYPES.has(type)) return "Only text and function items are allowed";
      if (type === "message" && !textPartsOk(item["content"], RESPONSES_PART_TYPES)) return "Only text content is allowed";
    }
  }
  if (hasForbiddenNested(input)) return "Only text content is allowed";
  if (body["instructions"] !== undefined && typeof body["instructions"] !== "string") return "instructions must be text";
  const include = body["include"];
  if (include !== undefined && !(Array.isArray(include) && include.every((i) => i === "reasoning.encrypted_content"))) return "Unsupported include";
  if (body["text"] !== undefined && (!isObj(body["text"]) || hasForbiddenNested(body["text"]))) return "Unsupported text option";
  return null;
}

export function validateChatBody(body: Record<string, unknown>): string | null {
  if (body["model"] !== BRIDGE_FLASH_MODEL) return "Unsupported model";
  if (!onlyKeys(body, CHAT_KEYS)) return "Unsupported request field";
  if (!functionToolsOnly(body["tools"], true)) return "Only function tools are allowed";
  if (!toolChoiceOk(body["tool_choice"])) return "Unsupported tool_choice";
  const messages = body["messages"];
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array";
  for (const m of messages) {
    if (!isObj(m) || typeof m["role"] !== "string" || !CHAT_ROLES.has(m["role"])) return "Invalid message";
    if (m["content"] != null && !textPartsOk(m["content"], new Set(["text"]))) return "Only text content is allowed";
  }
  if (hasForbiddenNested(messages)) return "Only text content is allowed";
  const rf = body["response_format"];
  if (rf !== undefined && !(isObj(rf) && (rf["type"] === "json_schema" || rf["type"] === "json_object" || rf["type"] === "text"))) return "Unsupported response_format";
  return null;
}

export async function mobileGateway(request: Request, operation: MobileGatewayOperation): Promise<Response> {
  const secret = process.env["NEEM_AI_BRIDGE_SECRET"];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!secret || secret.length < 32 || !apiKey) return fail(503, "AI bridge is not configured");
  if (!(await authorized(request, secret))) return fail(401, "Unauthorized");

  if (operation === "status") return json({ ready: true }, 200);

  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.res;
  const body = parsed.value;

  let url: string;
  if (operation === "responses") {
    const err = validateResponsesBody(body);
    if (err) return fail(400, err);
    body["store"] = false;
    const summary = isObj(body["reasoning"]) ? body["reasoning"]["summary"] : undefined;
    body["reasoning"] = { effort: "low", ...(summary === "auto" || summary === "concise" || summary === "detailed" ? { summary } : {}) };
    body["max_output_tokens"] = clampOutputTokens(body["max_output_tokens"]);
    url = `${GATEWAY}/responses`;
  } else if (operation === "chat") {
    const err = validateChatBody(body);
    if (err) return fail(400, err);
    body["max_completion_tokens"] = clampOutputTokens(body["max_completion_tokens"] ?? body["max_tokens"]);
    delete body["max_tokens"];
    url = `${GATEWAY}/chat/completions`;
  } else {
    if (body["model"] !== BRIDGE_EMBED_MODEL) return fail(400, "Unsupported model");
    if (!onlyKeys(body, new Set(["model", "input", "dimensions", "encoding_format"]))) return fail(400, "Unsupported request field");
    const input = body["input"];
    if (
      !Array.isArray(input) || input.length < 1 || input.length > 32 ||
      !input.every((s) => typeof s === "string" && s.length <= 12_000)
    ) return fail(400, "input must be an array of 1-32 strings, each at most 12,000 characters");
    url = `${GATEWAY}/embeddings`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort);
  const cleanup = () => {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", onAbort);
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    cleanup();
    if (request.signal?.aborted) return fail(499, "Client closed request");
    return fail(controller.signal.aborted ? 504 : 502, "Upstream request failed");
  }

  if (!upstream.ok) {
    cleanup();
    await upstream.body?.cancel().catch(() => {});
    const s = upstream.status;
    if (s === 402) return fail(402, "AI allowance exhausted");
    if (s === 429) {
      const retry = upstream.headers.get("retry-after");
      const res = fail(429, "Rate limited");
      if (retry && /^\d{1,5}$/.test(retry)) res.headers.set("Retry-After", retry);
      return res;
    }
    if (s === 403) return fail(403, "AI access denied");
    if (s >= 500) return fail(502, "Upstream error");
    return fail(400, "Upstream rejected the request");
  }

  const src = upstream.body;
  let stream: ReadableStream<Uint8Array> | null = null;
  if (!src) cleanup();
  else {
    const reader = src.getReader();
    stream = new ReadableStream<Uint8Array>({
      async pull(c) {
        try {
          const { done, value } = await reader.read();
          if (done) { cleanup(); c.close(); return; }
          c.enqueue(value);
        } catch (e) {
          cleanup();
          c.error(e);
        }
      },
      async cancel() {
        // Caller disconnected: stop the upstream generation too.
        cleanup();
        controller.abort();
        await reader.cancel().catch(() => {});
      },
    });
  }

  return new Response(stream, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

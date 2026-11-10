import { createOpenAI } from "@ai-sdk/openai";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  EMBEDDING_MODEL,
  chatModel,
  dataCollection,
  fallbackChatModel,
  libraryConfigured,
  MAX_INPUT_BYTES,
  outputCap,
} from "./modelPolicy";
export { EMBEDDING_MODEL } from "./modelPolicy";
export class AIAllowanceError extends Error {}
export class AIServiceError extends Error {}
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
function embeddingConnection() {
  if (!libraryConfigured())
    throw new Error("Book search is not connected yet.");
  const baseURL = process.env.NEEM_AI_BRIDGE_URL?.replace(/\/$/, "");
  const apiKey = process.env.NEEM_AI_BRIDGE_SECRET;
  if (!baseURL || !apiKey) throw new Error("Neem AI is not connected.");
  return { baseURL, apiKey };
}
export function openRouterProvider(
  ctx: ActionCtx,
  beforeRequest?: () => Promise<void>,
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey)
    throw new AIServiceError("The connection to Neem AI is being set up.");
  return createOpenAI({
    name: "openrouter",
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    headers: { "X-OpenRouter-Title": "Neem" },
    fetch: meteredFetch(ctx, "chat", beforeRequest),
  });
}
// All mobile traffic, including SDK retries, is reserved before transmission.
export function meteredFetch(
  ctx: Pick<ActionCtx, "runMutation">,
  service: "chat" | "embeddings" = "chat",
  beforeRequest?: () => Promise<void>,
): typeof fetch {
  return async (input, init) => {
    const { baseURL, apiKey } =
      service === "chat"
        ? {
            baseURL: OPENROUTER_BASE_URL,
            apiKey: process.env.OPENROUTER_API_KEY?.trim(),
          }
        : embeddingConnection();
    if (!apiKey)
      throw new AIServiceError("The connection to Neem AI is being set up.");
    const url = String(input);
    if (init?.method !== "POST" || typeof init.body !== "string")
      throw new Error("Unsupported AI request.");
    init.signal?.throwIfAborted();
    const body = JSON.parse(init.body) as Record<string, unknown>;
    let outputTokens = 0;
    if (
      service === "chat" &&
      url === `${baseURL}/chat/completions` &&
      body.model === chatModel()
    ) {
      outputTokens = outputCap(body.max_completion_tokens ?? body.max_tokens);
      body.max_tokens = outputTokens;
      delete body.max_completion_tokens;
      delete body.store;
      delete body.n;
      // These settings cannot be overridden by model output or SDK options.
      // OpenRouter tries the free fallback in the same request, so this is one
      // reservation and still obeys the zero-price limits below.
      const fallback = fallbackChatModel();
      if (fallback) body.models = [body.model, fallback];
      else delete body.models;
      delete body.route;
      delete body.plugins;
      body.provider = {
        require_parameters: true,
        data_collection: dataCollection(),
        max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
      };
    } else if (
      service !== "embeddings" ||
      url !== `${baseURL}/embeddings` ||
      body.model !== EMBEDDING_MODEL
    ) {
      throw new Error("This AI model is not enabled.");
    }
    const payload = JSON.stringify(body);
    const bytes = new TextEncoder().encode(payload).byteLength;
    if (bytes > MAX_INPUT_BYTES)
      throw new Error("The AI request is too large. Start a new conversation.");
    await beforeRequest?.();
    let id;
    try {
      id = await ctx.runMutation(internal.aiBudget.reserve, {
        model: String(body.model),
        inputBytes: bytes,
        outputTokens,
      });
    } catch {
      throw new AIAllowanceError(
        "Neem AI has reached its usage allowance. Please contact the app owner.",
      );
    }
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${apiKey}`);
      response = await fetch(input, {
        ...init,
        headers,
        redirect: "error",
        body: payload,
      });
      await ctx.runMutation(internal.aiBudget.complete, {
        id,
        status: response.status,
      });
    } catch (error) {
      await ctx.runMutation(internal.aiBudget.complete, { id, status: 0 });
      throw error;
    }
    if (service === "chat" && !response.ok) {
      const message =
        response.status === 429
          ? "Free AI has reached its request limit. Please try again later."
          : response.status === 401 || response.status === 402
            ? "The AI connection needs attention. Please contact the app owner."
            : "A compatible free AI provider is unavailable. Please try again later.";
      throw new AIServiceError(message);
    }
    return response;
  };
}
export async function embedWithLovable(
  ctx: ActionCtx,
  texts: string[],
  signal?: AbortSignal,
) {
  const { baseURL, apiKey } = embeddingConnection();
  const res = await meteredFetch(ctx, "embeddings")(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
  });
  if (!res.ok)
    throw new Error(
      res.status === 402
        ? "The Lovable AI allowance is unavailable."
        : "The library embedding request failed.",
    );
  const data = (await res.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  return texts.map((_, i) => {
    const vector = data.data?.find((d) => d.index === i)?.embedding;
    if (
      !vector ||
      vector.length !== 3072 ||
      vector.some((v) => !Number.isFinite(v))
    )
      throw new Error("The embedding model returned an incompatible vector.");
    return vector;
  });
}

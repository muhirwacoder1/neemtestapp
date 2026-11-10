// Google Gemma 4 31B (free): tools, tool_choice, temperature, top_p, seed,
// response_format and reasoning are supported, with a 256K context window.
export const GEMMA_CHAT_MODEL = "google/gemma-4-31b-it:free";
// Lets OpenRouter pick any compatible free model instead of a pinned one.
export const AUTO_FREE_MODEL = "openrouter/free";
export const DEFAULT_CHAT_MODEL = GEMMA_CHAT_MODEL;
// Free NVIDIA model tried by OpenRouter when the primary model fails (rate
// limit, downtime, etc.). Its only provider requires data_collection=allow.
export const NEMOTRON_FALLBACK_MODEL =
  "nvidia/nemotron-3-ultra-550b-a55b:free";
export const EMBEDDING_MODEL = "google/gemini-embedding-2";
export const MAX_INPUT_BYTES = 120_000;
export const MAX_OUTPUT_TOKENS = 2400;

export function isFreeChatModel(model: string) {
  return (
    model === AUTO_FREE_MODEL ||
    /^[a-z0-9-]+\/[a-z0-9._-]+:free$/.test(model)
  );
}
export function chatModel() {
  const model = process.env.OPENROUTER_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
  if (!isFreeChatModel(model))
    throw new Error("Only free AI models are enabled.");
  return model;
}
// Optional second free model. Set OPENROUTER_FALLBACK_MODEL=none to disable.
// Paid IDs, the auto router and the primary model itself are never used.
export function fallbackChatModel() {
  const configured = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
  if (configured?.toLowerCase() === "none") return undefined;
  const model = configured || NEMOTRON_FALLBACK_MODEL;
  if (
    model === AUTO_FREE_MODEL ||
    !isFreeChatModel(model) ||
    model === chatModel() ||
    chatModel() === AUTO_FREE_MODEL
  )
    return undefined;
  return model;
}
// "deny" keeps prompts away from providers that log or train on free traffic.
// "allow" is needed by some free models (including Nemotron) and is meant for
// demos with non-sensitive data. Anything other than allow/true stays "deny".
export function dataCollection(): "allow" | "deny" {
  const value = process.env.NEEM_AI_DATA_COLLECTION?.trim().toLowerCase();
  return value === "allow" || value === "true" ? "allow" : "deny";
}
export function chatConfigured() {
  try {
    chatModel();
    return !!process.env.OPENROUTER_API_KEY?.trim();
  } catch {
    return false;
  }
}
export function libraryConfigured() {
  return (
    process.env.NEEM_AI_LIBRARY_ENABLED === "true" &&
    !!process.env.NEEM_AI_BRIDGE_URL?.trim() &&
    !!process.env.NEEM_AI_BRIDGE_SECRET?.trim()
  );
}
export function outputCap(value: unknown, fallback = 1600) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.max(1, Math.floor(value)), MAX_OUTPUT_TOKENS)
    : fallback;
}

// Free chat reserves calls, not money. Optional legacy embeddings retain their
// conservative reservation; it is not a provider invoice estimate.
export function reservationCost(
  model: string,
  inputBytes: number,
  outputTokens: number,
) {
  if (
    !Number.isSafeInteger(inputBytes) ||
    inputBytes < 1 ||
    inputBytes > MAX_INPUT_BYTES
  )
    throw new Error("The AI request is too large. Start a new conversation.");
  if (
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0 ||
    outputTokens > MAX_OUTPUT_TOKENS
  )
    throw new Error("Invalid AI output allowance.");
  const inputUpperBound = inputBytes + 4096;
  if (model === chatModel()) return 0;
  if (model === EMBEDDING_MODEL && outputTokens === 0)
    return Math.ceil(inputUpperBound * 0.2);
  throw new Error("This AI model is not enabled.");
}
export function budgetLimit(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  // An invalid configured cap closes access instead of removing the limit.
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

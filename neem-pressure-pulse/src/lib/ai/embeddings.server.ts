// Server-only embedding helper for the Neem knowledge library (RAG).
export const EMBED_MODEL = "google/gemini-embedding-2"; // 3072 dims; must match knowledge_chunks.embedding

async function post(input: string[], apiKey: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input }),
    });
    const retry = res.status === 429 || res.status >= 500;
    if (res.ok || !retry || attempt === 4) return res;
    await res.body?.cancel();
    const ra = Number(res.headers.get("Retry-After"));
    await new Promise((r) => setTimeout(r, (ra > 0 ? ra * 1000 : 1000 * 2 ** attempt) + Math.random() * 500));
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    const res = await post(batch, apiKey);
    if (!res.ok) {
      if (res.status === 402) throw new Error("AI credits have run out. Add more in Settings → Plans & credits.");
      throw new Error(`Embedding failed (${res.status}).`);
    }
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const ordered: number[][] = [];
    for (const d of json.data) ordered[d.index] = d.embedding;
    for (let j = 0; j < batch.length; j++) {
      if (!ordered[j]?.length) throw new Error("Missing embedding result.");
      out.push(ordered[j]!);
    }
  }
  return out;
}

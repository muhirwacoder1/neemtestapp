import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkPages } from "./library-chunk";

type PagesInput = { docId: string; pages: { page: number; text: string }[] };

/** Admin-only: chunk, embed and store a batch of pages for a library document. */
export const addLibraryPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PagesInput) => {
    if (typeof d?.docId !== "string" || !Array.isArray(d.pages) || d.pages.length > 40) throw new Error("Invalid upload batch.");
    for (const p of d.pages) if (typeof p.page !== "number" || typeof p.text !== "string" || p.text.length > 60000) throw new Error("Invalid page.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only the library admin can add books.");
    const chunks = chunkPages(data.pages);
    if (!chunks.length) return { added: 0 };
    const { embed } = await import("./ai/embeddings.server");
    const vectors = await embed(chunks.map((c) => c.content));
    const rows = chunks.map((c, i) => ({ doc_id: data.docId, page: c.page, content: c.content, embedding: JSON.stringify(vectors[i]) }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from("knowledge_chunks").insert(rows.slice(i, i + 50));
      if (error) throw new Error("Couldn't save the book sections.");
    }
    return { added: rows.length };
  });

"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { embedWithLovable } from "./gateway";
import { extractText, getDocumentProxy } from "unpdf";

export const extract = internalAction({
  args: { id: v.id("knowledgeDocs") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    try {
      const d = await ctx.runQuery(internal.library.document, { id });
      if (!d?.url) return null;
      const res = await fetch(d.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("The uploaded file could not be read.");
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024)
        throw new Error("Choose a file up to 8 MB.");
      let pages: { page: number; text: string }[];
      if (d.fileName.toLowerCase().endsWith(".pdf")) {
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
          throw new Error("The file is not a valid PDF.");
        const pdf = await getDocumentProxy(bytes);
        if (pdf.numPages > 600)
          throw new Error("Split this book into volumes of up to 600 pages.");
        const result = await extractText(pdf, { mergePages: false });
        pages = (result.text as string[]).map((text, i) => ({
          page: i + 1,
          text,
        }));
      } else
        pages = [
          {
            page: 0,
            text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          },
        ];
      const chunks: { page: number; text: string }[] = [];
      for (const p of pages) {
        const text = p.text.replace(/\s+/g, " ").trim();
        for (let i = 0; i < text.length; i += 1600) {
          chunks.push({ page: p.page, text: text.slice(i, i + 1800) });
          if (chunks.length > 1200)
            throw new Error("Split this book into smaller volumes.");
          if (i + 1800 >= text.length) break;
        }
      }
      if (!chunks.length)
        throw new Error(
          "No readable text was found. Scanned PDFs need OCR before upload.",
        );
      await ctx.runMutation(internal.library.stage, { id, chunks });
    } catch (e) {
      await ctx.runMutation(internal.library.fail, {
        id,
        error:
          e instanceof Error ? e.message : "This file could not be processed.",
      });
    }
    return null;
  },
});
export const indexBatch = internalAction({
  args: { id: v.id("knowledgeDocs") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    try {
      const b = await ctx.runQuery(internal.library.nextBatch, { id });
      if (!b || !b.chunks.length) return null;
      const vectors = await embedWithLovable(
        ctx,
        b.chunks.map((c: { text: string }) => c.text),
      );
      await ctx.runMutation(internal.library.saveBatch, {
        id,
        start: b.indexed,
        vectors,
      });
    } catch {
      await ctx.runMutation(internal.library.fail, {
        id,
        error:
          "Indexing could not finish. Check the AI connection and allowance, then retry to resume.",
      });
    }
    return null;
  },
});

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { account, admin } from "./access";
import { EMBEDDING_MODEL } from "./gateway";
import { libraryConfigured } from "./modelPolicy";

function requireLibraryConnection() {
  if (!libraryConfigured())
    throw new ConvexError(
      "Book search is not connected yet. Educational articles remain available.",
    );
}
export const hasSources = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) =>
    !!(await ctx.db
      .query("knowledgeDocs")
      .withIndex("by_state", (q) => q.eq("state", "ready"))
      .first()),
});
export const permissions = query({
  args: {},
  returns: v.object({ admin: v.boolean() }),
  handler: async (ctx) => {
    const u = await account(ctx);
    return {
      admin: (process.env.NEEM_ADMIN_CLERK_IDS || "")
        .split(",")
        .map((s: string) => s.trim())
        .includes(u.clerkId),
    };
  },
});
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("knowledgeDocs"),
      title: v.string(),
      author: v.string(),
      state: v.string(),
      totalChunks: v.number(),
      indexedChunks: v.number(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await account(ctx);
    return (await ctx.db.query("knowledgeDocs").order("desc").take(100))
      .filter((d) => d.state !== "deleting")
      .map((d) => ({
        id: d._id,
        title: d.title,
        author: d.author,
        state: d.state,
        totalChunks: d.totalChunks,
        indexedChunks: d.indexedChunks,
        ...(d.error ? { error: d.error } : {}),
      }));
  },
});
export const uploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await admin(ctx);
    requireLibraryConnection();
    return ctx.storage.generateUploadUrl();
  },
});
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    author: v.string(),
    fileName: v.string(),
    contentType: v.string(),
  },
  returns: v.id("knowledgeDocs"),
  handler: async (ctx, args) => {
    const u = await admin(ctx),
      file = await ctx.db.system.get(args.storageId);
    requireLibraryConnection();
    if (
      !file ||
      file.size > 8 * 1024 * 1024 ||
      !args.title.trim() ||
      args.title.length > 160 ||
      args.author.length > 120 ||
      args.fileName.length > 180 ||
      !/\.(pdf|txt|md)$/i.test(args.fileName)
    )
      throw new ConvexError(
        "Choose a PDF, TXT or Markdown file up to 8 MB, and enter a title.",
      );
    const id = await ctx.db.insert("knowledgeDocs", {
      ...args,
      title: args.title.trim(),
      state: "queued",
      totalChunks: 0,
      indexedChunks: 0,
      model: EMBEDDING_MODEL,
      uploadedBy: u._id,
    });
    await ctx.scheduler.runAfter(0, internal.ingestion.extract, { id });
    return id;
  },
});
export const retry = mutation({
  args: { id: v.id("knowledgeDocs") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await admin(ctx);
    requireLibraryConnection();
    const d = await ctx.db.get(id);
    if (!d || d.state !== "failed")
      throw new ConvexError("This book cannot be retried right now.");
    await ctx.db.patch(id, {
      state: d.totalChunks ? "indexing" : "queued",
      error: undefined,
    });
    await ctx.scheduler.runAfter(
      0,
      d.totalChunks
        ? internal.ingestion.indexBatch
        : internal.ingestion.extract,
      { id },
    );
    return null;
  },
});
export const remove = mutation({
  args: { id: v.id("knowledgeDocs") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await admin(ctx);
    const d = await ctx.db.get(id);
    if (d) {
      await ctx.db.patch(id, { state: "deleting" });
      await ctx.scheduler.runAfter(0, internal.library.removeBatch, { id });
    }
    return null;
  },
});
export const removeBatch = internalMutation({
  args: { id: v.id("knowledgeDocs") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const d = await ctx.db.get(id);
    if (!d || d.state !== "deleting") return null;
    const rows = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_docId_and_ordinal", (q) => q.eq("docId", id))
      .take(100);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length)
      await ctx.scheduler.runAfter(0, internal.library.removeBatch, { id });
    else {
      await ctx.storage.delete(d.storageId);
      await ctx.db.delete(id);
    }
    return null;
  },
});
export const document = internalQuery({
  args: { id: v.id("knowledgeDocs") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const d = await ctx.db.get(id);
    return d && d.state !== "deleting"
      ? { ...d, url: await ctx.storage.getUrl(d.storageId) }
      : null;
  },
});
export const stage = internalMutation({
  args: {
    id: v.id("knowledgeDocs"),
    chunks: v.array(v.object({ page: v.number(), text: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, { id, chunks }) => {
    const d = await ctx.db.get(id);
    if (!d || d.state === "deleting") return null;
    if (chunks.length > 1200)
      throw new ConvexError(
        "This book is too large. Split it into smaller volumes.",
      );
    // The extraction step is immutable; retries resume indexing rather than duplicating passages.
    if (d.totalChunks) return null;
    for (let i = 0; i < chunks.length; i++)
      await ctx.db.insert("knowledgeChunks", {
        docId: id,
        ordinal: i,
        page: chunks[i].page,
        text: chunks[i].text,
        published: false,
      });
    await ctx.db.patch(id, {
      state: "indexing",
      totalChunks: chunks.length,
      indexedChunks: 0,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.ingestion.indexBatch, { id });
    return null;
  },
});
export const nextBatch = internalQuery({
  args: { id: v.id("knowledgeDocs") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const d = await ctx.db.get(id);
    if (!d || d.state !== "indexing") return null;
    const chunks = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_docId_and_ordinal", (q) =>
        q.eq("docId", id).gte("ordinal", d.indexedChunks),
      )
      .take(16);
    return { chunks, indexed: d.indexedChunks, total: d.totalChunks };
  },
});
export const saveBatch = internalMutation({
  args: {
    id: v.id("knowledgeDocs"),
    start: v.number(),
    vectors: v.array(v.array(v.float64())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.id);
    if (!d || d.state !== "indexing" || d.indexedChunks !== args.start)
      return null;
    if (
      args.vectors.length > 16 ||
      args.vectors.some(
        (v) => v.length !== 3072 || v.some((n) => !Number.isFinite(n)),
      )
    )
      throw new ConvexError("Invalid embedding vectors.");
    const rows = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_docId_and_ordinal", (q) =>
        q.eq("docId", args.id).gte("ordinal", args.start),
      )
      .take(args.vectors.length);
    for (let i = 0; i < rows.length; i++)
      await ctx.db.patch(rows[i]._id, {
        embedding: args.vectors[i],
        published: true,
      });
    const indexedChunks = args.start + rows.length;
    await ctx.db.patch(d._id, {
      indexedChunks,
      state: indexedChunks === d.totalChunks ? "ready" : "indexing",
    });
    if (indexedChunks < d.totalChunks)
      await ctx.scheduler.runAfter(1000, internal.ingestion.indexBatch, {
        id: d._id,
      });
    return null;
  },
});
export const fail = internalMutation({
  args: { id: v.id("knowledgeDocs"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, error }) => {
    const d = await ctx.db.get(id);
    if (d && d.state !== "deleting")
      await ctx.db.patch(id, { state: "failed", error: error.slice(0, 240) });
    return null;
  },
});
export const passages = internalQuery({
  args: { ids: v.array(v.id("knowledgeChunks")) },
  returns: v.array(
    v.object({
      title: v.string(),
      author: v.string(),
      page: v.number(),
      text: v.string(),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const out = [];
    for (const id of ids.slice(0, 8)) {
      const c = await ctx.db.get(id);
      if (!c?.published) continue;
      const d = await ctx.db.get(c.docId);
      if (d?.state === "ready")
        out.push({
          title: d.title,
          author: d.author,
          page: c.page,
          text: c.text,
        });
    }
    return out;
  },
});

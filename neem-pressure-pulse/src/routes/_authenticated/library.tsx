import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, PageHeader, SectionTitle } from "@/components/neem/ui";
import { addLibraryPages } from "@/lib/library.functions";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Knowledge Library — Neem AI" },
      { name: "description", content: "Books and guides Neem AI uses to answer foot-care and diabetes questions." },
      { property: "og:title", content: "Knowledge Library — Neem AI" },
      { property: "og:description", content: "Books and guides Neem AI uses to answer foot-care and diabetes questions." },
    ],
  }),
  component: LibraryPage,
});

type Doc = { id: string; title: string; author: string; chunk_count: number; created_at: string };

async function readFile(file: File): Promise<{ page: number; text: string }[]> {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: false });
    return (text as string[]).map((t, i) => ({ page: i + 1, text: t }));
  }
  // Plain text / markdown: treat every ~3000 chars as a "page".
  const all = await file.text();
  const pages: { page: number; text: string }[] = [];
  for (let i = 0; i < all.length; i += 3000) pages.push({ page: pages.length + 1, text: all.slice(i, i + 3000) });
  return pages;
}

function LibraryPage() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("knowledge_docs").select("id, title, author, chunk_count, created_at").order("created_at", { ascending: false });
    setDocs(data ?? []);
  }, []);
  useEffect(() => {
    void load();
    supabase.from("user_roles").select("role").eq("role", "admin").then(({ data }) => setAdmin(!!data?.length));
  }, [load]);

  const upload = async () => {
    if (!file || !title.trim()) return toast.error("Choose a file and enter a title.");
    let docId = "";
    try {
      setProgress("Reading file…");
      const pages = (await readFile(file)).filter((p) => p.text.trim());
      if (!pages.length) throw new Error("No text found. Scanned PDFs without text can't be read yet.");
      const { data: doc, error } = await supabase.from("knowledge_docs").insert({ title: title.trim(), author: author.trim() }).select("id").single();
      if (error || !doc) throw new Error("Couldn't create the book entry.");
      docId = doc.id;
      let total = 0;
      for (let i = 0; i < pages.length; i += 20) {
        setProgress(`Teaching Neem AI… page ${Math.min(i + 20, pages.length)} of ${pages.length}`);
        const r = await addLibraryPages({ data: { docId, pages: pages.slice(i, i + 20).map((p) => ({ page: p.page, text: p.text.slice(0, 60000) })) } });
        total += r.added;
      }
      await supabase.from("knowledge_docs").update({ chunk_count: total }).eq("id", docId);
      toast.success(`"${title.trim()}" added to Neem AI's library`);
      setFile(null); setTitle(""); setAuthor("");
    } catch (e) {
      if (docId) await supabase.from("knowledge_docs").delete().eq("id", docId);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
      await load();
    }
    return undefined;
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Remove "${d.title}" from the library?`)) return;
    const { error } = await supabase.from("knowledge_docs").delete().eq("id", d.id);
    if (error) toast.error("Couldn't remove it");
    await load();
  };

  return (
    <>
      <PageHeader title="Library" subtitle="What Neem AI has read" />

      {admin && (
        <>
          <SectionTitle>Add a book or guide</SectionTitle>
          <Card className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted px-4 py-4">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{file ? file.name : "Choose PDF, TXT or Markdown"}</span>
              <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} />
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-2xl bg-muted px-4 py-3 text-[16px] outline-none" />
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author or source (optional)" className="w-full rounded-2xl bg-muted px-4 py-3 text-[16px] outline-none" />
            <button disabled={!!progress} onClick={upload} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-60">{progress ?? "Add to library"}</button>
            <p className="text-[12px] text-muted-foreground">Only add material you have the right to use. Large books take a few minutes — keep this page open.</p>
          </Card>
        </>
      )}

      <SectionTitle>Books & guides</SectionTitle>
      {docs === null ? null : docs.length === 0 ? (
        <Card><p className="text-[14px] text-muted-foreground">No books yet. Neem AI uses the Learn articles until books are added.</p></Card>
      ) : (
        <div className="card-surface divide-y divide-border">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-4">
              <BookOpen className="h-5 w-5 shrink-0 text-m-ai" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-medium">{d.title}</p>
                <p className="text-[12px] text-muted-foreground">{d.author ? `${d.author} · ` : ""}{d.chunk_count} sections</p>
              </div>
              {admin && <button aria-label={`Remove ${d.title}`} onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircleHeart, Plus, ChevronRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PillButton } from "@/components/neem/ui";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Neem AI — Foot-care Health Assistant" },
      { name: "description", content: "Ask foot-care and diabetes questions and get personal, non-diagnostic guidance from Neem AI." },
      { property: "og:title", content: "Neem AI — Foot-care Health Assistant" },
      { property: "og:description", content: "Ask foot-care and diabetes questions and get personal, non-diagnostic guidance from Neem AI." },
    ],
  }),
  component: AIHome,
});

type Thread = { id: string; title: string; updated_at: string };
export const SUGGESTIONS = ["How should I check my feet each day?", "What does my foot pressure map mean?", "Is my glucose this week okay?", "A balanced dinner with local foods"];

function AIHome() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setSignedIn(!!data.user);
      if (!data.user) return;
      const { data: rows, error } = await supabase.from("chat_threads").select("id, title, updated_at").order("updated_at", { ascending: false });
      if (error) toast.error("Couldn't load your conversations");
      setThreads(rows ?? []);
    });
  }, []);

  const newThread = async (prompt?: string) => {
    if (!signedIn) return navigate({ to: "/auth" });
    const { data, error } = await supabase.from("chat_threads").insert({}).select("id").single();
    if (error || !data) return toast.error("Couldn't start a conversation");
    navigate({ to: "/chat/$threadId", params: { threadId: data.id }, search: prompt ? { q: prompt } : {} });
  };

  return (
    <>
      <PageHeader title="Neem AI" subtitle="Your foot-care companion" />
      <div className="relative mt-5 overflow-hidden rounded-[var(--radius)] p-6" style={{ background: "var(--gradient-device)" }}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-m-ai/20 text-m-ai"><MessageCircleHeart className="h-6 w-6" /></div>
        <p className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">Ask anything about your feet and diabetes.</p>
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Guidance, not a diagnosis. Your recorded readings are shared with Neem AI only when you send a message.</p>
        <PillButton className="mt-5 flex items-center gap-1.5" onClick={() => newThread()}><Plus className="h-4 w-4" />New conversation</PillButton>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => newThread(s)} className="card-surface p-4 text-left text-[14px] font-medium leading-snug transition active:scale-[0.97]">{s}</button>
        ))}
      </div>

      {signedIn && (
        <Link to="/library" className="mt-6 flex items-center justify-between rounded-[var(--radius)] bg-card px-5 py-4">
          <span className="text-[16px] font-semibold">Knowledge library</span><ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      {signedIn === false && (
        <Link to="/auth" className="mt-6 flex items-center justify-between rounded-[var(--radius)] bg-card px-5 py-4">
          <span className="text-[16px] font-semibold">Sign in to save your chats</span><ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      {threads.length > 0 && (
        <>
          <h2 className="mb-3 mt-9 px-1 text-[22px] font-bold tracking-tight">Conversations</h2>
          <div className="card-surface divide-y divide-border">
            {threads.map((t) => (
              <Link key={t.id} to="/chat/$threadId" params={{ threadId: t.id }} className="flex items-center gap-3 px-5 py-4">
                <span className="min-w-0 flex-1 truncate text-[16px]">{t.title}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{new Date(t.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

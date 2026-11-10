import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CheckCircle2, ChevronLeft, MessageCircleHeart, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNeem, latest, bmi, fmtDate, DEMO_TEMP } from "@/lib/neem-store";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" ? { q: s["q"] } : {}),
  head: () => ({ meta: [{ title: "Conversation — Neem AI" }, { name: "robots", content: "noindex" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [title, setTitle] = useState("Neem AI");

  useEffect(() => {
    setInitial(null);
    (async () => {
      const [{ data: t }, { data: rows, error }] = await Promise.all([
        supabase.from("chat_threads").select("title").eq("id", threadId).maybeSingle(),
        supabase.from("chat_messages").select("ui_id, role, parts").eq("thread_id", threadId).order("created_at"),
      ]);
      if (error) toast.error("Couldn't load this conversation");
      if (t) setTitle(t.title);
      setInitial((rows ?? []).map((r) => ({ id: r.ui_id, role: r.role as UIMessage["role"], parts: r.parts as UIMessage["parts"] })));
    })();
  }, [threadId]);

  return (
    <div className="flex h-[100dvh] flex-col pb-28">
      <header className="flex items-center gap-3 pb-3 pt-6">
        <Link to="/ai" aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{title}</p>
          <p className="text-[12px] text-muted-foreground">Neem AI · guidance, not diagnosis</p>
        </div>
      </header>
      {initial ? <ChatWindow key={threadId} threadId={threadId} initial={initial} /> : <div className="flex-1" />}
    </div>
  );
}

function useHealthSummary() {
  const n = useNeem();
  return useMemo(() => {
    const g = n.glucose.slice(-7), b = latest(n.bp), body = latest(n.body);
    const lines = [
      `Glucose: ${n.real.glucose ? "REAL saved readings" : "DEMO data"}. Blood pressure: ${n.real.bp ? "REAL" : "DEMO"}. Body: ${n.real.body ? "REAL" : "DEMO"}.`,
      `Recent glucose mg/dL: ${g.map((x) => `${x.value} ${x.context} ${fmtDate(x.at)}`).join("; ")}`,
      `Latest blood pressure: ${b.sys}/${b.dia} mmHg on ${fmtDate(b.at)}`,
      `Height ${body.heightCm} cm, weight ${body.weightKg} kg, BMI ${bmi(body)}`,
      n.device === "connected" && n.left && n.right
        ? `Insole connected. Relative pressure (0-1) left: ${JSON.stringify(n.left)}; right: ${JSON.stringify(n.right)}. Foot temp L ${latest(DEMO_TEMP).left}°C R ${latest(DEMO_TEMP).right}°C`
        : "Smart insole not connected; no live pressure or temperature.",
    ];
    return lines.join("\n");
  }, [n.glucose, n.bp, n.body, n.device, n.left, n.right, n.real]);
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const health = useHealthSummary();
  const healthRef = useRef(health);
  healthRef.current = health;
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
        },
        body: () => ({ threadId, health: healthRef.current, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      let msg = e.message;
      try { msg = JSON.parse(e.message).error ?? msg; } catch { /* plain text */ }
      toast.error(msg || "Something went wrong");
    },
  });
  const busy = status === "submitted" || status === "streaming";

  // React to Neem AI actions: open pages and refresh saved readings. Skip actions from loaded history.
  const handled = useRef(new Set(initial.flatMap((m) => m.parts.map((p) => ("toolCallId" in p ? p.toolCallId : "")))));
  const { refreshReadings } = useNeem();
  const router = useRouter();
  useEffect(() => {
    for (const m of messages) for (const p of m.parts) {
      if (!p.type.startsWith("tool-") || !("toolCallId" in p) || p.state !== "output-available" || handled.current.has(p.toolCallId)) continue;
      handled.current.add(p.toolCallId);
      if (p.type.startsWith("tool-save_")) void refreshReadings();
      if (p.type === "tool-open_page") {
        const path = (p.output as { path?: string })?.path;
        if (path) setTimeout(() => router.navigate({ to: path }), 600);
      }
    }
  }, [messages, refreshReadings, router]);

  const sentQ = useRef(false);
  useEffect(() => {
    if (q && !sentQ.current && initial.length === 0) {
      sentQ.current = true;
      sendMessage({ text: q });
      navigate({ search: {}, replace: true });
    }
  }, [q, initial.length, sendMessage, navigate]);

  useEffect(() => { if (!busy) taRef.current?.focus(); }, [busy]);

  const last = messages[messages.length - 1];
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-6 px-0">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<div className="grid h-14 w-14 place-items-center rounded-2xl bg-m-ai/20 text-m-ai"><MessageCircleHeart className="h-7 w-7" /></div>}
              title="Ask Neem AI"
              description="Foot care, glucose, blood pressure, nutrition — in plain language."
            />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className="text-[15px] leading-relaxed group-[.is-user]:rounded-[1.4rem] group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i} className="whitespace-pre-wrap">{p.text}</p>
                    ) : p.type.startsWith("tool-") && "state" in p ? (
                      <ActionChip key={i} name={p.type.slice(5)} state={p.state} />
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && <Shimmer className="text-[14px]">Thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="mt-2 rounded-[1.6rem] border-border bg-card"
        onSubmit={({ text }) => {
          if (!text.trim() || busy) return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea ref={taRef} autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your feet, glucose, food…" className="text-[16px]" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools><span className="px-2 text-[11px] text-muted-foreground">Can save readings, book visits & open pages</span></PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} className="rounded-full" />
        </PromptInputFooter>
      </PromptInput>
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  open_page: "Opening page",
  save_glucose: "Saved glucose reading",
  save_blood_pressure: "Saved blood pressure",
  save_body: "Saved height & weight",
  list_appointments: "Checked your appointments",
  search_library: "Searched the Neem library",
  book_appointment: "Appointment request saved",
};

function ActionChip({ name, state }: { name: string; state: string }) {
  const failed = state === "output-error";
  const done = state === "output-available";
  return (
    <span className="my-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] text-muted-foreground">
      {failed ? <TriangleAlert className="h-3.5 w-3.5 text-warning" /> : <CheckCircle2 className={`h-3.5 w-3.5 ${done ? "text-primary" : "opacity-40"}`} />}
      {failed ? "Action didn't work" : done ? ACTION_LABEL[name] ?? name : "Working…"}
    </span>
  );
}

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { router, Redirect } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import {
  ArrowRight,
  BookOpen,
  MessageCircle,
  ShieldCheck,
} from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useStore } from "../store";
import { useAccount } from "../services/backend";
import { useNavigation } from "../navigation";
import { Button, Card, T, Badge, Sheet, useTheme } from "../components/ui";
import { uid, metricInfo, hasOpenRouterConsent } from "../domain";
import { aiViewState, pageActions } from "../chat/session";
import {
  ChatHeader,
  ChatWelcome,
  Composer,
  MessageBubble,
  ChatNotice,
} from "../chat/components";
function errorMessage(e: unknown) {
  const data = (e as { data?: unknown })?.data;
  return typeof data === "string"
    ? data
    : "Neem AI could not be reached. Please check your connection and try again.";
}
export function AI() {
  const account = useAccount(),
    store = useStore();
  const state = aiViewState(account, {
    busy: store.busy,
    profileId: store.profile.id,
  });
  if (state === "checking" || state === "connecting")
    return <SessionConnecting />;
  if (state === "visitor")
    return (
      <Redirect href={{ pathname: "/sign-in", params: { returnTo: "/ai" } }} />
    );
  return (
    <AIErrorBoundary key={`${account.userId}-${store.profile.id}`}>
      <ConnectedAI />
    </AIErrorBoundary>
  );
}
function SessionConnecting() {
  const { refresh, error } = useStore(),
    c = useTheme(),
    [busy, setBusy] = useState(false);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 18,
        padding: 25,
      }}
    >
      <ActivityIndicator color={c.blue} />
      <T size={22} weight="medium">
        Opening your conversations
      </T>
      <T
        size={13}
        color={c.muted}
        style={{ textAlign: "center", maxWidth: 330 }}
      >
        We’re connecting the Neem account you already use. There’s no separate
        AI sign-in.
      </T>
      {!!error && <ChatNotice text={error} />}
      <Button
        label="Reconnect my account"
        small
        secondary
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
function ChatFrame({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, minHeight: 0 }}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : Platform.OS === "android"
            ? "height"
            : undefined
      }
      keyboardVerticalOffset={0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
function ConnectedAI() {
  const { profile, data, update } = useStore(),
    c = useTheme(),
    { height } = useWindowDimensions();
  const config = useQuery(api.ai.configuration, {}),
    threads = useQuery(api.ai.list, {
      profileId: profile.id as Id<"profiles">,
    });
  const create = useMutation(api.ai.create),
    send = useMutation(api.ai.send),
    cancel = useMutation(api.ai.cancel);
  const [selected, setSelected] = useState<Id<"conversations">>(),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [includeReadings, setIncludeReadings] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [history, setHistory] = useState(false),
    [notice, setNotice] = useState(""),
    [consenting, setConsenting] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    following = useRef(true),
    submitLock = useRef(false);
  const thread = threads?.find((t) => t.id === selected),
    busy = sending || !!thread?.generating,
    consent = hasOpenRouterConsent(data.preferences);
  async function submit() {
    if (!text.trim() || busy || submitLock.current) return;
    if (!consent) {
      setPrivacy(true);
      return;
    }
    if (!config?.connected) {
      setNotice(
        "Neem AI is unavailable right now. Your account is still signed in. Please try again shortly.",
      );
      return;
    }
    submitLock.current = true;
    setSending(true);
    setNotice("");
    following.current = true;
    const value = text.trim();
    try {
      const id =
        selected ?? (await create({ profileId: profile.id as Id<"profiles"> }));
      setSelected(id);
      await send({
        threadId: id,
        text: value,
        requestId: uid(),
        includeHistory: includeReadings,
      });
      setText("");
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setSending(false);
      submitLock.current = false;
    }
  }
  async function allow() {
    setConsenting(true);
    const saved = await update((d) => ({
      ...d,
      preferences: {
        ...d.preferences,
        aiConsent: true,
        aiConsentProvider: "openrouter",
      },
    }));
    setConsenting(false);
    if (saved) {
      setPrivacy(false);
      setNotice("Your choice is saved. You can send your message now.");
    } else
      setNotice("Your privacy choice could not be saved. Please try again.");
  }
  function newChat() {
    setSelected(undefined);
    setText("");
    setNotice("");
    following.current = true;
  }
  function stop() {
    if (!selected) return;
    void cancel({ threadId: selected }).catch(() =>
      setNotice("The response could not be stopped. Please try again."),
    );
  }
  return (
    <ChatFrame>
      <ChatHeader
        connected={!!config?.connected}
        onHistory={() => setHistory(true)}
        onNew={newChat}
      />
      <ScrollView
        ref={scroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          following.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height <
            100;
        }}
        onContentSizeChange={() => {
          if (selected && following.current)
            scroll.current?.scrollToEnd({ animated: false });
        }}
        contentContainerStyle={{
          paddingTop: selected ? 24 : 0,
          paddingBottom: 12,
          flexGrow: 1,
        }}
      >
        {selected ? (
          <Conversation
            key={selected}
            id={selected}
            busy={busy}
            onNotice={setNotice}
            onEarlier={() => {
              following.current = false;
            }}
          />
        ) : (
          <ChatWelcome
            compact={height < 850}
            onChoose={(prompt) => {
              setText(prompt);
              setNotice("");
            }}
          />
        )}
        {!!thread?.error && <ChatNotice text={thread.error} />}
        {!!notice && <ChatNotice text={notice} />}
        {config && !config.connected && (
          <ChatNotice text="Neem AI’s service connection is currently unavailable. You can still write a question and reopen your conversations. You’re using your existing Neem account." />
        )}
      </ScrollView>
      <Composer
        text={text}
        onText={setText}
        onSend={() => void submit()}
        busy={busy}
        onStop={stop}
        includeReadings={includeReadings}
        onReadings={() => setIncludeReadings((v) => !v)}
        onPrivacy={() => setPrivacy(true)}
        hasConsent={consent}
      />
      {privacy && (
        <AIPrivacy
          onClose={() => setPrivacy(false)}
          onAllow={consent ? undefined : () => void allow()}
          loading={consenting}
          allowed={consent}
          libraryConnected={!!config?.libraryConnected}
        />
      )}
      {history && (
        <Sheet title="Your conversations" onClose={() => setHistory(false)}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <T size={13} color={c.muted}>
              Saved to your Neem account
            </T>
            <Button
              label="New chat"
              small
              onPress={() => {
                newChat();
                setHistory(false);
              }}
            />
          </View>
          {!threads ? (
            <ActivityIndicator color={c.blue} />
          ) : !threads.length ? (
            <Card style={{ backgroundColor: c.subtle, gap: 12 }}>
              <MessageCircle size={25} color={c.muted} />
              <T size={19}>A fresh start.</T>
              <T size={13} color={c.muted}>
                Your conversations will appear here after you send your first
                message.
              </T>
            </Card>
          ) : (
            threads.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation ${t.title}`}
                onPress={() => {
                  setSelected(t.id);
                  setText("");
                  setHistory(false);
                  setNotice("");
                  following.current = true;
                }}
                style={{
                  backgroundColor: t.id === selected ? c.bluePale : c.subtle,
                  padding: 18,
                  borderRadius: 22,
                  gap: 7,
                }}
              >
                <T size={15} weight="semibold">
                  {t.title}
                </T>
                <T size={11} color={c.muted}>
                  {new Date(t.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {t.generating ? " · Responding" : ""}
                </T>
              </Pressable>
            ))
          )}
          {config?.libraryConnected && (
            <Button
              label="Open health library"
              icon={BookOpen}
              secondary
              onPress={() => {
                setHistory(false);
                router.setParams({
                  panels: JSON.stringify([{ kind: "library" }]),
                });
              }}
            />
          )}
        </Sheet>
      )}
    </ChatFrame>
  );
}
function AIPrivacy({
  onClose,
  onAllow,
  loading = false,
  allowed = false,
  libraryConnected = false,
}: {
  onClose: () => void;
  onAllow?: () => void;
  loading?: boolean;
  allowed?: boolean;
  libraryConnected?: boolean;
}) {
  const c = useTheme();
  return (
    <Sheet title="Your chat, your choice" onClose={onClose}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.lavender,
        }}
      >
        <ShieldCheck size={26} color={c.text} />
      </View>
      <T size={22} weight="semibold">
        One account. A clear choice.
      </T>
      <T size={14} color={c.muted}>
        Neem AI uses the account you’re already signed in to. This choice is
        about how your messages are processed.
      </T>
      <T size={14}>
        Messages and recent conversation history are sent through OpenRouter and
        its selected AI provider. Free models may retain messages or use them to
        improve their services. Avoid sharing sensitive identifying details.
      </T>
      <Card style={{ backgroundColor: c.mint, gap: 8 }}>
        <T size={15} weight="semibold">
          Your readings stay optional.
        </T>
        <T size={13}>
          Readings are off by default. Turn on “Readings” in the message box
          only when you want your recent recorded health readings included with
          that message.
        </T>
      </Card>
      {libraryConnected && (
        <T size={13} color={c.muted}>
          Relevant book passages can be included. When book search is used, its
          search text also passes through Lovable’s embedding service.
        </T>
      )}
      <T size={12} color={c.muted}>
        Neem AI offers educational guidance. It does not diagnose, prescribe
        medication, or replace your care team.
      </T>
      {onAllow ? (
        <Button
          label="Allow messages to Neem AI"
          loading={loading}
          onPress={onAllow}
        />
      ) : (
        <Button
          label={allowed ? "Done" : "Back to chat"}
          secondary
          onPress={onClose}
        />
      )}
    </Sheet>
  );
}
function Conversation({
  id,
  busy,
  onNotice,
  onEarlier,
}: {
  id: Id<"conversations">;
  busy: boolean;
  onNotice: (message: string) => void;
  onEarlier: () => void;
}) {
  const { results, status, loadMore } = useUIMessages(
      api.ai.messages,
      { threadId: id },
      { initialNumItems: 20, stream: true },
    ),
    nav = useNavigation(),
    c = useTheme();
  const proposals = useQuery(api.ai.proposals, { threadId: id }),
    confirm = useMutation(api.ai.confirm),
    [pending, setPending] = useState("");
  const messages = results.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  function openPage(page: string) {
    if (page === "Library") nav.open({ kind: "library" });
    else if (page === "Appointments") nav.open({ kind: "appointments" });
    else if (
      page === "Home" ||
      page === "Analytics" ||
      page === "Tasks" ||
      page === "Education" ||
      page === "Neem AI"
    )
      nav.go(page);
  }
  return (
    <>
      {status === "CanLoadMore" && (
        <Button
          label="Load earlier messages"
          secondary
          small
          onPress={() => {
            onEarlier();
            loadMore(20);
          }}
        />
      )}
      {status === "LoadingFirstPage" ? (
        <View style={{ padding: 30 }}>
          <ActivityIndicator color={c.teal} />
        </View>
      ) : !messages.length && !busy ? (
        <ChatNotice text="This conversation is ready. Ask a question below." />
      ) : (
        messages.map((m) => (
          <MessageBubble
            key={m.key}
            role={m.role}
            text={m.text}
            streaming={m.status === "streaming"}
          >
            {pageActions(m.parts).map((page, i) => (
              <Button
                key={`${page}-${i}`}
                label={`Open ${page}`}
                icon={ArrowRight}
                small
                secondary
                onPress={() => openPage(page)}
              />
            ))}
          </MessageBubble>
        ))
      )}
      {busy && !messages.some((m) => m.status === "streaming") && (
        <MessageBubble role="assistant" text="" streaming />
      )}
      {proposals?.map((a) => (
        <Card
          key={a.id}
          style={{
            backgroundColor: c.lavender,
            padding: 18,
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Badge label="Your confirmation needed" />
          <T size={17} weight="semibold">
            {a.payload.type === "reading"
              ? "Review your measurement"
              : a.payload.type === "task"
                ? "Review your care task"
                : "Review appointment request"}
          </T>
          <T size={13}>
            {a.payload.type === "reading"
              ? `${metricInfo[a.payload.reading.kind].label}: ${a.payload.reading.value}${a.payload.reading.secondary ? ` / ${a.payload.reading.secondary}` : ""}${a.payload.reading.height ? ` kg · ${a.payload.reading.height} cm` : ""}\n${a.payload.reading.context} · ${new Date(a.payload.reading.at).toLocaleString()}`
              : a.payload.type === "task"
                ? `${a.payload.title}\n${new Date(a.payload.dueAt).toLocaleString()}`
                : `${a.payload.careType} · ${a.payload.clinic}\n${new Date(a.payload.startsAt).toLocaleString()}\n${a.payload.reason}`}
          </T>
          {a.state === "pending" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[true, false].map((accept) => (
                <Button
                  key={String(accept)}
                  small
                  secondary={!accept}
                  label={accept ? "Confirm & save" : "Dismiss"}
                  disabled={!!pending}
                  loading={pending === a.id}
                  onPress={async () => {
                    setPending(a.id);
                    try {
                      await confirm({ id: a.id, accept });
                      onNotice(
                        accept
                          ? "Saved to your profile."
                          : "Request dismissed.",
                      );
                    } catch (e) {
                      onNotice(errorMessage(e));
                    } finally {
                      setPending("");
                    }
                  }}
                />
              ))}
            </View>
          ) : (
            <Badge label={a.state === "confirmed" ? "Saved" : "Dismissed"} />
          )}
        </Card>
      ))}
    </>
  );
}
class AIErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AIRecovery onRetry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}
function AIRecovery({ onRetry }: { onRetry: () => void }) {
  const { refresh } = useStore(),
    c = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", gap: 18, padding: 25 }}>
      <ShieldCheck size={32} color={c.teal} />
      <T size={25} weight="medium">
        Let’s reconnect your chat.
      </T>
      <T size={14} color={c.muted}>
        Your conversations are tied to your existing Neem account. A connection
        issue doesn’t mean you need another AI account.
      </T>
      <Button
        label="Reconnect conversations"
        onPress={async () => {
          await refresh();
          onRetry();
        }}
      />
    </View>
  );
}

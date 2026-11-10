import React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import {
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Footprints,
  Leaf,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Activity,
  History,
} from "lucide-react-native";
import { Button, T, fonts, useTheme } from "../components/ui";
export const starters = [
  {
    title: "A little care, daily",
    detail: "Build a foot-care routine",
    prompt: "Help me build a daily foot-care routine",
    icon: Footprints,
    tint: "lavender" as const,
  },
  {
    title: "Understand my steps",
    detail: "Make sense of pressure",
    prompt: "Explain what a pressure map can show",
    icon: Activity,
    tint: "bluePale" as const,
  },
  {
    title: "Feel prepared",
    detail: "Plan my next appointment",
    prompt: "What should I ask at my next appointment?",
    icon: CalendarDays,
    tint: "peach" as const,
  },
  {
    title: "Eat well, simply",
    detail: "Ideas with local foods",
    prompt: "Balanced meal ideas with local foods",
    icon: Leaf,
    tint: "mint" as const,
  },
];
export function AIAvatar({ size = 34 }: { size?: number }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Sparkles size={size * 0.47} color="#FFFFFF" strokeWidth={1.5} />
    </View>
  );
}
export function ChatHeader({
  onHistory,
  onNew,
  connected,
}: {
  onHistory: () => void;
  onNew: () => void;
  connected: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingBottom: 17,
        borderBottomWidth: 1,
        borderColor: c.line,
      }}
    >
      <AIAvatar size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={22} weight="semibold" style={{ letterSpacing: -0.6 }}>
          Neem AI
        </T>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: connected ? c.teal : c.muted,
            }}
          />
          <T size={11} color={c.muted}>
            {connected
              ? "Using your Neem account"
              : "Your everyday care companion"}
          </T>
        </View>
      </View>
      <ChatIcon label="Your conversations" icon={History} onPress={onHistory} />
      <ChatIcon label="New conversation" icon={Plus} onPress={onNew} filled />
    </View>
  );
}
export function ChatIcon({
  label,
  icon: Icon,
  onPress,
  filled = false,
  disabled = false,
}: {
  label: string;
  icon: typeof Plus;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 43,
        height: 43,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? c.ink : c.card,
        opacity: pressed || disabled ? 0.6 : 1,
        borderWidth: filled ? 0 : 1,
        borderColor: c.line,
      })}
    >
      <Icon size={20} strokeWidth={1.5} color={filled ? "#FFFFFF" : c.text} />
    </Pressable>
  );
}
export function ChatWelcome({
  onChoose,
  compact = false,
}: {
  onChoose: (prompt: string) => void;
  compact?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        gap: compact ? 20 : 28,
        paddingTop: compact ? 20 : 35,
        paddingBottom: 20,
      }}
    >
      <View style={{ alignItems: "center", gap: 15 }}>
        <View
          style={{
            width: compact ? 66 : 78,
            height: compact ? 66 : 78,
            borderRadius: 32,
            backgroundColor: c.lavender,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "-8deg" }],
          }}
        >
          <Sparkles size={35} strokeWidth={1.2} color={c.text} />
        </View>
        <View style={{ gap: 9, alignItems: "center" }}>
          <T
            size={compact ? 29 : 36}
            weight="medium"
            style={{
              letterSpacing: -1.1,
              textAlign: "center",
              lineHeight: compact ? 35 : 43,
            }}
          >
            A little clarity,{"\n"}whenever you need it.
          </T>
          <T
            size={13}
            color={c.muted}
            style={{ maxWidth: 365, textAlign: "center", lineHeight: 21 }}
          >
            Questions about your health, your feet,{"\n"}or the small habits
            that make a difference.
          </T>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {starters.map(({ title, detail, prompt, icon: Icon, tint }) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityLabel={detail}
            onPress={() => onChoose(prompt)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: "46%",
              minWidth: 135,
              borderRadius: 23,
              backgroundColor: c[tint],
              padding: compact ? 15 : 19,
              gap: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Icon size={21} color={c.text} strokeWidth={1.4} />
              <ArrowUpRight size={16} color={c.muted} />
            </View>
            <View style={{ gap: 4 }}>
              <T size={14} weight="semibold">
                {title}
              </T>
              <T size={11} color={c.muted}>
                {detail}
              </T>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Composer({
  text,
  onText,
  onSend,
  busy,
  onStop,
  includeReadings,
  onReadings,
  onPrivacy,
  hasConsent,
  guest = false,
  disabled = false,
}: {
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  onStop: () => void;
  includeReadings: boolean;
  onReadings: () => void;
  onPrivacy: () => void;
  hasConsent: boolean;
  guest?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 9, paddingTop: 10 }}>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 28,
          padding: 15,
          gap: 12,
          borderWidth: 1,
          borderColor: c.line,
          boxShadow: "0px 4px 20px rgba(20,30,35,0.035)",
        }}
      >
        <TextInput
          accessibilityLabel="Message Neem AI"
          placeholder={
            guest ? "One Neem account. All your care." : "What’s on your mind?"
          }
          placeholderTextColor={c.muted}
          value={text}
          editable={!guest && !disabled}
          onChangeText={onText}
          multiline
          maxLength={3000}
          style={{
            fontFamily: fonts.medium,
            color: c.text,
            fontSize: 15,
            minHeight: 43,
            maxHeight: 130,
            paddingHorizontal: 3,
            paddingVertical: 5,
            lineHeight: 22,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Include my recorded readings"
            accessibilityState={{
              checked: includeReadings,
              disabled: guest || disabled,
            }}
            disabled={guest || disabled}
            onPress={onReadings}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 9,
              borderRadius: 20,
              backgroundColor: includeReadings ? c.mint : c.subtle,
            }}
          >
            <SlidersHorizontal size={14} color={c.text} />
            <T size={11}>{includeReadings ? "Readings on" : "Readings off"}</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI privacy choices"
            onPress={onPrivacy}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck
              size={18}
              color={hasConsent ? c.teal : c.muted}
              strokeWidth={1.5}
            />
          </Pressable>
          <View style={{ flex: 1 }} />
          {busy ? (
            <ChatIcon
              label="Stop response"
              icon={Square}
              onPress={onStop}
              filled
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                guest ? "Continue with your Neem account" : "Send message"
              }
              accessibilityState={{
                disabled: disabled || (!guest && !text.trim()),
              }}
              disabled={disabled || (!guest && !text.trim())}
              onPress={onSend}
              style={({ pressed }) => ({
                width: 43,
                height: 43,
                borderRadius: 25,
                backgroundColor: c.ink,
                alignItems: "center",
                justifyContent: "center",
                opacity:
                  disabled || (!guest && !text.trim())
                    ? 0.3
                    : pressed
                      ? 0.7
                      : 1,
              })}
            >
              <ArrowUp size={22} color="#FFFFFF" strokeWidth={1.8} />
            </Pressable>
          )}
        </View>
      </View>
      <T size={10} color={c.muted} style={{ textAlign: "center" }}>
        A little guidance, alongside your care team. AI can make mistakes.
      </T>
    </View>
  );
}
function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <T key={index} size={15} weight="semibold">
            {part.slice(2, -2)}
          </T>
        ) : (
          part
        ),
      )}
    </>
  );
}
export function ChatText({ text }: { text: string }) {
  return (
    <View style={{ gap: 11 }}>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, i) => {
          const heading = /^#{1,3}\s+/.test(paragraph);
          return (
            <T
              key={i}
              selectable
              size={heading ? 17 : 15}
              weight={heading ? "semibold" : "regular"}
              style={{ lineHeight: 24 }}
            >
              <InlineText text={paragraph.replace(/^#{1,3}\s+/, "")} />
            </T>
          );
        })}
    </View>
  );
}
export function MessageBubble({
  role,
  text,
  streaming,
  children,
}: {
  role: string;
  text: string;
  streaming: boolean;
  children?: React.ReactNode;
}) {
  const c = useTheme(),
    user = role === "user";
  return (
    <View
      style={{
        gap: 10,
        alignSelf: user ? "flex-end" : "stretch",
        maxWidth: user ? "88%" : "100%",
        marginBottom: user ? 22 : 28,
      }}
    >
      {!user && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AIAvatar size={25} />
          <T size={11} weight="semibold" color={c.muted}>
            Neem AI
          </T>
        </View>
      )}
      <View
        style={
          user
            ? {
                backgroundColor: c.bluePale,
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderRadius: 24,
                borderBottomRightRadius: 7,
                gap: 10,
              }
            : { paddingLeft: 3, gap: 10 }
        }
      >
        {text ? (
          <ChatText text={text} />
        ) : streaming ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <ActivityIndicator size="small" color={c.teal} />
            <T size={13} color={c.muted}>
              Thinking it through…
            </T>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}
export function ChatNotice({
  text,
  action,
  onAction,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: c.subtle,
        padding: 14,
        borderRadius: 18,
        gap: 10,
      }}
    >
      <T size={12} color={c.muted}>
        {text}
      </T>
      {action && onAction && (
        <Button label={action} small secondary onPress={onAction} />
      )}
    </View>
  );
}

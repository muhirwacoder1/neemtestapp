import React, { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, ShieldCheck, Stethoscope } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, Card, Button, useTheme } from "../components/ui";
import { consultationError } from "../consultations";
export function useFeedback() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(task: () => Promise<unknown>, success = "Saved.") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await task();
      setMessage(success);
    } catch (e) {
      const data = (e as { data?: unknown })?.data;
      setMessage(
        typeof data === "string"
          ? data
          : e instanceof Error && !e.message.includes("[CONVEX")
            ? e.message
            : consultationError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return { message, busy, run, setMessage };
}
export function Feedback({ message }: { message: string }) {
  const c = useTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 14, borderRadius: 16, backgroundColor: c.bluePale }}
    >
      <T size={14}>{message}</T>
    </View>
  ) : null;
}
export function Loading() {
  const c = useTheme();
  return (
    <ActivityIndicator
      color={c.blue}
      accessibilityLabel="Loading care records"
    />
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return (
    <T size={13} color={c.muted} style={{ lineHeight: 20 }}>
      {children}
    </T>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ gap: 16 }}>
      <T size={21} weight="semibold">
        {title}
      </T>
      {children}
    </Card>
  );
}
export function Choices({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          accessibilityRole="button"
          accessibilityState={{ selected: o.id === value }}
          onPress={() => onChange(o.id)}
          style={{
            backgroundColor: o.id === value ? c.ink : c.subtle,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: o.id === value ? c.ink : c.line,
          }}
        >
          <T size={13} color={o.id === value ? "#FFFFFF" : c.text}>
            {o.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
export function Status({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: [
          "high",
          "urgent",
          "review",
          "failed",
          "suspended",
        ].includes(label)
          ? c.peach
          : ["low", "paid", "completed", "active"].includes(label)
            ? c.mint
            : c.subtle,
      }}
    >
      <T size={12} weight="semibold">
        {label === "unassessed" ? "Not assessed" : label.replaceAll("_", " ")}
      </T>
    </View>
  );
}
export function More({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (n: number) => void;
}) {
  return status === "CanLoadMore" ? (
    <Button label="Load more" secondary onPress={() => loadMore(20)} />
  ) : status === "LoadingMore" ? (
    <Loading />
  ) : null;
}
export function CareFrame({
  title,
  section,
  sections,
  onSection,
  children,
  clinician = false,
}: {
  title: string;
  section?: string;
  sections?: string[];
  onSection?: (s: string) => void;
  children: React.ReactNode;
  clinician?: boolean;
}) {
  const c = useTheme(),
    insets = useSafeAreaInsets(),
    wide = useWindowDimensions().width >= 1000;
  const Icon = clinician ? Stethoscope : ShieldCheck;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: insets.top,
        flexDirection: wide ? "row" : "column",
      }}
    >
      {wide && (
        <View
          style={{
            width: 220,
            padding: 26,
            paddingTop: 40,
            gap: 30,
            borderRightWidth: 1,
            borderColor: c.line,
          }}
        >
          <T size={32} weight="semibold">
            neem
          </T>
          <View style={{ gap: 12 }}>
            <Icon color={c.blue} size={30} />
            <T size={18}>{title}</T>
          </View>
          {sections?.map((s) => (
            <Button
              key={s}
              label={s}
              secondary={section !== s}
              small
              onPress={() => onSection?.(s)}
            />
          ))}
          <Button
            label="Patient app"
            ghost
            onPress={() => router.replace("/account")}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: wide ? 36 : 20,
            paddingVertical: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderBottomWidth: 1,
            borderColor: c.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to account"
            onPress={() => router.replace("/account")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 24,
              backgroundColor: c.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T size={23} weight="semibold">
              {title}
            </T>
            <Note>
              {clinician
                ? "Your patients. Connected care."
                : "A clear view of your care service."}
            </Note>
          </View>
          <Icon color={c.blue} size={24} />
        </View>
        {!wide && sections && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, gap: 8 }}
            >
              {sections.map((s) => (
                <Button
                  key={s}
                  label={s}
                  small
                  secondary={section !== s}
                  onPress={() => onSection?.(s)}
                />
              ))}
            </ScrollView>
          </View>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: wide ? 32 : 18,
            paddingBottom: insets.bottom + 40,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 1100,
              alignSelf: "center",
              gap: 18,
            }}
          >
            {children}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
export const money = (amount: number) => `${amount.toLocaleString()} RWF`;
export const dateTime = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export class CareBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <CareFrame title="Neem care">
        <Section title="This workspace could not be opened">
          <Note>
            Your access may have changed, or the secure connection is
            unavailable. Return to Account and try again.
          </Note>
          <Button
            label="Back to account"
            onPress={() => router.replace("/account")}
          />
        </Section>
      </CareFrame>
    ) : (
      this.props.children
    );
  }
}

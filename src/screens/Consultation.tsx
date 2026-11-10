import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Video,
  ShieldCheck,
  PhoneOff,
  Clock,
  Check,
} from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useMinuteClock } from "../useMinuteClock";
import { useStore } from "../store";
import {
  appointmentDate,
  appointmentTime,
  consultationError,
} from "../consultations";
import { requestVideoPermissions } from "../services/videoPermissions";
import { VideoCall } from "../components/VideoCall";
import type { VideoSession } from "../components/VideoCall.types";
import { Button, Card, Empty, IconButton, T, useTheme } from "../components/ui";
export function Consultation() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    { guest } = useStore();
  const valid = typeof id === "string" && /^[a-z0-9]{20,40}$/.test(id);
  return guest || !valid ? (
    <CallFrame>
      <Empty
        icon={Video}
        title={
          guest
            ? "Sign in to join your consultation"
            : "Appointment unavailable"
        }
        detail={
          guest
            ? "Your private consultation is linked to your Neem account."
            : "Open an appointment from Your care to join its video room."
        }
      />
      <Button
        label={guest ? "Sign in" : "Back to Your care"}
        onPress={() => router.replace(guest ? "/sign-in" : "/tasks")}
      />
    </CallFrame>
  ) : (
    <ConnectedConsultation key={id} id={id as Id<"consultations">} />
  );
}
function CallFrame({
  children,
  active = false,
  onLeave,
}: {
  children: React.ReactNode;
  active?: boolean;
  onLeave?: () => void;
}) {
  const c = useTheme(),
    insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: active ? "#101211" : c.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 16,
          gap: 12,
        }}
      >
        <IconButton
          icon={active ? PhoneOff : ArrowLeft}
          label={active ? "Leave consultation" : "Back to appointments"}
          onPress={
            onLeave ||
            (() =>
              router.replace({
                pathname: "/tasks",
                params: { panels: JSON.stringify([{ kind: "appointments" }]) },
              }))
          }
        />
        <T size={20} weight="medium" color={active ? "#FFFFFF" : c.text}>
          Your consultation
        </T>
      </View>
      {active ? (
        <View style={{ flex: 1 }}>{children}</View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, flexGrow: 1 }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
              gap: 20,
            }}
          >
            {children}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
function ConnectedConsultation({ id }: { id: Id<"consultations"> }) {
  const asOf = useMinuteClock();
  const visit = useQuery(api.consultations.detail, { id }),
    config = useQuery(api.consultations.configuration, { asOf }),
    join = useAction(api.daily.join),
    c = useTheme();
  const [session, setSession] = useState<VideoSession | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [left, setLeft] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        setSession(null);
        setLeft(true);
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (
      session &&
      (visit?.state !== "booked" ||
        !visit.canJoin ||
        !config?.enabled ||
        now >= session.expiresAt)
    ) {
      const timer = setTimeout(() => {
        setSession(null);
        setLeft(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visit?.state, visit?.canJoin, config?.enabled, session, now]);
  async function enter() {
    setError("");
    setBusy(true);
    try {
      await requestVideoPermissions();
      const next = await join({ id, consent: true });
      setSession(next);
      setLeft(false);
    } catch (e) {
      setError(
        e instanceof Error && !("data" in e) ? e.message : consultationError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    session &&
    visit?.state === "booked" &&
    visit.canJoin &&
    config?.enabled &&
    now < session.expiresAt
  )
    return (
      <CallFrame
        active
        onLeave={() => {
          setSession(null);
          setLeft(true);
        }}
      >
        <VideoCall
          session={session}
          onLeave={() => {
            setSession(null);
            setLeft(true);
          }}
          onError={() => {
            setSession(null);
            setError(
              "The call couldn’t connect. Check camera and microphone permissions and your connection, then try again.",
            );
          }}
        />
      </CallFrame>
    );
  const canJoin =
    visit?.state === "booked" &&
    visit.canJoin &&
    now >= visit.startsAt - 300_000 &&
    now < visit.endsAt + 600_000;
  return (
    <CallFrame>
      {visit === null ? (
        <Empty
          icon={Video}
          title="Appointment unavailable"
          detail="This appointment isn’t available to your account. Return to Your care to choose one of your appointments."
        />
      ) : !visit || !config ? (
        <ActivityIndicator color={c.blue} />
      ) : (
        <>
          {left && (
            <Card style={{ backgroundColor: c.mint, gap: 8 }}>
              <Check size={24} color={c.text} />
              <T size={21} weight="medium">
                You’ve left the consultation.
              </T>
              <T size={13}>Your camera and microphone are off.</T>
            </Card>
          )}
          <Card style={{ backgroundColor: c.bluePale, gap: 12 }}>
            <Video size={32} color={c.text} />
            <T size={27} weight="medium">
              {visit.clinicianName}
            </T>
            <T size={14}>{visit.specialty}</T>
            <T>
              {appointmentDate(visit.startsAt)} ·{" "}
              {appointmentTime(visit.startsAt)}–{appointmentTime(visit.endsAt)}
            </T>
          </Card>
          <Card style={{ gap: 14 }}>
            <ShieldCheck size={24} color={c.text} />
            <T size={20} weight="medium">
              Before you join
            </T>
            <T size={14} color={c.muted}>
              Daily provides the video connection. Joining shares your audio and
              video when you turn them on, connection information, and an
              anonymous room identifier with Daily. Your appointment note and
              health readings stay in Neem.
            </T>
            <T size={13} color={c.muted}>
              Camera and microphone start off. Recording and transcription are
              disabled in Neem’s call configuration.
            </T>
          </Card>
          {!config.enabled && (
            <T color={c.muted}>
              Video consultations are being connected. Please check back later.
            </T>
          )}
          {!canJoin && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Clock size={18} color={c.muted} />
              <T size={13} color={c.muted} style={{ flex: 1 }}>
                {visit.state === "cancelled"
                  ? "This appointment was cancelled."
                  : now >= visit.endsAt + 600_000
                    ? "This appointment has ended."
                    : "You can join from 5 minutes before the appointment."}
              </T>
            </View>
          )}
          {!!error && (
            <T role="alert" color={c.danger}>
              {error}
            </T>
          )}
          <Button
            label={left ? "Rejoin consultation" : "Agree and join consultation"}
            icon={Video}
            loading={busy}
            disabled={!config.enabled || !canJoin}
            onPress={enter}
            style={{ backgroundColor: c.blue }}
          />
        </>
      )}
    </CallFrame>
  );
}

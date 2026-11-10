import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  Video,
  Clock,
  ArrowRight,
  Plus,
  ShieldCheck,
  Bell,
} from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useMinuteClock } from "../useMinuteClock";
import { useStore } from "../store";
import { useNavigation } from "../navigation";
import {
  appointmentDate,
  appointmentTime,
  consultationError,
  localSlotTime,
  localTimezone,
} from "../consultations";
import {
  scheduleConsultationReminder,
  cancelConsultationReminder,
} from "../services/consultationReminders";
import { Button, Card, Empty, T, Badge, Input, Segments, useTheme } from "./ui";
type Visit = FunctionReturnType<typeof api.consultations.list>[number];
export function AppointmentList() {
  const { guest } = useStore(),
    nav = useNavigation();
  return guest ? (
    <>
      <Empty
        icon={Video}
        title="Your care, face to face"
        detail="Sign in to find available appointments and join a private video consultation."
      />
      <Button
        label="Sign in to book"
        onPress={() => nav.open({ kind: "auth" })}
      />
    </>
  ) : (
    <Appointments />
  );
}
function Appointments() {
  const asOf = useMinuteClock();
  const c = useTheme(),
    { profile } = useStore();
  const configuration = useQuery(api.consultations.configuration, { asOf });
  const [view, setView] = useState("My appointments"),
    [change, setChange] = useState<Visit | null>(null);
  if (!configuration)
    return (
      <ActivityIndicator
        color={c.blue}
        accessibilityLabel="Loading appointments"
      />
    );
  return (
    <>
      <Card style={{ backgroundColor: c.bluePale, gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Video size={26} color={c.text} strokeWidth={1.5} />
          <Badge label="Video consultations" bg={c.card} />
        </View>
        <T size={27} weight="medium" style={{ letterSpacing: -0.7 }}>
          Your care, face to face.
        </T>
        <T size={13} color={c.muted}>
          Book a time with your care team. Join your consultation right here in
          Neem.
        </T>
        <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
          <ShieldCheck size={15} color={c.text} />
          <T size={11}>Private rooms · Camera and microphone start off</T>
        </View>
      </Card>
      {!configuration.enabled && (
        <Card style={{ backgroundColor: c.peach, gap: 7 }}>
          <T weight="semibold">Video booking opens soon</T>
          <T size={13} color={c.muted}>
            We’re connecting the video service. Your existing appointment
            requests are still available below.
          </T>
        </Card>
      )}
      <Segments
        options={[
          "My appointments",
          "Book a visit",
          ...(configuration.clinicianId ? ["Clinician"] : []),
        ]}
        selected={view}
        onSelect={(next) => {
          setChange(null);
          setView(next);
        }}
        compact
      />
      {view === "Book a visit" ? (
        <BookVisit
          enabled={configuration.enabled}
          change={change}
          onDone={() => {
            setChange(null);
            setView("My appointments");
          }}
        />
      ) : view === "Clinician" && configuration.clinicianId ? (
        <ClinicianWorkspace clinicianId={configuration.clinicianId} />
      ) : (
        <>
          <MyVisits
            key={profile.id}
            onChange={(visit) => {
              setChange(visit);
              setView("Book a visit");
            }}
          />
          <Button
            label="Find an appointment"
            icon={Plus}
            secondary
            onPress={() => setView("Book a visit")}
          />
          <LegacyRequests />
        </>
      )}
    </>
  );
}
function MyVisits({ onChange }: { onChange: (visit: Visit) => void }) {
  const asOf = useMinuteClock();
  const { profile } = useStore(),
    c = useTheme();
  const visits = useQuery(api.consultations.list, {
    profileId: profile.id as Id<"profiles">,
    asOf,
  });
  if (!visits) return <ActivityIndicator color={c.blue} />;
  return visits.length ? (
    <>
      {visits.map((v) => (
        <VisitCard key={v.id} visit={v} onChange={() => onChange(v)} />
      ))}
      <T size={11} color={c.muted}>
        Showing upcoming appointments and the past 7 days.
      </T>
    </>
  ) : (
    <Empty
      icon={CalendarDays}
      title="Make time for your care"
      detail="Your booked video consultations will appear here. Choose a clinician to see their available times."
    />
  );
}
function VisitCard({
  visit,
  onChange,
  clinician = false,
}: {
  visit: Visit;
  onChange?: () => void;
  clinician?: boolean;
}) {
  const c = useTheme(),
    { setNotice } = useStore(),
    cancel = useMutation(api.consultations.cancel);
  const [confirm, setConfirm] = useState(false),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const upcoming = visit.state === "booked" && visit.endsAt + 600_000 > now,
    joinable = upcoming && visit.startsAt - 300_000 <= now;
  async function cancelVisit() {
    setBusy(true);
    try {
      await cancel({ id: visit.id });
      setConfirm(false);
      try {
        await cancelConsultationReminder(visit.id);
      } catch {
        setFeedback(
          "Appointment cancelled. Check this device’s reminders to remove any old notification.",
        );
        return;
      }
      setNotice("Appointment cancelled.");
      setFeedback("Appointment cancelled.");
    } catch (e) {
      setFeedback(consultationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 13 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Badge
          label={
            visit.state === "cancelled"
              ? "Cancelled"
              : upcoming
                ? "Booked"
                : "Ended"
          }
          bg={visit.state === "cancelled" ? c.subtle : c.mint}
          color={c.text}
        />
        <Video size={20} color={c.muted} />
      </View>
      <T size={21} weight="medium">
        {clinician ? visit.patientName : visit.clinicianName}
      </T>
      <T size={13} color={c.muted}>
        {visit.specialty} ·{" "}
        {Math.round((visit.endsAt - visit.startsAt) / 60_000)} min
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Clock size={16} color={c.muted} />
        <T size={14}>
          {appointmentDate(visit.startsAt)} · {appointmentTime(visit.startsAt)}
        </T>
      </View>
      <T size={11} color={c.muted}>
        {localTimezone()}
      </T>
      {!!visit.reason && <T size={13}>{visit.reason}</T>}
      {!!feedback && (
        <T accessibilityRole="alert" size={13}>
          {feedback}
        </T>
      )}
      {upcoming && visit.canJoin && (
        <Button
          label={joinable ? "Join consultation" : "View consultation"}
          icon={Video}
          onPress={() =>
            router.push({ pathname: "/consultation", params: { id: visit.id } })
          }
          style={{ backgroundColor: c.blue }}
        />
      )}
      {upcoming && !clinician && (
        <Button
          label="Remind me on this device"
          icon={Bell}
          secondary
          small
          onPress={async () => {
            try {
              await scheduleConsultationReminder(visit.id, visit.startsAt);
              setFeedback("Reminder set on this device.");
            } catch (e) {
              setFeedback(
                e instanceof Error ? e.message : "Reminder could not be set.",
              );
            }
          }}
        />
      )}
      {upcoming && visit.canManage && (
        <View style={{ gap: 10 }}>
          {confirm ? (
            <>
              <T size={13}>Cancel this appointment and release the time?</T>
              <Button
                label="Yes, cancel appointment"
                loading={busy}
                secondary
                onPress={cancelVisit}
              />
              <Button
                label="Keep appointment"
                small
                ghost
                onPress={() => setConfirm(false)}
              />
            </>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {!clinician && onChange && visit.startsAt > now + 300_000 && (
                <Button
                  label="Change time"
                  small
                  secondary
                  onPress={onChange}
                />
              )}
              <Button
                label="Cancel appointment"
                small
                ghost
                onPress={() => setConfirm(true)}
              />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
function BookVisit({
  enabled,
  change,
  onDone,
}: {
  enabled: boolean;
  change: Visit | null;
  onDone: () => void;
}) {
  const asOf = useMinuteClock();
  const c = useTheme(),
    { profile, setNotice } = useStore(),
    doctors = useQuery(api.consultations.clinicians, {});
  const [selected, setSelected] = useState<Id<"clinicians"> | null>(
      change?.clinicianId || null,
    ),
    [slotId, setSlotId] = useState<Id<"consultationSlots"> | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const slots = useQuery(
      api.consultations.slots,
      selected ? { clinicianId: selected, asOf } : "skip",
    ),
    book = useMutation(api.consultations.book),
    reschedule = useMutation(api.consultations.reschedule);
  const doctor = doctors?.find((d) => d.id === selected),
    slot = slots?.find((s) => s.id === slotId);
  async function confirm() {
    if (!slotId) return;
    setBusy(true);
    setFeedback("");
    try {
      if (change) {
        await reschedule({ id: change.id, slotId });
        await cancelConsultationReminder(change.id).catch(() =>
          setNotice(
            "Your time changed. Remove the old reminder from this device.",
          ),
        );
      } else
        await book({ profileId: profile.id as Id<"profiles">, slotId, reason });
      setNotice(
        change
          ? "Your appointment time has changed. Set a new reminder if you need one."
          : "Your video appointment is booked.",
      );
      onDone();
    } catch (e) {
      setFeedback(consultationError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!doctors) return <ActivityIndicator color={c.blue} />;
  if (!doctors.length)
    return (
      <Empty
        icon={CalendarDays}
        title="Your care team is getting ready"
        detail="Clinicians and their available times will appear here once your care team has been set up."
      />
    );
  return (
    <>
      {!!feedback && (
        <T accessibilityRole="alert" color={c.danger}>
          {feedback}
        </T>
      )}
      <T size={20} weight="medium">
        {change ? "Choose a new time" : "Who would you like to see?"}
      </T>
      {doctors
        .filter((d) => !change || d.id === change.clinicianId)
        .map((d) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === d.id }}
            accessibilityLabel={`Choose ${d.name}`}
            onPress={() => {
              setSelected(d.id);
              setSlotId(null);
            }}
          >
            <Card
              style={{
                backgroundColor: selected === d.id ? c.bluePale : c.subtle,
                gap: 5,
              }}
            >
              <T size={19} weight="medium">
                {d.name}
              </T>
              <T size={13} color={c.muted}>
                {d.specialty}
              </T>
            </Card>
          </Pressable>
        ))}
      {selected && (
        <>
          <T size={18} weight="medium">
            Available times
          </T>
          <T size={11} color={c.muted}>
            Times shown in {localTimezone()}. Availability updates as people
            book.
          </T>
          {!slots ? (
            <ActivityIndicator color={c.blue} />
          ) : !slots.filter((s) => s.state === "open").length ? (
            <Empty
              icon={Clock}
              title="No times available yet"
              detail="This clinician hasn’t published an available time in the next 30 days. Check back later."
            />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {slots
                .filter((s) => s.state === "open")
                .map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: slotId === s.id }}
                    accessibilityLabel={`${appointmentDate(s.startsAt)} at ${appointmentTime(s.startsAt)}`}
                    onPress={() => setSlotId(s.id)}
                    style={{
                      padding: 14,
                      borderRadius: 20,
                      backgroundColor: slotId === s.id ? c.ink : c.subtle,
                    }}
                  >
                    <T size={12} color={slotId === s.id ? "#FFFFFF" : c.text}>
                      {appointmentDate(s.startsAt)}
                    </T>
                    <T
                      size={16}
                      weight="medium"
                      color={slotId === s.id ? "#FFFFFF" : c.text}
                    >
                      {appointmentTime(s.startsAt)}
                    </T>
                  </Pressable>
                ))}
            </View>
          )}
        </>
      )}
      {slot && doctor && (
        <Card style={{ backgroundColor: c.mint, gap: 15 }}>
          <T size={20} weight="medium">
            {change ? "Review your new time" : "A little time for you"}
          </T>
          <T>{doctor.name}</T>
          <T size={14}>
            {appointmentDate(slot.startsAt)} · {appointmentTime(slot.startsAt)}–
            {appointmentTime(slot.endsAt)}
          </T>
          {!change && (
            <Input
              label="Anything you’d like the clinician to know? (optional)"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={1000}
              placeholder="A short note for your care team"
            />
          )}
          <T size={11} color={c.muted}>
            Your appointment note stays in Neem and is shared with your assigned
            clinician. Video uses Daily; review its notice before you join.
          </T>
          <Button
            label={change ? "Confirm new time" : "Confirm appointment"}
            icon={ArrowRight}
            loading={busy}
            disabled={!enabled}
            onPress={confirm}
          />
        </Card>
      )}
    </>
  );
}
export function ClinicianWorkspace({
  clinicianId,
}: {
  clinicianId: Id<"clinicians">;
}) {
  const asOf = useMinuteClock();
  const c = useTheme(),
    { setNotice } = useStore(),
    visits = useQuery(api.consultations.clinicianVisits, { asOf }),
    slots = useQuery(api.consultations.slots, { clinicianId, asOf });
  const publish = useMutation(api.consultations.publishSlot),
    close = useMutation(api.consultations.closeSlot);
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [duration, setDuration] = useState("30"),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  return (
    <>
      <T size={20} weight="medium">
        Your consultations
      </T>
      {visits?.length ? (
        visits.map((v) => <VisitCard key={v.id} visit={v} clinician />)
      ) : (
        <T color={c.muted}>Booked patient appointments will appear here.</T>
      )}
      <Card style={{ backgroundColor: c.lavender, gap: 16 }}>
        <T size={20} weight="medium">
          Make time available
        </T>
        <T size={12} color={c.muted}>
          Enter a date and time in {localTimezone()}. Publish individual slots
          up to 30 days ahead.
        </T>
        <Input
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-11-01"
          maxLength={10}
        />
        <Input
          label="Time (24-hour HH:MM)"
          value={time}
          onChangeText={setTime}
          placeholder="09:30"
          maxLength={5}
        />
        <Segments
          options={["15", "30", "45", "60"]}
          selected={duration}
          onSelect={setDuration}
          compact
        />
        <T size={11} color={c.muted}>
          Appointment length in minutes
        </T>
        {!!feedback && (
          <T accessibilityRole="alert" size={13}>
            {feedback}
          </T>
        )}
        <Button
          label="Publish available time"
          icon={Plus}
          loading={busy}
          onPress={async () => {
            const startsAt = localSlotTime(date, time);
            if (!Number.isFinite(startsAt)) {
              setFeedback("Enter a valid date and time.");
              return;
            }
            setBusy(true);
            try {
              await publish({ startsAt, durationMinutes: Number(duration) });
              setDate("");
              setTime("");
              setNotice("Your time is available to book.");
              setFeedback("Your time is available to book.");
            } catch (e) {
              setFeedback(consultationError(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      <T size={18} weight="medium">
        Your published times
      </T>
      {slots
        ?.filter((s) => s.state !== "closed")
        .map((s) => (
          <Card key={s.id} style={{ gap: 10 }}>
            <T>
              {appointmentDate(s.startsAt)} · {appointmentTime(s.startsAt)}
            </T>
            <Badge label={s.state === "booked" ? "Booked" : "Available"} />
            {s.state === "open" && (
              <Button
                label={`Remove ${appointmentTime(s.startsAt)} slot`}
                small
                ghost
                onPress={async () => {
                  try {
                    await close({ id: s.id });
                  } catch (e) {
                    setFeedback(consultationError(e));
                  }
                }}
              />
            )}
          </Card>
        ))}
    </>
  );
}
function LegacyRequests() {
  const { profile } = useStore(),
    c = useTheme(),
    items = useQuery(api.ai.appointments, {
      profileId: profile.id as Id<"profiles">,
    });
  if (!items?.length) return null;
  return (
    <>
      <T size={19} weight="medium">
        Clinic appointment requests
      </T>
      <T size={12} color={c.muted}>
        These saved requests need confirmation directly with your clinic. They
        do not include a video room.
      </T>
      {items.map((a) => (
        <Card key={a.id} style={{ gap: 8 }}>
          <Badge
            label={
              a.state === "cancelled"
                ? "Cancelled"
                : "Awaiting clinic confirmation"
            }
          />
          <T size={18}>{a.careType}</T>
          <T>{a.clinic}</T>
          <T size={12} color={c.muted}>
            {new Date(a.startsAt).toLocaleString()}
          </T>
          <T size={13}>{a.reason}</T>
        </Card>
      ))}
    </>
  );
}

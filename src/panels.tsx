import React, { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowRight,
  Bell,
  Bluetooth,
  Bookmark,
  Check,
  CheckCircle2,
  CircleHelp,
  Download,
  ExternalLink,
  Globe,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react-native";
import { useStore } from "./store";
import { useInsole } from "./insole";
import { useNavigation, Panel } from "./navigation";
import {
  Metric,
  articles,
  bmi,
  dayKey,
  displayReading,
  filterReadings,
  metricInfo,
  uid,
  validateReading,
  hasOpenRouterConsent,
} from "./domain";
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  RowLink,
  Segments,
  T,
  useTheme,
} from "./components/ui";
import { FootMaps, HealthChart } from "./components/graphics";
import { useAccount } from "./services/backend";
import { AccountAuth, AccountSecurity } from "./components/AccountAuth";
import { GAIT_STAGES, PRESSURE_COLORS } from "./pressure";
import { SimulationPairing } from "./components/SimulationPairing";
import { PairingVisual } from "./components/PairingVisual";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { cancelReminder, scheduleReminder } from "./services/reminders";
import { exportRecords } from "./services/export";
import { Zone } from "./services/ble.types";
import {
  loadPlans,
  purchasePlan,
  restorePurchases,
} from "./services/subscriptions";
import { StorePlan } from "./services/subscriptions.types";
import { KnowledgeLibrary } from "./components/KnowledgeLibrary";
import { AppointmentList } from "./components/AppointmentList";
import { MealPlanner } from "./components/MealPlanner";

export function panelTitle(panel: Panel) {
  return panel.kind === "metric"
    ? metricInfo[panel.metric].label
    : panel.kind === "add-reading"
      ? `Add ${panel.metric === "bmi" ? "body measurements" : metricInfo[panel.metric].label.toLowerCase()}`
      : (
          {
            "add-menu": "Add a measurement",
            pairing: "Your smart companion",
            foot: "Your foot pressure map",
            profile: "A little about you",
            settings: "Make Neem yours",
            notifications: "Your updates",
            "new-task": "A moment for your care",
            "meal-plan": "Good food, close to home",
            article: "A little knowledge",
            auth: "Welcome to Neem",
            subscription: "Neem Premium",
            privacy: "Your privacy, your choice",
            help: "Here to help",
            "edit-profile": "Your profile",
            security: "Login & security",
            library: "Neem knowledge library",
            appointments: "Your appointments",
          } as Record<string, string>
        )[panel.kind];
}
export function PanelContent({ panel }: { panel: Panel }) {
  switch (panel.kind) {
    case "add-menu":
      return <AddMenu />;
    case "metric":
      return <MetricDetail metric={panel.metric} />;
    case "add-reading":
      return <ReadingForm metric={panel.metric} />;
    case "foot":
      return <PressureDetail />;
    case "pairing":
      return <Pairing />;
    case "profile":
      return <ProfilePanel />;
    case "settings":
      return <SettingsPanel />;
    case "new-task":
      return <NewTask />;
    case "meal-plan":
      return <MealPlanner />;
    case "article":
      return <ArticlePanel id={panel.id} />;
    case "auth":
      return <AuthPanel />;
    case "notifications":
      return <NotificationsPanel />;
    case "subscription":
      return <SubscriptionPanel />;
    case "privacy":
      return <PrivacyPanel />;
    case "help":
      return <HelpPanel />;
    case "edit-profile":
      return <EditProfile />;
    case "security":
      return <SecurityPanel />;
    case "library":
      return <KnowledgeLibrary />;
    case "appointments":
      return <AppointmentList />;
  }
}
function AddMenu() {
  const nav = useNavigation(),
    { guest } = useStore(),
    c = useTheme();
  const colors = [c.bluePale, c.lavender, c.mint, c.peach];
  return (
    <>
      <T color={c.muted}>What would you like to record?</T>
      {(["glucose", "pressure", "bmi", "temperature"] as Metric[]).map(
        (metric, i) => (
          <Pressable
            key={metric}
            accessibilityRole="button"
            accessibilityLabel={`Add ${metricInfo[metric].label.toLowerCase()}`}
            onPress={() =>
              nav.open(
                guest ? { kind: "auth" } : { kind: "add-reading", metric },
              )
            }
          >
            <Card
              style={{
                backgroundColor: colors[i],
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 22,
              }}
            >
              <View style={{ flex: 1 }}>
                <T size={19} weight="medium">
                  {metricInfo[metric].label}
                </T>
                <T size={12} color={c.muted} style={{ marginTop: 4 }}>
                  {metricInfo[metric].unit}
                </T>
              </View>
              <Plus size={23} color={c.text} strokeWidth={1.4} />
            </Card>
          </Pressable>
        ),
      )}
      <T size={11} color={c.muted}>
        Record measurements from your device. Your readings stay private to your
        account.
      </T>
    </>
  );
}
function ReadingForm({ metric }: { metric: Metric }) {
  const { guest, update, setNotice } = useStore(),
    nav = useNavigation(),
    c = useTheme();
  const [value, setValue] = useState(""),
    [secondary, setSecondary] = useState(""),
    [height, setHeight] = useState(""),
    [date, setDate] = useState(dayKey()),
    [time, setTime] = useState(new Date().toTimeString().slice(0, 5)),
    [context, setContext] = useState(
      metric === "glucose" ? "Fasting" : "At rest",
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function save() {
    const validation = validateReading(metric, {
      value,
      secondary,
      height,
      date,
      time,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    const success = await update((d) => ({
      ...d,
      readings: [
        ...d.readings,
        {
          id: uid(),
          kind: metric,
          value: Number(value),
          secondary: metric === "pressure" ? Number(secondary) : undefined,
          height: metric === "bmi" ? Number(height) : undefined,
          at: new Date(`${date}T${time}`).toISOString(),
          context,
          source: "manual",
        },
      ],
    }));
    setSaving(false);
    if (success) {
      setNotice(guest ? "Measurement saved." : "Measurement securely saved.");
      nav.back();
    }
  }
  return (
    <>
      <Badge label={guest ? "Manual measurement" : "Manual measurement"} />
      <T size={13} color={c.muted}>
        {metricInfo[metric].description}
      </T>
      <Card style={{ backgroundColor: c.subtle, borderWidth: 0, padding: 20 }}>
        <View style={{ gap: 18 }}>
          <Input
            label={
              metric === "pressure"
                ? "Systolic (mmHg)"
                : metric === "bmi"
                  ? "Weight (kg)"
                  : metric === "glucose"
                    ? "Blood glucose (mg/dL)"
                    : "Plantar temperature (°C)"
            }
            value={value}
            onChangeText={setValue}
            placeholder={
              metric === "glucose"
                ? "e.g. 108"
                : metric === "pressure"
                  ? "e.g. 120"
                  : metric === "bmi"
                    ? "e.g. 68.4"
                    : "e.g. 31.8"
            }
            keyboardType="decimal-pad"
          />
          {metric === "pressure" && (
            <Input
              label="Diastolic (mmHg)"
              value={secondary}
              onChangeText={setSecondary}
              placeholder="e.g. 80"
              keyboardType="decimal-pad"
            />
          )}
          {metric === "bmi" && (
            <Input
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              placeholder="e.g. 170"
              keyboardType="decimal-pad"
            />
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Input
              label="Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-10-21"
            />
            <Input
              label="Time (24-hour)"
              value={time}
              onChangeText={setTime}
              placeholder="09:30"
            />
          </View>
        </View>
      </Card>
      {metric === "glucose" && (
        <>
          <T weight="bold" size={18}>
            A little context
          </T>
          <T size={13} color={c.muted}>
            When did you check?
          </T>
          <Segments
            options={[
              "Fasting",
              "Before meal",
              "After meal",
              "Before bed",
              "Other",
            ]}
            selected={context}
            onSelect={setContext}
            compact
          />
        </>
      )}
      {metric === "bmi" && Number(value) > 0 && Number(height) >= 50 && (
        <Card style={{ backgroundColor: c.pale }}>
          <T size={13}>Calculated BMI</T>
          <T size={34} weight="bold">
            {bmi(Number(value), Number(height))}
          </T>
          <T size={11} color={c.muted}>
            A number for your record. Interpretation depends on age and
            individual circumstances.
          </T>
        </Card>
      )}
      {!!error && (
        <T accessibilityRole="alert" color={c.danger} size={13}>
          {error}
        </T>
      )}
      <Button
        label="Save measurement"
        onPress={save}
        loading={saving}
        icon={Check}
      />
      <T color={c.muted} size={10} style={{ textAlign: "center" }}>
        Enter the reading exactly as shown on your measurement device.
      </T>
    </>
  );
}
function MetricDetail({ metric }: { metric: Metric }) {
  const { data, profile, setNotice, hasMoreReadings } = useStore(),
    nav = useNavigation(),
    c = useTheme(),
    [period, setPeriod] = useState("7 Days");
  const records = filterReadings(data.readings, metric, period),
    latest = records.at(-1),
    display = displayReading(latest, data.preferences),
    info = metricInfo[metric];
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Badge label="Recorded measurements" />
        <Button
          label="Add reading"
          icon={Plus}
          small
          onPress={() => nav.open({ kind: "add-reading", metric })}
        />
      </View>
      <View>
        <T size={12} color={c.muted}>
          Latest in this period
        </T>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}>
          <T size={47} weight="bold" style={{ letterSpacing: -2 }}>
            {display.value}
          </T>
          <T color={info.color} size={16}>
            {display.unit}
          </T>
        </View>
        <T size={12} color={c.muted}>
          {latest
            ? `${new Date(latest.at).toLocaleString()} · ${latest.context}`
            : "Your measurement history starts with one reading."}
        </T>
      </View>
      <Segments
        options={["Today", "7 Days", "30 Days", "90 Days"]}
        selected={period}
        onSelect={setPeriod}
        compact
      />
      <HealthChart
        readings={records}
        height={205}
        dual={metric === "pressure"}
        convert={
          metric === "glucose" && data.preferences.glucoseUnit === "mmol/L"
            ? (v) => v / 18.0182
            : metric === "temperature" &&
                data.preferences.temperatureUnit === "°F"
              ? (v) => v * 1.8 + 32
              : undefined
        }
      />
      <Card style={{ backgroundColor: c.subtle }}>
        <T size={12} color={c.muted}>
          {info.description}
        </T>
      </Card>
      <T size={18} weight="bold">
        Your measurement history
      </T>
      {hasMoreReadings && (
        <T size={12} color={c.muted}>
          This view includes your 1,000 most recent measurements.
        </T>
      )}
      {records.length ? (
        records
          .slice()
          .reverse()
          .map((r) => {
            const v = displayReading(r, data.preferences);
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 13,
                  paddingBottom: 15,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                }}
              >
                <View>
                  <T size={12} weight="semibold">
                    {new Date(r.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </T>
                  <T size={10} color={c.muted}>
                    {r.context} ·{" "}
                    {r.source === "manual" ? "Manual entry" : "Device"}
                  </T>
                </View>
                <T size={16} weight="bold" color={info.color}>
                  {v.value}{" "}
                  <T size={10} color={c.muted}>
                    {v.unit}
                  </T>
                </T>
              </View>
            );
          })
      ) : (
        <Empty
          title="A fresh start"
          detail="No readings in this range. Add your first measurement or choose a wider period."
        />
      )}
      <Button
        label="Export these readings"
        icon={Download}
        secondary
        onPress={() =>
          exportRecords(profile, records).catch(() =>
            setNotice("Export could not be completed. Please try again."),
          )
        }
      />
    </>
  );
}
function PressureDetail() {
  const { width } = useWindowDimensions();
  const insole = useInsole(),
    c = useTheme(),
    nav = useNavigation();
  const [paused, setPaused] = useState(false),
    [stage, setStage] = useState<number | undefined>(),
    [zone, setZone] = useState<{ side: "left" | "right"; region: Zone }>({
      side: "left",
      region: "heel",
    });
  const value = insole.frames[zone.side]?.sensors.find(
    (s) => s.region === zone.region,
  )?.value;
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Badge
          label={
            insole.preview
              ? insole.simulation === "connected"
                ? "neem · Preview"
                : "Walking preview"
              : Object.keys(insole.frames).length
                ? "Live sensor readings"
                : "Waiting for readings"
          }
          dot
        />
        {insole.preview && stage === undefined && (
          <Button
            small
            secondary
            label={paused ? "Play" : "Pause"}
            onPress={() => setPaused((v) => !v)}
          />
        )}
      </View>
      <FootMaps
        height={Math.min(330, (width - 64) / 1.1)}
        frames={insole.frames}
        preview={insole.preview}
        paused={paused}
        phase={stage === undefined ? undefined : GAIT_STAGES[stage].time}
        selected={`${zone.side}-${zone.region}`}
        onZone={(side, region) => setZone({ side, region })}
      />
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T size={10} color={c.muted}>
          Lower
        </T>
        {PRESSURE_COLORS.map((color) => (
          <View
            key={color}
            style={{
              width: 28,
              height: 6,
              borderRadius: 4,
              backgroundColor: color,
            }}
          />
        ))}
        <T size={10} color={c.muted}>
          Higher
        </T>
      </View>
      {insole.preview && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["Walking", ...GAIT_STAGES.map((s) => s.label)].map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{
                  selected: i === (stage === undefined ? 0 : stage + 1),
                }}
                onPress={() => {
                  setStage(i === 0 ? undefined : i - 1);
                  setPaused(false);
                }}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 11,
                  borderRadius: 24,
                  backgroundColor:
                    i === (stage === undefined ? 0 : stage + 1)
                      ? c.ink
                      : c.subtle,
                }}
              >
                <T
                  size={12}
                  color={
                    i === (stage === undefined ? 0 : stage + 1)
                      ? "#FFFFFF"
                      : c.text
                  }
                >
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          <T size={12} color={c.muted} style={{ lineHeight: 19 }}>
            {stage === undefined
              ? "The feet alternate through loading, stance, push-off and swing. Tap a stage to compare both feet at that point."
              : GAIT_STAGES[stage].detail}
          </T>
        </View>
      )}
      {insole.preview ? (
        <Card style={{ backgroundColor: c.pale }}>
          <T weight="bold">Pressure through a step</T>
          <T size={12} color={c.muted} style={{ marginTop: 8 }}>
            Several regions carry different loads at once. Red marks a higher
            illustrative load; blue marks a lower load. Initial loading
            represents the early loading response, rather than the single
            instant of heel contact. This preview is separate from your measured
            records.
          </T>
        </Card>
      ) : (
        <Card>
          <T size={12} color={c.teal} weight="bold">
            {zone.side.toUpperCase()} · {zone.region.toUpperCase()}
          </T>
          <T size={35} weight="bold">
            {value ?? "—"}
            <T size={12} color={c.muted}>
              {" "}
              / 100 relative
            </T>
          </T>
          <T size={12} color={c.muted}>
            {value === undefined
              ? "No measurement is available for this region."
              : "Measured sensor region. Shading between sensors is an estimate."}
          </T>
        </Card>
      )}
      {insole.connected ? (
        <Button
          secondary
          label={
            insole.preview
              ? "Show live sensor readings"
              : "Show walking animation"
          }
          onPress={() => insole.setPreview(!insole.preview)}
        />
      ) : (
        <Button
          label={
            insole.simulation === "connected"
              ? "Connection options"
              : "Connect my insole"
          }
          icon={Bluetooth}
          onPress={() => nav.open({ kind: "pairing" })}
        />
      )}
      <T size={11} color={c.muted}>
        Pressure is shown in relative units until the hardware calibration is
        verified. A pressure map cannot confirm an ulcer or a diagnosis.
      </T>
    </>
  );
}
function Pairing() {
  const insole = useInsole(),
    nav = useNavigation();
  const [mode, setMode] = useState(insole.connected ? "My insole" : "Preview");
  return (
    <>
      <Segments
        options={["Preview", "My insole"]}
        selected={mode}
        onSelect={setMode}
      />
      {mode === "Preview" ? (
        <SimulationPairing
          onViewMap={() => {
            insole.setPreview(true);
            nav.open({ kind: "foot" });
          }}
        />
      ) : (
        <RealPairing />
      )}
    </>
  );
}
function RealPairing() {
  const insole = useInsole(),
    { guest } = useStore(),
    c = useTheme(),
    nav = useNavigation();
  const { stopScan } = insole;
  useEffect(() => () => stopScan(), [stopScan]);
  const loading =
    insole.status === "scanning" || insole.status === "connecting";
  return (
    <>
      <View
        style={{
          borderRadius: 24,
          padding: 24,
          backgroundColor: c.subtle,
          alignItems: "center",
        }}
      >
        <Badge
          label={
            insole.connected
              ? "Connected"
              : insole.status === "scanning"
                ? "Looking nearby…"
                : insole.status === "connecting"
                  ? "Connecting…"
                  : "Ready when you are"
          }
          dot
        />
        <PairingVisual active={loading} height={220} />
        <T size={25} weight="bold" style={{ textAlign: "center" }}>
          {insole.connected
            ? "A little more connected."
            : loading
              ? "Making a connection."
              : "Meet your smart companion."}
        </T>
        <T
          size={12}
          color={c.muted}
          style={{ textAlign: "center", marginTop: 10 }}
        >
          {insole.connected
            ? "Your insole is linked. Valid packets will appear on your pressure map."
            : "Charge your insoles and keep them close to your phone."}
        </T>
      </View>
      {insole.connected ? (
        <>
          <Card>
            <T weight="bold">Neem Smart Insole</T>
            <T color={c.muted} size={12} style={{ marginTop: 7 }}>
              {insole.battery === undefined
                ? "Battery information is not available."
                : `Device battery: ${insole.battery}%`}
            </T>
            <T size={12} color={c.muted} style={{ marginTop: 8 }}>
              Left:{" "}
              {insole.frames.left
                ? "Receiving readings"
                : "Waiting for readings"}{" "}
              · Right:{" "}
              {insole.frames.right
                ? "Receiving readings"
                : "Waiting for readings"}
            </T>
          </Card>
          <Button
            label="Disconnect insole"
            secondary
            onPress={() => insole.disconnect()}
          />
        </>
      ) : (
        <>
          <Button
            label={
              guest
                ? "Sign in to connect"
                : insole.status === "scanning"
                  ? "Searching for your insole…"
                  : "Find my insole"
            }
            icon={Bluetooth}
            loading={loading}
            onPress={() => (guest ? nav.open({ kind: "auth" }) : insole.scan())}
          />
          {insole.status === "scanning" && (
            <Button label="Stop searching" secondary onPress={stopScan} />
          )}{" "}
          {insole.devices.map((d) => (
            <Button
              key={d.id}
              secondary
              label={`Connect ${d.name}`}
              onPress={() => insole.pair(d.id)}
            />
          ))}
        </>
      )}
      {!!insole.error && (
        <Card style={{ backgroundColor: c.pale }}>
          <T size={12}>{insole.error}</T>
          {!guest && (
            <Button
              label="Try again"
              secondary
              small
              onPress={() => insole.scan()}
              style={{ marginTop: 15 }}
            />
          )}
        </Card>
      )}
      <Button
        label="Explore the pressure animation"
        secondary
        onPress={() => {
          insole.setPreview(true);
          nav.open({ kind: "foot" });
        }}
      />
      <T size={11} color={c.muted} style={{ textAlign: "center" }}>
        Bluetooth connection is available in the Neem mobile development build.
        Connection states follow the device response.
      </T>
    </>
  );
}
function NewTask() {
  const { update, setNotice, data } = useStore(),
    nav = useNavigation(),
    c = useTheme();
  const [title, setTitle] = useState(""),
    [date, setDate] = useState(dayKey()),
    [time, setTime] = useState("18:00"),
    [reminder, setReminder] = useState(data.preferences.reminders),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (!title.trim()) {
      setError("Give your care task a name.");
      return;
    }
    const due = new Date(`${date}T${time}`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isFinite(due.getTime()) ||
      dayKey(due) !== date
    ) {
      setError("Enter a valid date and time.");
      return;
    }
    setBusy(true);
    setError("");
    const task = {
      id: uid(),
      title: title.trim(),
      dueAt: due.toISOString(),
      reminderId: undefined as string | undefined,
    };
    let reminderError = "";
    if (reminder) {
      try {
        task.reminderId = await scheduleReminder(task);
      } catch (e) {
        reminderError = (e as Error).message;
      }
    }
    const ok = await update((d) => ({ ...d, tasks: [...d.tasks, task] }));
    if (!ok && task.reminderId) await cancelReminder(task.reminderId);
    setBusy(false);
    if (ok) {
      nav.close();
      setNotice(reminderError || "A little time for your care, saved.");
    }
  }
  return (
    <>
      <T color={c.muted} size={13}>
        Make a little space for something that helps you feel well.
      </T>
      <Input
        label="What would you like to do?"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Check my feet after a walk"
        maxLength={140}
      />
      <T size={12} color={c.muted}>
        A few gentle ideas
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          "Check my feet",
          "Record blood glucose",
          "Record blood pressure",
          "Plan a balanced meal",
          "Prepare for my appointment",
        ].map((s) => (
          <Button
            key={s}
            label={s}
            small
            secondary
            onPress={() => setTitle(s)}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <Input label="Time (24-hour)" value={time} onChangeText={setTime} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 15,
        }}
      >
        <View style={{ flex: 1 }}>
          <T weight="semibold">A gentle reminder</T>
          <T size={11} color={c.muted}>
            Phone notifications need your permission.
          </T>
        </View>
        <Switch
          accessibilityLabel="Enable task reminder"
          value={reminder}
          onValueChange={setReminder}
          trackColor={{ true: c.teal }}
        />
      </View>
      {!!error && (
        <T accessibilityRole="alert" color={c.danger} size={12}>
          {error}
        </T>
      )}
      <Button
        label="Save care task"
        icon={Check}
        onPress={save}
        loading={busy}
      />
    </>
  );
}
function ArticlePanel({ id }: { id: string }) {
  const { data, update } = useStore(),
    c = useTheme(),
    article = articles.find((a) => a.id === id);
  if (!article)
    return (
      <Empty
        title="Article unavailable"
        detail="Return to Education to find another read."
      />
    );
  const saved = data.bookmarks.includes(id),
    read = data.readProgress[id];
  return (
    <>
      <Image
        source={{ uri: article.image }}
        accessibilityLabel={article.category}
        style={{ width: "100%", height: 220, borderRadius: 22 }}
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Badge label={article.category} />
        <Button
          small
          label={saved ? "Saved" : "Save article"}
          secondary
          icon={Bookmark}
          onPress={() =>
            update((d) => ({
              ...d,
              bookmarks: saved
                ? d.bookmarks.filter((v) => v !== id)
                : [...d.bookmarks, id],
            }))
          }
        />
      </View>
      <T size={30} weight="bold" style={{ letterSpacing: -1, lineHeight: 40 }}>
        {article.title}
      </T>
      <T size={11} color={c.muted}>
        Neem editorial · {article.minutes} min read{"\n"}Source date:{" "}
        {article.sourceDate} · No independent clinical review claimed
      </T>
      <T size={16} color={c.navy}>
        {article.intro}
      </T>
      {article.sections.map((s) => (
        <View key={s.title} style={{ gap: 9 }}>
          <T size={20} weight="bold">
            {s.title}
          </T>
          <T size={14} color={c.muted} style={{ lineHeight: 25 }}>
            {s.text}
          </T>
        </View>
      ))}
      <Card style={{ backgroundColor: c.subtle }}>
        <T size={11} weight="bold">
          Learn from the source
        </T>
        <T size={12} color={c.muted} style={{ marginTop: 6 }}>
          {article.sourceLabel}
        </T>
        <Button
          label="Read the original source"
          small
          secondary
          icon={ExternalLink}
          onPress={() => Linking.openURL(article.source)}
          style={{ alignSelf: "flex-start", marginTop: 13 }}
        />
      </Card>
      <Button
        label={read ? "Mark as unread" : "I’ve finished this read"}
        secondary={read}
        icon={Check}
        onPress={() =>
          update((d) => ({
            ...d,
            readProgress: { ...d.readProgress, [id]: !read },
          }))
        }
      />
    </>
  );
}
function ProfilePanel() {
  const store = useStore(),
    c = useTheme(),
    nav = useNavigation();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 17 }}>
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 24,
            backgroundColor: c.pale,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T size={27} weight="bold" color={c.teal}>
            {store.profile.name.slice(0, 1) || "N"}
          </T>
        </View>
        <View>
          <T size={23} weight="bold">
            {store.profile.name || "Welcome to Neem"}
          </T>
          <T size={12} color={c.muted}>
            {store.guest
              ? "Sign in to create your health profile"
              : "Your authorized health profile"}
          </T>
        </View>
      </View>
      <T size={12} weight="bold" color={c.muted}>
        YOUR PROFILES
      </T>
      <View style={{ gap: 10 }}>
        {store.profiles.map((p) => (
          <Pressable
            onPress={() => store.switchProfile(p.id)}
            accessibilityRole="button"
            key={p.id}
            style={{
              padding: 15,
              borderWidth: 1,
              borderRadius: 15,
              borderColor: p.id === store.profile.id ? c.teal : c.line,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <T size={14} weight="semibold">
                {p.name}
              </T>
              <T size={10} color={c.muted}>
                {store.guest ? "Your authorized profile" : "Authorized profile"}
              </T>
            </View>
            {p.id === store.profile.id && (
              <CheckCircle2 color={c.teal} size={20} />
            )}
          </Pressable>
        ))}
      </View>
      <View>
        <RowLink
          title="Edit your profile"
          icon={UserRound}
          onPress={() => nav.open({ kind: "edit-profile" })}
        />
        <RowLink
          title="Settings & preferences"
          icon={Settings}
          onPress={() => nav.open({ kind: "settings" })}
        />
        <RowLink
          title="Linked devices"
          icon={Bluetooth}
          onPress={() => nav.open({ kind: "pairing" })}
        />
        <RowLink
          title="Neem Premium"
          detail="A little more support"
          icon={Sparkles}
          onPress={() => nav.open({ kind: "subscription" })}
        />
        <RowLink
          title="Privacy & permissions"
          icon={ShieldCheck}
          onPress={() => nav.open({ kind: "privacy" })}
        />
        <RowLink
          title="Login & security"
          icon={KeyRound}
          onPress={() => nav.open({ kind: store.guest ? "auth" : "security" })}
        />
        <RowLink
          title="Help & support"
          icon={CircleHelp}
          onPress={() => nav.open({ kind: "help" })}
        />
      </View>
      {store.guest ? (
        <Button
          label="Sign in to your account"
          icon={ArrowRight}
          onPress={() => nav.open({ kind: "auth" })}
        />
      ) : (
        <Button
          label="Sign out"
          secondary
          icon={LogOut}
          onPress={() => {
            store.signOut();
            nav.close();
          }}
        />
      )}
      <T size={10} color={c.muted}>
        Dependent profiles must be provisioned and authorized by the account
        administrator. Each profile has its own records and device access.
      </T>
    </>
  );
}
function SettingsPanel() {
  const { data, update, refresh, guest, setNotice } = useStore(),
    c = useTheme(),
    nav = useNavigation();
  const prefs = data.preferences;
  return (
    <>
      <View style={{ gap: 15 }}>
        <T size={18} weight="bold">
          A view that feels like you
        </T>
        <Segments
          options={["Light", "Dark", "System"]}
          selected={
            prefs.appearance[0].toUpperCase() + prefs.appearance.slice(1)
          }
          onSelect={(s) =>
            update((d) => ({
              ...d,
              preferences: {
                ...d.preferences,
                appearance: s.toLowerCase() as any,
              },
            }))
          }
        />
      </View>
      <View style={{ gap: 14 }}>
        <T size={18} weight="bold">
          Your measurement units
        </T>
        <T size={12} color={c.muted}>
          Blood glucose
        </T>
        <Segments
          options={["mg/dL", "mmol/L"]}
          selected={prefs.glucoseUnit}
          onSelect={(s) =>
            update((d) => ({
              ...d,
              preferences: { ...d.preferences, glucoseUnit: s as any },
            }))
          }
        />
        <T size={12} color={c.muted}>
          Foot temperature
        </T>
        <Segments
          options={["°C", "°F"]}
          selected={prefs.temperatureUnit}
          onSelect={(s) =>
            update((d) => ({
              ...d,
              preferences: { ...d.preferences, temperatureUnit: s as any },
            }))
          }
        />
      </View>
      <View>
        <RowLink
          title="Notification preferences"
          detail="Choose a reminder when creating each task"
          icon={Bell}
          onPress={() => nav.open({ kind: "new-task" })}
        />
        <RowLink
          title="Bluetooth settings"
          icon={Bluetooth}
          onPress={() => nav.open({ kind: "pairing" })}
        />
        <RowLink
          title="Language"
          trailing="English"
          icon={Globe}
          onPress={() =>
            setNotice(
              "English is available. Additional translations are planned.",
            )
          }
        />
        <RowLink
          title="Privacy & data permissions"
          icon={ShieldCheck}
          onPress={() => nav.open({ kind: "privacy" })}
        />
        <RowLink
          title={guest ? "Account connection" : "Refresh secure records"}
          detail={
            guest
              ? "Sign in to synchronize your records"
              : "Reload your latest records from your account"
          }
          icon={RefreshCw}
          onPress={refresh}
        />
      </View>
      <T size={11} color={c.muted}>
        Neem 1.0.0 · Made for the little things that matter.
      </T>
    </>
  );
}
function EditProfile() {
  const { profile, rename } = useStore(),
    [name, setName] = useState(profile.name),
    nav = useNavigation();
  return (
    <>
      <Input
        label="Your name"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <Button
        label="Save profile"
        icon={Check}
        disabled={!name.trim()}
        onPress={async () => {
          await rename(name);
          nav.back();
        }}
      />
    </>
  );
}
function AuthPanel() {
  return <AccountAuth />;
}
function SecurityPanel() {
  return <AccountSecurity />;
}
function PrivacyPanel() {
  const { guest, data, update } = useStore(),
    c = useTheme();
  return (
    <>
      <ShieldCheck size={38} color={c.teal} />
      <T size={26} weight="bold">
        Your care. Your choice.
      </T>
      <T color={c.muted} size={13}>
        {guest
          ? "Sign in to keep your health records in your private account. Only display preferences and saved articles are stored in this browser before sign-in."
          : "Clerk manages your sign-in. Your health records are stored in Convex and restricted to authorized members of your profile."}
      </T>
      <Card style={{ backgroundColor: c.pale }}>
        <T weight="bold">Choose what you share with Neem AI</T>
        <T size={12} color={c.muted} style={{ marginTop: 10 }}>
          Your messages, recent conversation history and relevant book passages
          are processed through OpenRouter and its AI model provider. Your
          health records are included only when you select “Include my readings”
          for a conversation. Conversations are saved in your account. If book
          search is enabled, its search text also passes through Lovable’s
          embedding service.
        </T>
        <View
          style={{
            flexDirection: "row",
            gap: 15,
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <T size={13} style={{ flex: 1 }}>
            Allow my messages to be sent to Neem AI
          </T>
          <Switch
            accessibilityLabel="Allow my messages to be sent to Neem AI"
            value={hasOpenRouterConsent(data.preferences)}
            onValueChange={(aiConsent) => {
              void update((d) => ({
                ...d,
                preferences: {
                  ...d.preferences,
                  aiConsent,
                  aiConsentProvider: "openrouter",
                },
              }));
            }}
            trackColor={{ true: c.teal }}
          />
        </View>
      </Card>
      <T size={12} color={c.muted}>
        Turning off AI sharing stops new requests. It does not erase
        conversations already saved or data already processed by the service.
        The pressure animation is never added to your health history.
      </T>
      <T size={12} color={c.muted}>
        Pressure maps support monitoring and cannot diagnose an ulcer. Clinical
        alerts require supported sensors and validated rules.
      </T>
    </>
  );
}
function NotificationsPanel() {
  const { guest, data, update, profile } = useStore(),
    insole = useInsole(),
    c = useTheme();
  const alerts =
    useQuery(
      api.devices.alerts,
      !guest && profile.id
        ? { profileId: profile.id as Id<"profiles"> }
        : "skip",
    ) || [];
  const [category, setCategory] = useState("All");
  const updates = [
    ...alerts.map((a) => ({
      id: a.id,
      category: "Health",
      title:
        a.level === "contact_care_team"
          ? "Contact your care team"
          : "Review recommended",
      detail: `${a.reason} · Configured rule ${a.ruleVersion}`,
    })),
    ...data.tasks
      .filter((t) => !t.completedAt)
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        category: "Tasks",
        title: t.title,
        detail: new Date(t.dueAt).toLocaleString(),
      })),
    ...(insole.connected
      ? [
          {
            id: "connected",
            category: "Device",
            title: "Your insole is connected",
            detail: Object.keys(insole.frames).length
              ? "Sensor readings are arriving."
              : "Waiting for valid sensor readings.",
          },
        ]
      : []),
  ];
  const filtered = updates.filter(
      (a) => category === "All" || a.category === category,
    ),
    read = data.readProgress["notifications-read"];
  return (
    <>
      <Segments
        options={["All", "Device", "Health", "Tasks"]}
        selected={category}
        onSelect={setCategory}
        compact
      />
      {filtered.length ? (
        filtered.map((u) => (
          <Card
            key={u.id}
            style={{ backgroundColor: read ? c.subtle : c.card }}
          >
            <Badge label={u.category} />
            <T size={16} weight="bold" style={{ marginTop: 12 }}>
              {u.title}
            </T>
            <T size={12} color={c.muted} style={{ marginTop: 8 }}>
              {u.detail}
            </T>
          </Card>
        ))
      ) : (
        <Empty
          icon={Bell}
          title="You’re all caught up"
          detail="Device updates, care tasks and configured health alerts will appear here."
        />
      )}
      {updates.length > 0 && (
        <Button
          label={read ? "All caught up" : "Mark all as read"}
          secondary
          disabled={read}
          onPress={() => {
            void update((d) => ({
              ...d,
              readProgress: { ...d.readProgress, "notifications-read": true },
            }));
          }}
        />
      )}
    </>
  );
}
function SubscriptionPanel() {
  const { guest, setNotice, refresh } = useStore(),
    account = useAccount(),
    c = useTheme();
  const [plans, setPlans] = useState<StorePlan[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!guest)
      loadPlans(account.userId)
        .then(setPlans)
        .catch(() => {});
  }, [guest, account.userId]);
  async function runStore(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await refresh();
      setNotice("Premium access verified.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <View style={{ alignItems: "center", gap: 13 }}>
        <Sparkles size={38} color={c.teal} strokeWidth={1.3} />
        <Badge label="NEEM PREMIUM" />
        <T
          size={29}
          weight="bold"
          style={{ textAlign: "center", letterSpacing: -1 }}
        >
          A little more support.{"\n"}Every step of the way.
        </T>
        <T size={13} color={c.muted} style={{ textAlign: "center" }}>
          Understand your health with a thoughtful companion.
        </T>
      </View>
      <Card style={{ backgroundColor: c.pale, borderWidth: 0 }}>
        {[
          "Plain-language health education",
          "Explanations of recorded health trends",
          "Care habit and appointment preparation",
          "Nutrition education and everyday ideas",
          "History summaries with your permission",
        ].map((s) => (
          <View
            key={s}
            style={{ flexDirection: "row", gap: 11, paddingVertical: 12 }}
          >
            <CheckCircle2 size={18} color={c.teal} />
            <T size={13} style={{ flex: 1 }}>
              {s}
            </T>
          </View>
        ))}
      </Card>
      <T size={18} weight="bold" style={{ textAlign: "center" }}>
        {plans.length ? "Choose your store plan" : "Subscriptions open soon"}
      </T>
      <T size={12} color={c.muted} style={{ textAlign: "center" }}>
        {plans.length
          ? "Prices and billing periods come from your app store. Review the store confirmation before subscribing. Premium access is granted after server verification."
          : "Store subscriptions are not available yet. Any future plan will show its price and billing period before purchase."}
      </T>
      {plans.length ? (
        <View style={{ gap: 12 }}>
          {plans.map((p) => (
            <Card key={p.id}>
              <T size={17} weight="bold">
                {p.title}
              </T>
              <T size={12} color={c.muted}>
                {p.description}
              </T>
              <Button
                label={`Continue · ${p.price}`}
                loading={busy}
                onPress={() =>
                  runStore(() => purchasePlan(p.id, account.userId))
                }
                style={{ marginTop: 15 }}
              />
            </Card>
          ))}
          <Button
            label="Restore purchases"
            secondary
            loading={busy}
            onPress={() => runStore(() => restorePurchases(account.userId))}
          />
        </View>
      ) : (
        <Button label="Subscriptions coming soon" disabled onPress={() => {}} />
      )}
      <T size={10} color={c.muted} style={{ textAlign: "center" }}>
        AI supports education and understanding. It does not diagnose, prescribe
        or replace your care team.
      </T>
    </>
  );
}
function HelpPanel() {
  const c = useTheme(),
    [selected, setSelected] = useState("");
  const faqs = [
    {
      q: "How do I connect my insoles?",
      a: "Open your device card, then choose Find a real smart insole. A secure account, the native Neem development build, Bluetooth permission and a verified device service are required. The browser offers the walking-pressure animation.",
    },
    {
      q: "Where do my readings come from?",
      a: "Glucose and blood pressure come from your manual entries or supported external devices. A smart insole does not measure them. Foot pressure and temperature appear only when supported sensors report valid values.",
    },
    {
      q: "What does the pressure animation show?",
      a: "The animation illustrates pressure moving through a walking step. It is separate from your health records. Connect a supported insole to view measured sensor regions.",
    },
    {
      q: "Can Neem diagnose a foot condition?",
      a: "No. Pressure monitoring and education cannot confirm an ulcer or replace a clinical assessment. Discuss a new sore, redness, swelling or unusual warmth promptly with your healthcare professional.",
    },
  ];
  return (
    <>
      <CircleHelp size={37} color={c.teal} strokeWidth={1.2} />
      <T size={25} weight="bold">
        A little help along the way.
      </T>
      {faqs.map((f) => (
        <Pressable
          accessibilityRole="button"
          key={f.q}
          onPress={() => setSelected(selected === f.q ? "" : f.q)}
          style={{
            borderBottomWidth: 1,
            borderColor: c.line,
            paddingBottom: 19,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <T size={14} weight="bold" style={{ flex: 1 }}>
              {f.q}
            </T>
            <Plus size={18} color={c.teal} />
          </View>
          {selected === f.q && (
            <T size={13} color={c.muted} style={{ marginTop: 13 }}>
              {f.a}
            </T>
          )}
        </Pressable>
      ))}
    </>
  );
}

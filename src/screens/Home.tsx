import { PRESSURE_COLORS } from "../pressure";
import React from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Pause,
  Play,
  Bluetooth,
  Check,
  Droplet,
  Heart,
  Thermometer,
} from "lucide-react-native";
import { useStore } from "../store";
import { useInsole } from "../insole";
import { useNavigation } from "../navigation";
import {
  Metric,
  articles,
  bmi,
  displayReading,
  isToday,
  filterReadings,
  metricInfo,
} from "../domain";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Section,
  Segments,
  T,
  useTheme,
} from "../components/ui";
import {
  FootMaps,
  InsoleProduct,
  HealthChart,
  Sparkline,
} from "../components/graphics";

import { StepCounter } from "../components/StepCounter";
import { ReadingTicks } from "../components/MonoCharts";

const icons = {
  glucose: Droplet,
  pressure: Heart,
  bmi: Activity,
  temperature: Thermometer,
};
export function MetricCard({
  kind,
  tall = false,
}: {
  kind: Metric;
  tall?: boolean;
}) {
  const { data } = useStore(),
    c = useTheme(),
    nav = useNavigation();
  const [cardWidth, setCardWidth] = React.useState(160);
  const readings = data.readings
    .filter((r) => r.kind === kind)
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const reading = readings.at(-1),
    info = metricInfo[kind],
    Icon = icons[kind],
    value = displayReading(reading, data.preferences);
  const backgroundColor =
    kind === "pressure" ? c.lavender : kind === "bmi" ? c.mint : c.peach;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${info.label}`}
      onPress={() => nav.open({ kind: "metric", metric: kind })}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}
    >
      <View
        onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        style={{
          flex: 1,
          minHeight: tall ? 250 : 120,
          borderRadius: 26,
          padding: 16,
          backgroundColor,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 3,
          }}
        >
          <T size={15} style={{ flex: 1, letterSpacing: -0.3 }}>
            {kind === "pressure"
              ? "Blood pressure"
              : kind === "bmi"
                ? "Body mass"
                : "Foot temp."}
          </T>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 20,
              backgroundColor: c.card,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={17} color={c.text} strokeWidth={1.6} />
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 4,
            marginTop: tall ? 22 : 10,
          }}
        >
          <T
            size={kind === "pressure" ? 30 : 32}
            weight="semibold"
            style={{ letterSpacing: -1.5 }}
          >
            {value.value}
          </T>
          <T size={11} color={c.muted}>
            {value.unit || (kind === "bmi" ? "BMI" : info.unit)}
          </T>
        </View>
        {tall ? (
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              marginHorizontal: -16,
              marginBottom: -16,
              marginTop: 12,
            }}
          >
            {readings.length ? (
              <Sparkline
                values={readings
                  .slice(-10)
                  .map((r) =>
                    kind === "bmi" ? bmi(r.value, r.height!) : r.value,
                  )}
                color="#8E76A2"
                width={cardWidth}
                height={85}
              />
            ) : (
              <View
                style={{ height: 85, padding: 16, justifyContent: "flex-end" }}
              >
                <View
                  style={{
                    borderTopWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "#8E76A260",
                    marginBottom: 12,
                  }}
                />
                <T size={11} color={c.muted}>
                  No readings yet
                </T>
              </View>
            )}
          </View>
        ) : (
          <T size={10} color={c.muted} style={{ marginTop: 4 }}>
            {reading
              ? new Date(reading.at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "Add your first reading"}
          </T>
        )}
      </View>
    </Pressable>
  );
}
export function TaskRow({
  task,
}: {
  task: ReturnType<typeof useStore>["data"]["tasks"][number];
}) {
  const { update } = useStore(),
    c = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!task.completedAt }}
      aria-checked={!!task.completedAt}
      accessibilityLabel={task.title}
      onPress={() =>
        update((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  completedAt: t.completedAt
                    ? undefined
                    : new Date().toISOString(),
                }
              : t,
          ),
        }))
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 15,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 8,
          borderWidth: task.completedAt ? 0 : 1.4,
          borderColor: c.line,
          backgroundColor: task.completedAt ? c.teal : c.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {task.completedAt && (
          <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <T
          size={12}
          weight="medium"
          color={task.completedAt ? c.muted : c.text}
          style={task.completedAt ? { textDecorationLine: "line-through" } : {}}
        >
          {task.title}
        </T>
      </View>
      <T size={10} color={c.muted}>
        {new Date(task.dueAt).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </T>
    </Pressable>
  );
}
export function ArticleCard({
  article,
  compact = false,
}: {
  article: (typeof articles)[number];
  compact?: boolean;
}) {
  const nav = useNavigation(),
    c = useTheme();
  return (
    <Pressable
      onPress={() => nav.open({ kind: "article", id: article.id })}
      accessibilityRole="button"
      accessibilityLabel={`Read ${article.title}`}
      style={{ flex: 1, minWidth: compact ? 150 : 230 }}
    >
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Image
          accessibilityLabel={
            article.category === "Nutrition"
              ? "A colorful meal with vegetables"
              : "Outdoor movement and wellbeing"
          }
          source={{ uri: article.image }}
          style={{ width: "100%", height: compact ? 125 : 175 }}
        />
        <View style={{ padding: compact ? 16 : 21, gap: 8 }}>
          <T
            size={9}
            weight="extra"
            color={c.teal}
            style={{ letterSpacing: 1 }}
          >
            {article.category.toUpperCase()}
          </T>
          <T
            size={compact ? 14 : 18}
            weight="bold"
            style={{ letterSpacing: -0.3 }}
          >
            {article.title}
          </T>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <T size={10} color={c.muted}>
              {article.minutes} min read · Neem editorial
            </T>
            <ArrowUpRight size={15} color={c.navy} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
export function Home() {
  const { data, guest } = useStore(),
    insole = useInsole(),
    nav = useNavigation(),
    c = useTheme(),
    { width } = useWindowDimensions();
  const [paused, setPaused] = React.useState(false),
    [period, setPeriod] = React.useState("7 Days"),
    [metricPage, setMetricPage] = React.useState(0);
  const wide = width >= 1120,
    today = data.tasks.filter((t) => isToday(t.dueAt)),
    done = today.filter((t) => t.completedAt).length;
  const glucose = data.readings
    .filter((r) => r.kind === "glucose")
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const latest = glucose.at(-1),
    display = displayReading(latest, data.preferences),
    hasFrames = Object.keys(insole.frames).length > 0;
  const primary = (["pressure", "bmi", "temperature"] as Metric[])[metricPage];
  const secondary = (["pressure", "bmi", "temperature"] as Metric[]).filter(
    (k) => k !== primary,
  );
  return (
    <View style={{ gap: 24 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1, gap: 24 }}>
          <Card style={{ padding: 22 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View>
                {insole.preview && (
                  <IconButton
                    icon={paused ? Play : Pause}
                    label={
                      paused
                        ? "Play pressure animation"
                        : "Pause pressure animation"
                    }
                    onPress={() => setPaused((v) => !v)}
                    style={{ width: 35, height: 35, backgroundColor: c.subtle }}
                  />
                )}
              </View>
              <IconButton
                icon={ArrowUpRight}
                label="View pressure reports"
                onPress={() => nav.go("Analytics")}
                style={{ backgroundColor: c.bg }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore your foot pressure map"
              onPress={() => nav.open({ kind: "foot" })}
            >
              <FootMaps
                height={Math.min(250, (width - 96) / 1.1)}
                frames={insole.frames}
                preview={insole.preview}
                paused={paused}
              />
            </Pressable>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                justifyContent: "center",
                marginTop: 20,
              }}
            >
              <T size={10} color={c.muted}>
                Lower
              </T>
              {PRESSURE_COLORS.map((color) => (
                <View
                  key={color}
                  style={{
                    height: 5,
                    width: 22,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
              ))}
              <T size={10} color={c.muted}>
                Higher
              </T>
            </View>
            <T
              size={11}
              color={c.muted}
              style={{ textAlign: "center", marginTop: 15 }}
            >
              {insole.preview
                ? "Watch pressure move through a step. Connect your insoles to see your own readings."
                : hasFrames
                  ? "Smooth shading estimates pressure between measured sensor regions."
                  : "Your insole is linked. The map appears when valid readings arrive."}
            </T>
            {insole.connected && (
              <Button
                label={
                  insole.preview
                    ? "Show my live readings"
                    : "Explore pressure animation"
                }
                secondary
                small
                onPress={() => insole.setPreview(!insole.preview)}
                style={{ marginTop: 16, alignSelf: "center" }}
              />
            )}
          </Card>
          <StepCounter />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View blood glucose"
            onPress={() => nav.open({ kind: "metric", metric: "glucose" })}
          >
            <Card
              style={{
                backgroundColor: c.bluePale,
                padding: 20,
                minHeight: 174,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <T size={18} style={{ letterSpacing: -0.4 }}>
                  Blood glucose
                </T>
                <Badge
                  label={latest ? "Recorded" : "No readings yet"}
                  color={latest ? c.teal : c.muted}
                  bg={latest ? c.mint : c.card}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 10,
                  marginTop: 28,
                }}
              >
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: 7,
                    }}
                  >
                    <T
                      size={42}
                      weight="semibold"
                      style={{ letterSpacing: -2, lineHeight: 53 }}
                    >
                      {display.value}
                    </T>
                    <T size={15} color={c.muted}>
                      {display.unit || data.preferences.glucoseUnit}
                    </T>
                  </View>
                  <T size={11} color={c.muted}>
                    {latest
                      ? `${latest.context} · ${new Date(latest.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : "A little check-in with your health"}
                  </T>
                </View>
                <ReadingTicks values={glucose.map((r) => r.value)} />
              </View>
            </Card>
          </Pressable>
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <T size={20} weight="medium" style={{ letterSpacing: -0.5 }}>
                Overview
              </T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <IconButton
                  icon={ChevronLeft}
                  label="Previous overview metric"
                  onPress={() => setMetricPage((v) => (v + 2) % 3)}
                  style={{ width: 37, height: 37 }}
                />
                <IconButton
                  icon={ChevronRight}
                  label="Next overview metric"
                  onPress={() => setMetricPage((v) => (v + 1) % 3)}
                  color="#FFFFFF"
                  style={{ width: 37, height: 37, backgroundColor: c.ink }}
                />
              </View>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}
            >
              <View style={{ flex: 1 }}>
                <MetricCard kind={primary} tall />
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                {secondary.map((kind) => (
                  <MetricCard key={kind} kind={kind} />
                ))}
              </View>
            </View>
          </View>
        </View>
        <Card style={{ flex: wide ? 1 : undefined, minWidth: 0, padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <T
              size={18}
              weight="medium"
              style={{ flex: 1, letterSpacing: -0.4 }}
            >
              Blood glucose trend
            </T>
            <Segments
              options={["7 Days", "30 Days"]}
              selected={period}
              onSelect={setPeriod}
              compact
            />
          </View>
          <HealthChart
            readings={filterReadings(data.readings, "glucose", period)}
            height={wide ? 290 : 178}
            mode="bars"
            convert={
              data.preferences.glucoseUnit === "mmol/L"
                ? (v) => v / 18.0182
                : undefined
            }
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all health reports"
            onPress={() => nav.go("Analytics")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 16,
              marginTop: 14,
              borderTopWidth: 1,
              borderColor: c.line,
            }}
          >
            <T size={13}>See your full picture</T>
            <ArrowUpRight size={18} color={c.text} strokeWidth={1.5} />
          </Pressable>
        </Card>
      </View>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1 : undefined, gap: 20 }}>
          <Card
            style={{ backgroundColor: c.mint, padding: 22, overflow: "hidden" }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <T size={17}>Neem smart insole</T>
              <Bluetooth size={20} color={c.text} strokeWidth={1.5} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <View style={{ flex: 1, gap: 8 }}>
                <T
                  size={27}
                  weight="medium"
                  style={{ letterSpacing: -0.8, lineHeight: 33 }}
                >
                  {insole.connected
                    ? "A little more\nconnected."
                    : "Better care.\nFrom the sole up."}
                </T>
                <T size={11} color={c.muted}>
                  {insole.connected
                    ? insole.battery === undefined
                      ? "Connected · Battery unavailable"
                      : `Connected · ${insole.battery}% battery`
                    : insole.simulation === "connected"
                      ? "neem · Preview ready"
                      : "Connect your everyday companion."}
                </T>
              </View>
              <View style={{ width: 115 }}>
                <InsoleProduct height={135} />
              </View>
            </View>
            <Button
              label={
                insole.connected
                  ? "Manage my insole"
                  : insole.simulation === "connected"
                    ? "View connection preview"
                    : "Connect my insole"
              }
              icon={Bluetooth}
              onPress={() => nav.open({ kind: "pairing" })}
              style={{ marginTop: 16 }}
            />
          </Card>
          <Card style={{ backgroundColor: c.lavender }}>
            <View
              style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 25,
                  backgroundColor: c.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Footprints size={23} color={c.text} strokeWidth={1.4} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={18} weight="medium">
                  A little care, daily.
                </T>
                <T size={12} color={c.muted} style={{ marginTop: 4 }}>
                  {today.length
                    ? `${done} of ${today.length} tasks completed today`
                    : "Make room for a healthy habit."}
                </T>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                today.length
                  ? nav.go("Tasks")
                  : nav.open({ kind: guest ? "auth" : "new-task" })
              }
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 22,
              }}
            >
              <T size={13} weight="medium">
                {today.length ? "View today’s care" : "Start your routine"}
              </T>
              <ArrowRight size={19} color={c.text} strokeWidth={1.5} />
            </Pressable>
          </Card>
        </View>
      </View>
      {guest && (
        <Card style={{ backgroundColor: c.bluePale }}>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 18,
              alignItems: wide ? "center" : "stretch",
            }}
          >
            <View style={{ flex: 1 }}>
              <T size={24} weight="medium" style={{ letterSpacing: -0.6 }}>
                Your health. Your own space.
              </T>
              <T size={13} color={c.muted} style={{ marginTop: 7 }}>
                Save your readings, build a routine and keep your care
                connected.
              </T>
            </View>
            <Button
              label="Get started"
              icon={ArrowRight}
              onPress={() => nav.open({ kind: "auth" })}
            />
          </View>
        </Card>
      )}
      {today.length > 0 && (
        <Card>
          <Section
            title="A moment for your care"
            action="All tasks"
            onPress={() => nav.go("Tasks")}
          />
          {today.slice(0, 3).map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </Card>
      )}
      <View>
        <Section
          title="A little more knowledge"
          action="Explore"
          onPress={() => nav.go("Education")}
        />
        <View
          style={{ flexDirection: width >= 700 ? "row" : "column", gap: 16 }}
        >
          {articles.slice(0, 2).map((article) => (
            <ArticleCard key={article.id} article={article} compact={!wide} />
          ))}
        </View>
      </View>
    </View>
  );
}

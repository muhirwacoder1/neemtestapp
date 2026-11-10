import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChartColumn,
  ChartSpline,
  Info,
} from "lucide-react-native";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  Section,
  Segments,
  T,
  useTheme,
} from "../components/ui";
import { FootMaps, HealthChart } from "../components/graphics";
import { PressureInsights } from "../components/PressureInsights";
import { MeasurementGauge } from "../components/MonoCharts";
import { useStore } from "../store";
import { useInsole } from "../insole";
import { useNavigation } from "../navigation";
import {
  Metric,
  dayKey,
  displayReading,
  filterReadings,
  metricInfo,
} from "../domain";
import { exportRecords } from "../services/export";
export function Analytics() {
  const { data, profile, setNotice, hasMoreReadings } = useStore(),
    insole = useInsole(),
    nav = useNavigation(),
    c = useTheme(),
    { width } = useWindowDimensions();
  const [period, setPeriod] = useState("7 Days"),
    [start, setStart] = useState(() =>
      dayKey(new Date(Date.now() - 6 * 86400000)),
    ),
    [end, setEnd] = useState(dayKey()),
    [chartMode, setChartMode] = useState("Bars");
  const invalidRange =
    period === "Custom" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      start > end ||
      end > dayKey());
  const selected = (kind: Metric) =>
    invalidRange
      ? []
      : filterReadings(data.readings, kind, period, { start, end });
  const wide = width >= 1120,
    kinds: Metric[] = ["glucose", "pressure", "bmi", "temperature"];
  const colors = [c.blue, "#B79BCF", "#91B97B", "#EEA88C"];
  return (
    <View style={{ gap: 26 }}>
      <PressureInsights />
      <T
        size={23}
        weight="medium"
        style={{ letterSpacing: -0.7, marginTop: 8 }}
      >
        Your health records
      </T>
      <View style={{ alignItems: "center" }}>
        <Segments
          options={["Today", "7 Days", "30 Days", "90 Days", "Custom"]}
          selected={period}
          onSelect={setPeriod}
          compact
        />
      </View>
      {period === "Custom" && (
        <Card>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Input
              label="Start date (YYYY-MM-DD)"
              value={start}
              onChangeText={setStart}
              placeholder="2026-10-01"
            />
            <Input
              label="End date (YYYY-MM-DD)"
              value={end}
              onChangeText={setEnd}
              placeholder="2026-10-21"
            />
          </View>
          {invalidRange && (
            <T size={12} color={c.danger} style={{ marginTop: 12 }}>
              Choose a valid date range that ends on or before today.
            </T>
          )}
        </Card>
      )}
      <View
        style={{
          maxWidth: 510,
          width: "100%",
          alignSelf: "center",
          paddingVertical: 12,
        }}
      >
        <MeasurementGauge
          counts={kinds.map((kind, i) => ({
            label:
              kind === "bmi"
                ? "Body mass"
                : kind === "temperature"
                  ? "Foot temp."
                  : kind === "glucose"
                    ? "Glucose"
                    : "Pressure",
            count: selected(kind).length,
            color: colors[i],
          }))}
        />
      </View>
      {hasMoreReadings && (
        <T size={12} color={c.muted}>
          Showing your 1,000 most recent measurements. Exports include this
          loaded history.
        </T>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <T size={21} weight="medium" style={{ letterSpacing: -0.6 }}>
          Your health trends
        </T>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {[
            { label: "Bars", icon: ChartColumn },
            { label: "Line", icon: ChartSpline },
          ].map(({ label, icon: Icon }) => (
            <IconButton
              key={label}
              icon={Icon}
              label={`Show ${label.toLowerCase()} charts`}
              onPress={() => setChartMode(label)}
              color={chartMode === label ? "#FFFFFF" : c.text}
              style={{
                width: 38,
                height: 38,
                backgroundColor: chartMode === label ? c.ink : c.card,
              }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
        {kinds.map((kind, i) => {
          const records = selected(kind),
            info = metricInfo[kind],
            latest = records.at(-1),
            display = displayReading(latest, data.preferences);
          return (
            <Card
              key={kind}
              style={{
                width: wide ? "48.5%" : "100%",
                flexGrow: 1,
                padding: 20,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <T size={18} weight="medium" style={{ letterSpacing: -0.5 }}>
                  {info.label}
                </T>
                <IconButton
                  icon={ArrowUpRight}
                  label={`Open ${info.label} details`}
                  onPress={() => nav.open({ kind: "metric", metric: kind })}
                  style={{
                    backgroundColor: [c.bluePale, c.lavender, c.mint, c.peach][
                      i
                    ],
                    width: 34,
                    height: 34,
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 14,
                  marginBottom: 18,
                }}
              >
                <T size={35} weight="semibold" style={{ letterSpacing: -1.6 }}>
                  {display.value}
                </T>
                <T size={13} color={c.muted}>
                  {display.unit ||
                    (kind === "glucose"
                      ? data.preferences.glucoseUnit
                      : kind === "temperature"
                        ? data.preferences.temperatureUnit
                        : info.unit)}
                </T>
                <T size={11} color={c.muted} style={{ marginLeft: "auto" }}>
                  {records.length} readings
                </T>
              </View>
              <HealthChart
                readings={records}
                height={190}
                mode={chartMode === "Bars" ? "bars" : "line"}
                dual={kind === "pressure"}
                convert={
                  kind === "glucose" &&
                  data.preferences.glucoseUnit === "mmol/L"
                    ? (v) => v / 18.0182
                    : kind === "temperature" &&
                        data.preferences.temperatureUnit === "°F"
                      ? (v) => v * 1.8 + 32
                      : undefined
                }
              />
              <T size={10} color={c.muted} style={{ marginTop: 14 }}>
                {kind === "bmi"
                  ? "BMI is one part of your health picture. No age-based interpretation is applied."
                  : kind === "temperature"
                    ? "From a supported sensor or a recorded manual measurement."
                    : "Discuss your reference ranges with your clinician. No clinical target is configured."}
              </T>
            </Card>
          );
        })}
      </View>
      <Button
        label="Export this summary"
        icon={ArrowDownToLine}
        secondary
        onPress={() =>
          exportRecords(profile, kinds.flatMap(selected))
            .then(() => setNotice("Your summary is ready."))
            .catch(() =>
              setNotice("The summary could not be exported. Try again."),
            )
        }
        style={{ alignSelf: "center" }}
      />
      <Card>
        <Section
          title="A closer look at your steps"
          action="Explore map"
          onPress={() => nav.open({ kind: "foot" })}
        />
        <FootMaps
          frames={insole.frames}
          height={Math.min(250, (width - 96) / 1.1)}
          preview={insole.preview}
        />
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <Badge
            label={
              insole.preview
                ? "Animation preview"
                : Object.keys(insole.frames).length
                  ? "Relative pressure · 0–100"
                  : "No sensor readings available"
            }
            bg={c.subtle}
            color={c.muted}
          />
        </View>
        <T size={11} color={c.muted} style={{ marginTop: 16 }}>
          Pressure maps help you understand patterns. They cannot confirm an
          ulcer or replace a daily foot check.
        </T>
      </Card>
      <Card style={{ backgroundColor: c.peach }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Info size={20} color={c.text} />
          <T size={17} weight="medium">
            Keep your care team close.
          </T>
        </View>
        <T size={13} color={c.muted} style={{ marginTop: 12 }}>
          If you notice a new sore, unusual warmth, redness or swelling, contact
          your care team promptly.
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.open({ kind: "article", id: "daily-care" })}
          style={{ marginTop: 18 }}
        >
          <T size={13} weight="semibold">
            Know the warning signs ↗
          </T>
        </Pressable>
      </Card>
    </View>
  );
}

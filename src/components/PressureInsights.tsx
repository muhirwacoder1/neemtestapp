import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react-native";
import { useInsole } from "../insole";
import { useNavigation } from "../navigation";
import { GAIT_DURATION } from "../pressure";
import {
  analyzePressureSession,
  normalPressureSession,
  RegionPressureReport,
} from "../pressureAnalytics";
import { Badge, Button, Card, fonts, Segments, T, useTheme } from "./ui";

// Rounded paired bars adapted from the supplied Amicro example. Both series use
// the same relative-pressure scale; transaction examples and calendar data are omitted.
function PeakPressureChart({
  rows,
  selected,
  onSelect,
}: {
  rows: RegionPressureReport[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const c = useTheme(),
    [width, setWidth] = useState(300);
  const height = 210,
    left = 28,
    right = 10,
    top = 15,
    bottom = 179;
  const span = (width - left - right) / rows.length,
    bar = Math.min(18, span * 0.29),
    gap = 4;
  const y = (value: number) => bottom - (value / 100) * (bottom - top);
  return (
    <View
      onLayout={(e) => setWidth(Math.max(180, e.nativeEvent.layout.width))}
      style={{ height }}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        accessibilityLabel="Preview peak and average relative pressure by foot region, on a zero to one hundred scale"
      >
        {[0, 50, 100].map((value) => (
          <G key={value}>
            <Line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke={c.line}
              strokeDasharray="2 5"
            />
            <SvgText
              x={0}
              y={y(value) + 4}
              fontSize={10}
              fontFamily={fonts.regular}
              fill={c.muted}
            >
              {value}
            </SvgText>
          </G>
        ))}
        {rows.map((row, i) => {
          const center = left + span * (i + 0.5);
          return (
            <G key={row.id}>
              {row.peak !== null && row.peak > 0 && (
                <Rect
                  x={center - gap / 2 - bar}
                  y={y(row.peak)}
                  width={bar}
                  height={bottom - y(row.peak)}
                  rx={6}
                  fill={c.text}
                />
              )}
              {row.average !== null && row.average > 0 && (
                <Rect
                  x={center + gap / 2}
                  y={y(row.average)}
                  width={bar}
                  height={bottom - y(row.average)}
                  rx={6}
                  fill={c.text}
                  opacity={0.19}
                />
              )}
              <SvgText
                x={center}
                y={200}
                textAnchor="middle"
                fontSize={10}
                fontFamily={i === selected ? fonts.semibold : fonts.regular}
                fill={i === selected ? c.text : c.muted}
              >
                {row.short}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {rows.map((row, i) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Select ${row.label}: peak ${Math.round(row.peak ?? 0)}, average ${Math.round(row.average ?? 0)} relative pressure`}
          accessibilityState={{ selected: i === selected }}
          onPress={() => onSelect(i)}
          style={{
            position: "absolute",
            left: left + span * i,
            top: 0,
            width: span,
            height,
          }}
        />
      ))}
    </View>
  );
}
const regionNotes: Record<string, string> = {
  heel: "The heel loads early, then unloads toward push-off.",
  midfoot: "The midfoot carries a lower, distributed load in this preview.",
  metatarsals:
    "The metatarsal heads load through stance, then release toward toe-off.",
  hallux: "The big toe reaches its highest load during push-off.",
  lesserToes: "The smaller toes share load as pressure moves forward.",
};
export function PressureInsights() {
  const c = useTheme(),
    insole = useInsole(),
    nav = useNavigation();
  const [source, setSource] = useState("Preview"),
    [range, setRange] = useState("10 cycles"),
    [selected, setSelected] = useState(0),
    [explain, setExplain] = useState(false);
  const cycles = range === "1 cycle" ? 1 : 10;
  const report = useMemo(
    () => analyzePressureSession(normalPressureSession(cycles)),
    [cycles],
  );
  const row = report.rows[selected],
    normal = report.level === "low";
  return (
    <View style={{ gap: 18, width: "100%", maxWidth: 680, alignSelf: "center" }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <T size={23} weight="medium" style={{ letterSpacing: -0.7 }}>
          Ulcer analytics
        </T>
        <Badge
          label={source === "Preview" ? "Preview" : "My insole"}
          dot
          bg={source === "Preview" ? c.bluePale : c.subtle}
          color={c.text}
        />
      </View>
      <Segments
        options={["Preview", "My insole"]}
        selected={source}
        onSelect={setSource}
      />
      {source === "Preview" ? (
        <>
          <Card style={{ backgroundColor: normal ? c.mint : c.peach, gap: 15 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <T size={13} color={c.muted}>
                Preview pressure alert level
              </T>
              <View
                style={{
                  width: 39,
                  height: 39,
                  borderRadius: 22,
                  backgroundColor: c.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={22} strokeWidth={1.5} color={c.text} />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <T
                size={49}
                weight="medium"
                style={{ letterSpacing: -2, lineHeight: 55 }}
              >
                {normal
                  ? "Low"
                  : report.level === "review"
                    ? "Review"
                    : "Watch"}
              </T>
              <Badge
                label={normal ? "Normal pattern" : "Pattern to review"}
                bg={c.card}
                color={c.text}
              />
            </View>
            <T
              size={21}
              weight="medium"
              style={{ letterSpacing: -0.5, lineHeight: 27 }}
            >
              {normal
                ? "No unusual pressure detected."
                : "Repeated unusual pressure needs a closer look."}
            </T>
            <T size={12} color={c.muted}>
              Normal walking preview · {cycles}{" "}
              {cycles === 1 ? "cycle" : "cycles"} ·{" "}
              {((cycles * GAIT_DURATION) / 1000).toFixed(cycles === 1 ? 1 : 0)}{" "}
              seconds
            </T>
            <View
              style={{ height: 1, backgroundColor: c.text, opacity: 0.1 }}
            />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <T size={12} color={c.muted}>
                  Peak pressure
                </T>
                <T size={28} weight="medium">
                  {Math.round(report.peak ?? 0)}{" "}
                  <T size={11} color={c.muted}>
                    / 100 relative
                  </T>
                </T>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <T size={12} color={c.muted}>
                  Regions to review
                </T>
                <T size={28} weight="medium">
                  {report.persistentRegions}
                </T>
              </View>
            </View>
            <T size={11} color={c.muted}>
              Preview pressure check · not an ulcer diagnosis.
            </T>
          </Card>
          <Card style={{ gap: 16, padding: 19 }}>
            <T size={20} weight="medium" style={{ letterSpacing: -0.5 }}>
              Peak & average pressure
            </T>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <View>
                <T size={32} weight="medium" style={{ letterSpacing: -1 }}>
                  {Math.round(row.peak ?? 0)}{" "}
                  <T size={11} color={c.muted}>
                    / 100
                  </T>
                </T>
                <T size={12} color={c.muted}>
                  {row.label}
                </T>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  padding: 3,
                  borderRadius: 13,
                  backgroundColor: c.subtle,
                }}
              >
                {["1 cycle", "10 cycles"].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === range }}
                    onPress={() => setRange(value)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: value === range ? c.ink : "transparent",
                    }}
                  >
                    <T size={11} color={value === range ? "#FFFFFF" : c.muted}>
                      {value}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 18 }}>
              {[
                { label: "Peak", opacity: 1 },
                { label: "Average", opacity: 0.19 },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{ flexDirection: "row", gap: 7, alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 3,
                      backgroundColor: c.text,
                      opacity: item.opacity,
                    }}
                  />
                  <T size={12} color={c.muted}>
                    {item.label}
                  </T>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: c.subtle,
                borderRadius: 18,
                padding: 8,
              }}
            >
              <PeakPressureChart
                rows={report.rows}
                selected={selected}
                onSelect={setSelected}
              />
            </View>
            <View
              style={{
                backgroundColor: c.bluePale,
                borderRadius: 20,
                padding: 15,
                gap: 9,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <T size={17} weight="medium">
                  {row.label}
                </T>
                <Check size={19} color={c.text} />
              </View>
              <T size={12} color={c.muted}>
                {regionNotes[row.id]}
              </T>
              <T size={12}>
                Peak {Math.round(row.peak ?? 0)} · Average{" "}
                {Math.round(row.average ?? 0)} / 100
              </T>
              <T size={12}>
                Repeated off-phase load: {row.flaggedCycles} cycles
              </T>
              <T size={11} color={c.muted}>
                Longest unusual run: {row.longestRunSeconds.toFixed(1)} s
              </T>
            </View>
            <T size={12} color={c.muted} style={{ lineHeight: 19 }}>
              A brief red peak can be expected at the right stage. This check
              focuses on high pressure that stays in the same region at an
              unexpected stage and repeats over time.
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: explain }}
              onPress={() => setExplain((v) => !v)}
              style={{ paddingVertical: 9 }}
            >
              <T size={12} weight="medium">
                {explain ? "Hide check details −" : "How this check works +"}
              </T>
            </Pressable>
            {explain && (
              <T size={12} color={c.muted} style={{ lineHeight: 19 }}>
                The preview compares each region with its expected loading at
                the same gait stage. A review flag needs repeated cycles and
                time above the example threshold. These example limits are not
                clinical thresholds. Actual analysis needs calibrated readings,
                verified gait phases and a personal reference.
              </T>
            )}
            <Button
              label="Explore walking pressure"
              secondary
              icon={ArrowUpRight}
              onPress={() => {
                insole.setPreview(true);
                nav.open({ kind: "foot" });
              }}
            />
          </Card>
        </>
      ) : (
        <Card style={{ gap: 16, backgroundColor: c.subtle }}>
          <T size={31} weight="medium" style={{ letterSpacing: -1 }}>
            Not assessed
          </T>
          <T size={18} weight="medium">
            No gait report available yet.
          </T>
          <T size={13} color={c.muted} style={{ lineHeight: 21 }}>
            A pressure-pattern report needs continuous, phase-tagged insole
            history and a validated personal reference. A current map or
            occasional readings are not enough to assess persistent unusual
            loading.
          </T>
          <Button
            label={
              insole.connected ? "View my pressure map" : "Connection options"
            }
            onPress={() => {
              if (insole.connected) {
                insole.setPreview(false);
                nav.open({ kind: "foot" });
              } else nav.open({ kind: "pairing" });
            }}
          />
        </Card>
      )}
    </View>
  );
}

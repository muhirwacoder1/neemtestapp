import React, { useId, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Reading, bmi } from "../domain";
import { fonts, T, useTheme } from "./ui";

// Native SVG adaptations of Amicro's rounded mono line, pillar and arc geometry.
// Source and MIT notice: docs/licenses/amicro-MIT.txt.
type Point = [number, number];
function spline(points: Point[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].join(",")}`;
  // Monotone cubic interpolation keeps curves within neighboring measurements.
  const slopes = points
    .slice(1)
    .map(
      (p, i) => (p[1] - points[i][1]) / Math.max(0.001, p[0] - points[i][0]),
    );
  const tangents = points.map((_, i) =>
    i === 0
      ? slopes[0]
      : i === points.length - 1
        ? slopes.at(-1)!
        : slopes[i - 1] * slopes[i] <= 0
          ? 0
          : 2 / (1 / slopes[i - 1] + 1 / slopes[i]),
  );
  return points.slice(1).reduce(
    (path, p, i) => {
      const prev = points[i],
        dx = (p[0] - prev[0]) / 3;
      return `${path} C${prev[0] + dx},${prev[1] + dx * tangents[i]} ${p[0] - dx},${p[1] - dx * tangents[i + 1]} ${p.join(",")}`;
    },
    `M${points[0].join(",")}`,
  );
}
export function Sparkline({
  values,
  color,
  width = 110,
  height = 38,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const id = `spark${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!values.length) return <View style={{ width, height }} />;
  const lo = Math.min(...values) - 3,
    hi = Math.max(...values) + 3;
  const pts: Point[] = values.map((v, i) => [
    values.length === 1
      ? width / 2
      : 3 + (i / (values.length - 1)) * (width - 6),
    height - 5 - ((v - lo) / (hi - lo)) * (height - 12),
  ]);
  const path = spline(pts),
    last = pts.at(-1)!;
  return (
    <Svg
      width={width}
      height={height}
      accessibilityLabel={`${values.length} recent measurements`}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity=".3" />
          <Stop offset="1" stopColor={color} stopOpacity=".03" />
        </LinearGradient>
      </Defs>
      <Path
        d={`${path} L${last[0]},${height} L${pts[0][0]},${height} Z`}
        fill={`url(#${id})`}
      />
      <Path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle
        cx={last[0]}
        cy={last[1]}
        r={3.5}
        fill="white"
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
export function ReadingTicks({ values }: { values: number[] }) {
  const c = useTheme(),
    recent = values.slice(-12),
    lo = Math.min(...recent),
    range = Math.max(1, Math.max(...recent) - lo);
  return (
    <Svg
      width={132}
      height={68}
      viewBox="0 0 132 68"
      accessibilityLabel={
        recent.length
          ? `${recent.length} recent glucose readings`
          : "No glucose readings yet"
      }
    >
      {(recent.length ? recent : Array.from({ length: 10 }, () => null)).map(
        (v, i) => {
          const h = v === null ? 16 : 18 + ((v - lo) / range) * 40;
          return (
            <Rect
              key={i}
              x={i * 11 + 3}
              y={(68 - h) / 2}
              width={5}
              height={h}
              rx={3}
              fill={
                v === null
                  ? "none"
                  : i % 3 === 0
                    ? "#F27676"
                    : i % 3 === 1
                      ? c.card
                      : "#3A4C54"
              }
              stroke={v === null ? c.text : "none"}
              strokeOpacity={0.12}
            />
          );
        },
      )}
    </Svg>
  );
}
export function HealthChart({
  readings,
  color,
  height = 190,
  dual = false,
  convert,
  mode = "line",
}: {
  readings: Reading[];
  color?: string;
  height?: number;
  dual?: boolean;
  convert?: (value: number) => number;
  mode?: "line" | "bars";
}) {
  const c = useTheme(),
    ink = color || c.text,
    id = `mono${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [selectedId, setSelectedId] = useState<string>();
  const [chartWidth, setChartWidth] = useState(320);
  const ordered = [...readings].sort(
    (a, b) => +new Date(a.at) - +new Date(b.at),
  );
  // Keep rendering bounded while retaining the first and latest observations.
  const records =
    mode === "bars"
      ? ordered.slice(-7)
      : ordered.filter(
          (_, i) =>
            i % Math.max(1, Math.ceil(ordered.length / 80)) === 0 ||
            i === ordered.length - 1,
        );
  const values = records.map((r) =>
    r.kind === "bmi"
      ? bmi(r.value, r.height!)
      : convert
        ? convert(r.value)
        : r.value,
  );
  const all = dual ? [...values, ...records.map((r) => r.secondary!)] : values;
  const lo =
    mode === "bars"
      ? 0
      : Math.max(0, Math.min(...all) - Math.max(3, Math.min(...all) * 0.08));
  const hi = Math.max(...all) + Math.max(3, Math.max(...all) * 0.08);
  const selected = Math.max(
    0,
    records.findIndex((r) => r.id === selectedId) < 0
      ? records.length - 1
      : records.findIndex((r) => r.id === selectedId),
  );
  const plotBottom = height - 31,
    top = 16,
    plotLeft = 32,
    plotWidth = Math.max(80, chartWidth - plotLeft - 22);
  const timeStart = records.length ? +new Date(records[0].at) : 0,
    timeSpan = records.length ? +new Date(records.at(-1)!.at) - timeStart : 0;
  const point = (v: number, i: number): Point => [
    mode === "bars"
      ? plotLeft + ((i + 0.5) / records.length) * plotWidth
      : timeSpan
        ? plotLeft +
          ((+new Date(records[i].at) - timeStart) / timeSpan) * plotWidth
        : plotLeft + plotWidth / 2,
    top + (1 - (v - lo) / (hi - lo || 1)) * (plotBottom - top),
  ];
  const points = values.map(point),
    path = spline(points);
  const formatted = (v: number) =>
    v.toFixed(
      records[0]?.kind === "temperature" ||
        records[0]?.kind === "bmi" ||
        !!convert
        ? 1
        : 0,
    );
  return (
    <View
      onLayout={(e) => setChartWidth(Math.max(140, e.nativeEvent.layout.width))}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
          minHeight: 26,
        }}
      >
        <T size={11} color={c.muted}>
          {mode === "bars" ? "Latest 7 readings" : "Recorded over time"}
        </T>
        <T size={12} weight="semibold">
          {records.length
            ? `${formatted(values[selected])}${dual ? ` / ${records[selected].secondary}` : ""}`
            : "Awaiting your first reading"}
        </T>
      </View>
      <View style={{ height }}>
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          preserveAspectRatio="none"
          accessibilityLabel={
            records.length
              ? `${mode === "bars" ? "Bar" : "Line"} chart of ${records.length} measurements`
              : "Empty measurement chart"
          }
        >
          <Defs>
            <Pattern
              id={`${id}dots`}
              width={7}
              height={7}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={2} cy={2} r={1.25} fill={ink} opacity={0.7} />
            </Pattern>
            <LinearGradient id={`${id}area`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ink} stopOpacity={0.12} />
              <Stop offset="1" stopColor={ink} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 1, 2].map((i) => (
            <G key={i}>
              <Line
                x1={plotLeft}
                x2={chartWidth - 8}
                y1={top + (i / 2) * (plotBottom - top)}
                y2={top + (i / 2) * (plotBottom - top)}
                stroke={c.line}
                strokeDasharray="2 6"
              />
              {!!records.length && (
                <SvgText
                  x={0}
                  y={top + (i / 2) * (plotBottom - top) + 4}
                  fill={c.muted}
                  fontSize={11}
                  fontFamily={fonts.regular}
                >
                  {formatted(hi - (i / 2) * (hi - lo))}
                </SvgText>
              )}
            </G>
          ))}
          {mode === "line" && records.length > 0 && (
            <>
              <Path
                d={`${path} L${points.at(-1)![0]},${plotBottom} L${points[0][0]},${plotBottom} Z`}
                fill={`url(#${id}area)`}
              />
              <Path
                d={path}
                fill="none"
                stroke={ink}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {dual && (
                <Path
                  d={spline(records.map((r, i) => point(r.secondary!, i)))}
                  fill="none"
                  stroke={c.muted}
                  strokeWidth={2}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                />
              )}
              <Line
                x1={points[selected][0]}
                x2={points[selected][0]}
                y1={top}
                y2={plotBottom}
                stroke={c.muted}
                strokeDasharray="3 5"
                opacity={0.5}
              />
            </>
          )}
          {records.map((r, i) => {
            const [x, y] = points[i],
              barWidth = Math.min(45, (plotWidth * 0.56) / records.length),
              barHeight = Math.max(3, plotBottom - y);
            return (
              <G key={r.id} onPress={() => setSelectedId(r.id)}>
                <Rect
                  x={x - Math.max(10, barWidth / 2 + 4)}
                  y={0}
                  width={Math.max(20, barWidth + 8)}
                  height={plotBottom}
                  fill="transparent"
                />
                {mode === "bars" ? (
                  <>
                    <Rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={Math.min(12, barHeight / 2)}
                      fill={i === selected ? ink : `url(#${id}dots)`}
                    />
                    {i === selected && (
                      <Circle
                        cx={x}
                        cy={y + Math.min(10, barHeight / 2)}
                        r={3}
                        fill={c.card}
                      />
                    )}
                    {dual && (
                      <Line
                        x1={x - barWidth / 3}
                        x2={x + barWidth / 3}
                        y1={point(r.secondary!, i)[1]}
                        y2={point(r.secondary!, i)[1]}
                        stroke={i === selected ? c.card : ink}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    )}
                  </>
                ) : (
                  <Circle
                    cx={x}
                    cy={y}
                    r={i === selected ? 5 : 3}
                    fill={i === selected ? c.card : ink}
                    stroke={ink}
                    strokeWidth={2}
                  />
                )}
                {(mode === "bars" ||
                  i === 0 ||
                  i === records.length - 1 ||
                  i === Math.floor(records.length / 2)) && (
                  <SvgText
                    x={x}
                    y={height - 7}
                    textAnchor="middle"
                    fill={c.muted}
                    fontSize={11}
                    fontFamily={fonts.regular}
                  >
                    {new Date(r.at).toLocaleDateString(undefined, {
                      month:
                        mode === "bars" && chartWidth < 280
                          ? undefined
                          : "short",
                      day: "numeric",
                    })}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
        {!records.length && (
          <View
            style={{
              position: "absolute",
              left: 25,
              right: 10,
              top: 35,
              alignItems: "center",
              gap: 5,
            }}
          >
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 18,
                padding: 14,
                alignItems: "center",
              }}
            >
              <T size={14}>Your story starts with a reading.</T>
              <T size={11} color={c.muted}>
                Add a measurement to see your trend.
              </T>
            </View>
          </View>
        )}
      </View>
      {!!records.length && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous measurement"
            disabled={selected === 0}
            onPress={() => setSelectedId(records[selected - 1].id)}
            style={{ padding: 8, opacity: selected === 0 ? 0.3 : 1 }}
          >
            <T size={20}>←</T>
          </Pressable>
          <T size={11} color={c.muted}>
            {new Date(records[selected].at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next measurement"
            disabled={selected === records.length - 1}
            onPress={() => setSelectedId(records[selected + 1].id)}
            style={{
              padding: 8,
              opacity: selected === records.length - 1 ? 0.3 : 1,
            }}
          >
            <T size={20}>→</T>
          </Pressable>
        </View>
      )}
      {dual && !!records.length && (
        <T size={10} color={c.muted}>
          Solid: systolic · {mode === "bars" ? "Small marker" : "Dashed"}:
          diastolic
        </T>
      )}
    </View>
  );
}
export function CareGauge({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const c = useTheme(),
    progress = total ? completed / total : 0;
  const arc = (start: number, end: number) => {
    const p = (angle: number) => [
      160 - 134 * Math.cos((angle * Math.PI) / 180),
      154 - 134 * Math.sin((angle * Math.PI) / 180),
    ];
    return `M${p(start).join(",")} A134,134 0 0 1 ${p(end).join(",")}`;
  };
  return (
    <View style={{ alignItems: "center", paddingTop: 17 }}>
      <Svg
        width="100%"
        height={200}
        viewBox="0 0 320 200"
        accessibilityLabel={`${completed} of ${total} care tasks completed`}
      >
        <Path
          d={arc(0, 180)}
          fill="none"
          stroke={c.line}
          strokeWidth={18}
          strokeLinecap="round"
        />
        {progress > 0 && (
          <Path
            d={arc(0, Math.max(0.1, progress * 180))}
            fill="none"
            stroke={c.blue}
            strokeWidth={18}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <View style={{ position: "absolute", bottom: 20, alignItems: "center" }}>
        <T
          size={56}
          weight="medium"
          style={{ letterSpacing: -3, lineHeight: 66 }}
        >
          {total ? `${Math.round(progress * 100)}%` : "—"}
        </T>
        <T size={14}>Care completed</T>
        <T size={11} color={c.muted} style={{ marginTop: 6 }}>
          {total ? `${completed} of ${total} tasks` : "No tasks in this period"}
        </T>
      </View>
    </View>
  );
}
export function MeasurementGauge({
  counts,
}: {
  counts: { label: string; count: number; color: string }[];
}) {
  const c = useTheme(),
    total = counts.reduce((n, item) => n + item.count, 0);
  const segments = counts.filter((item) => item.count > 0);
  const arc = (start: number, end: number) => {
    const p = (a: number) => [
      160 - 134 * Math.cos((a * Math.PI) / 180),
      154 - 134 * Math.sin((a * Math.PI) / 180),
    ];
    return `M${p(start).join(",")} A134,134 0 0 1 ${p(end).join(",")}`;
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignItems: "center" }}>
        <Svg
          width="100%"
          height={220}
          viewBox="0 0 320 200"
          accessibilityLabel={`${total} measurements in this period`}
        >
          <Path
            d={arc(0, 180)}
            fill="none"
            stroke={c.line}
            strokeWidth={18}
            strokeLinecap="round"
          />
          {segments.map((item, i) => {
            const start =
              (segments.slice(0, i).reduce((n, s) => n + s.count, 0) / total) *
              180;
            const angle = start + (item.count / total) * 180;
            return (
              <Path
                key={item.label}
                d={arc(
                  start + Math.min(5, (angle - start) / 4),
                  angle - Math.min(5, (angle - start) / 4),
                )}
                fill="none"
                stroke={item.color}
                strokeWidth={18}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
        <View
          style={{ position: "absolute", bottom: 26, alignItems: "center" }}
        >
          <T
            size={58}
            weight="medium"
            style={{ letterSpacing: -3, lineHeight: 70 }}
          >
            {total || "—"}
          </T>
          <T size={15}>Measurements</T>
          <T size={11} color={c.muted} style={{ marginTop: 5 }}>
            {total
              ? "Your recorded health picture"
              : "Your readings will appear here"}
          </T>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
        }}
      >
        {counts.map((item) => (
          <View
            key={item.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 5,
                backgroundColor: item.color,
              }}
            />
            <T size={12} color={c.muted}>
              {item.label} {item.count}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

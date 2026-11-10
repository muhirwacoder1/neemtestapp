import type { SensorFrame, Zone } from "./services/ble.types";
// An anatomical sole mask, with individually shaped toes. Units: 120 × 270.
export const FOOT_PATH =
  "M30 74 C18 87 13 103 17 119 C22 136 32 147 33 170 C34 189 26 210 30 233 C33 251 45 261 60 261 C77 261 86 250 87 235 C89 218 78 200 78 179 C78 153 91 135 97 111 C102 92 94 80 81 75 C64 68 45 67 30 74 Z M20 51 C17 38 20 18 30 15 C43 12 48 25 46 41 C45 56 36 66 27 63 C22 62 21 57 20 51 Z M50 34 C49 23 53 13 61 14 C70 15 70 27 68 39 C66 49 62 55 56 53 C51 51 50 43 50 34 Z M72 43 C72 33 75 24 82 26 C89 29 86 43 83 52 C80 59 74 59 72 53 Z M88 57 C88 49 94 43 99 47 C104 52 98 64 94 69 C90 72 85 66 88 57 Z M99 73 C101 66 107 62 111 67 C115 72 107 84 102 84 C98 83 97 79 99 73 Z";
export const REGIONS: Zone[] = ["heel", "midfoot", "forefoot", "toes"];
export const SENSOR_POS = [
  { x: 59, y: 227, sx: 27, sy: 31 },
  { x: 59, y: 164, sx: 25, sy: 34 },
  { x: 56, y: 104, sx: 36, sy: 31 },
  { x: 45, y: 47, sx: 35, sy: 29 },
];
// Preview-only anatomical lobes. These are not physical sensor locations.
export const PREVIEW_POS = [
  { x: 58, y: 232, sx: 22, sy: 25 },
  { x: 43, y: 222, sx: 14, sy: 24 },
  { x: 72, y: 166, sx: 14, sy: 39 },
  { x: 42, y: 162, sx: 12, sy: 30 },
  { x: 34, y: 91, sx: 17, sy: 20 },
  { x: 53, y: 94, sx: 13, sy: 20 },
  { x: 69, y: 99, sx: 12, sy: 20 },
  { x: 83, y: 108, sx: 11, sy: 20 },
  { x: 93, y: 116, sx: 9, sy: 20 },
  { x: 33, y: 36, sx: 12, sy: 23 },
  { x: 60, y: 33, sx: 8, sy: 18 },
  { x: 80, y: 43, sx: 7, sy: 15 },
  { x: 95, y: 57, sx: 6, sy: 13 },
  { x: 105, y: 74, sx: 6, sy: 11 },
];
export const PRESSURE_COLORS = [
  "#163DFA",
  "#00B9FA",
  "#0BD65A",
  "#D3F235",
  "#FF9829",
  "#F12D24",
];
export const GAIT_DURATION = 4200;
export const GAIT_STAGES = [
  {
    label: "Initial loading",
    time: 0.07,
    detail:
      "Heel red, metatarsal heads orange, toes lightly loaded and the arch mostly blue.",
  },
  {
    label: "Mid-stance",
    time: 0.28,
    detail:
      "Heel and metatarsal heads red together, with orange and green across the big toe.",
  },
  {
    label: "Terminal stance",
    time: 0.45,
    detail: "Metatarsal heads red, heel green and the big toe orange.",
  },
  {
    label: "Pre-swing",
    time: 0.58,
    detail:
      "Big toe red, metatarsal heads fading toward orange and the heel fading from green to blue.",
  },
  {
    label: "Swing",
    time: 0.8,
    detail: "The foot is unloaded and returns to blue before the next step.",
  },
];
// Illustrative relative amplitudes, not clinical norms. Each lobe remains independent.
const GAIT_KEYS = [
  {
    t: 0,
    v: [
      0.48, 0.42, 0.16, 0.025, 0.4, 0.42, 0.43, 0.42, 0.4, 0.18, 0.12, 0.1,
      0.08, 0.07,
    ],
  },
  {
    t: 0.07,
    v: [
      0.99, 0.92, 0.29, 0.045, 0.72, 0.75, 0.73, 0.7, 0.63, 0.46, 0.34, 0.28,
      0.23, 0.18,
    ],
  },
  {
    t: 0.28,
    v: [
      0.97, 0.89, 0.46, 0.07, 0.99, 1.0, 0.97, 0.92, 0.8, 0.79, 0.54, 0.45,
      0.36, 0.28,
    ],
  },
  {
    t: 0.45,
    v: [
      0.43, 0.37, 0.34, 0.045, 1.0, 1.0, 0.96, 0.87, 0.72, 0.81, 0.58, 0.48,
      0.37, 0.25,
    ],
  },
  {
    t: 0.54,
    v: [
      0.37, 0.29, 0.25, 0.035, 0.98, 0.94, 0.86, 0.72, 0.58, 0.98, 0.63, 0.49,
      0.35, 0.23,
    ],
  },
  {
    t: 0.6,
    v: [
      0.1, 0.07, 0.13, 0.02, 0.81, 0.78, 0.69, 0.54, 0.39, 1.0, 0.67, 0.44,
      0.27, 0.16,
    ],
  },
  {
    t: 0.69,
    v: [
      0.02, 0.02, 0.02, 0.01, 0.03, 0.03, 0.025, 0.02, 0.02, 0.04, 0.025, 0.02,
      0.02, 0.02,
    ],
  },
  {
    t: 0.91,
    v: [
      0.02, 0.02, 0.02, 0.01, 0.03, 0.03, 0.025, 0.02, 0.02, 0.04, 0.025, 0.02,
      0.02, 0.02,
    ],
  },
  {
    t: 1,
    v: [
      0.48, 0.42, 0.16, 0.025, 0.4, 0.42, 0.43, 0.42, 0.4, 0.18, 0.12, 0.1,
      0.08, 0.07,
    ],
  },
];
export function gaitValues(time: number, side: number): number[] {
  "worklet";
  const p = (((time + side * 0.5) % 1) + 1) % 1;
  let i = 0;
  while (i < GAIT_KEYS.length - 2 && p > GAIT_KEYS[i + 1].t) i++;
  const a = GAIT_KEYS[i],
    b = GAIT_KEYS[i + 1];
  const u = (p - a.t) / (b.t - a.t),
    f = u * u * (3 - 2 * u);
  return a.v.map((v, j) => v + (b.v[j] - v) * f);
}
export function previewFieldAt(x: number, y: number, values: number[]): number {
  let peak = 0,
    sum = 0;
  for (let i = 0; i < PREVIEW_POS.length; i++) {
    const p = PREVIEW_POS[i];
    const v =
      values[i] *
      Math.exp(-0.5 * (((x - p.x) / p.sx) ** 2 + ((y - p.y) / p.sy) ** 2));
    peak = Math.max(peak, v);
    sum += v;
  }
  return Math.min(1, Math.max(0.02, peak + 0.075 * (sum - peak)));
}
export function frameValues(frame?: SensorFrame): number[] {
  return REGIONS.map(
    (z) => (frame?.sensors.find((s) => s.region === z)?.value ?? -100) / 100,
  );
}
export function fieldAt(
  x: number,
  y: number,
  values: number[],
  preview: boolean,
): number {
  if (preview) return previewFieldAt(x, y, values);
  let value = 0,
    coverage = 0;
  for (let i = 0; i < 4; i++) {
    if (values[i] < 0) continue;
    const p = SENSOR_POS[i],
      w = Math.exp(-0.5 * (((x - p.x) / p.sx) ** 2 + ((y - p.y) / p.sy) ** 2));
    value += values[i] * w;
    coverage = Math.max(coverage, w);
  }
  if (!preview && coverage < 0.35) return -1;
  return Math.min(1, Math.max(0, value));
}

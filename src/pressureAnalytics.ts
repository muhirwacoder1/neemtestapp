import { GAIT_DURATION, gaitValues, previewFieldAt } from "./pressure";

export const REPORT_REGIONS = [
  { id: "heel", label: "Heel", short: "Heel", points: [[58, 232]] },
  { id: "midfoot", label: "Midfoot", short: "Arch", points: [[72, 166]] },
  {
    id: "metatarsals",
    label: "Metatarsal heads",
    short: "MTH",
    points: [
      [34, 91],
      [53, 94],
      [69, 99],
      [83, 108],
      [93, 116],
    ],
  },
  { id: "hallux", label: "Big toe", short: "Big toe", points: [[33, 36]] },
  {
    id: "lesserToes",
    label: "Other toes",
    short: "Toes",
    points: [
      [60, 33],
      [80, 43],
      [95, 57],
      [105, 74],
    ],
  },
] as const;
export type ReportRegion = (typeof REPORT_REGIONS)[number]["id"];
export type GaitReportSample = {
  timeMs: number;
  side: "left" | "right";
  phase?: number;
  cycle?: number;
  values: Partial<Record<ReportRegion, number>>;
};
// Illustrative rules for the supplied simulation. Never clinical thresholds.
export const SIMULATION_RULES = {
  high: 0.85,
  deviation: 0.12,
  repeatedCycles: 3,
  minimumTotalSeconds: 1.2,
  maxGapMs: 150,
};
export function simulationRegionValues(
  phase: number,
): Record<ReportRegion, number> {
  const amplitudes = gaitValues(phase, 0);
  return Object.fromEntries(
    REPORT_REGIONS.map((r) => [
      r.id,
      Math.max(...r.points.map(([x, y]) => previewFieldAt(x, y, amplitudes))),
    ]),
  ) as Record<ReportRegion, number>;
}
export function normalPressureSession(cycles: number): GaitReportSample[] {
  // A complete, explicitly simulated session, not fabricated calendar history.
  const count = Math.min(10, Math.max(1, Math.floor(cycles)));
  const base = Array.from({ length: 100 }, (_, i) =>
    simulationRegionValues(i / 100),
  );
  const samples: GaitReportSample[] = [];
  for (let cycle = 0; cycle < count; cycle++)
    for (let step = 0; step < 100; step++) {
      for (const side of ["left", "right"] as const) {
        const shifted = (step + (side === "right" ? 50 : 0)) % 100;
        samples.push({
          timeMs: (cycle + step / 100) * GAIT_DURATION,
          side,
          phase: shifted / 100,
          cycle,
          values: { ...base[shifted] },
        });
      }
    }
  return samples;
}
export type RegionPressureReport = {
  id: ReportRegion;
  label: string;
  short: string;
  peak: number | null;
  average: number | null;
  unexpectedSeconds: number;
  longestRunSeconds: number;
  flaggedCycles: number;
  repeated: boolean;
  sides: Record<
    "left" | "right",
    { seconds: number; longest: number; cycles: number }
  >;
};
export function analyzePressureSession(samples: GaitReportSample[]) {
  let complete = samples.length > 0;
  const references = new Map<number, Record<ReportRegion, number>>();
  const rows: RegionPressureReport[] = REPORT_REGIONS.map((region) => {
    let sum = 0,
      count = 0,
      peak = 0;
    const sides = {
      left: { seconds: 0, longest: 0, cycles: 0 },
      right: { seconds: 0, longest: 0, cycles: 0 },
    };
    for (const side of ["left", "right"] as const) {
      const ordered = samples
        .filter((s) => s.side === side)
        .sort((a, b) => a.timeMs - b.timeMs);
      if (!ordered.length) complete = false;
      let previousTime: number | undefined,
        wasFlagged = false,
        run = 0;
      const flaggedCycles = new Set<number>();
      const phaseBins = new Set<number>();
      for (const sample of ordered) {
        const value = sample.values[region.id];
        const valid =
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 1 &&
          Number.isFinite(sample.timeMs) &&
          sample.timeMs >= 0 &&
          typeof sample.phase === "number" &&
          sample.phase >= 0 &&
          sample.phase < 1 &&
          typeof sample.cycle === "number" &&
          Number.isInteger(sample.cycle) &&
          sample.cycle >= 0;
        if (!valid) {
          complete = false;
          wasFlagged = false;
          run = 0;
          previousTime = undefined;
          continue;
        }
        sum += value!;
        count++;
        peak = Math.max(peak, value!);
        const gap =
          previousTime === undefined ? 0 : sample.timeMs - previousTime;
        const contiguous =
          previousTime !== undefined &&
          gap > 0 &&
          gap <= SIMULATION_RULES.maxGapMs;
        if (previousTime !== undefined && !contiguous) complete = false;
        phaseBins.add(Math.floor(sample.phase! * 10));
        if (!references.has(sample.phase!))
          references.set(sample.phase!, simulationRegionValues(sample.phase!));
        const reference = references.get(sample.phase!)![region.id];
        const flagged =
          value! >= SIMULATION_RULES.high &&
          value! > reference + SIMULATION_RULES.deviation;
        if (flagged) {
          const elapsed = wasFlagged && contiguous ? gap / 1000 : 0;
          run = wasFlagged && contiguous ? run + elapsed : 0;
          sides[side].seconds += elapsed;
          sides[side].longest = Math.max(sides[side].longest, run);
          flaggedCycles.add(sample.cycle!);
        } else run = 0;
        wasFlagged = flagged;
        previousTime = sample.timeMs;
      }
      sides[side].cycles = flaggedCycles.size;
      if (
        phaseBins.size < 10 ||
        ordered.length < 30 ||
        ordered.at(-1)!.timeMs - ordered[0].timeMs < GAIT_DURATION * 0.95
      )
        complete = false;
    }
    const repeated = Object.values(sides).some(
      (s) =>
        s.cycles >= SIMULATION_RULES.repeatedCycles &&
        s.seconds >= SIMULATION_RULES.minimumTotalSeconds,
    );
    return {
      ...region,
      peak: count ? peak * 100 : null,
      average: count ? (sum / count) * 100 : null,
      unexpectedSeconds: sides.left.seconds + sides.right.seconds,
      longestRunSeconds: Math.max(sides.left.longest, sides.right.longest),
      flaggedCycles: Math.max(sides.left.cycles, sides.right.cycles),
      repeated,
      sides,
    };
  });
  const persistentRegions = rows.filter((r) => r.repeated).length;
  const unusualRegions = rows.filter((r) => r.flaggedCycles > 0).length;
  const level = persistentRegions
    ? "review"
    : unusualRegions
      ? "watch"
      : complete
        ? "low"
        : "unavailable";
  return {
    rows,
    complete,
    persistentRegions,
    unusualRegions,
    level,
    peak: rows.some((r) => r.peak !== null)
      ? Math.max(...rows.map((r) => r.peak ?? 0))
      : null,
  };
}

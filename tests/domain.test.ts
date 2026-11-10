import assert from "node:assert/strict";
import test from "node:test";
import {
  bmi,
  dayKey,
  defaults,
  displayReading,
  emptyData,
  filterReadings,
  validateReading,
} from "../src/domain";
import { parseRelativeFrame } from "../src/services/ble.types";
const fields = {
  value: "108",
  secondary: "",
  height: "",
  date: dayKey(),
  time: "00:00",
};
test("manual entries reject missing, future and inconsistent measurements", () => {
  assert.match(
    validateReading("glucose", { ...fields, value: "" })!,
    /Enter a measurement/,
  );
  assert.match(
    validateReading("pressure", { ...fields, value: "80", secondary: "120" })!,
    /Systolic/,
  );
  assert.match(
    validateReading("bmi", { ...fields, value: "68", height: "" })!,
    /height/,
  );
  assert.match(
    validateReading("glucose", { ...fields, date: "2099-01-01" })!,
    /future/,
  );
  assert.match(
    validateReading("glucose", { ...fields, date: "2026-02-30" })!,
    /valid date/,
  );
  assert.equal(validateReading("glucose", fields), null);
});
test("BMI is calculated from weight and height and display units do not modify the record", () => {
  assert.equal(bmi(68.4, 170), 23.7);
  const record = {
    id: "r",
    kind: "glucose" as const,
    value: 108,
    at: new Date().toISOString(),
    context: "Fasting",
    source: "manual" as const,
  };
  assert.equal(
    displayReading(record, { ...defaults, glucoseUnit: "mmol/L" }).value,
    "6.0",
  );
  assert.equal(record.value, 108);
});
test("new profiles start empty and do not share mutable preferences", () => {
  const first = emptyData(),
    second = emptyData();
  assert.equal(first.readings.length, 0);
  assert.equal(first.tasks.length, 0);
  first.preferences.aiConsent = true;
  assert.equal(second.preferences.aiConsent, false);
});
test("date filters select real records and custom ranges include the final day", () => {
  const record = {
    id: "r",
    kind: "glucose" as const,
    value: 108,
    at: "2026-10-20T12:00:00.000Z",
    context: "Fasting",
    source: "manual" as const,
  };
  assert.equal(
    filterReadings([record], "glucose", "Custom", {
      start: "2026-10-20",
      end: "2026-10-20",
    }).length,
    1,
  );
  assert.equal(
    filterReadings([record], "glucose", "Custom", {
      start: "2026-10-21",
      end: "2026-10-21",
    }).length,
    0,
  );
  assert.equal(
    filterReadings([record], "pressure", "Custom", {
      start: "2026-10-20",
      end: "2026-10-20",
    }).length,
    0,
  );
});
test("sensor decoding rejects unknown hardware formats and unsupported values", () => {
  assert.equal(parseRelativeFrame("not-json"), null);
  assert.equal(
    parseRelativeFrame(
      JSON.stringify({
        side: "left",
        sensors: [{ region: "heel", value: 40 }],
      }),
    ),
    null,
  );
  assert.equal(
    parseRelativeFrame(
      JSON.stringify({
        version: 1,
        side: "left",
        sensors: [{ region: "heel", value: 101 }],
      }),
    ),
    null,
  );
  assert.equal(
    parseRelativeFrame(
      JSON.stringify({
        version: 1,
        side: "left",
        sensors: [
          { region: "heel", value: 20 },
          { region: "heel", value: 30 },
        ],
      }),
    ),
    null,
  );
  const parsed = parseRelativeFrame(
    JSON.stringify({
      version: 1,
      side: "right",
      sensors: [{ region: "heel", value: 42 }],
      temperature: 34,
    }),
  );
  assert.equal(parsed?.sensors[0].value, 42);
  assert.equal(parsed?.temperature, undefined);
});

test("walking preview keeps multiple regions loaded and shifts push-off to the big toe", async () => {
  const { gaitValues, previewFieldAt } = await import("../src/pressure");
  const at = (time: number, x: number, y: number) =>
    previewFieldAt(x, y, gaitValues(time, 0));
  // Initial loading: red heel, orange metatarsals, less-loaded toe and blue arch.
  assert.ok(at(0.07, 58, 232) >= 0.95);
  assert.ok(at(0.07, 53, 94) >= 0.75 && at(0.07, 53, 94) < 0.87);
  assert.ok(at(0.07, 33, 36) < at(0.07, 53, 94));
  assert.ok(at(0.07, 42, 162) < 0.12);
  // Both heel and forefoot stay hot at mid-stance, rather than taking turns.
  assert.ok(at(0.28, 58, 232) >= 0.95 && at(0.28, 53, 94) >= 0.95);
  assert.ok(at(0.28, 33, 36) >= 0.7);
  // Terminal stance unloads the heel while retaining forefoot/toe pressure.
  assert.ok(at(0.45, 58, 232) > 0.35 && at(0.45, 58, 232) < 0.55);
  assert.ok(at(0.45, 53, 94) >= 0.95);
  assert.ok(at(0.45, 33, 36) >= 0.75 && at(0.45, 33, 36) < 0.9);
  // Pre-swing moves the maximum to hallux; metatarsals and heel fade gradually.
  assert.ok(at(0.6, 33, 36) >= 0.95);
  assert.ok(at(0.6, 53, 94) < at(0.54, 53, 94));
  assert.ok(at(0.6, 58, 232) < at(0.54, 58, 232));
  assert.ok(at(0.8, 33, 36) < 0.1 && at(0.8, 58, 232) < 0.1);
});

test("walking preview is bounded, continuous at loop boundaries, and alternates feet", async () => {
  const { gaitValues, previewFieldAt, frameValues, fieldAt } =
    await import("../src/pressure");
  for (let step = 0; step <= 100; step++) {
    const time = step / 100;
    assert.deepEqual(gaitValues(time, 1), gaitValues(time + 0.5, 0));
    for (const [x, y] of [
      [58, 232],
      [53, 94],
      [33, 36],
      [42, 162],
    ]) {
      const v = previewFieldAt(x, y, gaitValues(time, 0));
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
    }
  }
  const before = gaitValues(1 - 1e-6, 0),
    after = gaitValues(1e-6, 0);
  assert.ok(before.every((v, i) => Math.abs(v - after[i]) < 0.001));
  // A live map never fills unknown regions with the illustrative preview.
  const empty = frameValues();
  assert.equal(fieldAt(58, 232, empty, false), -1);
  const heelOnly = frameValues({
    side: "left",
    sensors: [{ region: "heel", value: 80 }],
    receivedAt: "2026-10-22T00:00:00Z",
  });
  assert.equal(fieldAt(33, 36, heelOnly, false), -1);
});

test("normal pressure simulation allows expected red peaks without persistent alerts", async () => {
  const { analyzePressureSession, normalPressureSession } =
    await import("../src/pressureAnalytics");
  for (const cycles of [1, 10]) {
    const result = analyzePressureSession(normalPressureSession(cycles));
    assert.equal(result.complete, true);
    assert.equal(result.level, "low");
    assert.equal(result.persistentRegions, 0);
    assert.equal(result.unusualRegions, 0);
    assert.ok(result.peak! >= 95);
    assert.ok(result.rows.every((r) => r.average! < r.peak!));
  }
});
test("a heel that stays red during unloading is flagged after repeated cycles", async () => {
  const { analyzePressureSession, normalPressureSession } =
    await import("../src/pressureAnalytics");
  const samples = normalPressureSession(10).map((s) => ({
    ...s,
    values: {
      ...s.values,
      heel: s.phase! >= 0.42 && s.phase! <= 0.96 ? 0.99 : s.values.heel,
    },
  }));
  const result = analyzePressureSession(samples),
    heel = result.rows.find((r) => r.id === "heel")!;
  assert.equal(result.level, "review");
  assert.equal(result.persistentRegions, 1);
  assert.ok(heel.longestRunSeconds > 1);
  assert.ok(heel.flaggedCycles >= 3);
  assert.equal(heel.repeated, true);
  assert.ok(
    result.rows.filter((r) => r.id !== "heel").every((r) => !r.repeated),
  );
});
test("unexpected early big-toe load distinguishes a brief variation from repetition", async () => {
  const { analyzePressureSession, normalPressureSession } =
    await import("../src/pressureAnalytics");
  const session = (cycles: number) =>
    normalPressureSession(cycles).map((s) => ({
      ...s,
      values: { ...s.values, hallux: s.phase! < 0.16 ? 1 : s.values.hallux },
    }));
  assert.equal(analyzePressureSession(session(1)).level, "watch");
  const repeated = analyzePressureSession(session(10));
  assert.equal(repeated.level, "review");
  assert.equal(repeated.rows.find((r) => r.id === "hallux")!.repeated, true);
});
test("pressure analytics never turns missing phase, coverage, or short history into normal", async () => {
  const { analyzePressureSession, normalPressureSession } =
    await import("../src/pressureAnalytics");
  const normal = normalPressureSession(1);
  for (const samples of [
    [],
    normal.slice(0, 2),
    normal.map((s) => ({ ...s, phase: undefined })),
    normal.map((s) => ({ ...s, values: { ...s.values, heel: undefined } })),
    normal.filter((s) => s.side === "left"),
  ]) {
    const result = analyzePressureSession(samples);
    assert.equal(result.complete, false);
    assert.equal(result.level, "unavailable");
  }
});
test("gaps in pressure history cannot accumulate an imaginary continuous exposure", async () => {
  const { analyzePressureSession, normalPressureSession } =
    await import("../src/pressureAnalytics");
  const gaps = normalPressureSession(10)
    .filter((_, i) => i % 20 < 2)
    .map((s) => ({ ...s, values: { ...s.values, heel: 1 } }));
  const result = analyzePressureSession(gaps),
    heel = result.rows.find((r) => r.id === "heel")!;
  assert.equal(result.complete, false);
  assert.equal(heel.unexpectedSeconds, 0);
  assert.equal(heel.repeated, false);
  assert.notEqual(result.level, "low");
});

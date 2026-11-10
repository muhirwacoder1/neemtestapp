export type Zone = "heel" | "midfoot" | "forefoot" | "toes";
export type SensorFrame = {
  side: "left" | "right";
  sensors: { region: Zone; value: number }[];
  temperature?: number;
  receivedAt: string;
};
export type FoundInsole = { id: string; name: string; rssi?: number };
export type InsoleClient = {
  scan: (
    found: (device: FoundInsole) => void,
    error: (message: string) => void,
  ) => Promise<void>;
  stopScan: () => void;
  connect: (
    id: string,
    frame: (frame: SensorFrame) => void,
    disconnected: () => void,
  ) => Promise<{ battery?: number }>;
  disconnect: () => Promise<void>;
  destroy: () => void;
};
// This documented adapter contract must be verified against the actual firmware.
// Never infer pressure units, sensor positions or temperature capability from bytes.
export function parseRelativeFrame(text: string): SensorFrame | null {
  try {
    const v = JSON.parse(text);
    const zones = ["heel", "midfoot", "forefoot", "toes"];
    if (
      v.version !== 1 ||
      !["left", "right"].includes(v.side) ||
      !Array.isArray(v.sensors) ||
      !v.sensors.length ||
      v.sensors.length > 4
    )
      return null;
    if (
      !v.sensors.every(
        (s: { region: string; value: number }) =>
          zones.includes(s.region) &&
          typeof s.value === "number" &&
          Number.isFinite(s.value) &&
          s.value >= 0 &&
          s.value <= 100,
      )
    )
      return null;
    if (
      new Set(v.sensors.map((s: { region: string }) => s.region)).size !==
      v.sensors.length
    )
      return null;
    return {
      side: v.side,
      sensors: v.sensors,
      receivedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

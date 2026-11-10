import type { SensorFrame, Zone } from "../services/ble.types";
export type PressureMapProps = {
  height?: number;
  frames?: Partial<Record<"left" | "right", SensorFrame>>;
  preview?: boolean;
  paused?: boolean;
  /** Freeze both feet at an illustrative gait stage for inspection. */
  phase?: number;
  selected?: string;
  onZone?: (side: "left" | "right", zone: Zone, value?: number) => void;
};

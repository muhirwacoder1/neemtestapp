import { ZONES, ZONE_LABEL, type FootReading, type Zone } from "@/lib/neem-store";

// Zone geometry on a 100x220 canvas for a LEFT foot; right foot is mirrored.
const ZONE_POS: Record<Zone, { cx: number; cy: number; rx: number; ry: number }> = {
  toes: { cx: 44, cy: 28, rx: 22, ry: 14 },
  forefootMed: { cx: 36, cy: 70, rx: 18, ry: 20 },
  forefootLat: { cx: 64, cy: 76, rx: 16, ry: 18 },
  midfoot: { cx: 58, cy: 130, rx: 14, ry: 24 },
  heel: { cx: 50, cy: 186, rx: 22, ry: 22 },
};

export function heatColor(v: number) {
  const stops = ["var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)"];
  const i = Math.min(stops.length - 1, Math.floor(v * stops.length));
  return stops[i];
}

const FOOT_PATH =
  "M50 6 C72 6 84 22 84 44 C84 66 80 86 76 104 C72 122 74 144 76 164 C80 196 70 214 50 214 C30 214 20 198 22 176 C24 150 30 130 28 108 C26 88 16 70 16 46 C16 22 30 6 50 6 Z";

export function Foot({
  reading,
  side,
  size = 120,
  onZone,
  selected,
}: {
  reading: FootReading | null;
  side: "left" | "right";
  size?: number;
  onZone?: (z: Zone) => void;
  selected?: Zone | null;
}) {
  const id = `clip-${side}-${size}`;
  return (
    <svg
      viewBox="0 0 100 220"
      width={size}
      height={size * 2.2}
      role="img"
      aria-label={`${side} foot pressure map${reading ? "" : ", no readings available"}`}
      style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <clipPath id={id}>
          <path d={FOOT_PATH} />
        </clipPath>
        <filter id={`blur-${id}`}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <path d={FOOT_PATH} fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" />
      {reading && (
        <g clipPath={`url(#${id})`}>
          <g filter={`url(#blur-${id})`}>
            {ZONES.map((z) => {
              const p = ZONE_POS[z];
              return (
                <ellipse
                  key={z}
                  {...p}
                  rx={p.rx * 1.4}
                  ry={p.ry * 1.4}
                  fill={heatColor(reading[z])}
                  opacity={0.35 + reading[z] * 0.6}
                  style={{ transition: "all 0.8s ease" }}
                />
              );
            })}
          </g>
        </g>
      )}
      {ZONES.map((z) => {
        const p = ZONE_POS[z];
        return (
          <circle
            key={z}
            cx={p.cx}
            cy={p.cy}
            r={selected === z ? 5 : 2.6}
            fill={reading ? "var(--card)" : "var(--muted-foreground)"}
            stroke={selected === z ? "var(--foreground)" : "none"}
            strokeWidth="1.5"
            opacity={reading ? 0.9 : 0.4}
            style={{ cursor: onZone ? "pointer" : undefined }}
            onClick={onZone ? () => onZone(z) : undefined}
          >
            <title>{ZONE_LABEL[z]}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span>Low</span>
      <div
        className="h-1.5 flex-1 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--heat-1), var(--heat-2), var(--heat-3), var(--heat-4), var(--heat-5))",
        }}
      />
      <span>High</span>
    </div>
  );
}

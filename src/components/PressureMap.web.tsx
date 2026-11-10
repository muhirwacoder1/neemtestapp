import React, { useEffect, useRef, useState } from "react";
import { View, AccessibilityInfo } from "react-native";
import { T, useTheme } from "./ui";
import {
  FOOT_PATH,
  SENSOR_POS,
  PREVIEW_POS,
  GAIT_DURATION,
  REGIONS,
  PRESSURE_COLORS,
  gaitValues,
  frameValues,
} from "../pressure";
import type { PressureMapProps } from "./PressureMap.types";
const palette = PRESSURE_COLORS.map((c) => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
]);
function Sole({
  side,
  height,
  frames = {},
  preview = false,
  paused = false,
  phase,
  selected,
  onZone,
}: PressureMapProps & { side: "left" | "right"; height: number }) {
  const phaseRef = useRef(0.07),
    ref = useRef<HTMLCanvasElement>(null),
    c = useTheme(),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const s = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => s.remove();
  }, []);
  const frame = frames[side];
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 120,
      h = 270,
      off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const offctx = off.getContext("2d")!;
    const image = offctx.createImageData(w, h),
      path = new Path2D(FOOT_PATH),
      inside = new Uint8Array(w * h),
      positions = preview ? PREVIEW_POS : SENSOR_POS,
      count = positions.length,
      weights = new Float32Array(w * h * count);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!offctx.isPointInPath(path, x + 0.5, y + 0.5)) continue;
        inside[y * w + x] = 1;
        for (let i = 0; i < count; i++) {
          const p = positions[i];
          weights[(y * w + x) * count + i] = Math.exp(
            -0.5 * (((x - p.x) / p.sx) ** 2 + ((y - p.y) / p.sy) ** 2),
          );
        }
      }
    const playing = preview && phase === undefined && !paused && !reduced;
    let raf = 0,
      last = 0,
      previous = performance.now();
    const draw = (now: number) => {
      if (now - last < 32 && playing) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = now;
      if (playing && !document.hidden)
        phaseRef.current += (now - previous) / GAIT_DURATION;
      previous = now;
      const values = preview
        ? gaitValues(
            phase ?? phaseRef.current,
            phase === undefined && side === "right" ? 1 : 0,
          )
        : frameValues(frame);
      for (let p = 0; p < w * h; p++) {
        if (!inside[p]) continue;
        let value = 0,
          peak = 0,
          coverage = 0;
        for (let i = 0; i < count; i++) {
          if (values[i] < 0) continue;
          const weight = weights[p * count + i];
          const contribution = values[i] * weight;
          value += contribution;
          peak = Math.max(peak, contribution);
          coverage = Math.max(coverage, weight);
        }
        if (preview) value = Math.max(0.02, peak + 0.075 * (value - peak));
        const unmeasured = !preview && coverage < 0.35,
          t = Math.min(1, Math.max(0, value)) * (palette.length - 1),
          a = Math.floor(t),
          b = Math.min(palette.length - 1, a + 1),
          f = t - a;
        for (let k = 0; k < 3; k++)
          image.data[p * 4 + k] = unmeasured
            ? k === 0
              ? 217
              : k === 1
                ? 230
                : 238
            : Math.round(palette[a][k] * (1 - f) + palette[b][k] * f);
        image.data[p * 4 + 3] = unmeasured ? 75 : 255;
      }
      offctx.putImageData(image, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(canvas.width / w, canvas.height / h);
      ctx.clip(path);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.scale(canvas.width / w, canvas.height / h);
      ctx.strokeStyle = preview ? PRESSURE_COLORS[0] : c.line;
      ctx.lineWidth = 0.9;
      ctx.stroke(path);
      if (!preview && frame)
        frame.sensors.forEach((s) => {
          const p = SENSOR_POS[REGIONS.indexOf(s.region)];
          ctx.beginPath();
          ctx.arc(
            p.x,
            p.y,
            selected === `${side}-${s.region}` ? 5 : 2.8,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = c.navy;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      ctx.restore();
      if (playing && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(raf);
      previous = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", visibility);
    draw(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [frame, preview, paused, phase, reduced, side, c.line, c.navy, selected]);
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      {React.createElement("canvas", {
        ref,
        width: 180,
        height: 405,
        role: "img",
        "aria-label": `${side} foot ${preview ? "animated pressure visualization" : frame ? "interpolated sensor pressure" : "readings unavailable"}`,
        style: {
          height,
          width: (height * 120) / 270,
          display: "block",
          transform: side === "left" ? "scaleX(-1)" : undefined,
          cursor: onZone ? "pointer" : "default",
        },
        onClick: (event: React.MouseEvent<HTMLCanvasElement>) => {
          if (!onZone) return;
          const box = event.currentTarget.getBoundingClientRect(),
            y = ((event.clientY - box.top) / box.height) * 270;
          const i = SENSOR_POS.reduce(
            (best, p, i) =>
              Math.abs(p.y - y) < Math.abs(SENSOR_POS[best].y - y) ? i : best,
            0,
          );
          const zone = REGIONS[i];
          onZone(
            side,
            zone,
            preview
              ? undefined
              : frame?.sensors.find((s) => s.region === zone)?.value,
          );
        },
      })}
      <T size={10} weight="bold" color={c.muted} style={{ letterSpacing: 2 }}>
        {side.toUpperCase()}
      </T>
    </View>
  );
}
export function FootMaps(props: PressureMapProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: Math.min(64, (props.height || 250) / 5),
        paddingVertical: 10,
      }}
    >
      {(["left", "right"] as const).map((side) => (
        <Sole key={side} {...props} side={side} height={props.height || 250} />
      ))}
    </View>
  );
}

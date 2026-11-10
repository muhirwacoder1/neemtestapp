import React, { useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import {
  Canvas,
  Group,
  Path,
  Rect,
  Shader,
  Skia,
  Circle,
} from "@shopify/react-native-skia";
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  useReducedMotion,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  FOOT_PATH,
  SENSOR_POS,
  GAIT_DURATION,
  PRESSURE_COLORS,
  REGIONS,
  gaitValues,
  frameValues,
} from "../pressure";
import { T, useTheme } from "./ui";
import { PRESSURE_SHADER } from "../pressureShader";
import type { PressureMapProps } from "./PressureMap.types";
const effect = Skia.RuntimeEffect.Make(PRESSURE_SHADER)!;
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
  const c = useTheme(),
    clock = useSharedValue(0.07),
    reduced = useReducedMotion(),
    [active, setActive] = useState(true),
    values = useSharedValue(frameValues(frames[side]));
  useEffect(() => {
    const s = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => s.remove();
  }, []);
  useEffect(() => {
    values.value = withTiming(frameValues(frames[side]), { duration: 180 });
  }, [frames, side, values]);
  useEffect(() => {
    if (preview && phase === undefined && !paused && !reduced && active)
      clock.value = withRepeat(
        withTiming(clock.value + 1, {
          duration: GAIT_DURATION,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    else cancelAnimation(clock);
    return () => cancelAnimation(clock);
  }, [preview, paused, phase, reduced, active, clock]);
  const uniforms = useDerivedValue(() => ({
    amplitude: values.value,
    gait: gaitValues(
      phase ?? clock.value,
      phase === undefined && side === "right" ? 1 : 0,
    ),
    preview: preview ? 1 : 0,
  }));
  const width = (height * 120) / 270,
    scale = height / 270;
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="image"
        accessibilityLabel={`${side} foot ${preview ? "animated pressure visualization" : "sensor pressure map"}`}
        onPress={(e) => {
          if (!onZone) return;
          const y = e.nativeEvent.locationY / scale;
          const i = SENSOR_POS.reduce(
            (best, p, i) =>
              Math.abs(p.y - y) < Math.abs(SENSOR_POS[best].y - y) ? i : best,
            0,
          );
          onZone(
            side,
            REGIONS[i],
            preview
              ? undefined
              : frames[side]?.sensors.find((s) => s.region === REGIONS[i])
                  ?.value,
          );
        }}
      >
        <Canvas style={{ width, height }}>
          <Group
            transform={
              side === "left" ? [{ translateX: width }, { scaleX: -1 }] : []
            }
          >
            <Group transform={[{ scale }]}>
              <Group clip={FOOT_PATH}>
                <Rect x={0} y={0} width={120} height={270}>
                  <Shader source={effect} uniforms={uniforms} />
                </Rect>
              </Group>
              <Path
                path={FOOT_PATH}
                style="stroke"
                color={preview ? PRESSURE_COLORS[0] : c.line}
                strokeWidth={0.9}
              />
              {!preview &&
                frames[side]?.sensors.map((s) => {
                  const p = SENSOR_POS[REGIONS.indexOf(s.region)];
                  return (
                    <Circle
                      key={s.region}
                      cx={p.x}
                      cy={p.y}
                      r={selected === `${side}-${s.region}` ? 5 : 2.8}
                      color="white"
                    />
                  );
                })}
            </Group>
          </Group>
        </Canvas>
      </Pressable>
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

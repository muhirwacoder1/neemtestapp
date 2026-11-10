import React, { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { Check } from "lucide-react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  useReducedMotion,
} from "react-native-reanimated";
import { InsoleProduct } from "./graphics";
export function PairingVisual({
  active = false,
  height = 220,
  connected = false,
}: {
  active?: boolean;
  height?: number;
  connected?: boolean;
}) {
  const t = useSharedValue(0),
    reduced = useReducedMotion(),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (active && !reduced && foreground)
      t.value = withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.linear }),
        -1,
        false,
      );
    else cancelAnimation(t);
    return () => cancelAnimation(t);
  }, [active, reduced, foreground, t]);
  const ring = useAnimatedStyle(() => ({
    opacity: active ? (1 - t.value) * 0.5 : 0,
    transform: [{ scale: 0.5 + t.value * 0.9 }],
  }));
  const product = useAnimatedStyle(() => ({
    transform: [
      { translateY: active ? Math.sin(t.value * Math.PI * 2) * -7 : 0 },
    ],
  }));
  return (
    <View
      style={{
        height: height + 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: height * 0.9,
            height: height * 0.9,
            borderRadius: height,
            borderWidth: 2,
            borderColor: "#39A79A",
          },
          ring,
        ]}
      />
      <Animated.View
        style={[{ width: (height * 360) / 290, maxWidth: "100%" }, product]}
      >
        <InsoleProduct height={height} />
      </Animated.View>
      {connected && (
        <View
          style={{
            position: "absolute",
            bottom: 4,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "#28B67A",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 4,
            borderColor: "#FFFFFF",
          }}
        >
          <Check size={25} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

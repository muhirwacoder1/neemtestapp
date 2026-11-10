import React, { useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  ArrowUpRight,
  Check,
  Footprints,
  Smartphone,
  Target,
} from "lucide-react-native";
import { useSteps } from "../steps/context";
import { Button, Card, Input, Sheet, T, useTheme } from "./ui";
const descriptions = {
  loading: "Checking your phone’s motion sensor…",
  idle: "A little movement. A healthier day.",
  ready: "",
  denied: "Allow motion access in your phone settings.",
  unavailable: "This device does not have a step sensor.",
  web: "Open Neem on your phone to count your steps.",
  "development-build": "Step tracking is available in the Neem Android app.",
  "shared-profile": "Switch to your own profile to track your steps.",
  error: "Your step counter needs a moment. Try connecting again.",
};
export function StepCounter() {
  const { snapshot, enable, setGoal } = useSteps(),
    c = useTheme();
  const [open, setOpen] = useState(false),
    [goal, setGoalText] = useState(""),
    [error, setError] = useState("");
  const ready = snapshot.status === "ready",
    known = !!snapshot.day?.updatedAt || ready,
    count = snapshot.day?.count ?? 0;
  const progress =
      known && snapshot.goal ? Math.min(1, count / snapshot.goal) : 0,
    circumference = 2 * Math.PI * 37;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open step count"
        onPress={() => {
          setGoalText(snapshot.goal ? String(snapshot.goal) : "");
          setError("");
          setOpen(true);
        }}
      >
        <Card
          style={{
            backgroundColor: c.lavender,
            padding: 22,
            gap: 18,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: c.card,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Footprints size={19} color={c.text} strokeWidth={1.6} />
              </View>
              <T size={17} weight="medium">
                Your steps
              </T>
            </View>
            <ArrowUpRight size={21} color={c.text} />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 15,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <View
                style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}
              >
                <T
                  size={44}
                  weight="semibold"
                  style={{ letterSpacing: -1.6, lineHeight: 54 }}
                >
                  {known ? count.toLocaleString() : "—"}
                </T>
                <T size={14} color={c.muted}>
                  steps
                </T>
              </View>
              <T size={12} color={c.muted}>
                {known
                  ? snapshot.day?.source === "ios"
                    ? "Today · From your phone"
                    : "Recorded today · While Neem is open"
                  : "Today"}
              </T>
            </View>
            <View
              style={{
                width: 90,
                height: 90,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Svg width={90} height={90} style={{ position: "absolute" }}>
                <Circle
                  cx={45}
                  cy={45}
                  r={37}
                  stroke={c.card}
                  strokeWidth={8}
                  fill="none"
                />
                {progress > 0 && (
                  <Circle
                    cx={45}
                    cy={45}
                    r={37}
                    stroke={c.text}
                    strokeWidth={8}
                    fill="none"
                    strokeDasharray={`${circumference * progress} ${circumference}`}
                    strokeLinecap="round"
                    rotation={-90}
                    origin="45,45"
                  />
                )}
              </Svg>
              {snapshot.status === "loading" ? (
                <ActivityIndicator color={c.text} />
              ) : progress >= 1 ? (
                <Check size={26} color={c.text} />
              ) : (
                <Footprints size={25} strokeWidth={1.5} color={c.text} />
              )}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            {snapshot.goal ? (
              <Target size={13} color={c.muted} />
            ) : (
              <Smartphone size={13} color={c.muted} />
            )}
            <T size={12} color={c.muted} style={{ flex: 1 }}>
              {ready
                ? snapshot.goal
                  ? `${snapshot.goal.toLocaleString()} step goal · ${Math.round(progress * 100)}% recorded`
                  : "Make room for a little movement. Set your own goal."
                : descriptions[snapshot.status]}
            </T>
          </View>
        </Card>
      </Pressable>
      {open && (
        <Sheet title="Every step adds up" onClose={() => setOpen(false)}>
          <Card style={{ backgroundColor: c.lavender, gap: 8 }}>
            <Footprints size={25} color={c.text} />
            <T size={42} weight="semibold">
              {known ? count.toLocaleString() : "—"} <T size={17}>steps</T>
            </T>
            <T size={13}>
              {known
                ? snapshot.day?.source === "ios"
                  ? "Today’s count from your iPhone’s motion sensor."
                  : "Steps recorded on this phone while Neem is open. Steps taken while Neem is closed are not included."
                : descriptions[snapshot.status]}
            </T>
          </Card>
          <T size={13} color={c.muted}>
            Your step count is saved on this device for this profile. It comes
            from your phone, independently of the insole pressure animation.
          </T>
          {["idle", "error"].includes(snapshot.status) && (
            <Button
              label={
                snapshot.status === "error"
                  ? "Reconnect step counter"
                  : "Enable step counting"
              }
              icon={Footprints}
              onPress={() => void enable()}
            />
          )}
          {snapshot.status === "denied" && (
            <Button
              label="Open phone settings"
              secondary
              onPress={() =>
                void Linking.openSettings().catch(() =>
                  setError(
                    "Open your phone’s Settings app and allow motion access for Neem.",
                  ),
                )
              }
            />
          )}
          {snapshot.status === "development-build" && (
            <T size={13} color={c.muted}>
              Android step counting needs the installed Neem development app. It
              cannot run inside Expo Go.
            </T>
          )}
          {snapshot.status === "web" && (
            <T size={13} color={c.muted}>
              This browser cannot access your phone’s motion sensor. Your count
              will appear in the Neem mobile app after you allow motion access.
            </T>
          )}
          <T size={19} weight="semibold">
            A goal that fits your day
          </T>
          <T size={13} color={c.muted}>
            Choose your own target. This is an activity preference, not a
            medical recommendation.
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[3000, 5000, 8000, 10000].map((value) => (
              <Button
                key={value}
                small
                secondary={goal !== String(value)}
                label={value.toLocaleString()}
                onPress={() => setGoalText(String(value))}
              />
            ))}
          </View>
          <Input
            label="Your daily step goal"
            value={goal}
            keyboardType="number-pad"
            onChangeText={setGoalText}
            maxLength={6}
            placeholder="e.g. 5,000"
          />
          {!!error && (
            <T accessibilityRole="alert" color={c.danger} size={13}>
              {error}
            </T>
          )}
          <Button
            label="Save my goal"
            disabled={
              snapshot.status === "loading" ||
              snapshot.status === "shared-profile" ||
              (snapshot.status === "error" && snapshot.storageError)
            }
            onPress={() => {
              const value = Number(goal);
              if (
                !/^\d+$/.test(goal) ||
                !Number.isSafeInteger(value) ||
                value < 100 ||
                value > 100000
              ) {
                setError("Choose a goal between 100 and 100,000 steps.");
                return;
              }
              setGoal(value);
              setOpen(false);
            }}
          />
          {snapshot.goal && (
            <Button
              label="Remove goal"
              ghost
              onPress={() => {
                setGoal(null);
                setGoalText("");
              }}
            />
          )}
          {snapshot.storageError && (
            <T accessibilityRole="alert" size={12} color={c.danger}>
              The latest count could not be saved on this device. Keep Neem open
              and try again.
            </T>
          )}
        </Sheet>
      )}
    </>
  );
}

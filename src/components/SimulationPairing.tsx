import React, { useEffect } from "react";
import { View } from "react-native";
import { Bluetooth, CheckCircle2, RotateCcw } from "lucide-react-native";
import { useInsole } from "../insole";
import { Badge, Button, Card, T, useTheme } from "./ui";
import { PairingVisual } from "./PairingVisual";
export function SimulationPairing({ onViewMap }: { onViewMap: () => void }) {
  const { simulation, startSimulation, cancelSimulation, resetSimulation } =
      useInsole(),
    c = useTheme();
  useEffect(() => {
    startSimulation();
    return () => cancelSimulation();
  }, [startSimulation, cancelSimulation]);
  const connected = simulation === "connected",
    loading = simulation !== "idle" && !connected,
    labels = ["Searching", "Found", "Connecting", "Ready"],
    index = ["searching", "found", "connecting", "connected"].indexOf(
      simulation,
    ),
    detail = {
      idle: "See how an insole connects, then explore pressure through a step.",
      searching: "Looking for a nearby insole…",
      found: "neem found. Preparing the connection…",
      connecting: "Connecting to neem…",
      connected:
        "The connection preview is complete. Your walking heatmap is ready.",
    }[simulation];
  return (
    <>
      <Card
        style={{ backgroundColor: c.bluePale, alignItems: "center", gap: 10 }}
      >
        <Badge label="Connection preview" dot bg={c.card} color={c.text} />
        <PairingVisual active={loading} connected={connected} height={150} />
        <View
          accessibilityLiveRegion="polite"
          style={{ alignItems: "center", gap: 8 }}
        >
          <T size={32} weight="medium" style={{ letterSpacing: -1 }}>
            neem
          </T>
          <T size={19} weight="medium">
            {connected
              ? "Preview ready"
              : simulation === "idle"
                ? "Ready to connect"
                : labels[index]}
          </T>
          <T
            size={13}
            color={c.muted}
            style={{ textAlign: "center", lineHeight: 20 }}
          >
            {detail}
          </T>
        </View>
        <View
          style={{ flexDirection: "row", gap: 5, marginTop: 16, width: "100%" }}
        >
          {labels.map((label, i) => (
            <View key={label} style={{ flex: 1, gap: 8, alignItems: "center" }}>
              <View
                style={{
                  width: "100%",
                  height: 5,
                  borderRadius: 5,
                  backgroundColor: i <= index ? c.blue : c.line,
                }}
              />
              <T size={10} color={i === index ? c.text : c.muted}>
                {label}
              </T>
            </View>
          ))}
        </View>
      </Card>
      {index >= 1 && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {connected ? (
            <CheckCircle2 size={24} color={c.teal} />
          ) : (
            <Bluetooth size={24} color={c.blue} />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <T size={18} weight="medium">
              neem
            </T>
            <T size={12} color={c.muted}>
              {connected ? "Preview ready" : "Insole preview"}
            </T>
          </View>
        </Card>
      )}
      {connected ? (
        <>
          <Button
            label="View walking heatmap"
            onPress={onViewMap}
            style={{ backgroundColor: c.blue }}
          />
          <Button
            label="Replay connection preview"
            icon={RotateCcw}
            secondary
            onPress={() => startSimulation(true)}
          />
        </>
      ) : loading ? (
        <Button label="Stop preview" secondary onPress={resetSimulation} />
      ) : (
        <Button
          label="Start connection preview"
          icon={Bluetooth}
          onPress={() => startSimulation(true)}
          style={{ backgroundColor: c.blue }}
        />
      )}
      <T
        size={11}
        color={c.muted}
        style={{ textAlign: "center", lineHeight: 17 }}
      >
        This preview uses no Bluetooth connection and saves no sensor readings.
        Choose My insole to connect your actual device.
      </T>
    </>
  );
}

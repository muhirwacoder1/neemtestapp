import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, T } from "../components/ui";
export default function NotFound() {
  return (
    <Card>
      <View style={{ gap: 16, alignItems: "center", padding: 30 }}>
        <T size={27} weight="bold">
          A little off the path.
        </T>
        <T size={13}>
          This page isn’t available. Your dashboard is just a step away.
        </T>
        <Button label="Back to Home" onPress={() => router.replace("/")} />
      </View>
    </Card>
  );
}

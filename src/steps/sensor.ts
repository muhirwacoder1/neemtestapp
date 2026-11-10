import { Pedometer } from "expo-sensors";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type { StepSensor } from "./tracker";
export const stepSensor: StepSensor = {
  platform:
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : "web",
  requiresBuild:
    Platform.OS === "android" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  available: () => Pedometer.isAvailableAsync(),
  permission: (request) =>
    request
      ? Pedometer.requestPermissionsAsync()
      : Pedometer.getPermissionsAsync(),
  today: async (start, end) =>
    (await Pedometer.getStepCountAsync(start, end)).steps,
  watch: (callback) =>
    Pedometer.watchStepCount((result) => callback(result.steps)),
};

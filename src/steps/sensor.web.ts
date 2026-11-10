import type { StepSensor } from "./tracker";
export const stepSensor: StepSensor = {
  platform: "web",
  requiresBuild: false,
  available: async () => false,
  permission: async () => ({ granted: false, canAskAgain: false }),
  today: async () => 0,
  watch: () => ({ remove() {} }),
};

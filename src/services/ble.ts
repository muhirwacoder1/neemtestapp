import { PermissionsAndroid, Platform } from "react-native";
import { toByteArray } from "base64-js";
import type { BleManager, Device, Subscription } from "react-native-ble-plx";
import { InsoleClient, parseRelativeFrame } from "./ble.types";
export async function createInsoleClient(): Promise<InsoleClient> {
  const service = process.env.EXPO_PUBLIC_BLE_SERVICE_UUID;
  const characteristic =
    process.env.EXPO_PUBLIC_BLE_PRESSURE_CHARACTERISTIC_UUID;
  if (
    !service ||
    !characteristic ||
    process.env.EXPO_PUBLIC_BLE_PROTOCOL !== "verified-neem-relative-v1"
  )
    throw new Error(
      "Your insole connection has not been configured. Ask your device team for the verified Bluetooth service, pressure characteristic and packet format.",
    );
  if (Platform.OS === "android") {
    const permissions =
      Number(Platform.Version) >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (
      Object.values(result).some(
        (v) => v !== PermissionsAndroid.RESULTS.GRANTED,
      )
    )
      throw new Error(
        "Bluetooth permission is needed to find your insoles. You can enable it in your phone settings.",
      );
  }
  let manager: BleManager;
  try {
    const library = await import("react-native-ble-plx");
    manager = new library.BleManager();
  } catch {
    throw new Error(
      "Bluetooth needs a Neem development build on your phone. It is not available in Expo Go.",
    );
  }
  let device: Device | undefined,
    scanTimer: ReturnType<typeof setTimeout> | undefined;
  const subscriptions: Subscription[] = [];
  const stopScan = () => {
    clearTimeout(scanTimer);
    manager.stopDeviceScan();
  };
  return {
    async scan(found, error) {
      await new Promise<void>((resolve, reject) => {
        let subscription: Subscription | undefined;
        const timeout = setTimeout(() => {
          subscription?.remove();
          reject(new Error("Turn on Bluetooth, then try again."));
        }, 12_000);
        subscription = manager.onStateChange((state) => {
          if (state === "PoweredOn") {
            clearTimeout(timeout);
            subscription?.remove();
            resolve();
          } else if (state === "Unauthorized" || state === "Unsupported") {
            clearTimeout(timeout);
            subscription?.remove();
            reject(
              new Error("Bluetooth is unavailable or permission was denied."),
            );
          }
        }, true);
      });
      manager.startDeviceScan([service], null, (e, item) => {
        if (e) {
          stopScan();
          error(e.message);
          return;
        }
        if (item)
          found({
            id: item.id,
            name: item.name || item.localName || "Neem Smart Insole",
            rssi: item.rssi ?? undefined,
          });
      });
      scanTimer = setTimeout(() => {
        stopScan();
        error(
          "Scan finished. If your insoles are not listed, charge them, keep them nearby and try again.",
        );
      }, 15_000);
    },
    stopScan,
    async connect(id, onFrame, disconnected) {
      stopScan();
      device = await manager.connectToDevice(id, { timeout: 15_000 });
      await device.discoverAllServicesAndCharacteristics();
      subscriptions.push(
        manager.onDeviceDisconnected(id, () => disconnected()),
      );
      let battery: number | undefined;
      try {
        const reading = await device.readCharacteristicForService(
          "180f",
          "2a19",
        );
        if (reading.value) {
          const v = toByteArray(reading.value)[0];
          if (v <= 100) battery = v;
        }
      } catch {
        /* Optional standard battery service. */
      }
      if (
        characteristic &&
        process.env.EXPO_PUBLIC_BLE_PROTOCOL === "verified-neem-relative-v1"
      ) {
        subscriptions.push(
          device.monitorCharacteristicForService(
            service,
            characteristic,
            (error, value) => {
              if (error || !value?.value) return;
              const frame = parseRelativeFrame(
                String.fromCharCode(...toByteArray(value.value)),
              );
              if (frame) onFrame(frame);
            },
          ),
        );
      }
      return { battery };
    },
    async disconnect() {
      subscriptions.splice(0).forEach((s) => s.remove());
      if (device)
        await manager.cancelDeviceConnection(device.id).catch(() => {});
      device = undefined;
    },
    destroy() {
      stopScan();
      subscriptions.forEach((s) => s.remove());
      manager.destroy();
    },
  };
}

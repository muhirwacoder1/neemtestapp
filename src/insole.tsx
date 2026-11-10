import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import { createInsoleClient } from "./services/ble";
import { FoundInsole, InsoleClient, SensorFrame } from "./services/ble.types";
import { useStore } from "./store";
import { convex } from "./services/backend";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
type Insole = {
  connected: boolean;
  preview: boolean;
  setPreview: (value: boolean) => void;
  status: "idle" | "scanning" | "connecting" | "connected" | "error";
  devices: FoundInsole[];
  frames: Partial<Record<"left" | "right", SensorFrame>>;
  battery?: number;
  error: string;
  scan: () => Promise<void>;
  pair: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  stopScan: () => void;
  simulation: "idle" | "searching" | "found" | "connecting" | "connected";
  startSimulation: (restart?: boolean) => void;
  cancelSimulation: () => void;
  resetSimulation: () => void;
};
const Context = createContext<Insole>(null!);
export function InsoleProvider({ children }: { children: React.ReactNode }) {
  const { guest, profile, setNotice } = useStore();
  const scopeKey = `${guest}-${profile.id}`;
  const [scope, setScope] = useState(scopeKey);
  const currentScope = scope === scopeKey;
  const [connected, setConnected] = useState(false),
    [preview, setPreview] = useState(true),
    [status, setStatus] = useState<Insole["status"]>("idle"),
    [devices, setDevices] = useState<FoundInsole[]>([]),
    [frames, setFrames] = useState<Insole["frames"]>({}),
    [battery, setBattery] = useState<number>(),
    [error, setError] = useState("");
  const [simulation, setSimulation] = useState<Insole["simulation"]>("idle"),
    [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!active || simulation === "idle" || simulation === "connected") return;
    const next = {
      searching: "found",
      found: "connecting",
      connecting: "connected",
    } as const;
    const duration = { searching: 1600, found: 1100, connecting: 2200 };
    const timer = setTimeout(
      () =>
        setSimulation((state) =>
          state === simulation ? next[simulation] : state,
        ),
      duration[simulation],
    );
    return () => clearTimeout(timer);
  }, [simulation, active]);
  // This path never calls Bluetooth, device linking or sensor-history mutations.
  const startSimulation = useCallback((restart = false) => {
    setPreview(true);
    setSimulation((state) =>
      state === "connected" && !restart ? state : "searching",
    );
  }, []);
  const cancelSimulation = useCallback(() => {
    setSimulation((state) => (state === "connected" ? state : "idle"));
  }, []);
  const resetSimulation = useCallback(() => setSimulation("idle"), []);
  const client = useRef<InsoleClient | null>(null),
    generation = useRef(0);
  const invalidateSession = useCallback(() => {
    generation.current++;
    client.current?.destroy();
    client.current = null;
  }, []);
  // Keep the Router mounted while profile data loads. Reset only the device
  // session, and hide stale readings immediately when the profile changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnected(false);
      setPreview(true);
      setStatus("idle");
      setDevices([]);
      setFrames({});
      setBattery(undefined);
      setError("");
      setSimulation("idle");
      setScope(scopeKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      invalidateSession();
    };
  }, [scopeKey, invalidateSession]);
  async function scan() {
    if (!currentScope) return;
    const gen = generation.current;
    setError("");
    setSimulation("idle");
    setDevices([]);
    setStatus("scanning");
    try {
      if (guest)
        throw new Error("Sign in to link your insoles to your health profile.");
      if (!client.current) {
        const next = await createInsoleClient();
        if (gen !== generation.current) {
          next.destroy();
          return;
        }
        client.current = next;
      }
      await client.current.scan(
        (item) => {
          if (gen === generation.current)
            setDevices((list) => [
              ...list.filter((d) => d.id !== item.id),
              item,
            ]);
        },
        (message) => {
          if (gen === generation.current) {
            setError(message);
            setStatus("error");
          }
        },
      );
    } catch (e) {
      if (gen === generation.current) {
        setError((e as Error).message);
        setStatus("error");
      }
    }
  }
  async function pair(id: string) {
    if (!currentScope) return;
    const gen = generation.current;
    setError("");
    setStatus("connecting");
    try {
      if (!client.current || guest || !convex)
        throw new Error("Sign in before linking your insole.");
      const deviceId = await convex.mutation(api.devices.link, {
        profileId: profile.id as Id<"profiles">,
        hardwareId: id,
        name: devices.find((d) => d.id === id)?.name || "Neem Smart Insole",
      });
      if (gen !== generation.current) return;
      const lastSaved = { left: 0, right: 0 };
      let syncNotice = false;
      const result = await client.current.connect(
        id,
        (frame) => {
          if (gen !== generation.current) return;
          setFrames((f) => ({ ...f, [frame.side]: frame }));
          if (Date.now() - lastSaved[frame.side] > 10000) {
            lastSaved[frame.side] = Date.now();
            void convex!
              .mutation(api.devices.saveFrame, {
                profileId: profile.id as Id<"profiles">,
                deviceId,
                side: frame.side,
                sensors: frame.sensors,
                receivedAt: frame.receivedAt,
                sequence: `${frame.side}-${frame.receivedAt}`,
              })
              .then(() => {
                syncNotice = false;
              })
              .catch(() => {
                if (gen === generation.current && !syncNotice) {
                  syncNotice = true;
                  setNotice(
                    "Your map is current, but sensor history could not synchronize.",
                  );
                }
              });
          }
        },
        () => {
          if (gen === generation.current) {
            setConnected(false);
            setFrames({});
            setStatus("idle");
            setNotice("Your insole disconnected. Reconnect for live readings.");
          }
        },
      );
      if (gen !== generation.current) return;
      setBattery(result.battery);
      setConnected(true);
      setPreview(false);
      setStatus("connected");
    } catch (e) {
      if (gen === generation.current) {
        setFrames({});
        setConnected(false);
        setError((e as Error).message);
        setStatus("error");
      }
    }
  }
  useEffect(() => {
    const timer = setInterval(
      () =>
        setFrames((f) => {
          const fresh = Object.entries(f).filter(
            ([, v]) => Date.now() - Date.parse(v.receivedAt) < 30000,
          );
          return fresh.length === Object.keys(f).length
            ? f
            : Object.fromEntries(fresh);
        }),
      5000,
    );
    return () => clearInterval(timer);
  }, []);
  async function disconnect() {
    await client.current?.disconnect();
    setConnected(false);
    setFrames({});
    setBattery(undefined);
    setStatus("idle");
  }
  const stopScan = useCallback(() => {
    client.current?.stopScan();
    setStatus((s) => (s === "scanning" ? "idle" : s));
  }, []);
  return (
    <Context.Provider
      value={{
        connected: currentScope && connected,
        preview: currentScope ? preview : true,
        setPreview,
        status: currentScope ? status : "idle",
        devices: currentScope ? devices : [],
        frames: currentScope ? frames : {},
        battery: currentScope ? battery : undefined,
        error: currentScope ? error : "",
        scan,
        pair,
        disconnect,
        stopScan,
        simulation: currentScope ? simulation : "idle",
        startSimulation,
        cancelSimulation,
        resetSimulation,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useInsole = () => useContext(Context);

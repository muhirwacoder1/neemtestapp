import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "../store";
import { useAccount } from "../services/backend";
import { StepTracker, type StepSnapshot } from "./tracker";
import { stepSensor } from "./sensor";
const initial: StepSnapshot = {
  status: "loading",
  day: null,
  goal: null,
  canAskAgain: true,
  storageError: false,
};
const Context = createContext<{
  snapshot: StepSnapshot;
  enable: () => Promise<void>;
  setGoal: (goal: number | null) => void;
}>({ snapshot: initial, enable: async () => {}, setGoal: () => {} });
export function StepsProvider({ children }: { children: React.ReactNode }) {
  const { guest, profile } = useStore(),
    account = useAccount();
  const scope =
    !guest && account.signedIn && profile.id && profile.role === "owner"
      ? `${account.userId}/${profile.id}`
      : null;
  const [state, setState] = useState<{
    scope: string | null;
    snapshot: StepSnapshot;
  }>({ scope: null, snapshot: initial });
  const current = useRef<{ scope: string; tracker: StepTracker } | null>(null);
  useEffect(() => {
    if (!scope) return;
    const tracker = new StepTracker({
      key: `@neem/steps/v1/${scope}`,
      sensor: stepSensor,
      storage: AsyncStorage,
      emit: (snapshot) => setState({ scope, snapshot }),
    });
    current.current = { scope, tracker };
    void tracker.initialize(
      AppState.currentState === "active" || AppState.currentState == null,
    );
    const listener = AppState.addEventListener(
      "change",
      (next) => void tracker.setActive(next === "active"),
    );
    const timer = setInterval(() => void tracker.tick(), 60000);
    return () => {
      listener.remove();
      clearInterval(timer);
      current.current = null;
      void tracker.dispose();
    };
  }, [scope]);
  const snapshot =
    scope === null
      ? { ...initial, status: "shared-profile" as const }
      : state.scope === scope
        ? state.snapshot
        : initial;
  return (
    <Context.Provider
      value={{
        snapshot,
        enable: async () => {
          if (current.current?.scope === scope)
            await current.current.tracker.enable();
        },
        setGoal: (goal) => {
          if (current.current?.scope === scope)
            current.current.tracker.setGoal(goal);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSteps = () => useContext(Context);

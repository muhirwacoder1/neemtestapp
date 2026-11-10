import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
type Intro = {
  ready: boolean;
  seen: boolean;
  finish: () => Promise<void>;
  names: { firstName: string; lastName: string };
  setNames: (names: { firstName: string; lastName: string }) => void;
};
const Context = createContext<Intro>(null!);
const KEY = "@neem/welcome-seen/v1";
export function StartupProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [seen, setSeen] = useState(false),
    [names, setNames] = useState({ firstName: "", lastName: "" });
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (active) setSeen(value === "yes");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const finish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY, "yes");
    } catch {}
    setSeen(true);
  }, []);
  return (
    <Context.Provider value={{ ready, seen, finish, names, setNames }}>
      {children}
    </Context.Provider>
  );
}
export const useStartup = () => useContext(Context);

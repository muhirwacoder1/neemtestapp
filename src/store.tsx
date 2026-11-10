import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useColorScheme, ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { Profile, ProfileData, ProfileDetails, emptyData } from "./domain";
import { useAccount, convex } from "./services/backend";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

type Store = {
  data: ProfileData;
  profile: Profile;
  profiles: Profile[];
  guest: boolean;
  ready: boolean;
  busy: boolean;
  error: string;
  dark: boolean;
  notice: string;
  hasMoreReadings: boolean;
  setNotice: (s: string) => void;
  update: (fn: (d: ProfileData) => ProfileData) => Promise<boolean>;
  switchProfile: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  rename: (name: string) => Promise<void>;
  saveProfile: (details: ProfileDetails, complete: boolean) => Promise<boolean>;
  signOut: () => Promise<void>;
};
const Context = createContext<Store>(null!);
const GUEST_KEY = "@neem/visitor-preferences/v2";
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  // Select the store only after the sign-in state is known. Mounting a visitor
  // navigator first would reset a direct workspace link when auth finishes.
  if (!account.loaded)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ECF0F3",
        }}
      >
        <ActivityIndicator color="#2196F3" />
      </View>
    );
  return account.signedIn && convex ? (
    <CloudStore key={account.userId}>{children}</CloudStore>
  ) : (
    <VisitorStore key="visitor">{children}</VisitorStore>
  );
}
function StoreView({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Omit<Store, "dark">;
}) {
  const scheme = useColorScheme();
  const { notice, setNotice } = value;
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  const dark =
    value.data.preferences.appearance === "dark" ||
    (value.data.preferences.appearance === "system" && scheme === "dark");
  return (
    <Context.Provider value={{ ...value, dark }}>{children}</Context.Provider>
  );
}
function VisitorStore({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(GUEST_KEY)
      .then((raw) => {
        if (mounted && raw) {
          try {
            const d = JSON.parse(raw);
            setData({
              ...emptyData(),
              preferences: { ...emptyData().preferences, ...d.preferences },
              bookmarks: Array.isArray(d.bookmarks) ? d.bookmarks : [],
              readProgress: d.readProgress || {},
            });
          } catch {}
        }
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const update = async (fn: (d: ProfileData) => ProfileData) => {
    const next = fn(data);
    if (next.readings.length || next.tasks.length) {
      setNotice("Sign in to save your health records and care tasks.");
      return false;
    }
    try {
      await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(next));
      setData(next);
      return true;
    } catch {
      setNotice("Your preferences could not be saved. Please try again.");
      return false;
    }
  };
  return (
    <StoreView
      value={{
        data,
        profile: { id: "visitor", name: "" },
        profiles: [],
        guest: true,
        ready,
        busy: false,
        error: "",
        notice,
        setNotice,
        hasMoreReadings: false,
        update,
        switchProfile: async () => {},
        refresh: async () =>
          setNotice("Sign in to synchronize your health records."),
        rename: async () =>
          setNotice("Sign in to create your personal profile."),
        saveProfile: async () => {
          setNotice("Sign in to save your profile.");
          return false;
        },
        signOut: async () => {},
      }}
    >
      {children}
    </StoreView>
  );
}
function CloudStore({ children }: { children: React.ReactNode }) {
  const account = useAccount(),
    ensure = useMutation(api.profiles.ensure),
    save = useMutation(api.records.saveChanges),
    renameProfile = useMutation(api.profiles.rename),
    saveSetup = useMutation(api.profiles.saveSetup);
  const [initialized, setInitialized] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Id<"profiles">>(),
    [notice, setNotice] = useState("");
  const saving = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    if (account.authenticated)
      ensure({})
        .then(() => {
          if (mounted) {
            setInitialized(true);
            setError("");
          }
        })
        .catch(() => {
          if (mounted)
            setError(
              "Your profile could not be opened. Check your connection and retry.",
            );
        });
    return () => {
      mounted = false;
    };
  }, [account.authenticated, ensure]);
  const profiles = useQuery(
    api.profiles.list,
    account.authenticated && initialized ? {} : "skip",
  );
  const profileId = profiles?.some((p) => p.id === selected)
    ? selected
    : profiles?.[0]?.id;
  const result = useQuery(
    api.records.dashboard,
    account.authenticated && profileId ? { profileId } : "skip",
  );
  const data: ProfileData = result || emptyData(),
    profile = profiles?.find((p) => p.id === profileId) || {
      id: "",
      name: account.name,
    };
  const currentData = useRef(data);
  useEffect(() => {
    currentData.current = data;
  }, [data]);
  const update = async (fn: (d: ProfileData) => ProfileData) => {
    if (!profileId || !account.authenticated) {
      setNotice("Your secure connection is still loading.");
      return false;
    }
    if (saving.current) {
      setNotice("Your previous change is saving. Please try again shortly.");
      return false;
    }
    const before = currentData.current,
      next = fn(before),
      gen = generation.current;
    saving.current = true;
    try {
      const readings = next.readings.filter(
        (r) => !before.readings.some((p) => p.id === r.id),
      );
      if (readings.some((r) => r.source !== "manual"))
        throw new Error("This form accepts manual measurements only.");
      await save({
        profileId,
        readings: readings as (Omit<
          ProfileData["readings"][number],
          "source"
        > & { source: "manual" })[],
        tasks: next.tasks.filter(
          (t) =>
            JSON.stringify(before.tasks.find((p) => p.id === t.id)) !==
            JSON.stringify(t),
        ),
        ...(JSON.stringify(next.preferences) !==
        JSON.stringify(before.preferences)
          ? { preferences: next.preferences }
          : {}),
        ...(JSON.stringify(next.bookmarks) !== JSON.stringify(before.bookmarks)
          ? { bookmarks: next.bookmarks }
          : {}),
        ...(JSON.stringify(next.readProgress) !==
        JSON.stringify(before.readProgress)
          ? { readProgress: next.readProgress }
          : {}),
      });
      return gen === generation.current;
    } catch {
      setNotice(
        "Your changes could not be saved. Check your connection and try again.",
      );
      return false;
    } finally {
      saving.current = false;
    }
  };
  const switchProfile = async (id: string) => {
    if (saving.current) {
      setNotice("Please wait for your current change to save.");
      return;
    }
    if (profiles?.some((p) => p.id === id)) {
      generation.current++;
      setSelected(id as Id<"profiles">);
    }
  };
  const refresh = useCallback(async () => {
    try {
      await ensure({});
      setInitialized(true);
      setError("");
      setNotice("Your account is connected. Records update automatically.");
    } catch {
      setError("Your account could not be reached. Please try again.");
    }
  }, [ensure]);
  return (
    <StoreView
      value={{
        data,
        profile,
        profiles: profiles || [],
        guest: false,
        ready: true,
        busy: !result,
        error:
          error ||
          (account.loaded && !account.authenticated
            ? "Your session has not connected to the health service. Please sign out and sign in again."
            : ""),
        notice,
        setNotice,
        hasMoreReadings: !!result?.hasMoreReadings,
        update,
        switchProfile,
        refresh,
        rename: async (name) => {
          if (!profileId) return;
          try {
            await renameProfile({ profileId, name });
            setNotice("Profile updated.");
          } catch {
            setNotice("Your profile could not be saved.");
          }
        },
        saveProfile: async (details, complete) => {
          if (!profileId || !account.authenticated) return false;
          try {
            await saveSetup({ profileId, details, complete });
            return true;
          } catch {
            setNotice(
              "Your profile could not be saved. Check your connection and try again.",
            );
            return false;
          }
        },
        signOut: async () => {
          generation.current++;
          await account.signOut();
        },
      }}
    >
      {children}
    </StoreView>
  );
}
export const useStore = () => useContext(Context);

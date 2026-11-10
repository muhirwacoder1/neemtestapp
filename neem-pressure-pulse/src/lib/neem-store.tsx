import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DeviceState = "none" | "connected" | "disconnected";
export type GlucoseContext = "Fasting" | "Before meal" | "After meal" | "Before bed" | "Other";
export type Glucose = { id: string; value: number; context: GlucoseContext; at: string };
export type BP = { id: string; sys: number; dia: number; at: string };
export type Body = { id: string; heightCm: number; weightKg: number; at: string };
export type Task = { id: string; title: string; time: string; group: "today" | "upcoming"; done: boolean; custom?: boolean };

// Sensor zones per foot (relative pressure 0–1). Demo Mode only.
export type Zone = "toes" | "forefootMed" | "forefootLat" | "midfoot" | "heel";
export const ZONES: Zone[] = ["toes", "forefootMed", "forefootLat", "midfoot", "heel"];
export const ZONE_LABEL: Record<Zone, string> = {
  toes: "Toes",
  forefootMed: "Forefoot (inner)",
  forefootLat: "Forefoot (outer)",
  midfoot: "Midfoot",
  heel: "Heel",
};
export type FootReading = Record<Zone, number>;

const day = (d: number, h = 8) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 15, 0, 0);
  return t.toISOString();
};

const seededGlucose: Glucose[] = Array.from({ length: 30 }, (_, i) => ({
  id: `g${i}`,
  value: Math.round(110 + Math.sin(i / 2.3) * 22 + (i % 3) * 6),
  context: (["Fasting", "After meal", "Before meal"] as GlucoseContext[])[i % 3]!,
  at: day(29 - i, 7 + (i % 3) * 5),
}));
const seededBP: BP[] = Array.from({ length: 30 }, (_, i) => ({
  id: `b${i}`,
  sys: Math.round(124 + Math.sin(i / 3) * 8),
  dia: Math.round(80 + Math.cos(i / 3) * 5),
  at: day(29 - i, 9),
}));
const seededBody: Body[] = Array.from({ length: 6 }, (_, i) => ({
  id: `w${i}`,
  heightCm: 172,
  weightKg: +(81 - i * 0.6).toFixed(1),
  at: day(150 - i * 30),
}));
export const DEMO_TEMP = Array.from({ length: 30 }, (_, i) => ({
  at: day(29 - i),
  left: +(30.4 + Math.sin(i / 4) * 0.5).toFixed(1),
  right: +(30.6 + Math.sin(i / 4 + 0.6) * 0.6).toFixed(1),
}));
export const DEMO_PRESSURE_TREND = Array.from({ length: 30 }, (_, i) => ({
  at: day(29 - i),
  avg: +(0.42 + Math.sin(i / 5) * 0.06).toFixed(2),
  peak: +(0.74 + Math.cos(i / 4) * 0.08).toFixed(2),
}));

const seedTasks: Task[] = [
  { id: "t1", title: "Check feet for visible changes", time: "8:00 AM", group: "today", done: true },
  { id: "t2", title: "Record fasting glucose", time: "8:30 AM", group: "today", done: false },
  { id: "t3", title: "Review Smart Insole alerts", time: "12:00 PM", group: "today", done: false },
  { id: "t4", title: "Record blood pressure", time: "6:00 PM", group: "today", done: false },
  { id: "t5", title: "Read: Choosing the right shoes", time: "8:00 PM", group: "today", done: false },
  { id: "t6", title: "Podiatry appointment — CHUK", time: "Tomorrow, 10:00 AM", group: "upcoming", done: false },
  { id: "t7", title: "Moisturise feet (not between toes)", time: "Tomorrow, 9:00 PM", group: "upcoming", done: false },
];

function jitter(base: FootReading, t: number): FootReading {
  const out = {} as FootReading;
  ZONES.forEach((z, i) => (out[z] = Math.max(0.05, Math.min(1, base[z] + Math.sin(t / 3 + i) * 0.08))));
  return out;
}
const BASE_L: FootReading = { toes: 0.32, forefootMed: 0.78, forefootLat: 0.52, midfoot: 0.18, heel: 0.66 };
const BASE_R: FootReading = { toes: 0.28, forefootMed: 0.6, forefootLat: 0.46, midfoot: 0.16, heel: 0.58 };

type Ctx = {
  device: DeviceState;
  battery: number;
  lastSync: Date | null;
  connect: () => void;
  disconnect: () => void;
  pairOpen: boolean;
  setPairOpen: (v: boolean) => void;
  tick: number;
  setTick: (fn: (n: number) => number) => void;
  left: FootReading | null;
  right: FootReading | null;
  glucose: Glucose[];
  addGlucose: (g: Omit<Glucose, "id">) => Promise<void>;
  bp: BP[];
  addBP: (b: Omit<BP, "id">) => Promise<void>;
  body: Body[];
  addBody: (b: Omit<Body, "id">) => Promise<void>;
  tasks: Task[];
  toggleTask: (id: string) => void;
  addTask: (title: string, time: string) => void;
  /** true when that metric shows the signed-in user's saved readings (not demo). */
  real: { glucose: boolean; bp: boolean; body: boolean };
  refreshReadings: () => Promise<void>;
  premium: boolean;
  setPremium: (v: boolean) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
};

const NeemCtx = createContext<Ctx | null>(null);

export function NeemProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<DeviceState>("none");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [glucose, setGlucose] = useState(seededGlucose);
  const [bp, setBP] = useState(seededBP);
  const [body, setBody] = useState(seededBody);
  const [tasks, setTasks] = useState(seedTasks);
  const [premium, setPremium] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [real, setReal] = useState({ glucose: false, bp: false, body: false });
  const [userId, setUserId] = useState<string | null>(null);

  // Signed-in users with saved readings see only their real data per metric; otherwise demo data.
  const refreshReadings = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setReal({ glucose: false, bp: false, body: false });
      setGlucose(seededGlucose); setBP(seededBP); setBody(seededBody);
      return;
    }
    const { data } = await supabase.from("health_readings").select("*").order("recorded_at");
    const rows = data ?? [];
    const g = rows.filter((r) => r.kind === "glucose").map((r) => ({ id: r.id, value: Number(r.value1), context: (r.context ?? "Other") as GlucoseContext, at: r.recorded_at }));
    const b = rows.filter((r) => r.kind === "bp").map((r) => ({ id: r.id, sys: Number(r.value1), dia: Number(r.value2), at: r.recorded_at }));
    const w = rows.filter((r) => r.kind === "body").map((r) => ({ id: r.id, heightCm: Number(r.value1), weightKg: Number(r.value2), at: r.recorded_at }));
    setReal({ glucose: g.length > 0, bp: b.length > 0, body: w.length > 0 });
    setGlucose(g.length ? g : seededGlucose);
    setBP(b.length ? b : seededBP);
    setBody(w.length ? w : seededBody);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { void refreshReadings(); }, [userId, refreshReadings]);

  const saveReading = async (row: { kind: string; value1: number; value2?: number; context?: string; recorded_at: string }) => {
    if (!userId) return false;
    const { error } = await supabase.from("health_readings").insert(row);
    if (error) throw error;
    await refreshReadings();
    return true;
  };

  const connected = device === "connected";
  const value: Ctx = {
    device,
    battery: 82,
    lastSync,
    connect: () => {
      setDevice("connected");
      setLastSync(new Date());
    },
    disconnect: () => setDevice("disconnected"),
    pairOpen,
    setPairOpen,
    tick,
    setTick,
    left: connected ? jitter(BASE_L, tick) : null,
    right: connected ? jitter(BASE_R, tick + 2) : null,
    glucose,
    addGlucose: async (g) => {
      if (!(await saveReading({ kind: "glucose", value1: g.value, context: g.context, recorded_at: g.at })))
        setGlucose((s) => [...s, { ...g, id: crypto.randomUUID() }]);
    },
    bp,
    addBP: async (b) => {
      if (!(await saveReading({ kind: "bp", value1: b.sys, value2: b.dia, recorded_at: b.at })))
        setBP((s) => [...s, { ...b, id: crypto.randomUUID() }]);
    },
    body,
    addBody: async (b) => {
      if (!(await saveReading({ kind: "body", value1: b.heightCm, value2: b.weightKg, recorded_at: b.at })))
        setBody((s) => [...s, { ...b, id: crypto.randomUUID() }]);
    },
    real,
    refreshReadings,
    tasks,
    toggleTask: (id) => setTasks((s) => s.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    addTask: (title, time) =>
      setTasks((s) => [...s, { id: crypto.randomUUID(), title, time, group: "today", done: false, custom: true }]),
    premium,
    setPremium,
    saved,
    toggleSaved: (id) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
  };
  return <NeemCtx.Provider value={value}>{children}</NeemCtx.Provider>;
}

export function useNeem() {
  const c = useContext(NeemCtx);
  if (!c) throw new Error("useNeem outside provider");
  return c;
}

export const bmi = (b: Body) => +(b.weightKg / (b.heightCm / 100) ** 2).toFixed(1);
export function bmiLabel(v: number) {
  if (v < 18.5) return "Below adult range";
  if (v < 25) return "Within adult range";
  if (v < 30) return "Above adult range";
  return "Well above adult range";
}
export const latest = <T,>(a: T[]): T => a[a.length - 1]!;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

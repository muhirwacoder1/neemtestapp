import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Bluetooth, BatteryMedium, Check, X, ArrowRight } from "lucide-react";
import insole from "@/assets/insole.png";
import { useNeem, latest, bmi, bmiLabel, fmtDate, DEMO_TEMP, ZONE_LABEL, type Zone } from "@/lib/neem-store";
import { Foot, HeatLegend } from "@/components/neem/FootMap";
import { Card, CardHead, SectionTitle, TickBars, DemoBadge, PillButton } from "@/components/neem/ui";
import { MeasureSheet, type MeasureKind } from "@/components/neem/MeasureSheet";
import { ProfileSheet } from "@/components/neem/ProfileSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Summary — Neem" },
      { name: "description", content: "Your daily foot health overview, smart insole status and health measurements." },
      { property: "og:title", content: "Summary — Neem" },
      { property: "og:description", content: "Your daily foot health overview, smart insole status and health measurements." },
    ],
  }),
  component: Home,
});

function Home() {
  const n = useNeem();
  const [measure, setMeasure] = useState<MeasureKind | null>(null);
  const [full, setFull] = useState(false);
  const [profile, setProfile] = useState(false);
  const connected = n.device === "connected";
  const g = latest(n.glucose), b = latest(n.bp), body = latest(n.body);
  const today = n.tasks.filter((t) => t.group === "today");
  const done = today.filter((t) => t.done).length;
  const pct = done / today.length;

  return (
    <>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pt-14">
        <div className="min-w-0">
          <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em]">Summary</h1>
          <p className="mt-1.5 text-[15px] font-medium text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 pb-1">
          <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-card">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-m-bp ring-2 ring-card" />
          </button>
          <button aria-label="Account" onClick={() => setProfile(true)} className="grid h-11 w-11 place-items-center rounded-full border-[2.5px] border-m-bmi text-[15px] font-bold text-m-bmi">AU</button>
        </div>
      </header>

      {/* Care ring — the hero, like Activity Ring */}
      <Card className="mt-6" onClick={undefined}>
        <h3 className="text-[19px] font-semibold tracking-tight">Daily care</h3>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6">
          <Ring pct={pct} />
          <div className="min-w-0">
            <p className="text-[17px] font-medium">Tasks</p>
            <p className="text-[34px] font-bold leading-tight tracking-tight text-m-bmi">{done}/{today.length}<span className="unit ml-0.5">done</span></p>
            <p className="mt-1 text-[13px] text-muted-foreground">{connected ? "No new foot alert" : "Insole not connected"}</p>
          </div>
        </div>
      </Card>

      {/* Device card */}
      <div className="relative mt-3 overflow-hidden rounded-[var(--radius)] p-6" style={{ background: "var(--gradient-device)" }}>
        <img src={insole} alt="" width={1024} height={1024} className={`pointer-events-none absolute -right-10 top-1/2 w-56 -translate-y-1/2 rotate-[-18deg] transition-all duration-700 ${connected ? "opacity-100" : "opacity-40 grayscale"}`} />
        <div className="relative max-w-[60%]">
          <div className="flex items-center gap-2"><p className="text-[15px] text-muted-foreground">Smart Insole</p><DemoBadge /></div>
          <p className="mt-1 text-[24px] font-semibold leading-tight tracking-tight">{connected ? "Neem NM-2041" : n.device === "disconnected" ? "Disconnected" : "Not paired yet"}</p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1"><Bluetooth className={`h-3.5 w-3.5 ${connected ? "text-m-glucose" : ""}`} />L · R</span>
            {connected && <span className="flex items-center gap-1"><BatteryMedium className="h-3.5 w-3.5" />{n.battery}%</span>}
            {n.lastSync && <span>Synced {n.lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <PillButton className="mt-5" onClick={() => (connected ? n.disconnect() : n.setPairOpen(true))}>
            {connected ? "Disconnect" : n.device === "disconnected" ? "Reconnect" : "Connect Insole"}
          </PillButton>
        </div>
      </div>

      {/* Pressure */}
      <Card className="mt-3" onClick={connected ? () => setFull(true) : undefined}>
        <CardHead title="Foot Pressure" chevron={connected} />
        <p className="mt-0.5 text-[13px] text-muted-foreground">{connected ? "Live · relative pressure" : "No readings available"}</p>
        <div className="mt-4 flex justify-center gap-10">
          <div className="text-center"><Foot reading={n.left} side="left" size={78} /><p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">L</p></div>
          <div className="text-center"><Foot reading={n.right} side="right" size={78} /><p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">R</p></div>
        </div>
        {connected && <div className="mt-4"><HeatLegend /></div>}
      </Card>

      {/* 2-col metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric title="Glucose" label={g.context} value={`${g.value}`} unit="mg/dL" color="var(--m-glucose)" data={n.glucose.slice(-14).map((x) => x.value)} onClick={() => setMeasure("glucose")} />
        <Metric title="Pressure" label={fmtDate(b.at)} value={`${b.sys}/${b.dia}`} unit="mmHg" color="var(--m-bp)" data={n.bp.slice(-14).map((x) => x.sys)} onClick={() => setMeasure("bp")} />
        <Metric title="BMI" label={bmiLabel(bmi(body)).replace(" adult range", "")} value={`${bmi(body)}`} unit="" color="var(--m-bmi)" data={n.body.map(bmi)} onClick={() => setMeasure("body")} />
        <Metric title="Foot Temp" label={connected ? "Left foot" : "Needs insole"} value={connected ? `${latest(DEMO_TEMP).left}` : "—"} unit={connected ? "°C" : ""} color="var(--m-temp)" data={connected ? DEMO_TEMP.slice(-14).map((x) => x.left) : []} />
      </div>

      <Link to="/analytics" className="mt-3 flex items-center justify-between rounded-[var(--radius)] bg-card px-5 py-4">
        <span className="text-[17px] font-semibold">All health trends</span>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      <SectionTitle action={<Link to="/tasks" className="text-[15px] font-medium text-m-bmi">Show all</Link>}>Today</SectionTitle>
      <div className="card-surface divide-y divide-border">
        {today.slice(0, 4).map((t) => (
          <button key={t.id} onClick={() => n.toggleTask(t.id)} className="flex w-full items-center gap-3.5 px-5 py-4 text-left">
            <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${t.done ? "border-m-bmi bg-m-bmi text-background" : "border-muted-foreground/50"}`}>{t.done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}</span>
            <span className={`min-w-0 flex-1 truncate text-[16px] ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground">{t.time}</span>
          </button>
        ))}
      </div>

      <MeasureSheet kind={measure} onClose={() => setMeasure(null)} />
      <ProfileSheet open={profile} onClose={() => setProfile(false)} />
      {full && <FullPressure onClose={() => setFull(false)} />}
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="color-mix(in oklab, var(--m-bmi) 22%, transparent)" strokeWidth="22" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--m-bmi)" strokeWidth="22" strokeLinecap="round"
        strokeDasharray={`${Math.max(0.02, pct) * c} ${c}`} style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }} />
    </svg>
  );
}

function Metric({ title, label, value, unit, color, data, onClick }: {
  title: string; label: string; value: string; unit: string; color: string; data: number[]; onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <CardHead title={title} chevron={!!onClick} />
      <p className="mt-2 truncate text-[13px] text-muted-foreground">{label}</p>
      <p className="truncate text-[28px] font-semibold leading-tight tracking-tight" style={{ color }}>
        {value}<span className="unit ml-0.5">{unit}</span>
      </p>
      <TickBars data={data} color={color} className="mt-3" />
    </Card>
  );
}

function FullPressure({ onClose }: { onClose: () => void }) {
  const n = useNeem();
  const [zone, setZone] = useState<Zone | null>("forefootMed");
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background animate-in fade-in">
      <div className="mx-auto max-w-md px-5 pb-10 pt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-bold tracking-tight">Pressure map</h2>
          <button aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-card"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-8 flex justify-center gap-8">
          <Foot reading={n.left} side="left" size={128} onZone={setZone} selected={zone} />
          <Foot reading={n.right} side="right" size={128} onZone={setZone} selected={zone} />
        </div>
        <div className="mt-6"><HeatLegend /></div>
        {zone && n.left && n.right && (
          <Card className="mt-5">
            <p className="text-[15px] text-muted-foreground">{ZONE_LABEL[zone]}</p>
            <div className="mt-1 grid grid-cols-2">
              <p className="text-[30px] font-semibold text-m-glucose">{Math.round(n.left[zone] * 100)}<span className="unit">% L</span></p>
              <p className="text-[30px] font-semibold text-m-temp">{Math.round(n.right[zone] * 100)}<span className="unit">% R</span></p>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">Relative to sensor maximum. Tap a dot to inspect a zone.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

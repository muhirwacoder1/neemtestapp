import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNeem, DEMO_PRESSURE_TREND, DEMO_TEMP, ZONES, ZONE_LABEL, bmi, bmiLabel, latest, fmtDate } from "@/lib/neem-store";
import { Foot, HeatLegend } from "@/components/neem/FootMap";
import { Card, PageHeader, SectionTitle, DemoBadge } from "@/components/neem/ui";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Neem" },
      { name: "description", content: "Foot pressure, glucose, blood pressure, BMI and temperature trends." },
      { property: "og:title", content: "Analytics — Neem" },
      { property: "og:description", content: "Foot pressure, glucose, blood pressure, BMI and temperature trends." },
    ],
  }),
  component: Analytics,
});

const RANGES = [{ l: "Today", d: 1 }, { l: "7D", d: 7 }, { l: "30D", d: 30 }, { l: "90D", d: 90 }] as const;
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };
const axis = { tick: { fontSize: 10, fill: "var(--muted-foreground)" }, axisLine: false, tickLine: false };

function Analytics() {
  const n = useNeem();
  const [days, setDays] = useState<number>(7);
  const cut = Date.now() - days * 864e5;
  const f = <T extends { at: string }>(a: T[]) => a.filter((x) => new Date(x.at).getTime() >= cut).map((x) => ({ ...x, d: fmtDate(x.at) }));
  const g = f(n.glucose), b = f(n.bp), p = f(DEMO_PRESSURE_TREND), t = f(DEMO_TEMP);
  const connected = n.device === "connected";
  const sumL = n.left ? ZONES.reduce((s, z) => s + n.left![z], 0) : 0;
  const sumR = n.right ? ZONES.reduce((s, z) => s + n.right![z], 0) : 0;
  const leftPct = sumL + sumR ? Math.round((sumL / (sumL + sumR)) * 100) : 50;
  const body = latest(n.body);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Your health trends" right={n.real.glucose && n.real.bp && n.real.body ? undefined : <DemoBadge />} />
      <div className="sticky top-0 z-10 -mx-5 mt-3 bg-background/85 px-5 py-2 backdrop-blur">
        <div className="flex rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button key={r.l} onClick={() => setDays(r.d)} className={`flex-1 rounded-full py-2 text-xs font-bold transition ${days === r.d ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}>{r.l}</button>
          ))}
        </div>
      </div>

      <SectionTitle>Foot pressure</SectionTitle>
      <Card>
        {connected ? (
          <>
            <div className="flex justify-around"><Foot reading={n.left} side="left" size={84} /><Foot reading={n.right} side="right" size={84} /></div>
            <div className="mt-3"><HeatLegend /></div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold"><span>Left {leftPct}%</span><span>Right {100 - leftPct}%</span></div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted"><div className="bg-primary transition-all" style={{ width: `${leftPct}%` }} /><div className="flex-1 bg-accent" /></div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1 text-center">
              {ZONES.map((z) => (
                <div key={z} className="rounded-xl bg-muted p-1.5">
                  <p className="text-[9px] font-semibold leading-tight text-muted-foreground">{ZONE_LABEL[z]}</p>
                  <p className="text-sm font-extrabold">{Math.round(((n.left![z] + n.right![z]) / 2) * 100)}</p>
                </div>
              ))}
            </div>
          </>
        ) : <p className="py-6 text-center text-sm text-muted-foreground">Connect your insoles to see live pressure. Trend below uses demo history.</p>}
        <p className="mt-4 text-xs font-semibold text-muted-foreground">Average vs peak (relative pressure)</p>
        <div className="h-36"><ResponsiveContainer><AreaChart data={p}>
          <defs><linearGradient id="pk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--chart-3)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--chart-3)" stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} width={28} domain={[0, 1]} /><Tooltip {...tip} />
          <Area dataKey="peak" stroke="var(--chart-3)" fill="url(#pk)" strokeWidth={2} />
          <Area dataKey="avg" stroke="var(--primary)" fill="transparent" strokeWidth={2} />
        </AreaChart></ResponsiveContainer></div>
      </Card>

      <SectionTitle>Foot health monitoring</SectionTitle>
      <Card className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-success/15 text-2xl">✓</div>
        <div className="min-w-0">
          <p className="font-bold">No new alert</p>
          <p className="text-xs text-muted-foreground">No sustained elevated pressure or temperature difference above configured thresholds. This is risk monitoring, not a diagnosis — check your feet daily and contact your care team about any wound or redness.</p>
        </div>
      </Card>

      <SectionTitle>Blood glucose</SectionTitle>
      <Card>
        {g.length ? <div className="h-44"><ResponsiveContainer><LineChart data={g}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <ReferenceArea y1={70} y2={180} fill="var(--success)" fillOpacity={0.08} />
          <XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} width={30} domain={[50, 220]} /><Tooltip {...tip} />
          <Line dataKey="value" name="mg/dL" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart></ResponsiveContainer></div> : <Empty />}
        <p className="mt-2 text-[11px] text-muted-foreground">Shaded band: example 70–180 mg/dL target. Your clinician can set your own range.</p>
      </Card>

      <SectionTitle>Blood pressure</SectionTitle>
      <Card>
        {b.length ? <div className="h-44"><ResponsiveContainer><LineChart data={b}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} width={30} domain={[60, 150]} /><Tooltip {...tip} />
          <Line dataKey="sys" name="Systolic" stroke="var(--chart-3)" strokeWidth={2.5} dot={false} />
          <Line dataKey="dia" name="Diastolic" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
        </LineChart></ResponsiveContainer></div> : <Empty />}
      </Card>

      <SectionTitle>Body measurements</SectionTitle>
      <Card className="grid grid-cols-3 text-center">
        <div><p className="text-xs text-muted-foreground">Height</p><p className="text-xl font-extrabold">{body.heightCm}<span className="text-xs"> cm</span></p></div>
        <div><p className="text-xs text-muted-foreground">Weight</p><p className="text-xl font-extrabold">{body.weightKg}<span className="text-xs"> kg</span></p></div>
        <div><p className="text-xs text-muted-foreground">BMI</p><p className="text-xl font-extrabold">{bmi(body)}</p></div>
        <p className="col-span-3 mt-2 text-[11px] text-muted-foreground">{bmiLabel(bmi(body))}. BMI is a screening measure for adults; under-18s use age-specific charts.</p>
      </Card>

      <SectionTitle>Foot temperature</SectionTitle>
      <Card>
        {connected && t.length ? <div className="h-40"><ResponsiveContainer><LineChart data={t}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} width={30} domain={[29, 32]} /><Tooltip {...tip} />
          <Line dataKey="left" name="Left °C" stroke="var(--primary)" strokeWidth={2} dot={false} />
          <Line dataKey="right" name="Right °C" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
        </LineChart></ResponsiveContainer></div> : <Empty text="Temperature requires a connected insole with temperature sensors." />}
      </Card>
    </>
  );
}

function Empty({ text = "No readings in this period." }: { text?: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

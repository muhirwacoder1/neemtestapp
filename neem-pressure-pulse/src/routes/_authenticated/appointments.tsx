import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, PageHeader, SectionTitle } from "@/components/neem/ui";
import { CARE_TYPES, fmtAppt, validateBooking, type Appointment } from "@/lib/appointments";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — Neem" },
      { name: "description", content: "Request and track your foot-care and diabetes appointments." },
      { property: "og:title", content: "Appointments — Neem" },
      { property: "og:description", content: "Request and track your foot-care and diabetes appointments." },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [care, setCare] = useState<string>(CARE_TYPES[0]);
  const [clinic, setClinic] = useState("");
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("appointments").select("*").order("starts_at");
    if (error) toast.error("Couldn't load appointments");
    setItems(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const book = async () => {
    const starts_at = when ? new Date(when).toISOString() : "";
    const err = validateBooking({ care_type: care, clinic, starts_at });
    if (err) return toast.error(err);
    setBusy(true);
    const { error } = await supabase.from("appointments").insert({ care_type: care, clinic: clinic.trim(), starts_at, reason: reason.trim() });
    setBusy(false);
    if (error) return toast.error("Couldn't save the request");
    toast.success("Appointment request saved");
    setClinic(""); setWhen(""); setReason("");
    await load();
    return undefined;
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error("Couldn't cancel");
    await load();
    return undefined;
  };

  const now = Date.now();
  const upcoming = (items ?? []).filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now);
  const past = (items ?? []).filter((a) => a.status === "cancelled" || new Date(a.starts_at).getTime() < now);

  return (
    <>
      <PageHeader title="Appointments" subtitle="Your care visits" />

      <Link to="/ai" className="mt-4 flex items-center gap-3 rounded-[var(--radius)] bg-card px-5 py-4">
        <MessageCircleHeart className="h-5 w-5 text-m-ai" />
        <span className="flex-1 text-[15px]">Or just tell Neem AI “book an appointment”</span>
      </Link>

      <SectionTitle>Request a visit</SectionTitle>
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {CARE_TYPES.map((c) => (
            <button key={c} onClick={() => setCare(c)} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${care === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c}</button>
          ))}
        </div>
        <Field label="Clinic or hospital"><input value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="e.g. CHUK, King Faisal Hospital" className="w-full bg-transparent text-[16px] outline-none" /></Field>
        <Field label="Date & time"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full bg-transparent text-[16px] outline-none [color-scheme:dark]" /></Field>
        <Field label="Reason (optional)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. routine foot check" className="w-full bg-transparent text-[16px] outline-none" /></Field>
        <button disabled={busy} onClick={book} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-50">Save request</button>
        <p className="text-[12px] text-muted-foreground">Neem keeps this request for you. Please confirm the time with the clinic directly.</p>
      </Card>

      <SectionTitle>Upcoming</SectionTitle>
      {items === null ? null : upcoming.length === 0 ? (
        <Card><p className="text-[14px] text-muted-foreground">No upcoming appointments.</p></Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((a) => (
            <Card key={a.id} className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">{a.care_type}</p>
                <p className="text-[13px] text-muted-foreground">{a.clinic} · {fmtAppt(a.starts_at)}</p>
                {a.reason && <p className="mt-1 text-[13px]">{a.reason}</p>}
              </div>
              <button onClick={() => cancel(a.id)} className="text-[13px] text-muted-foreground underline">Cancel</button>
            </Card>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>Past & cancelled</SectionTitle>
          <div className="card-surface divide-y divide-border">
            {past.map((a) => (
              <div key={a.id} className="px-5 py-3 text-[14px]"><span className="font-medium">{a.care_type}</span> <span className="text-muted-foreground">· {a.clinic} · {fmtAppt(a.starts_at)}{a.status === "cancelled" ? " · cancelled" : ""}</span></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block rounded-2xl bg-muted px-4 py-3"><span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>{children}</label>;
}

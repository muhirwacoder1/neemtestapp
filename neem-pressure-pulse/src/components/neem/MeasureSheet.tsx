import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useNeem, type GlucoseContext } from "@/lib/neem-store";

export type MeasureKind = "glucose" | "bp" | "body";
const CONTEXTS: GlucoseContext[] = ["Fasting", "Before meal", "After meal", "Before bed", "Other"];

export function MeasureSheet({ kind, onClose }: { kind: MeasureKind | null; onClose: () => void }) {
  const { addGlucose, addBP, addBody } = useNeem();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ctx, setCtx] = useState<GlucoseContext>("Fasting");
  if (!kind) return null;

  const title = { glucose: "Add Blood glucose", bp: "Add Blood pressure", body: "Add Height & weight" }[kind];
  const save = async () => {
    const x = Number(a), y = Number(b);
    const at = new Date().toISOString();
    if (kind === "glucose") {
      if (!(x >= 20 && x <= 600)) return toast.error("Enter a glucose value between 20 and 600 mg/dL");
      try { await addGlucose({ value: x, context: ctx, at }); } catch { return toast.error("Couldn't save. Please try again."); }
    } else if (kind === "bp") {
      if (!(x >= 60 && x <= 260 && y >= 30 && y <= 160)) return toast.error("Check your systolic and diastolic values");
      try { await addBP({ sys: x, dia: y, at }); } catch { return toast.error("Couldn't save. Please try again."); }
    } else {
      if (!(x >= 50 && x <= 250 && y >= 10 && y <= 300)) return toast.error("Check your height and weight");
      try { await addBody({ heightCm: x, weightKg: y, at }); } catch { return toast.error("Couldn't save. Please try again."); }
    }
    toast.success("Measurement saved");
    setA(""); setB(""); onClose();
    return undefined;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md animate-rise rounded-t-[2rem] bg-card px-5 pb-8 pt-5">
        <div className="mb-5 grid grid-cols-[2rem_1fr_2rem] items-center">
          <button aria-label="Close" onClick={onClose}><X className="h-6 w-6" /></button>
          <h3 className="text-center text-lg font-bold">{title}</h3>
        </div>
        <div className="overflow-hidden rounded-2xl bg-muted">
          {kind === "glucose" && <Row label="Blood glucose (mg/dL)" value={a} set={setA} />}
          {kind === "bp" && (<><Row label="Systolic (mmHg)" value={a} set={setA} /><Row label="Diastolic (mmHg)" value={b} set={setB} /></>)}
          {kind === "body" && (<><Row label="Height (cm)" value={a} set={setA} /><Row label="Weight (kg)" value={b} set={setB} /></>)}
          <div className="flex justify-between px-4 py-4 text-sm text-muted-foreground"><span>Date & time</span><span>Now</span></div>
        </div>
        {kind === "glucose" && (
          <>
            <p className="mb-3 mt-6 font-semibold">When did you check?</p>
            <div className="flex flex-wrap gap-2">
              {CONTEXTS.map((c) => (
                <button key={c} onClick={() => setCtx(c)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${ctx === c ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{c}</button>
              ))}
            </div>
          </>
        )}
        <button onClick={save} className="mt-8 h-14 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-elegant active:scale-[0.98]">Save</button>
      </div>
    </div>
  );
}

function Row({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between border-b border-border px-4 py-4 last:border-0">
      <span className="font-medium">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder="—" className="w-24 bg-transparent text-right text-lg font-bold text-primary outline-none" />
    </label>
  );
}

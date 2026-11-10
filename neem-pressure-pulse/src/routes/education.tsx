import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Clock, X } from "lucide-react";
import { useNeem } from "@/lib/neem-store";
import { Card, PageHeader, SectionTitle } from "@/components/neem/ui";
import footcare from "@/assets/edu-footcare.jpg";
import food from "@/assets/edu-food.jpg";
import { ARTICLES as EDU, MEALS } from "@/lib/edu-content";

export const Route = createFileRoute("/education")({
  head: () => ({
    meta: [
      { title: "Learn — Neem" },
      { name: "description", content: "Foot care, diabetes and nutrition guides reviewed for everyday life." },
      { property: "og:title", content: "Learn — Neem" },
      { property: "og:description", content: "Foot care, diabetes and nutrition guides reviewed for everyday life." },
    ],
  }),
  component: Education,
});

const CATS = ["All", "Foot care", "Pressure", "Glucose", "Blood pressure", "Warning signs", "Nutrition"];
const IMG: Record<string, string> = { a1: footcare, a5: food };
const ARTICLES = EDU.map((a) => ({ ...a, img: IMG[a.id] }));

function Education() {
  const { saved, toggleSaved } = useNeem();
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const list = ARTICLES.filter((a) => cat === "All" || a.cat === cat);
  const art = ARTICLES.find((a) => a.id === open);

  return (
    <>
      <PageHeader title="Learn" subtitle="Health learning center" />
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${cat === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-card"}`}>{c}</button>
        ))}
      </div>

      {(cat === "All" || cat === "Nutrition") && (
        <>
          <div className="relative mt-6 overflow-hidden rounded-[var(--radius)]">
            <img src={food} alt="Beans, sweet potato, isombe and avocado" width={1024} height={768} className="h-64 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[24px] font-semibold leading-tight tracking-tight">Eat well,<br />the Rwandan way</p>
              <button onClick={() => setOpen("a5")} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-primary-foreground">Read the guide</button>
            </div>
          </div>
          <SectionTitle>Sample day</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {MEALS.map((x) => (
              <div key={x.m} className="px-4 py-3"><p className="text-xs font-bold text-primary">{x.m}</p><p className="text-sm">{x.f}</p></div>
            ))}
            <p className="px-4 py-3 text-[11px] text-muted-foreground">General guidance only — not a diet plan. Ask your dietitian about your personal needs.</p>
          </Card>
        </>
      )}

      <SectionTitle>Articles</SectionTitle>
      <div className="space-y-3">
        {list.map((a) => (
          <Card key={a.id} onClick={() => setOpen(a.id)} className="flex gap-4 p-3">
            {a.img ? <img src={a.img} alt="" loading="lazy" width={1024} height={768} className="h-20 w-20 shrink-0 rounded-2xl object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-2xl" style={{ background: `linear-gradient(135deg, oklch(0.4 0.12 ${a.hue}), oklch(0.65 0.1 ${a.hue + 30}))` }} />}
            <div className="min-w-0 flex-1 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{a.cat}</p>
              <p className="font-bold leading-snug">{a.title}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{a.min} min · {a.by}</p>
            </div>
            {saved.includes(a.id) && <Bookmark className="h-4 w-4 shrink-0 fill-primary text-primary" />}
          </Card>
        ))}
      </div>

      {art && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          {art.img ? <img src={art.img} alt="" width={1024} height={768} className="h-72 w-full object-cover" /> : <div className="h-56 w-full" style={{ background: `linear-gradient(135deg, oklch(0.4 0.12 ${art.hue}), oklch(0.65 0.1 ${art.hue + 30}))` }} />}
          <div className="mx-auto -mt-8 max-w-md rounded-t-[2rem] bg-background px-6 pb-16 pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{art.cat}</p>
              <div className="flex gap-2">
                <button aria-label="Save" onClick={() => toggleSaved(art.id)} className="grid h-10 w-10 place-items-center rounded-full bg-muted"><Bookmark className={`h-5 w-5 ${saved.includes(art.id) ? "fill-primary text-primary" : ""}`} /></button>
                <button aria-label="Close" onClick={() => setOpen(null)} className="grid h-10 w-10 place-items-center rounded-full bg-muted"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight">{art.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{art.by} · {art.min} min read · Oct 2026</p>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed">{art.body.map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>
        </div>
      )}
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNeem, type Task } from "@/lib/neem-store";
import { Card, PageHeader, SectionTitle } from "@/components/neem/ui";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Daily Care — Neem" },
      { name: "description", content: "Your daily foot care routine, reminders and adherence." },
      { property: "og:title", content: "Daily Care — Neem" },
      { property: "og:description", content: "Your daily foot care routine, reminders and adherence." },
    ],
  }),
  component: Tasks,
});

function Tasks() {
  const n = useNeem();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const today = n.tasks.filter((t) => t.group === "today" && !t.done);
  const upcoming = n.tasks.filter((t) => t.group === "upcoming" && !t.done);
  const done = n.tasks.filter((t) => t.done);
  const pct = Math.round((done.length / n.tasks.length) * 100);
  const week = [4, 5, 3, 5, 5, 4, done.length];

  return (
    <>
      <PageHeader title="Daily care" subtitle="Small steps, every day" right={<Link to="/appointments" className="rounded-full bg-card px-4 py-2 text-[13px] font-semibold">Appointments</Link>} />
      <Card className="mt-3 flex items-center gap-5">
        <svg viewBox="0 0 36 36" className="h-20 w-20 shrink-0 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--muted)" strokeWidth="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * 0.942} 100`} style={{ transition: "stroke-dasharray .6s" }} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold">{done.length} of {n.tasks.length}</p>
          <p className="text-xs text-muted-foreground">You're doing well — keep going at your pace.</p>
          <div className="mt-2 flex h-8 items-end gap-1">
            {week.map((v, i) => <div key={i} className="flex-1 rounded-sm bg-accent" style={{ height: `${(v / 5) * 100}%` }} />)}
          </div>
        </div>
      </Card>

      <Group title="Today" tasks={today} />
      <Group title="Upcoming" tasks={upcoming} />
      <Group title="Completed" tasks={done} />

      <SectionTitle>Add a task</SectionTitle>
      <Card className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk for 20 minutes" className="w-full rounded-xl bg-muted px-4 py-3 text-sm outline-none" />
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Reminder time (e.g. 7:00 PM)" className="w-full rounded-xl bg-muted px-4 py-3 text-sm outline-none" />
        <button
          onClick={() => {
            if (!title.trim()) return toast.error("Give your task a name");
            n.addTask(title.trim(), time.trim() || "Anytime");
            setTitle(""); setTime("");
            toast.success("Task added");
            return undefined;
          }}
          className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground"
        ><Plus className="h-4 w-4" />Add task</button>
      </Card>
    </>
  );
}

function Group({ title, tasks }: { title: string; tasks: Task[] }) {
  const { toggleTask } = useNeem();
  if (!tasks.length) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {tasks.map((t) => (
          <button key={t.id} onClick={() => toggleTask(t.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all ${t.done ? "scale-110 border-success bg-success text-primary-foreground" : "border-border"}`}>{t.done && <Check className="h-4 w-4" strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-semibold ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.time}</span>
            </span>
          </button>
        ))}
      </Card>
    </>
  );
}

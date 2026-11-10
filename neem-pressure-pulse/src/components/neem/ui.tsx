import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: (() => void) | undefined }) {
  const C = onClick ? "button" : "div";
  return (
    <C
      onClick={onClick}
      className={cn("card-surface block w-full p-5 text-left transition-transform duration-200", onClick && "active:scale-[0.97]", className)}
    >
      {children}
    </C>
  );
}

/** Apple Fitness–style card title with a round chevron. */
export function CardHead({ title, chevron = true }: { title: string; chevron?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="truncate text-[19px] font-semibold tracking-tight">{title}</h3>
      {chevron && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex items-end justify-between px-1">
      <h2 className="text-[22px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full border border-warning/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">
      Demo
    </span>
  );
}

/** Thin vertical tick bars, like Apple Fitness step charts. */
export function TickBars({ data, color, className }: { data: number[]; color: string; className?: string }) {
  if (!data.length) return <div className={cn("h-14", className)} />;
  const max = Math.max(...data), min = Math.min(...data) * 0.85;
  return (
    <div className={cn("relative flex h-14 items-end gap-[3px] border-b border-border", className)}>
      {data.map((v, i) => (
        <div key={i} className="relative flex h-full flex-1 items-end">
          <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
          <div className="relative mx-auto w-[3px] rounded-full" style={{ height: `${((v - min) / (max - min || 1)) * 85 + 10}%`, background: color }} />
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ data, className, color = "var(--accent)" }: { data: number[]; className?: string; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 26 - 2}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pb-2 pt-14">
      <div className="min-w-0">
        <h1 className="truncate text-[40px] font-bold leading-none tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] font-medium text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function PillButton({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cn("rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground transition active:scale-95", className)}>
      {children}
    </button>
  );
}

import { Link } from "@tanstack/react-router";
import { Footprints, Activity, CircleCheckBig, BookOpen, MessageCircleHeart } from "lucide-react";

const items = [
  { to: "/", label: "Summary", icon: Footprints },
  { to: "/analytics", label: "Trends", icon: Activity },
  { to: "/tasks", label: "Care", icon: CircleCheckBig },
  { to: "/education", label: "Learn", icon: BookOpen },
  { to: "/ai", label: "Neem AI", icon: MessageCircleHeart },
] as const;

export function BottomNav() {
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <nav className="fixed inset-x-0 bottom-5 z-40 mx-auto w-fit max-w-[calc(100%-2rem)]">
        <div className="glass flex rounded-full p-1 shadow-elegant">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="group flex w-[68px] flex-col items-center gap-1 rounded-full py-2 text-[10.5px] font-semibold text-foreground/85 transition-colors data-[status=active]:bg-muted data-[status=active]:text-m-bmi"
            >
              <Icon className="h-[22px] w-[22px] transition-transform group-active:scale-90" strokeWidth={2.2} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

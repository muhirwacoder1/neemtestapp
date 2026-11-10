import { useEffect, useState } from "react";
import { Bluetooth, Check, X, BatteryMedium } from "lucide-react";
import insole from "@/assets/insole.png";
import { useNeem } from "@/lib/neem-store";
import { DemoBadge } from "./ui";

type Phase = "permission" | "scanning" | "found" | "connecting" | "success" | "failed";

export function PairingSheet() {
  const { pairOpen, setPairOpen, connect, device } = useNeem();
  const [phase, setPhase] = useState<Phase>("permission");
  const [progress, setProgress] = useState(0);
  const reconnect = device === "disconnected";

  useEffect(() => {
    if (pairOpen) setPhase(reconnect ? "found" : "permission");
  }, [pairOpen, reconnect]);

  useEffect(() => {
    if (phase === "scanning") {
      const t = setTimeout(() => setPhase("found"), 1800);
      return () => clearTimeout(t);
    }
    if (phase === "connecting") {
      setProgress(0);
      const iv = setInterval(() => setProgress((p) => Math.min(100, p + 7)), 90);
      const t = setTimeout(() => setPhase("success"), 1500);
      return () => (clearInterval(iv), clearTimeout(t));
    }
    if (phase === "success") {
      connect();
      const t = setTimeout(() => setPairOpen(false), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pairOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setPairOpen(false)}>
      <div
        role="dialog"
        aria-label="Pair Smart Insole"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md animate-rise rounded-t-[2.25rem] bg-card px-6 pb-10 pt-5 shadow-elegant"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
        <button aria-label="Close" onClick={() => setPairOpen(false)} className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          <div className="flex justify-center"><DemoBadge /></div>
          <h3 className="mt-2 text-xl font-bold">
            {phase === "permission" && "Allow Bluetooth"}
            {phase === "scanning" && "Looking for insoles…"}
            {phase === "found" && (reconnect ? "Reconnect Neem Insole" : "Neem Smart Insole")}
            {phase === "connecting" && "Connecting…"}
            {phase === "success" && "Connected"}
            {phase === "failed" && "Couldn't connect"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {phase === "permission" && "Neem uses Bluetooth to find and connect to your smart insoles nearby."}
            {phase === "scanning" && "Keep your insoles close to your phone."}
            {phase === "found" && "Left + Right · NM-2041"}
            {phase === "connecting" && "Pairing left and right insoles"}
            {phase === "success" && "Your insoles are sending sensor data."}
            {phase === "failed" && "Move closer and try again."}
          </p>
        </div>

        <div className="relative mx-auto my-6 grid h-52 w-52 place-items-center">
          {(phase === "scanning" || phase === "connecting") && (
            <>
              <span className="absolute inset-8 animate-ping-slow rounded-full bg-accent/40" />
              <span className="absolute inset-8 animate-ping-slow rounded-full bg-primary/20 [animation-delay:0.7s]" />
            </>
          )}
          {phase === "permission" ? (
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <Bluetooth className="h-11 w-11" />
            </div>
          ) : (
            <img src={insole} alt="Neem Smart Insole" width={1024} height={1024} className={`relative w-48 ${phase === "success" ? "" : "animate-float"}`} />
          )}
          {phase === "success" && (
            <div className="absolute bottom-2 right-6 grid h-12 w-12 place-items-center rounded-full bg-success text-primary-foreground shadow-elegant">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
          )}
        </div>

        {phase === "found" && (
          <div className="mb-5 flex justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><BatteryMedium className="h-4 w-4" /> L 82%</span>
            <span className="flex items-center gap-1"><BatteryMedium className="h-4 w-4" /> R 79%</span>
          </div>
        )}
        {phase === "connecting" && (
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {phase === "permission" && <PrimaryBtn onClick={() => setPhase("scanning")}>Allow & Search</PrimaryBtn>}
        {phase === "found" && <PrimaryBtn onClick={() => setPhase("connecting")}>Connect</PrimaryBtn>}
        {phase === "failed" && <PrimaryBtn onClick={() => setPhase("scanning")}>Try again</PrimaryBtn>}
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Simulated pairing in this preview. Real BLE pairing requires the native mobile build.
        </p>
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-14 w-full rounded-full bg-gradient-primary text-base font-bold text-primary-foreground shadow-elegant transition active:scale-[0.98]">
      {children}
    </button>
  );
}

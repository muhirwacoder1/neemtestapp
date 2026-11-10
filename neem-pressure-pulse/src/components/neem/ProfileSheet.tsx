import { ChevronRight, X, User, Users, CreditCard, Bluetooth, Bell, Ruler, Shield, KeyRound, Globe, Moon, HelpCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

const groups = [
  { title: "Account", items: [
    { i: User, l: "Personal profile" }, { i: Users, l: "Switch profile · Dependents" },
    { i: CreditCard, l: "Subscription & billing" }, { i: Bluetooth, l: "Linked devices" },
  ] },
  { title: "Settings", items: [
    { i: Bell, l: "Notifications" }, { i: Ruler, l: "Measurement units" }, { i: Shield, l: "Privacy & data permissions" },
    { i: KeyRound, l: "Password & security" }, { i: Globe, l: "Language" }, { i: Moon, l: "Appearance" }, { i: HelpCircle, l: "Help & support" },
  ] },
];

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 pb-10 pt-6">
        <div className="flex justify-end"><button aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-muted"><X className="h-5 w-5" /></button></div>
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-elegant">A</div>
          <h2 className="mt-3 text-xl font-extrabold">Amani Uwase</h2>
          <p className="text-sm text-muted-foreground">Free plan · Demo account</p>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="mt-6">
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.title}</p>
            <div className="card-surface divide-y divide-border">
              {g.items.map(({ i: I, l }) => (
                <button key={l} onClick={() => toast("Coming in the next phase")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold">
                  <I className="h-5 w-5 text-primary" /><span className="flex-1">{l}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => toast("Sign-in arrives with account setup")} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-muted py-3.5 text-sm font-bold text-destructive"><LogOut className="h-4 w-4" />Log out</button>
      </div>
    </div>
  );
}

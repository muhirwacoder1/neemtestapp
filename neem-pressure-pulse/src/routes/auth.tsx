import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Neem" },
      { name: "description", content: "Sign in to Neem to save your Neem AI conversations." },
      { property: "og:title", content: "Sign in — Neem" },
      { property: "og:description", content: "Sign in to Neem to save your Neem AI conversations." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/ai", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/ai", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/ai" } });
    setBusy(false);
    if (res.error) return void toast.error(res.error.message);
    if (mode === "up" && !res.data.session) toast.success("Check your email to confirm your account.");
  };

  const oauth = async (p: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  };

  return (
    <div className="pt-16">
      <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em]">{mode === "in" ? "Welcome back" : "Join Neem"}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Sign in to chat with Neem AI and keep your conversations private to you.</p>

      <div className="mt-8 space-y-3">
        <button onClick={() => oauth("google")} className="h-13 w-full rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground">Continue with Google</button>
        <button type="button" onClick={() => oauth("lovable")} className="lovable-auth-button w-full">Continue with Lovable</button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>

      <form onSubmit={submit} className="card-surface divide-y divide-border">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="w-full bg-transparent px-5 py-4 text-[16px] outline-none" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === "in" ? "current-password" : "new-password"} className="w-full bg-transparent px-5 py-4 text-[16px] outline-none" />
        <div className="p-3">
          <button disabled={busy} className="w-full rounded-full bg-secondary py-3.5 text-[15px] font-semibold disabled:opacity-50">{busy ? "Please wait…" : mode === "in" ? "Sign in with email" : "Create account"}</button>
        </div>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 w-full text-center text-[14px] text-muted-foreground">
        {mode === "in" ? "New to Neem? " : "Already have an account? "}<span className="font-semibold text-m-bmi">{mode === "in" ? "Create an account" : "Sign in"}</span>
      </button>
    </div>
  );
}

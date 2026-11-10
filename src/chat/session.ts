export type AIViewState = "checking" | "visitor" | "connecting" | "ready";
// The app's Clerk session is the authority. A temporary profile/token delay must
// never turn an already signed-in person into an AI-specific sign-in flow.
export function aiViewState(
  account: { loaded: boolean; signedIn: boolean; authenticated: boolean },
  store: { busy: boolean; profileId: string },
): AIViewState {
  if (account.signedIn)
    return account.authenticated &&
      !store.busy &&
      !!store.profileId &&
      store.profileId !== "visitor"
      ? "ready"
      : "connecting";
  return account.loaded ? "visitor" : "checking";
}
export function authReturnPath(value: unknown): "/" | "/ai" {
  return value === "/ai" ? "/ai" : "/";
}
export function pageActions(parts: readonly unknown[]): string[] {
  const allowed = [
    "Home",
    "Analytics",
    "Tasks",
    "Education",
    "Neem AI",
    "Library",
    "Appointments",
  ];
  return parts.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const p = part as { type?: unknown; state?: unknown; output?: unknown };
    if (
      p.type !== "tool-open_page" ||
      p.state !== "output-available" ||
      !p.output ||
      typeof p.output !== "object"
    )
      return [];
    const page = (p.output as { page?: unknown }).page;
    return typeof page === "string" && allowed.includes(page) ? [page] : [];
  });
}

export function appNeedsSignIn(
  account: { loaded: boolean; signedIn: boolean },
  pathname: string,
) {
  return (
    account.loaded &&
    !account.signedIn &&
    !["/welcome", "/sign-in", "/sign-up", "/auth-callback"].includes(pathname)
  );
}

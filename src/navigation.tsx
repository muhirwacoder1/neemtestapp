import { createContext, useContext } from "react";
import { Metric } from "./domain";
export type Tab =
  "Home" | "Analytics" | "Tasks" | "Education" | "Neem AI" | "Account";
export type Panel =
  | {
      kind:
        | "add-menu"
        | "pairing"
        | "foot"
        | "profile"
        | "settings"
        | "notifications"
        | "new-task"
        | "meal-plan"
        | "auth"
        | "subscription"
        | "privacy"
        | "help"
        | "edit-profile"
        | "security"
        | "library"
        | "appointments";
    }
  | { kind: "metric" | "add-reading"; metric: Metric }
  | { kind: "article"; id: string };
export const Navigation = createContext<{
  tab: Tab;
  go: (tab: Tab) => void;
  open: (panel: Panel) => void;
  close: () => void;
  back: () => void;
}>(null!);
export const useNavigation = () => useContext(Navigation);
export function decodePanels(value?: string): Panel[] {
  if (!value || value.length > 2000) return [];
  try {
    const panels = JSON.parse(value);
    if (!Array.isArray(panels)) return [];
    const simple = [
      "add-menu",
      "pairing",
      "foot",
      "profile",
      "settings",
      "notifications",
      "new-task",
      "meal-plan",
      "auth",
      "subscription",
      "privacy",
      "help",
      "edit-profile",
      "security",
      "library",
      "appointments",
    ];
    return panels
      .slice(0, 6)
      .filter(
        (p) =>
          p &&
          (simple.includes(p.kind) ||
            (["metric", "add-reading"].includes(p.kind) &&
              ["glucose", "pressure", "bmi", "temperature"].includes(
                p.metric,
              )) ||
            (p.kind === "article" &&
              typeof p.id === "string" &&
              p.id.length < 80)),
      );
  } catch {
    return [];
  }
}

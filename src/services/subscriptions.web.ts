import { StorePlan } from "./subscriptions.types";
export async function loadPlans(userId: string): Promise<StorePlan[]> {
  return [];
}
export async function purchasePlan(id: string, userId: string) {
  throw new Error("Manage store subscriptions in the Neem iOS or Android app.");
}
export async function restorePurchases(userId: string) {
  throw new Error(
    "Restore store subscriptions in the Neem iOS or Android app.",
  );
}

import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { convex } from "./backend";
import { api } from "../../convex/_generated/api";
import { StorePlan } from "./subscriptions.types";
let packages = new Map<string, PurchasesPackage>();
async function sdk(userId: string) {
  const key =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!key || !convex) return null;
  if (!userId) throw new Error("Sign in before managing your subscription.");
  const { default: Purchases } = await import("react-native-purchases");
  if (!(await Purchases.isConfigured()))
    Purchases.configure({ apiKey: key, appUserID: userId });
  else if ((await Purchases.getAppUserID()) !== userId) {
    packages.clear();
    await Purchases.logIn(userId);
  }
  return Purchases;
}
export async function loadPlans(userId: string): Promise<StorePlan[]> {
  const Purchases = await sdk(userId);
  if (!Purchases) return [];
  const offerings = await Purchases.getOfferings();
  const available = offerings.current?.availablePackages || [];
  packages = new Map(available.map((p) => [p.identifier, p]));
  return available.map((p) => ({
    id: p.identifier,
    title: p.product.title,
    description: p.product.description,
    price: p.product.priceString,
  }));
}
async function verify() {
  const result = await convex!.action(api.subscriptions.sync, {});
  if (!result.active)
    throw new Error(
      "Your purchase is waiting for server verification. Please try Restore purchases.",
    );
}
export async function purchasePlan(id: string, userId: string) {
  const Purchases = await sdk(userId),
    plan = packages.get(id);
  if (!Purchases || !plan)
    throw new Error(
      "This store plan is unavailable. Please reload and try again.",
    );
  await Purchases.purchasePackage(plan);
  await verify();
}
export async function restorePurchases(userId: string) {
  const Purchases = await sdk(userId);
  if (!Purchases) throw new Error("Subscriptions are not configured yet.");
  await Purchases.restorePurchases();
  await verify();
}

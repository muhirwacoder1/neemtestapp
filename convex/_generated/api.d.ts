/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as ai from "../ai.js";
import type * as aiBudget from "../aiBudget.js";
import type * as aiDiagnostics from "../aiDiagnostics.js";
import type * as billing from "../billing.js";
import type * as care from "../care.js";
import type * as careAccess from "../careAccess.js";
import type * as careAppointments from "../careAppointments.js";
import type * as careInsoles from "../careInsoles.js";
import type * as careValues from "../careValues.js";
import type * as consultationValues from "../consultationValues.js";
import type * as consultations from "../consultations.js";
import type * as daily from "../daily.js";
import type * as devices from "../devices.js";
import type * as gateway from "../gateway.js";
import type * as ingestion from "../ingestion.js";
import type * as intelligence from "../intelligence.js";
import type * as library from "../library.js";
import type * as mobileMoney from "../mobileMoney.js";
import type * as modelPolicy from "../modelPolicy.js";
import type * as profiles from "../profiles.js";
import type * as prompts from "../prompts.js";
import type * as records from "../records.js";
import type * as routing from "../routing.js";
import type * as subscriptions from "../subscriptions.js";
import type * as values from "../values.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  ai: typeof ai;
  aiBudget: typeof aiBudget;
  aiDiagnostics: typeof aiDiagnostics;
  billing: typeof billing;
  care: typeof care;
  careAccess: typeof careAccess;
  careAppointments: typeof careAppointments;
  careInsoles: typeof careInsoles;
  careValues: typeof careValues;
  consultationValues: typeof consultationValues;
  consultations: typeof consultations;
  daily: typeof daily;
  devices: typeof devices;
  gateway: typeof gateway;
  ingestion: typeof ingestion;
  intelligence: typeof intelligence;
  library: typeof library;
  mobileMoney: typeof mobileMoney;
  modelPolicy: typeof modelPolicy;
  profiles: typeof profiles;
  prompts: typeof prompts;
  records: typeof records;
  routing: typeof routing;
  subscriptions: typeof subscriptions;
  values: typeof values;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};

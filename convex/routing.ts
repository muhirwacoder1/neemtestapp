import { chatModel } from "./modelPolicy";

// A single free model serves every request. Do not spend a second model call
// classifying the question or silently fall back to a paid model.
export function chooseModel() {
  return { model: chatModel(), source: "rules" as const };
}

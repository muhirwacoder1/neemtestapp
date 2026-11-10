import { describe, expect, it } from "vitest";
import { validateBooking } from "./appointments";

const now = new Date("2026-10-21T12:00:00Z");
describe("validateBooking", () => {
  it("rejects a time in the past", () => {
    expect(validateBooking({ care_type: "Dietitian", clinic: "CHUK", starts_at: "2026-10-20T10:00:00Z" }, now)).toMatch(/future/);
  });
  it("requires a clinic", () => {
    expect(validateBooking({ care_type: "Dietitian", clinic: " ", starts_at: "2026-10-25T10:00:00Z" }, now)).toMatch(/clinic/);
  });
  it("accepts a complete future booking", () => {
    expect(validateBooking({ care_type: "Dietitian", clinic: "CHUK", starts_at: "2026-10-25T10:00:00Z" }, now)).toBeNull();
  });
});

// Shared appointment options. Used by the Appointments page and Neem AI booking tool.
export const CARE_TYPES = ["Podiatry / foot care", "Diabetes clinic", "General doctor (GP)", "Dietitian", "Eye check", "Other"] as const;

export type Appointment = {
  id: string;
  care_type: string;
  clinic: string;
  starts_at: string;
  reason: string;
  notes: string;
  status: string;
};

/** Validates a booking request; returns an error message or null. */
export function validateBooking(b: { care_type: string; clinic: string; starts_at: string }, now = new Date()): string | null {
  if (!b.care_type.trim()) return "Choose the type of care.";
  if (!b.clinic.trim()) return "Enter the clinic or hospital.";
  const t = new Date(b.starts_at);
  if (Number.isNaN(t.getTime())) return "Choose a valid date and time.";
  if (t.getTime() <= now.getTime()) return "Choose a date and time in the future.";
  return null;
}

export const fmtAppt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

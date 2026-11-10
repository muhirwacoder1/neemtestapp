import { ProfileDetails } from "./domain";
import countries from "./countries.json";
export { countries };
export const sexOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;
export function validateProfileDetails(
  details: ProfileDetails,
  now = new Date(),
) {
  if (
    !details.firstName.trim() ||
    details.firstName.trim().length > 60 ||
    details.lastName.trim().length > 60
  )
    return "Enter your first name and keep each name under 60 characters.";
  if (details.birthDate !== undefined) {
    const d = new Date(`${details.birthDate}T12:00:00Z`);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(details.birthDate) ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 10) !== details.birthDate ||
      details.birthDate < "1900-01-01" ||
      details.birthDate > today
    )
      return "Choose a valid date of birth on or before today.";
  }
  if (
    details.country !== undefined &&
    !countries.some((c) => c.code === details.country)
  )
    return "Choose your country or region from the list.";
  if (
    details.assignedSex !== undefined &&
    !sexOptions.some((s) => s.value === details.assignedSex)
  )
    return "Choose an assigned sex option or skip this question.";
  if (
    details.heightCm !== undefined &&
    (!Number.isFinite(details.heightCm) ||
      details.heightCm < 50 ||
      details.heightCm > 250)
  )
    return "Enter height between 50 and 250 cm, or leave it blank.";
  if (
    details.weightKg !== undefined &&
    (!Number.isFinite(details.weightKg) ||
      details.weightKg < 10 ||
      details.weightKg > 500)
  )
    return "Enter weight between 10 and 500 kg, or leave it blank.";
  return null;
}

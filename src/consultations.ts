export function consultationError(e: unknown) {
  const data = (e as { data?: unknown })?.data;
  return typeof data === "string"
    ? data
    : "We couldn’t complete that step. Check your connection and try again.";
}
export const localTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Your local time";
export function appointmentDate(time: number) {
  return new Date(time).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
export function appointmentTime(time: number) {
  return new Date(time).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
export function localSlotTime(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return NaN;
  const value = new Date(`${date}T${time}:00`);
  // Reject impossible dates and times normalized by the platform.
  const expected = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return expected === date &&
    value.getHours() === Number(time.slice(0, 2)) &&
    value.getMinutes() === Number(time.slice(3))
    ? value.getTime()
    : NaN;
}

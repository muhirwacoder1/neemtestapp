import { Platform } from "react-native";
import { requestReminderPermission } from "./reminders";
export async function cancelConsultationReminder(id: string) {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  const reminders = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    reminders
      .filter((r) => r.content.data?.consultationId === id)
      .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
  );
}
export async function scheduleConsultationReminder(
  id: string,
  startsAt: number,
) {
  if (startsAt <= Date.now())
    throw new Error("This appointment has already started.");
  await requestReminderPermission();
  const Notifications = await import("expo-notifications");
  await cancelConsultationReminder(id);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your Neem appointment",
      body: "Your video consultation starts soon. Open Neem to join.",
      data: { consultationId: id },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Math.max(startsAt - 10 * 60_000, Date.now() + 5000)),
      channelId: "care",
    },
  });
}

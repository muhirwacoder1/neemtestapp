import { Platform } from "react-native";
import { CareTask } from "../domain";
export async function scheduleReminder(task: CareTask): Promise<string> {
  await requestReminderPermission();
  const Notifications = await import("expo-notifications");
  if (new Date(task.dueAt).getTime() <= Date.now())
    throw new Error("Choose a future time for a reminder.");
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "A moment for your care",
      body: "Your Neem care reminder is ready.",
      data: { taskId: task.id },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(task.dueAt),
      channelId: "care",
    },
  });
}
export async function cancelReminder(id: string) {
  if (Platform.OS !== "web") {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export async function requestReminderPermission(): Promise<void> {
  if (Platform.OS === "web")
    throw new Error(
      "Care reminders are available in the Neem mobile app. You can still manage your care tasks here.",
    );
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("care", {
      name: "Daily care",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Reminders are off. You can allow notifications in your phone settings.",
    );
}

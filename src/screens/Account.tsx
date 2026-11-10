import React, { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import { useUser } from "@clerk/expo";
import {
  Bell,
  CalendarDays,
  Bluetooth,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Globe,
  HeartPulse,
  KeyRound,
  Pencil,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  LucideIcon,
} from "lucide-react-native";
import { useStore } from "../store";
import { useAccount } from "../services/backend";
import { useNavigation } from "../navigation";
import {
  cancelReminder,
  requestReminderPermission,
} from "../services/reminders";
import { CareAccountLinks } from "../care/AccountLinks";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { Button, Card, Segments, Sheet, T, useTheme } from "../components/ui";
function AccountRow({
  title,
  detail,
  icon: Icon,
  onPress,
  trailing,
}: {
  title: string;
  detail?: string;
  icon: LucideIcon;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const c = useTheme();
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 15,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.subtle,
          borderRadius: 18,
        }}
      >
        <Icon size={20} color={c.text} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={16}>{title}</T>
        {detail && (
          <T size={11} color={c.muted} style={{ marginTop: 3 }}>
            {detail}
          </T>
        )}
      </View>
      {trailing ||
        (onPress && (
          <View
            style={{
              width: 33,
              height: 33,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: c.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={17} color={c.text} strokeWidth={1.3} />
          </View>
        ))}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}
function PhotoEditor() {
  const { user } = useUser(),
    store = useStore(),
    c = useTheme(),
    [busy, setBusy] = useState(false);
  async function pick() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const Picker = await import("expo-image-picker");
      const result = await Picker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image.base64 || image.base64.length > 7_000_000) {
        store.setNotice("Choose a photo smaller than 5 MB.");
        return;
      }
      await user.setProfileImage({
        file: `data:${image.mimeType || "image/jpeg"};base64,${image.base64}`,
      });
      store.setNotice("Your profile photo is updated.");
    } catch {
      store.setNotice("Your photo couldn’t be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change your profile photo"
      disabled={busy}
      onPress={pick}
      style={{
        position: "absolute",
        bottom: 10,
        right: 5,
        width: 44,
        height: 44,
        borderRadius: 26,
        backgroundColor: c.ink,
        borderWidth: 3,
        borderColor: c.bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Pencil size={20} color="#FFFFFF" strokeWidth={1.6} />
    </Pressable>
  );
}
export function Account() {
  const store = useStore(),
    account = useAccount(),
    nav = useNavigation(),
    c = useTheme(),
    [units, setUnits] = useState(false),
    [busy, setBusy] = useState(false);
  const owner = !store.guest && store.profile.role === "owner",
    profile = store.profile,
    prefs = store.data.preferences;
  async function reminders(on: boolean) {
    if (busy) return;
    if (store.guest) {
      router.push("/sign-in");
      return;
    }
    setBusy(true);
    try {
      if (on) await requestReminderPermission();
      else
        await Promise.all(
          store.data.tasks
            .filter((t) => !!t.reminderId)
            .map((t) => cancelReminder(t.reminderId!)),
        );
      await store.update((d) => ({
        ...d,
        tasks: on
          ? d.tasks
          : d.tasks.map((t) => ({ ...t, reminderId: undefined })),
        preferences: { ...d.preferences, reminders: on },
      }));
    } catch (e) {
      store.setNotice(
        e instanceof Error ? e.message : "Reminders could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{ width: "100%", maxWidth: 680, alignSelf: "center", gap: 20 }}
    >
      <View
        style={{
          alignItems: "center",
          paddingTop: 5,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        <View>
          <ProfileAvatar
            name={profile.name}
            imageUrl={owner ? account.imageUrl : undefined}
          />
          {owner && <PhotoEditor />}
          {store.guest && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in to personalize your account"
              onPress={() => router.push("/sign-in")}
              style={{
                position: "absolute",
                bottom: 10,
                right: 5,
                backgroundColor: c.ink,
                width: 44,
                height: 44,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: c.bg,
              }}
            >
              <Pencil size={20} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
        <T
          size={32}
          weight="medium"
          style={{ letterSpacing: -1, textAlign: "center", marginTop: 3 }}
        >
          {profile.name || "Your Neem account"}
        </T>
        <T size={15} color={c.muted} style={{ textAlign: "center" }}>
          {store.guest
            ? "A little care starts with you."
            : owner
              ? account.email
              : "Your shared health profile"}
        </T>
      </View>
      {store.guest && (
        <Button
          label="Sign in or create an account"
          onPress={() => router.push("/sign-in")}
          style={{ backgroundColor: c.blue }}
        />
      )}
      {!store.guest && account.authenticated && <CareAccountLinks />}
      <Card style={{ paddingVertical: 6, paddingHorizontal: 18 }}>
        <AccountRow
          title="Notifications"
          detail="Care reminders on this device"
          icon={Bell}
          trailing={
            <Switch
              accessibilityLabel="Care reminders"
              value={prefs.reminders}
              disabled={busy}
              onValueChange={reminders}
              trackColor={{ false: c.line, true: c.blue }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <AccountRow
          title="Appointments"
          icon={CalendarDays}
          onPress={() => nav.open({ kind: "appointments" })}
        />
        <AccountRow
          title="Invoices & payments"
          icon={BookOpen}
          onPress={() => router.push("/billing")}
        />
        <AccountRow
          title="Personal information"
          icon={UserRound}
          onPress={() =>
            router.push(
              store.guest ? "/sign-in" : "/profile-setup?section=personal",
            )
          }
        />
        <AccountRow
          title="Health information"
          icon={HeartPulse}
          onPress={() =>
            router.push(
              store.guest ? "/sign-in" : "/profile-setup?section=health",
            )
          }
        />
      </Card>
      <Card style={{ paddingVertical: 6, paddingHorizontal: 18 }}>
        <AccountRow
          title="Language"
          icon={Globe}
          trailing={
            <View
              style={{
                backgroundColor: c.subtle,
                paddingHorizontal: 15,
                paddingVertical: 9,
                borderRadius: 24,
              }}
            >
              <T size={13}>English</T>
            </View>
          }
        />
        <AccountRow
          title="Dark mode"
          icon={Sun}
          trailing={
            <Switch
              accessibilityLabel="Dark mode"
              value={store.dark}
              onValueChange={(on) => {
                void store.update((d) => ({
                  ...d,
                  preferences: {
                    ...d.preferences,
                    appearance: on ? "dark" : "light",
                  },
                }));
              }}
              trackColor={{ false: c.line, true: c.blue }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <AccountRow
          title="Units"
          icon={Ruler}
          onPress={() => setUnits(true)}
          trailing={
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 23,
                borderWidth: 1,
                borderColor: c.line,
                flexDirection: "row",
                gap: 9,
                alignItems: "center",
              }}
            >
              <T size={13}>{prefs.glucoseUnit}</T>
              <ChevronRight size={16} color={c.text} />
            </View>
          }
        />
      </Card>
      <Card style={{ paddingVertical: 6, paddingHorizontal: 18 }}>
        <AccountRow
          title="Connected insoles"
          icon={Bluetooth}
          onPress={() => nav.open({ kind: "pairing" })}
        />
        <AccountRow
          title="Login & security"
          icon={KeyRound}
          onPress={() =>
            store.guest
              ? router.push("/sign-in")
              : nav.open({ kind: "security" })
          }
        />
        <AccountRow
          title="Privacy & permissions"
          icon={ShieldCheck}
          onPress={() => nav.open({ kind: "privacy" })}
        />
        <AccountRow
          title="Help & support"
          icon={CircleHelp}
          onPress={() => nav.open({ kind: "help" })}
        />
      </Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go("Education")}
          style={{ flex: 1 }}
        >
          <Card style={{ backgroundColor: c.mint, gap: 10 }}>
            <BookOpen size={23} color={c.text} strokeWidth={1.5} />
            <T size={17}>Discover</T>
          </Card>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.go("Neem AI")}
          style={{ flex: 1 }}
        >
          <Card style={{ backgroundColor: c.lavender, gap: 10 }}>
            <Sparkles size={23} color={c.text} strokeWidth={1.5} />
            <T size={17}>Neem AI</T>
          </Card>
        </Pressable>
      </View>
      {store.profiles.length > 1 && (
        <Card>
          <T size={18} weight="medium">
            Your profiles
          </T>
          {store.profiles.map((p) => (
            <AccountRow
              key={p.id}
              title={p.name}
              detail={p.id === profile.id ? "Current profile" : undefined}
              icon={UserRound}
              onPress={() => store.switchProfile(p.id)}
            />
          ))}
        </Card>
      )}
      <T size={11} color={c.muted} style={{ textAlign: "center" }}>
        Neem · A little care. A healthier you.
      </T>
      {units && (
        <Sheet title="Your measurement units" onClose={() => setUnits(false)}>
          <T size={16}>Blood glucose</T>
          <Segments
            options={["mg/dL", "mmol/L"]}
            selected={prefs.glucoseUnit}
            onSelect={(value) =>
              store.update((d) => ({
                ...d,
                preferences: {
                  ...d.preferences,
                  glucoseUnit: value as "mg/dL" | "mmol/L",
                },
              }))
            }
          />
          <T size={16}>Foot temperature</T>
          <Segments
            options={["°C", "°F"]}
            selected={prefs.temperatureUnit}
            onSelect={(value) =>
              store.update((d) => ({
                ...d,
                preferences: {
                  ...d.preferences,
                  temperatureUnit: value as "°C" | "°F",
                },
              }))
            }
          />
          <T size={12} color={c.muted}>
            These choices change how your readings are displayed.
          </T>
          <Button
            label="Done"
            onPress={() => setUnits(false)}
            style={{ backgroundColor: c.blue }}
          />
        </Sheet>
      )}
    </View>
  );
}

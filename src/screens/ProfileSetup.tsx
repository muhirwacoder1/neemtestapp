import React from "react";
import { ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ProfileForm } from "../components/ProfileForm";
import { EntryFrame } from "../components/EntryFrame";
import { Button, T } from "../components/ui";
import { useStartup } from "../components/Startup";
import { useStore } from "../store";
import { useAccount } from "../services/backend";
export function ProfileSetup() {
  const store = useStore(),
    account = useAccount(),
    intro = useStartup(),
    { section } = useLocalSearchParams<{ section?: string }>();
  if (store.guest)
    return (
      <EntryFrame>
        <T size={30} weight="medium">
          A profile of your own.
        </T>
        <T style={{ marginVertical: 18 }}>
          Sign in to keep your personal and health information private and
          connected to your account.
        </T>
        <Button label="Sign in" onPress={() => router.replace("/sign-in")} />
      </EntryFrame>
    );
  if (store.busy || !store.profile.id)
    return (
      <EntryFrame>
        <ActivityIndicator />
      </EntryFrame>
    );
  if (store.profile.role === "viewer")
    return (
      <EntryFrame>
        <T>
          You can view this profile. Ask its owner to update the personal
          information.
        </T>
        <Button
          label="Back to your account"
          onPress={() => router.replace("/account")}
        />
      </EntryFrame>
    );
  const initial = store.profile.details || {
    firstName:
      intro.names.firstName ||
      account.firstName ||
      (store.profile.name !== "My profile"
        ? store.profile.name.split(" ")[0]
        : ""),
    lastName:
      intro.names.lastName ||
      account.lastName ||
      (store.profile.name !== "My profile"
        ? store.profile.name.split(" ").slice(1).join(" ")
        : ""),
    ...(store.profile.birthDate ? { birthDate: store.profile.birthDate } : {}),
  };
  const mode =
    section === "personal" || section === "health" ? section : "onboarding";
  return (
    <ProfileForm
      key={`${store.profile.id}-${mode}`}
      initial={initial}
      mode={mode}
      onSave={store.saveProfile}
      onDone={() => {
        intro.setNames({ firstName: "", lastName: "" });
        store.setNotice("Your profile is ready.");
        router.replace(mode === "onboarding" ? "/" : "/account");
      }}
    />
  );
}

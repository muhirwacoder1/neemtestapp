import React, { useState } from "react";
import { View } from "react-native";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { useClerk } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import { Button, T, useTheme } from "./ui";
import { useAccount } from "../services/backend";
function Hosted() {
  const { startHostedAuth } = useHostedAuth(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const c = useTheme();
  async function start(mode: "sign-in" | "sign-up") {
    setBusy(true);
    setError("");
    try {
      await startHostedAuth({ mode, redirectUrl: "neem://auth-callback" });
    } catch {
      setError("Sign-in could not finish. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <T size={27} weight="bold">
        Your care, connected.
      </T>
      <T color={c.muted}>
        Sign in securely to keep your readings, care tasks and conversations
        together.
      </T>
      <Button label="Sign in" loading={busy} onPress={() => start("sign-in")} />
      <Button
        label="Create an account"
        secondary
        disabled={busy}
        onPress={() => start("sign-up")}
      />
      {!!error && <T color={c.danger}>{error}</T>}
    </View>
  );
}
export function AccountAuth() {
  const account = useAccount();
  return account.configured ? (
    <Hosted />
  ) : (
    <T>
      Account access is being connected. You can explore Education and the
      pressure animation.
    </T>
  );
}
function Security() {
  const clerk = useClerk();
  return (
    <View style={{ gap: 16 }}>
      <T>
        Manage your password, connected sign-in methods and active sessions in
        your secure account.
      </T>
      <Button
        label="Manage account security"
        onPress={() => WebBrowser.openBrowserAsync(clerk.buildUserProfileUrl())}
      />
    </View>
  );
}
export function AccountSecurity() {
  return useAccount().signedIn ? <Security /> : <AccountAuth />;
}

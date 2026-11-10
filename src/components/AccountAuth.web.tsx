import React, { useState } from "react";
import { View } from "react-native";
import { SignIn, SignUp, UserProfile } from "@clerk/expo/web";
import { useAccount } from "../services/backend";
import { Button, T, useTheme } from "./ui";
export function AccountAuth() {
  const account = useAccount(),
    c = useTheme(),
    [signup, setSignup] = useState(false);
  if (!account.configured)
    return (
      <T>
        Account access is being connected. You can explore Education and the
        pressure animation.
      </T>
    );
  return (
    <View style={{ gap: 16, alignItems: "center" }}>
      <T size={24} weight="bold">
        Your care, connected.
      </T>
      <T size={12} color={c.muted} style={{ textAlign: "center" }}>
        Your readings, tasks and conversations, securely in one place.
      </T>
      {signup ? (
        <SignUp routing="hash" forceRedirectUrl="/" />
      ) : (
        <SignIn routing="hash" forceRedirectUrl="/" />
      )}
      <Button
        label={
          signup
            ? "Already have an account? Sign in"
            : "New to Neem? Create an account"
        }
        secondary
        onPress={() => setSignup((v) => !v)}
      />
    </View>
  );
}
export function AccountSecurity() {
  return useAccount().signedIn ? (
    <UserProfile routing="hash" />
  ) : (
    <AccountAuth />
  );
}

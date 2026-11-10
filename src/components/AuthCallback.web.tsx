import { HandleSSOCallback } from "@clerk/react";
import { router, useLocalSearchParams } from "expo-router";
import { authReturnPath } from "../chat/session";
export function AuthCallback() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination = authReturnPath(returnTo);
  return (
    <HandleSSOCallback
      navigateToApp={() => router.replace(destination)}
      navigateToSignIn={() =>
        router.replace({
          pathname: "/sign-in",
          params: { returnTo: destination },
        })
      }
      navigateToSignUp={() =>
        router.replace({
          pathname: "/sign-up",
          params: { returnTo: destination },
        })
      }
    />
  );
}

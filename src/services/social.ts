import { useSSO } from "@clerk/expo/experimental";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();
export function useSocial() {
  const { startSSOFlow } = useSSO();
  return async (
    strategy: "oauth_google" | "oauth_apple",
    _signup: boolean,
    _returnTo: "/" | "/ai" = "/",
  ) => {
    const result = await startSSOFlow({
      strategy,
      redirectUrl: "neem://auth-callback",
    });
    return result.authSessionResult?.type === "success";
  };
}

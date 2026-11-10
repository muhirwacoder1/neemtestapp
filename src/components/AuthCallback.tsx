import { Redirect } from "expo-router";
export function AuthCallback() {
  return <Redirect href="/sign-in" />;
}

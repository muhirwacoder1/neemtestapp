import { useSignIn, useSignUp } from "@clerk/expo";
export function useSocial() {
  const { signIn } = useSignIn(),
    { signUp } = useSignUp();
  return async (
    strategy: "oauth_google" | "oauth_apple",
    signup: boolean,
    returnTo: "/" | "/ai" = "/",
  ) => {
    const result = await (signup ? signUp : signIn).sso({
      strategy,
      redirectUrl: returnTo,
      redirectCallbackUrl: `/auth-callback?returnTo=${encodeURIComponent(returnTo)}`,
    });
    if (result.error) throw result.error;
    return true;
  };
}

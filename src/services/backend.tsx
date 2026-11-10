import React, { createContext, useContext } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProvider, ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

export const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const url = process.env.EXPO_PUBLIC_CONVEX_URL;
export const convex = url ? new ConvexReactClient(url) : null;
export const backendConfigured = !!convex && !!clerkKey;
type Account = {
  configured: boolean;
  signedIn: boolean;
  loaded: boolean;
  authenticated: boolean;
  userId: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  signOut: () => Promise<void>;
};
const guest: Account = {
  configured: backendConfigured,
  signedIn: false,
  loaded: true,
  authenticated: false,
  userId: "",
  name: "",
  email: "",
  firstName: "",
  lastName: "",
  imageUrl: "",
  signOut: async () => {},
};
const AccountContext = createContext<Account>(guest);
function Session({ children }: { children: React.ReactNode }) {
  const auth = useAuth(),
    { user } = useUser(),
    cloud = useConvexAuth();
  return (
    <AccountContext.Provider
      value={{
        configured: true,
        signedIn: !!auth.isSignedIn,
        loaded: auth.isLoaded && !cloud.isLoading,
        authenticated: cloud.isAuthenticated,
        userId: auth.userId || "",
        name: user?.fullName || user?.firstName || "My profile",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        imageUrl: user?.hasImage ? user.imageUrl : "",
        email: user?.primaryEmailAddress?.emailAddress || "",
        signOut: async () => {
          await auth.signOut();
        },
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function BackendProvider({ children }: { children: React.ReactNode }) {
  if (!convex)
    return (
      <AccountContext.Provider value={guest}>
        {children}
      </AccountContext.Provider>
    );
  if (!clerkKey)
    return (
      <ConvexProvider client={convex}>
        <AccountContext.Provider value={guest}>
          {children}
        </AccountContext.Provider>
      </ConvexProvider>
    );
  return (
    <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Session>{children}</Session>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
export const useAccount = () => useContext(AccountContext);

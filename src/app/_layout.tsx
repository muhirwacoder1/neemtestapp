import React, { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Urbanist_400Regular } from "@expo-google-fonts/urbanist/400Regular";
import { Urbanist_500Medium } from "@expo-google-fonts/urbanist/500Medium";
import { Urbanist_600SemiBold } from "@expo-google-fonts/urbanist/600SemiBold";
import { Urbanist_700Bold } from "@expo-google-fonts/urbanist/700Bold";
import { StoreProvider } from "../store";
import { StepsProvider } from "../steps/context";
import { InsoleProvider } from "../insole";
import AppShell from "../Shell";
import { StartupProvider } from "../components/Startup";
import { BackendProvider } from "../services/backend";
void SplashScreen.preventAutoHideAsync();
function ProfileShell() {
  return (
    <StepsProvider>
      <InsoleProvider>
        <AppShell />
      </InsoleProvider>
    </StepsProvider>
  );
}
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#ECF0F3",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#101211" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <BackendProvider>
        <StoreProvider>
          <StartupProvider>
            <ProfileShell />
          </StartupProvider>
        </StoreProvider>
      </BackendProvider>
    </SafeAreaProvider>
  );
}

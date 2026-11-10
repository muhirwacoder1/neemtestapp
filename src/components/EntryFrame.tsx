import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, X } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStartup } from "./Startup";
import { Brand } from "./graphics";
import { IconButton, useTheme } from "./ui";
export function EntryFrame({
  children,
  onBack,
  wide = false,
  close = true,
  footer,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  wide?: boolean;
  close?: boolean;
  footer?: React.ReactNode;
}) {
  const c = useTheme(),
    insets = useSafeAreaInsets(),
    intro = useStartup();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <StatusBar style={c.bg === "#ECF0F3" ? "dark" : "light"} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top + 12, 20),
          paddingBottom: footer ? 18 : Math.max(insets.bottom + 16, 28),
          paddingHorizontal: 22,
          width: "100%",
          maxWidth: wide ? 1120 : 530,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <IconButton
            icon={ArrowLeft}
            label="Go back"
            onPress={onBack || (() => router.replace("/welcome"))}
          />
          <Brand width={82} />
          {close ? (
            <IconButton
              icon={X}
              label="Explore Neem"
              onPress={async () => {
                await intro.finish();
                router.replace("/");
              }}
            />
          ) : (
            <View style={{ width: 46 }} />
          )}
        </View>
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            width: "100%",
            maxWidth: 530,
            alignSelf: "center",
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: c.bg,
          }}
        >
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

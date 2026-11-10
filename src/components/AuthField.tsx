import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { fonts, T, useTheme } from "./ui";
export function AuthField({
  label,
  value,
  onChangeText,
  password = false,
  email = false,
  code = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  password?: boolean;
  email?: boolean;
  code?: boolean;
  placeholder?: string;
}) {
  const c = useTheme(),
    [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 10, flex: 1 }}>
      <T size={15}>{label}</T>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 36,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 19,
          minHeight: 55,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          secureTextEntry={password && !visible}
          autoCapitalize={email || password ? "none" : "words"}
          autoCorrect={!email && !password && !code}
          keyboardType={
            email ? "email-address" : code ? "number-pad" : "default"
          }
          autoComplete={
            email
              ? "email"
              : password
                ? "password"
                : code
                  ? "one-time-code"
                  : "off"
          }
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 55,
            fontFamily: fonts.regular,
            fontSize: 16,
            color: c.text,
            ...({ outlineStyle: "none" } as any),
          }}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            onPress={() => setVisible((v) => !v)}
            style={{ padding: 8, marginRight: -8 }}
          >
            {visible ? (
              <Eye size={20} color={c.text} strokeWidth={1.5} />
            ) : (
              <EyeOff size={20} color={c.text} strokeWidth={1.5} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

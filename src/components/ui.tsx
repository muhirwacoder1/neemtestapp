import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  X,
  LucideIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../store";
export const fonts = {
  regular: "Urbanist_400Regular",
  medium: "Urbanist_500Medium",
  semibold: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
  extra: "Urbanist_700Bold",
};
export const light = {
  bg: "#ECF0F3",
  card: "#FFFFFF",
  text: "#101211",
  muted: "#626B70",
  line: "#DFE5E8",
  navy: "#101211",
  teal: "#247E63",
  pale: "#DCE9CC",
  subtle: "#F3F5F6",
  bluePale: "#D0DFEB",
  lavender: "#E5D9F0",
  peach: "#F3DFD8",
  mint: "#DCE9CC",
  blue: "#2196F3",
  ink: "#101211",
  danger: "#AB403B",
};
export const dark = {
  bg: "#171B1E",
  card: "#242A2E",
  text: "#F3F5F4",
  muted: "#ADB6BA",
  line: "#394247",
  navy: "#F3F5F4",
  teal: "#A4D8BD",
  pale: "#344335",
  subtle: "#2C3338",
  bluePale: "#304655",
  lavender: "#443D52",
  peach: "#513E39",
  mint: "#344335",
  blue: "#57B1FF",
  ink: "#101211",
  danger: "#F4ABA2",
};
export function useTheme() {
  return useStore().dark ? dark : light;
}
export function T({
  children,
  size = 14,
  weight = "regular",
  color,
  style,
  ...props
}: TextProps & { size?: number; weight?: keyof typeof fonts; color?: string }) {
  const c = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          color: color || c.text,
          lineHeight: size * 1.4,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 28,
          padding: 22,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  icon: Icon,
  secondary = false,
  ghost = false,
  small = false,
  disabled = false,
  loading = false,
  textSize,
  textWeight = "bold",
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  secondary?: boolean;
  ghost?: boolean;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  textSize?: number;
  textWeight?: keyof typeof fonts;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 50,
          paddingHorizontal: small ? 16 : 22,
          borderRadius: 100,
          backgroundColor: ghost ? "transparent" : secondary ? c.subtle : c.ink,
          flexDirection: "row",
          gap: 9,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={secondary ? c.text : "#FFFFFF"}
        />
      ) : (
        <>
          {Icon && (
            <Icon
              size={small ? 15 : 18}
              color={secondary || ghost ? c.navy : "#FFFFFF"}
              strokeWidth={1.7}
            />
          )}
          <T
            size={textSize || (small ? 12 : 14)}
            weight={textWeight}
            color={secondary || ghost ? c.navy : "#FFFFFF"}
          >
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  onPress,
  label,
  color,
  style,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  color?: string;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 46,
          height: 46,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 50,
          backgroundColor: pressed ? c.bluePale : c.card,
        },
        style,
      ]}
    >
      <Icon size={19} color={color || c.text} strokeWidth={1.7} />
    </Pressable>
  );
}
export function Badge({
  label,
  color,
  bg,
  dot = false,
}: {
  label: string;
  color?: string;
  bg?: string;
  dot?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: bg || c.pale,
      }}
    >
      {dot && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: color || c.teal,
          }}
        />
      )}
      <T size={11} weight="medium" color={color || c.teal}>
        {label}
      </T>
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
  subtitle,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  subtitle?: string;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 17,
      }}
    >
      <View style={{ flex: 1 }}>
        <T size={20} weight="medium" style={{ letterSpacing: -0.45 }}>
          {title}
        </T>
        {subtitle && (
          <T size={12} color={c.muted} style={{ marginTop: 3 }}>
            {subtitle}
          </T>
        )}
      </View>
      {action && onPress && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingVertical: 10,
          }}
        >
          <T size={11} weight="bold" color={c.navy}>
            {action}
          </T>
          <ArrowUpRight size={14} color={c.navy} />
        </Pressable>
      )}
    </View>
  );
}
export function Input({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8, flexGrow: 1 }}>
      <T size={12} weight="semibold" color={c.muted}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            fontFamily: fonts.medium,
            fontSize: 16,
            color: c.text,
            backgroundColor: c.subtle,
            borderRadius: 18,
            padding: 15,
            minHeight: 52,
          },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
          style,
        ]}
      />
    </View>
  );
}
export function Segments({
  options,
  selected,
  onSelect,
  compact = false,
}: {
  options: string[];
  selected: string;
  onSelect: (s: string) => void;
  compact?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        padding: 5,
        borderRadius: 30,
        backgroundColor: c.card,
        alignSelf: "flex-start",
      }}
    >
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === o }}
          aria-selected={selected === o}
          onPress={() => onSelect(o)}
          style={{
            paddingHorizontal: compact ? 11 : 17,
            paddingVertical: 9,
            borderRadius: 26,
            backgroundColor: selected === o ? c.ink : "transparent",
          }}
        >
          <T
            size={compact ? 11 : 12}
            weight="medium"
            color={selected === o ? "#FFFFFF" : c.text}
          >
            {o}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
export function RowLink({
  title,
  detail,
  icon: Icon,
  onPress,
  trailing,
}: {
  title: string;
  detail?: string;
  icon: LucideIcon;
  onPress: () => void;
  trailing?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 17,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        gap: 14,
      }}
    >
      <Icon size={21} color={c.navy} strokeWidth={1.5} />
      <View style={{ flex: 1 }}>
        <T size={14} weight="semibold">
          {title}
        </T>
        {detail && (
          <T size={11} color={c.muted}>
            {detail}
          </T>
        )}
      </View>
      {trailing && (
        <T size={12} color={c.muted}>
          {trailing}
        </T>
      )}
      <ChevronRight size={17} color={c.muted} />
    </Pressable>
  );
}
export function Empty({
  title,
  detail,
  icon: Icon,
  action,
  onPress,
}: {
  title: string;
  detail: string;
  icon?: LucideIcon;
  action?: string;
  onPress?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: 34, gap: 10, alignItems: "center" }}>
      {Icon && <Icon size={34} color={c.teal} strokeWidth={1.2} />}
      <T weight="bold" size={17} style={{ textAlign: "center" }}>
        {title}
      </T>
      <T
        color={c.muted}
        size={13}
        style={{ textAlign: "center", maxWidth: 330 }}
      >
        {detail}
      </T>
      {action && onPress && (
        <Button
          label={action}
          onPress={onPress}
          small
          secondary
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}
export function Sheet({
  title,
  children,
  onClose,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
}) {
  const c = useTheme(),
    { width, height } = useWindowDimensions(),
    insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={onBack || onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#17202770",
          justifyContent: width < 700 ? "flex-end" : "center",
          alignItems: "center",
          padding: width < 700 ? 0 : 30,
        }}
      >
        <Pressable
          accessibilityLabel="Close dialog backdrop"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 700,
            maxHeight: height - Math.max(insets.top, 30),
            backgroundColor: c.card,
            borderRadius: 28,
            borderBottomLeftRadius: width < 700 ? 0 : 28,
            borderBottomRightRadius: width < 700 ? 0 : 28,
            overflow: "hidden",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingVertical: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderColor: c.line,
            }}
          >
            {onBack && (
              <IconButton icon={ArrowLeft} onPress={onBack} label="Go back" />
            )}
            <T size={19} weight="bold" style={{ flex: 1 }}>
              {title}
            </T>
            <IconButton icon={X} onPress={onClose} label="Close dialog" />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: width < 400 ? 20 : 28, gap: 22 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

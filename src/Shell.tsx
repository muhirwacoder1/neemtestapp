import {
  Slot,
  Redirect,
  router,
  usePathname,
  useGlobalSearchParams,
  Href,
} from "expo-router";
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  LogIn,
  LogOut,
  Bell,
  CalendarDays,
  Check,
  CircleHelp,
  Leaf,
  CalendarCheck2,
  Menu,
  Plus,
  UserRound,
  Settings,
} from "lucide-react-native";
import { useStore } from "./store";
import { Navigation, Panel, Tab, decodePanels } from "./navigation";
import { Button, Card, IconButton, Sheet, T, useTheme } from "./components/ui";
import { Brand } from "./components/graphics";
import { useStartup } from "./components/Startup";
import { appNeedsSignIn } from "./chat/session";
import { useAccount } from "./services/backend";
import { PanelContent, panelTitle } from "./panels";
import {
  HomeNavigationIcon,
  ReportsNavigationIcon,
  DiscoverNavigationIcon,
  AINavigationIcon,
  NavigationIconProps,
} from "./components/NavigationIcons";
const tabs: {
  name: Tab;
  icon: React.ComponentType<NavigationIconProps>;
  slug: string;
}[] = [
  { name: "Home", icon: HomeNavigationIcon, slug: "home" },
  { name: "Analytics", icon: ReportsNavigationIcon, slug: "analytics" },
  { name: "Tasks", icon: CalendarCheck2, slug: "tasks" },
  { name: "Education", icon: DiscoverNavigationIcon, slug: "education" },
  { name: "Neem AI", icon: AINavigationIcon, slug: "ai" },
];
export default function AppShell() {
  const store = useStore(),
    c = useTheme(),
    intro = useStartup(),
    account = useAccount(),
    { width } = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ panels?: string }>();
  const tab: Tab =
    pathname === "/account"
      ? "Account"
      : tabs.find((t) => pathname === (t.slug === "home" ? "/" : `/${t.slug}`))
          ?.name || "Home";
  const panels = useMemo(() => decodePanels(params.panels), [params.panels]);
  const setPanels = useCallback(
    (value: Panel[] | ((old: Panel[]) => Panel[])) => {
      const next = typeof value === "function" ? value(panels) : value;
      router.setParams({
        panels: next.length ? JSON.stringify(next) : undefined,
      });
    },
    [panels],
  );
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    desktop = width >= 960;
  const close = useCallback(() => setPanels([]), [setPanels]),
    back = useCallback(() => setPanels((p) => p.slice(0, -1)), [setPanels]);
  const open = (panel: Panel) => {
    if (panel.kind === "profile") {
      router.push("/account");
      return;
    }
    if (panel.kind === "auth") {
      router.push("/sign-in");
      return;
    }
    if (panel.kind === "edit-profile") {
      router.push("/profile-setup?section=personal");
      return;
    }
    setPanels((p) => [...p, panel]);
  };
  const go = useCallback((next: Tab) => {
    const slug =
      next === "Account" ? "account" : tabs.find((t) => t.name === next)!.slug;
    router.replace((slug === "home" ? "/" : `/${slug}`) as Href);
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);
  useEffect(() => {
    if (Platform.OS === "web") {
      document.title = "Neem — A little care. A healthier you.";
      if (!__DEV__ && "serviceWorker" in navigator)
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      document.documentElement.style.backgroundColor = c.bg;
    }
  }, [c.bg]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panels.length) {
        back();
        return true;
      }
      if (tab !== "Home") {
        go("Home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [panels.length, tab, back, go]);
  const panel = panels.at(-1);
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  const title = {
    Home: "Your health",
    Analytics: "Reports",
    Tasks: "Your care",
    Education: "Discover",
    "Neem AI": "Neem AI",
    Account: "Your account",
  }[tab];
  if (!store.ready || !intro.ready)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: 25,
        }}
      >
        <Brand width={120} />
        <ActivityIndicator color={c.teal} />
        <T size={12} color={c.muted}>
          A little moment to get ready…
        </T>
      </View>
    );
  const entry = [
    "/welcome",
    "/sign-in",
    "/sign-up",
    "/profile-setup",
    "/auth-callback",
  ].includes(pathname);
  if (appNeedsSignIn(account, pathname))
    return (
      <Redirect
        href={{
          pathname: "/sign-in",
          params: { returnTo: pathname === "/ai" ? "/ai" : "/" },
        }}
      />
    );
  if (
    !entry &&
    !store.guest &&
    !store.busy &&
    store.profile.id &&
    store.profile.role === "owner" &&
    !store.profile.onboardedAt
  )
    return <Redirect href="/profile-setup" />;
  if (
    entry ||
    ["/consultation", "/admin", "/clinician", "/billing"].includes(pathname)
  )
    return <Slot />;
  return (
    <Navigation.Provider value={{ tab, go, open, close, back }}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: c.bg }}>
        <StatusBar style={store.dark ? "light" : "dark"} />
        {desktop && (
          <View
            style={{
              width: 216,
              paddingTop: 42,
              paddingHorizontal: 18,
              paddingBottom: 28,
            }}
          >
            <View style={{ marginLeft: 18, marginBottom: 45 }}>
              <Brand width={102} />
            </View>
            <View
              style={{
                backgroundColor: c.ink,
                borderRadius: 32,
                padding: 9,
                gap: 6,
              }}
            >
              {tabs.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityLabel={name}
                  accessibilityState={{ selected: tab === name }}
                  aria-selected={tab === name}
                  onPress={() => go(name)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    padding: 15,
                    borderRadius: 26,
                    backgroundColor:
                      tab === name
                        ? "#FFFFFF"
                        : pressed
                          ? "#303433"
                          : "transparent",
                  })}
                >
                  <Icon
                    size={21}
                    color={tab === name ? c.ink : "#E6EBE9"}
                    strokeWidth={1.6}
                  />
                  <T
                    size={14}
                    weight="medium"
                    color={tab === name ? c.ink : "#E6EBE9"}
                  >
                    {name === "Analytics"
                      ? "Reports"
                      : name === "Education"
                        ? "Discover"
                        : name === "Tasks"
                          ? "Your care"
                          : name}
                  </T>
                </Pressable>
              ))}
            </View>
            <Button
              label="Add measurement"
              icon={Plus}
              onPress={() => open({ kind: "add-menu" })}
              style={{
                marginTop: 16,
                backgroundColor: c.blue,
                paddingHorizontal: 12,
              }}
            />
            <View style={{ flex: 1, minHeight: 40 }} />
            <View
              style={{
                backgroundColor: c.mint,
                padding: 20,
                borderRadius: 26,
                gap: 10,
                marginBottom: 20,
              }}
            >
              <Leaf size={23} color={c.text} strokeWidth={1.4} />
              <T size={20} weight="medium" style={{ letterSpacing: -0.5 }}>
                A little care. A healthier you.
              </T>
              <T size={12} color={c.muted}>
                One step at a time.
              </T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => open({ kind: "settings" })}
              style={{
                flexDirection: "row",
                padding: 13,
                gap: 12,
                alignItems: "center",
              }}
            >
              <Settings size={20} color={c.text} strokeWidth={1.5} />
              <T>Settings</T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open help and support"
              onPress={() => open({ kind: "help" })}
              style={{
                flexDirection: "row",
                padding: 13,
                gap: 12,
                alignItems: "center",
              }}
            >
              <CircleHelp size={20} color={c.text} strokeWidth={1.5} />
              <T>Help & support</T>
            </Pressable>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scroll}
            showsVerticalScrollIndicator={false}
            scrollEnabled={tab !== "Neem AI"}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop:
                tab === "Neem AI"
                  ? Math.max(insets.top + 12, 18)
                  : Math.max(insets.top + 15, desktop ? 36 : 22),
              ...(tab === "Neem AI"
                ? { height: "100%" as const, flexGrow: 1 }
                : {}),
              paddingHorizontal: desktop ? 32 : width < 380 ? 18 : 22,
              paddingBottom:
                tab === "Neem AI"
                  ? desktop
                    ? 22
                    : 105 + insets.bottom
                  : desktop
                    ? 44
                    : 120 + insets.bottom,
              width: "100%",
              maxWidth: tab === "Neem AI" ? 1080 : 1260,
              alignSelf: "center",
            }}
          >
            {tab !== "Neem AI" && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: tab === "Home" ? 24 : 28,
                }}
              >
                {tab === "Account" ? (
                  <IconButton
                    icon={ArrowLeft}
                    label="Back to Home"
                    onPress={() => go("Home")}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open your profile"
                    onPress={() => open({ kind: "profile" })}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 28,
                      backgroundColor: c.bluePale,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {account.imageUrl && store.profile.role === "owner" ? (
                      <Image
                        source={{ uri: account.imageUrl }}
                        style={{ width: 48, height: 48, borderRadius: 28 }}
                        accessibilityLabel="Your profile photo"
                      />
                    ) : store.profile.name ? (
                      <T size={23} weight="medium">
                        {store.profile.name.slice(0, 1)}
                      </T>
                    ) : (
                      <UserRound size={24} color={c.text} strokeWidth={1.4} />
                    )}
                  </Pressable>
                )}
                {tab !== "Home" && (
                  <T size={22} weight="medium" style={{ letterSpacing: -0.5 }}>
                    {title}
                  </T>
                )}
                {tab === "Account" ? (
                  <IconButton
                    icon={store.guest ? LogIn : LogOut}
                    label={store.guest ? "Sign in" : "Sign out"}
                    color={store.guest ? c.blue : c.danger}
                    onPress={async () => {
                      if (!store.guest) await store.signOut();
                      router.replace("/sign-in");
                    }}
                    style={{
                      backgroundColor: store.guest ? c.bluePale : c.peach,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 3,
                      borderRadius: 32,
                      backgroundColor: c.card,
                    }}
                  >
                    <IconButton
                      icon={Bell}
                      label="Open notifications"
                      onPress={() => open({ kind: "notifications" })}
                      style={{ backgroundColor: c.bg, width: 43, height: 43 }}
                    />
                    <IconButton
                      icon={Menu}
                      label="Open account menu"
                      onPress={() => open({ kind: "profile" })}
                      style={{ width: 43, height: 43 }}
                    />
                  </View>
                )}
              </View>
            )}
            {tab === "Home" && (
              <View
                style={{
                  marginBottom: 26,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 15,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T size={21} color={c.muted} style={{ letterSpacing: -0.5 }}>
                    {greeting} 👋
                  </T>
                  <T
                    size={desktop ? 40 : 33}
                    weight="medium"
                    style={{
                      letterSpacing: -1.3,
                      lineHeight: desktop ? 52 : 45,
                      marginTop: 3,
                    }}
                  >
                    {store.profile.name || "Your everyday health"}
                  </T>
                </View>
                {desktop && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open care calendar"
                    onPress={() => go("Tasks")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      padding: 13,
                      borderRadius: 24,
                      backgroundColor: c.card,
                    }}
                  >
                    <CalendarDays size={17} color={c.text} strokeWidth={1.5} />
                    <T size={12}>
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </T>
                  </Pressable>
                )}
              </View>
            )}
            {!!store.error && (
              <Card style={{ marginBottom: 20, backgroundColor: c.peach }}>
                <T size={13}>{store.error}</T>
                <Button
                  label="Try again"
                  secondary
                  small
                  onPress={store.refresh}
                  style={{ marginTop: 14, alignSelf: "flex-start" }}
                />
              </Card>
            )}
            {store.busy && tab !== "Neem AI" ? (
              <View style={{ gap: 20 }}>
                {[1, 2, 3].map((v) => (
                  <View
                    key={v}
                    style={{
                      height: v === 1 ? 180 : 150,
                      borderRadius: 28,
                      backgroundColor: c.line,
                      opacity: 1 - v * 0.15,
                    }}
                  />
                ))}
                <ActivityIndicator color={c.text} />
              </View>
            ) : (
              <Slot />
            )}
          </ScrollView>
          {!desktop && (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                bottom: Math.max(insets.bottom, 16),
                left: 16,
                right: 16,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: "100%",
                  maxWidth: 500,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 6,
                    height: 66,
                    backgroundColor: c.ink,
                    borderRadius: 40,
                    boxShadow: "0px 8px 28px rgba(22,30,34,0.14)",
                  }}
                >
                  {tabs.map(({ name, icon: Icon }) => (
                    <Pressable
                      key={name}
                      accessibilityRole="tab"
                      accessibilityLabel={name}
                      accessibilityState={{ selected: tab === name }}
                      aria-selected={tab === name}
                      onPress={() => go(name)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        height: 52,
                        borderRadius: 32,
                        backgroundColor:
                          tab === name
                            ? "#FFFFFF"
                            : pressed
                              ? "#303433"
                              : "transparent",
                      })}
                    >
                      <Icon
                        size={22}
                        color={tab === name ? c.ink : "#E5EAE8"}
                        strokeWidth={tab === name ? 1.9 : 1.5}
                      />
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a measurement"
                  onPress={() => open({ kind: "add-menu" })}
                  style={({ pressed }) => ({
                    width: 66,
                    height: 66,
                    borderRadius: 40,
                    backgroundColor: c.blue,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Plus size={29} color="#FFFFFF" strokeWidth={1.3} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
        {!!store.notice && (
          <View
            accessibilityRole="alert"
            style={{
              position: "absolute",
              bottom: desktop ? 25 : 100 + insets.bottom,
              left: desktop ? 250 : 22,
              right: 22,
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <View
              style={{
                maxWidth: 560,
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderRadius: 24,
                backgroundColor: c.ink,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              }}
            >
              <Check size={17} color="#C8E3B1" />
              <T size={12} color="#FFFFFF" style={{ flexShrink: 1 }}>
                {store.notice}
              </T>
            </View>
          </View>
        )}
        {panel && (
          <Sheet
            title={panelTitle(panel)}
            onClose={close}
            onBack={panels.length > 1 ? back : undefined}
          >
            <PanelContent
              key={`${store.profile.id}-${panel.kind}-${"metric" in panel ? panel.metric : "id" in panel ? panel.id : ""}`}
              panel={panel}
            />
          </Sheet>
        )}
      </View>
    </Navigation.Provider>
  );
}

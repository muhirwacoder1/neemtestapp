import React, { useState } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import {
  ArrowRight,
  ChevronRight,
  Footprints,
  Heart,
  ShieldCheck,
} from "lucide-react-native";
import { router } from "expo-router";
import { Button, T, useTheme } from "../components/ui";
import { EntryFrame } from "../components/EntryFrame";
import { useStartup } from "../components/Startup";
export function Welcome() {
  const c = useTheme(),
    intro = useStartup(),
    { width } = useWindowDimensions(),
    [page, setPage] = useState(0),
    [photoWidth, setPhotoWidth] = useState(340);
  const slides = [
      {
        title: "A little care.\nA healthier you.",
        detail:
          "Get to know your foot health, build a daily routine and keep your care connected.",
        icon: Footprints,
      },
      {
        title: "Every step,\nunderstood.",
        detail:
          "Explore pressure through a step. Connect compatible insoles to see your own measurements.",
        icon: ShieldCheck,
      },
      {
        title: "Your health.\nAll in one place.",
        detail:
          "Record your readings, follow your trends and make room for small, healthy habits.",
        icon: Heart,
      },
    ],
    slide = slides[page],
    Icon = slide.icon,
    wide = width >= 800;
  async function enter(signup = true) {
    await intro.finish();
    router.replace(signup ? "/sign-up" : "/sign-in");
  }
  return (
    <EntryFrame
      wide
      close={false}
      onBack={() => (page ? setPage(page - 1) : enter(false))}
    >
      <View
        style={{
          flex: 1,
          flexDirection: wide ? "row" : "column",
          gap: wide ? 54 : 25,
          justifyContent: "center",
          alignItems: wide ? "center" : "stretch",
        }}
      >
        <View
          style={{
            flex: wide ? 1 : undefined,
            borderRadius: 36,
            backgroundColor: c.bluePale,
            overflow: "hidden",
            maxHeight: wide ? 560 : 330,
          }}
          onLayout={(e) => setPhotoWidth(e.nativeEvent.layout.width)}
        >
          <View style={{ width: "100%", aspectRatio: 604 / 643 }}>
            <Image
              source={require("../../assets/onboarding/welcome-artwork.png")}
              accessibilityLabel="A person preparing their shoes for movement"
              style={{
                position: "absolute",
                width: (photoWidth * 1274) / 604,
                height: (photoWidth * 1234) / 604,
                left: (-photoWidth * 19) / 604,
                top: (-photoWidth * 22) / 604,
              }}
            />
          </View>
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: "52%",
              height: "38%",
              backgroundColor: c.bluePale,
              padding: 18,
              borderTopLeftRadius: 28,
              justifyContent: "center",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon size={18} color={c.text} strokeWidth={1.5} />
            <T
              size={18}
              weight="medium"
              style={{ textAlign: "center", letterSpacing: -0.4 }}
            >
              One step at a time.
            </T>
          </View>
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 18 }}>
          <T
            size={wide ? 47 : 36}
            weight="medium"
            style={{ letterSpacing: -1.5, lineHeight: wide ? 54 : 42 }}
          >
            {slide.title}
          </T>
          <T size={15} color={c.muted} style={{ lineHeight: 22 }}>
            {slide.detail}
          </T>
          <View style={{ flexDirection: "row", gap: 6, marginVertical: 5 }}>
            {slides.map((_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Welcome page ${i + 1}`}
                aria-selected={page === i}
                onPress={() => setPage(i)}
                style={{ paddingVertical: 8 }}
              >
                <View
                  style={{
                    width: i === page ? 30 : 7,
                    height: 6,
                    borderRadius: 5,
                    backgroundColor: i === page ? c.blue : c.card,
                  }}
                />
              </Pressable>
            ))}
          </View>
          <Button
            label={page === 2 ? "Create your account" : "Next"}
            textSize={16}
            textWeight="medium"
            icon={page === 2 ? ArrowRight : ChevronRight}
            onPress={() => (page === 2 ? enter() : setPage(page + 1))}
            style={{ backgroundColor: c.blue, minHeight: 56 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to Neem"
            onPress={async () => {
              await intro.finish();
              router.replace("/sign-in");
            }}
            style={{ padding: 10 }}
          >
            <T size={14} style={{ textAlign: "center" }}>
              Already have an account? <T weight="semibold">Sign in</T>
            </T>
          </Pressable>
        </View>
      </View>
    </EntryFrame>
  );
}

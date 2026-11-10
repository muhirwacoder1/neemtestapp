import React, { useState } from "react";
import {
  Image,
  Pressable,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowUpRight, Bookmark, Search, Utensils } from "lucide-react-native";
import { articles } from "../domain";
import {
  Button,
  Card,
  Empty,
  Section,
  T,
  fonts,
  useTheme,
} from "../components/ui";
import { useStore } from "../store";
import { useNavigation } from "../navigation";
import { ArticleCard } from "./Home";
export function Education() {
  const { data } = useStore(),
    nav = useNavigation(),
    c = useTheme(),
    { width } = useWindowDimensions();
  const [category, setCategory] = useState("All"),
    [query, setQuery] = useState("");
  const filtered = articles.filter(
    (a) =>
      (category === "All" || category === "Saved"
        ? category !== "Saved" || data.bookmarks.includes(a.id)
        : a.category === category) &&
      `${a.title} ${a.category} ${a.intro}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <View style={{ gap: 26 }}>
      <Card
        style={{ backgroundColor: c.mint, padding: 24, overflow: "hidden" }}
      >
        <T size={13} color={c.muted}>
          A little knowledge. A lot of good.
        </T>
        <T
          size={34}
          weight="medium"
          style={{ lineHeight: 40, letterSpacing: -1, marginTop: 14 }}
        >
          Feel informed.
          <T size={34} weight="medium">
            {" "}
            Feel more like you.
          </T>
        </T>
        <T size={13} color={c.muted} style={{ marginTop: 12, maxWidth: 400 }}>
          Thoughtful guidance for the small things that matter to your health.
        </T>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 20,
            gap: 12,
          }}
        >
          <Button
            label="Your daily foot check"
            small
            icon={ArrowUpRight}
            onPress={() => nav.open({ kind: "article", id: "daily-care" })}
          />
          <Image
            source={{ uri: articles[0].image }}
            accessibilityLabel="Everyday foot care"
            style={{ width: 70, height: 70, borderRadius: 40 }}
          />
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          backgroundColor: c.card,
          paddingHorizontal: 17,
          borderRadius: 32,
        }}
      >
        <Search size={19} color={c.muted} />
        <TextInput
          accessibilityLabel="Search education articles"
          placeholder="What would you like to learn?"
          placeholderTextColor={c.muted}
          value={query}
          onChangeText={setQuery}
          style={{
            flex: 1,
            paddingVertical: 17,
            color: c.text,
            fontFamily: fonts.regular,
            fontSize: 13,
            ...({ outlineStyle: "none" } as any),
          }}
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {[
          "All",
          "Foot care",
          "Nutrition",
          "Foot pressure",
          "Blood glucose",
          "Mobility",
          "Saved",
        ].map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: category === cat }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 17,
              paddingVertical: 11,
              borderRadius: 50,
              backgroundColor: category === cat ? c.ink : c.card,
            }}
          >
            {cat === "Saved" && (
              <Bookmark
                size={13}
                color={category === cat ? "#FFFFFF" : c.muted}
              />
            )}
            <T
              size={11}
              weight="semibold"
              color={category === cat ? "#FFFFFF" : c.muted}
            >
              {cat}
            </T>
          </Pressable>
        ))}
      </View>
      {category === "Nutrition" && (
        <Card style={{ backgroundColor: c.pale }}>
          <Utensils size={24} color={c.teal} />
          <T size={22} weight="bold" style={{ marginTop: 12 }}>
            Good food, close to home.
          </T>
          <T color={c.muted} size={13} style={{ marginTop: 8 }}>
            Explore a balanced plate with familiar ingredients like dodo, beans
            and sweet potatoes. Adapt choices with your care team.
          </T>
          <Button
            label="Build a balanced meal idea"
            small
            secondary
            onPress={() => nav.open({ kind: "meal-plan" })}
            style={{ marginTop: 18, alignSelf: "flex-start" }}
          />
        </Card>
      )}
      <View>
        <Section
          title={
            category === "Saved"
              ? "Your little library"
              : category === "Nutrition"
                ? "Nourish your everyday"
                : "Made for a healthier everyday"
          }
          subtitle={`${filtered.length} thoughtful reads · Sources included with every article`}
        />
        <View
          style={{
            flexDirection: width >= 740 ? "row" : "column",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          {filtered.map((a) => (
            <View
              key={a.id}
              style={{
                width: width >= 1150 ? "31.8%" : width >= 740 ? "48%" : "100%",
              }}
            >
              <ArticleCard article={a} />
            </View>
          ))}
        </View>
        {!filtered.length && (
          <Card>
            <Empty
              icon={Bookmark}
              title={
                category === "Saved"
                  ? "Your library starts here"
                  : "No matching articles"
              }
              detail={
                category === "Saved"
                  ? "Open an article and tap Save to keep it close."
                  : "Try a different search or topic."
              }
              action="Explore all articles"
              onPress={() => {
                setCategory("All");
                setQuery("");
              }}
            />
          </Card>
        )}
      </View>
    </View>
  );
}

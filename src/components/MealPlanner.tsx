import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Check, Leaf } from "lucide-react-native";
import { Button, Card, Segments, T, useTheme } from "./ui";
import { useStore } from "../store";
import { useNavigation } from "../navigation";
import { uid } from "../domain";
export function MealPlanner() {
  const c = useTheme(),
    { update, setNotice } = useStore(),
    nav = useNavigation();
  const [vegetable, setVegetable] = useState("Dodo"),
    [protein, setProtein] = useState("Beans"),
    [carb, setCarb] = useState("Sweet potato"),
    [plantBased, setPlantBased] = useState("All foods");
  const [due] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    return date;
  });
  return (
    <>
      <Leaf size={34} color={c.teal} strokeWidth={1.2} />
      <T size={26} weight="bold">
        A balanced plate, your way.
      </T>
      <T size={13} color={c.muted}>
        A little inspiration with familiar ingredients. Adapt the choices and
        portions to your preferences and the guidance of your care team.
      </T>
      <Segments
        options={["All foods", "Plant-based"]}
        selected={plantBased}
        onSelect={(s) => {
          setPlantBased(s);
          if (s === "Plant-based") setProtein("Beans");
        }}
      />
      <View style={{ gap: 13 }}>
        <T size={15} weight="bold">
          Start with vegetables
        </T>
        <Segments
          options={["Dodo", "Cabbage", "Carrots & greens", "Green beans"]}
          selected={vegetable}
          onSelect={setVegetable}
          compact
        />
      </View>
      <View style={{ gap: 13 }}>
        <T size={15} weight="bold">
          Add a source of protein
        </T>
        <Segments
          options={
            plantBased === "Plant-based"
              ? ["Beans", "Lentils", "Tofu"]
              : ["Beans", "Eggs", "Fish", "Lentils"]
          }
          selected={protein}
          onSelect={setProtein}
          compact
        />
      </View>
      <View style={{ gap: 13 }}>
        <T size={15} weight="bold">
          Include a carbohydrate food
        </T>
        <Segments
          options={[
            "Sweet potato",
            "Rice",
            "Irish potato",
            "Whole-grain ugali",
          ]}
          selected={carb}
          onSelect={setCarb}
          compact
        />
      </View>
      <Card style={{ backgroundColor: c.pale, borderWidth: 0 }}>
        <T size={11} weight="bold" color={c.teal}>
          A LITTLE PLAN FOR YOUR DAY
        </T>
        <T size={21} weight="bold" style={{ marginTop: 12 }}>
          {vegetable}, {protein.toLowerCase()} & {carb.toLowerCase()}
        </T>
        <T size={12} color={c.muted} style={{ marginTop: 10 }}>
          Beans provide both carbohydrate and protein. This is a food-group
          idea, not an individualized nutrition prescription.
        </T>
      </Card>
      <Button
        label={`Save meal task for ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        icon={Check}
        onPress={async () => {
          const ok = await update((d) => ({
            ...d,
            tasks: [
              ...d.tasks,
              {
                id: uid(),
                title: `Plan a balanced meal: ${vegetable}, ${protein.toLowerCase()} & ${carb.toLowerCase()}`,
                dueAt: due.toISOString(),
              },
            ],
          }));
          if (ok) {
            nav.close();
            setNotice("Your meal idea has been added to Tasks.");
          }
        }}
      />
      <Button
        label="Read about balanced meal planning"
        small
        ghost
        onPress={() =>
          Linking.openURL(
            "https://www.cdc.gov/diabetes/healthy-eating/diabetes-meal-planning.html",
          )
        }
      />
    </>
  );
}

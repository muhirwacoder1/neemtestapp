import React, { useState } from "react";
import { View } from "react-native";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Plus,
  Sparkles,
} from "lucide-react-native";
import { useStore } from "../store";
import { useNavigation } from "../navigation";
import { dayKey, isToday } from "../domain";
import { Button, Card, Empty, Segments, T, useTheme } from "../components/ui";
import { CareGauge } from "../components/MonoCharts";
import { TaskRow } from "./Home";
export function Tasks() {
  const { data } = useStore(),
    nav = useNavigation(),
    c = useTheme();
  const [group, setGroup] = useState("Today");
  const today = data.tasks.filter((t) => isToday(t.dueAt)),
    done = today.filter((t) => t.completedAt).length;
  const filtered = data.tasks
    .filter((t) =>
      group === "Completed"
        ? !!t.completedAt
        : group === "Upcoming"
          ? !t.completedAt && !isToday(t.dueAt)
          : isToday(t.dueAt) && !t.completedAt,
    )
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  return (
    <View style={{ gap: 24 }}>
      <Card style={{ backgroundColor: c.bluePale, padding: 22 }}>
        <T size={23} weight="medium" style={{ letterSpacing: -0.6 }}>
          Care at your own pace.
        </T>
        <T size={13} color={c.muted} style={{ marginTop: 7 }}>
          Every little habit makes room for a healthier day.
        </T>
        <CareGauge completed={done} total={today.length} />
      </Card>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 15,
        }}
      >
        <Segments
          options={["Today", "Upcoming", "Completed"]}
          selected={group}
          onSelect={setGroup}
          compact
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Appointments"
            icon={CalendarDays}
            small
            secondary
            onPress={() => nav.open({ kind: "appointments" })}
          />
          <Button
            label="Add task"
            icon={Plus}
            small
            onPress={() => nav.open({ kind: "new-task" })}
          />
        </View>
      </View>
      <Card>
        <T size={20} weight="medium">
          {group === "Today"
            ? "A little time for you"
            : group === "Upcoming"
              ? "On the horizon"
              : "Look at what you’ve done"}
        </T>
        {filtered.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {!filtered.length && (
          <Empty
            icon={group === "Completed" ? Check : CalendarCheck}
            title={
              group === "Today" && today.length
                ? "You’ve made time for your care."
                : "A little space in your day"
            }
            detail={
              group === "Today" && today.length
                ? "Your tasks for today are complete. You can add another whenever you need."
                : "Create a care task or change the filter to see more."
            }
            action="Add a care task"
            onPress={() => nav.open({ kind: "new-task" })}
          />
        )}
      </Card>
      <Card>
        <T size={20} weight="medium">
          Your week of care
        </T>
        <T size={12} color={c.muted} style={{ marginTop: 7 }}>
          Days with at least one completed task.
        </T>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 25,
          }}
        >
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const completed = data.tasks.some(
              (t) =>
                t.completedAt && dayKey(new Date(t.completedAt)) === dayKey(d),
            );
            return (
              <View key={i} style={{ alignItems: "center", gap: 9 }}>
                <T size={11} color={c.muted}>
                  {d.toLocaleDateString(undefined, { weekday: "narrow" })}
                </T>
                <View
                  style={{
                    width: 33,
                    height: 33,
                    borderRadius: 50,
                    backgroundColor: completed ? c.ink : c.subtle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {completed ? (
                    <Check size={17} color="#FFFFFF" />
                  ) : (
                    <T size={11} color={c.muted}>
                      {d.getDate()}
                    </T>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Card>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Sparkles size={14} color={c.teal} />
        <T size={11} color={c.muted}>
          Consistency grows with kindness to yourself.
        </T>
      </View>
    </View>
  );
}

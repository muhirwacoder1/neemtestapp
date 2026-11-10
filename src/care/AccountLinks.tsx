import React from "react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import { Button, Card, T } from "../components/ui";
export function CareAccountLinks() {
  const role = useQuery(api.care.permissions);
  if (!role?.administrator && !role?.clinician) return null;
  return (
    <Card style={{ gap: 14 }}>
      <T size={20} weight="semibold">
        Your care workspace
      </T>
      {role.administrator && (
        <Button
          label="Open care administration"
          onPress={() => router.push("/admin")}
        />
      )}{" "}
      {role.clinician && (
        <Button
          label="Open clinician workspace"
          secondary
          onPress={() => router.push("/clinician")}
        />
      )}
    </Card>
  );
}

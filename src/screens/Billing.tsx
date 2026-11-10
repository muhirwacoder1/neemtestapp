import React from "react";
import { router } from "expo-router";
import { useStore } from "../store";
import { Button } from "../components/ui";
import { CareFrame, CareBoundary, Section, Note } from "../care/shared";
import { BillingList } from "../care/Billing";
import type { Id } from "../../convex/_generated/dataModel";
export function Billing() {
  const { profile, guest } = useStore();
  return (
    <CareBoundary>
      <CareFrame title="Your invoices">
        {guest ? (
          <Section title="Sign in to view your invoices">
            <Note>Your invoices are linked to your Neem account.</Note>
            <Button label="Sign in" onPress={() => router.push("/sign-in")} />
          </Section>
        ) : (
          <BillingList
            key={profile.id}
            profileId={profile.id as Id<"profiles">}
          />
        )}
      </CareFrame>
    </CareBoundary>
  );
}

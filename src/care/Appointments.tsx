import React, { useState } from "react";
import { View } from "react-native";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Input, T } from "../components/ui";
import { useMinuteClock } from "../useMinuteClock";
import {
  Section,
  Note,
  Status,
  Choices,
  Feedback,
  useFeedback,
  Loading,
  More,
  dateTime,
} from "./shared";
export function CareAppointments({
  profileId,
}: {
  profileId?: Id<"profiles">;
}) {
  const rows = usePaginatedQuery(
      api.careAppointments.list,
      profileId ? { profileId } : {},
      { initialNumItems: 20 },
    ),
    update = useMutation(api.careAppointments.update),
    f = useFeedback(),
    [confirm, setConfirm] = useState(""),
    [change, setChange] = useState<{
      id: Id<"consultations">;
      clinicianId?: Id<"clinicians">;
    } | null>(null);
  return (
    <Section title="Appointments">
      <Note>
        Times follow this device’s timezone. Only the assigned clinician and
        patient can enter a video room.
      </Note>
      <Feedback message={f.message} />
      {rows.status === "LoadingFirstPage" ? (
        <Loading />
      ) : !rows.results.length ? (
        <Note>
          No appointments yet. Select a patient to book an available time.
        </Note>
      ) : (
        rows.results.map((row) => (
          <View key={row.id} style={{ gap: 12, paddingVertical: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <T size={18} weight="semibold">
                {row.patient}
              </T>
              <Status label={row.state} />
            </View>
            <T size={14}>{dateTime(row.startsAt)}</T>
            <Note>
              {row.clinician} ·{" "}
              {Math.round((row.endsAt - row.startsAt) / 60000)} minutes
            </Note>
            <T size={14}>{row.reason}</T>
            {row.state === "booked" && (
              <>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {row.canJoin && (
                    <Button
                      small
                      label="Join consultation"
                      onPress={() =>
                        router.push({
                          pathname: "/consultation",
                          params: { id: row.id },
                        })
                      }
                    />
                  )}
                  <Button
                    small
                    secondary
                    label="Reschedule"
                    onPress={() => setChange({ id: row.id })}
                  />
                  <Button
                    small
                    secondary
                    label="Complete"
                    disabled={f.busy}
                    onPress={() =>
                      void f.run(
                        () => update({ id: row.id, action: "complete" }),
                        "Appointment completed.",
                      )
                    }
                  />
                  <Button
                    small
                    ghost
                    label="Cancel appointment"
                    onPress={() => setConfirm(row.id)}
                  />
                </View>
                {confirm === row.id && (
                  <>
                    <Note>Cancel this appointment and release its time?</Note>
                    <Button
                      small
                      label="Confirm cancellation"
                      loading={f.busy}
                      onPress={() =>
                        void f.run(async () => {
                          await update({ id: row.id, action: "cancel" });
                          setConfirm("");
                        }, "Appointment cancelled.")
                      }
                    />
                    <Button
                      small
                      ghost
                      label="Keep appointment"
                      onPress={() => setConfirm("")}
                    />
                  </>
                )}
                {change?.id === row.id && (
                  <SlotPicker
                    onPick={(slotId) =>
                      void f.run(async () => {
                        await update({
                          id: row.id,
                          slotId,
                          action: "reschedule",
                        });
                        setChange(null);
                      }, "Appointment rescheduled.")
                    }
                    onClose={() => setChange(null)}
                  />
                )}
              </>
            )}
          </View>
        ))
      )}
      <More status={rows.status} loadMore={rows.loadMore} />
    </Section>
  );
}
export function BookPatient({ profileId }: { profileId: Id<"profiles"> }) {
  const book = useMutation(api.careAppointments.book),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    f = useFeedback();
  return (
    <Section title="Book a consultation">
      <Note>
        Choose a published time. The appointment will be attached to the
        patient’s account.
      </Note>
      <Feedback message={f.message} />
      {!open ? (
        <Button
          label="Find an available time"
          secondary
          onPress={() => setOpen(true)}
        />
      ) : (
        <>
          <Input
            label="Reason for appointment"
            value={reason}
            maxLength={1000}
            onChangeText={setReason}
          />
          <SlotPicker
            onPick={(slotId) =>
              void f.run(async () => {
                await book({ profileId, slotId, reason });
                setOpen(false);
              }, "Appointment booked for this patient.")
            }
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </Section>
  );
}
function SlotPicker({
  onPick,
  onClose,
}: {
  onPick: (id: Id<"consultationSlots">) => void;
  onClose: () => void;
}) {
  const clinicians = useQuery(api.consultations.clinicians),
    [clinician, setClinician] = useState(""),
    [slot, setSlot] = useState(""),
    asOf = useMinuteClock();
  const slots = useQuery(
    api.consultations.slots,
    clinician ? { clinicianId: clinician as Id<"clinicians">, asOf } : "skip",
  );
  return (
    <View style={{ gap: 12 }}>
      <T size={15}>Clinician</T>
      {!clinicians ? (
        <Loading />
      ) : !clinicians.length ? (
        <Note>No clinicians have been enabled yet.</Note>
      ) : (
        <Choices
          options={clinicians.map((c) => ({ id: c.id, label: c.name }))}
          value={clinician}
          onChange={(id) => {
            setClinician(id);
            setSlot("");
          }}
        />
      )}
      {clinician &&
        (!slots ? (
          <Loading />
        ) : !slots.filter((s) => s.state === "open").length ? (
          <Note>
            No open times. The clinician can publish availability in their
            workspace.
          </Note>
        ) : (
          <Choices
            options={slots
              .filter((s) => s.state === "open")
              .map((s) => ({ id: s.id, label: dateTime(s.startsAt) }))}
            value={slot}
            onChange={setSlot}
          />
        ))}
      <Button
        label="Confirm selected time"
        disabled={!slot}
        onPress={() => onPick(slot as Id<"consultationSlots">)}
      />
      <Button label="Close time selector" ghost onPress={onClose} />
    </View>
  );
}

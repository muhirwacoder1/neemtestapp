import React, { useState } from "react";
import { View, Switch } from "react-native";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Input, T, useTheme } from "../components/ui";
import {
  Section,
  Note,
  Status,
  Choices,
  Feedback,
  useFeedback,
  Loading,
  dateTime,
} from "./shared";
type Encounter = FunctionReturnType<typeof api.care.encounters>[number];
type History = Encounter["history"];
const blank: History = {
  complaint: "",
  presentingHistory: "",
  medicalHistory: "",
  medications: "",
  allergies: "",
  socialHistory: "",
  footExamination: "",
  assessment: "",
  plan: "",
  risk: "unassessed",
  rationale: "",
  priority: "routine",
  consentRecorded: false,
};
const fields: {
  key: keyof Pick<
    History,
    | "complaint"
    | "presentingHistory"
    | "medicalHistory"
    | "medications"
    | "allergies"
    | "socialHistory"
    | "footExamination"
    | "assessment"
    | "plan"
    | "rationale"
  >;
  label: string;
}[] = [
  { key: "complaint", label: "Presenting complaint" },
  { key: "presentingHistory", label: "History of the complaint" },
  { key: "medicalHistory", label: "Medical, surgical and family history" },
  { key: "medications", label: "Current medications" },
  { key: "allergies", label: "Allergies and reactions" },
  { key: "socialHistory", label: "Social history and daily activity" },
  { key: "footExamination", label: "Foot examination and findings" },
  { key: "assessment", label: "Clinical assessment" },
  { key: "plan", label: "Care plan and follow-up" },
  { key: "rationale", label: "Risk assessment rationale" },
];
export function PatientHistory({
  profileId,
  canWrite,
}: {
  profileId: Id<"profiles">;
  canWrite: boolean;
}) {
  const rows = useQuery(api.care.encounters, { profileId }),
    [editor, setEditor] = useState<Encounter | "new" | null>(null),
    [expanded, setExpanded] = useState("");
  return (
    <Section title="Clinical history">
      {canWrite && (
        <Button label="Take patient history" onPress={() => setEditor("new")} />
      )}
      <Note>
        Signed records are preserved. Corrections are recorded in a new
        encounter. Showing the latest 40 records.
      </Note>
      {editor && (
        <HistoryEditor
          key={editor === "new" ? "new" : editor._id}
          profileId={profileId}
          record={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {!rows ? (
        <Loading />
      ) : !rows.length ? (
        <Note>No clinical history recorded.</Note>
      ) : (
        rows.map((row) => (
          <View key={row._id} style={{ gap: 10, paddingVertical: 12 }}>
            <Status label={row.state} />
            <T size={17} weight="semibold">
              {row.history.complaint || "Untitled draft"}
            </T>
            <Note>
              {row.authorName || "Care team"} · {dateTime(row.updatedAt)} ·
              Revision {row.revision}
            </Note>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Status label={row.history.risk} />
              <Status label={row.history.priority} />
            </View>
            <Button
              small
              secondary
              label={expanded === row._id ? "Hide record" : "Read record"}
              onPress={() => setExpanded(expanded === row._id ? "" : row._id)}
            />
            {expanded === row._id &&
              fields.map((f) => (
                <View key={f.key} style={{ gap: 4 }}>
                  <T size={12} weight="semibold">
                    {f.label}
                  </T>
                  <T size={14}>{row.history[f.key] || "Not recorded"}</T>
                </View>
              ))}
            {canWrite && row.state === "draft" && (
              <Button
                small
                label="Continue draft"
                onPress={() => setEditor(row)}
              />
            )}
          </View>
        ))
      )}
    </Section>
  );
}
function HistoryEditor({
  profileId,
  record,
  onClose,
}: {
  profileId: Id<"profiles">;
  record?: Encounter;
  onClose: () => void;
}) {
  const [form, setForm] = useState<History>(record?.history ?? blank),
    [confirm, setConfirm] = useState(false),
    save = useMutation(api.care.saveHistory),
    f = useFeedback(),
    c = useTheme();
  function submit(sign: boolean) {
    void f.run(
      async () => {
        await save({
          profileId,
          history: form,
          sign,
          ...(record ? { id: record._id, revision: record.revision } : {}),
        });
        onClose();
      },
      sign ? "History signed." : "Draft saved.",
    );
  }
  return (
    <View
      style={{
        gap: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: c.line,
      }}
    >
      <T size={21} weight="semibold">
        {record ? "Continue history" : "New patient history"}
      </T>
      <Note>
        Record examination findings, including sensation, circulation, skin
        condition, previous ulcers or amputations, and relevant conditions.
        These notes inform the clinician’s assessment.
      </Note>
      {fields.map((field) => (
        <Input
          key={field.key}
          label={field.label}
          value={form[field.key]}
          multiline
          maxLength={4000}
          onChangeText={(text) => setForm({ ...form, [field.key]: text })}
        />
      ))}
      <T size={14} weight="semibold">
        Clinician-assessed ulcer risk
      </T>
      <Choices
        options={["unassessed", "low", "moderate", "high"].map((id) => ({
          id,
          label: id === "unassessed" ? "Not assessed" : id,
        }))}
        value={form.risk}
        onChange={(value) =>
          setForm({ ...form, risk: value as History["risk"] })
        }
      />
      <T size={14} weight="semibold">
        Review priority
      </T>
      <Choices
        options={["routine", "review", "urgent"].map((id) => ({
          id,
          label: id,
        }))}
        value={form.priority}
        onChange={(value) =>
          setForm({ ...form, priority: value as History["priority"] })
        }
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          accessibilityLabel="Patient consent recorded"
          value={form.consentRecorded}
          onValueChange={(value) =>
            setForm({ ...form, consentRecorded: value })
          }
        />
        <T size={14}>Patient consent recorded</T>
      </View>
      <Feedback message={f.message} />
      <Button
        label="Save draft"
        secondary
        loading={f.busy}
        onPress={() => submit(false)}
      />
      {confirm ? (
        <>
          <Note>
            Signing makes this encounter permanent and updates the patient’s
            risk queue. Check the assessment before confirming.
          </Note>
          <Button
            label="Confirm and sign history"
            loading={f.busy}
            onPress={() => submit(true)}
          />
          <Button
            label="Keep editing"
            ghost
            onPress={() => setConfirm(false)}
          />
        </>
      ) : (
        <Button
          label="Review and sign"
          disabled={f.busy}
          onPress={() => setConfirm(true)}
        />
      )}
      <Button label="Close editor" ghost onPress={onClose} />
    </View>
  );
}

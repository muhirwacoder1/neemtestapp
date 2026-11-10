import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import {
  ArrowUpRight,
  Users,
  Activity,
  Footprints,
  CalendarDays,
} from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAccount } from "../services/backend";
import { useStore } from "../store";
import { T, Button, Card, Input, useTheme } from "../components/ui";
import { ClinicianWorkspace } from "../components/AppointmentList";
import {
  CareFrame,
  CareBoundary,
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
import { PatientHistory } from "./History";
import { CareAppointments, BookPatient } from "./Appointments";
import { IssueInvoice, BillingList } from "./Billing";
export function CareWorkspace({ mode }: { mode: "admin" | "clinician" }) {
  return (
    <CareBoundary>
      <WorkspaceGate mode={mode} />
    </CareBoundary>
  );
}
function WorkspaceGate({ mode }: { mode: "admin" | "clinician" }) {
  const account = useAccount(),
    { guest } = useStore();
  return !account.configured || guest || !account.authenticated ? (
    <CareFrame title="Neem care">
      <Section title="Sign in to your workspace">
        <Note>
          Use your approved care team account to access patient records.
        </Note>
        <Button label="Sign in" onPress={() => router.push("/sign-in")} />
      </Section>
    </CareFrame>
  ) : (
    <AuthorizedWorkspace mode={mode} />
  );
}
function AuthorizedWorkspace({ mode }: { mode: "admin" | "clinician" }) {
  const role = useQuery(api.care.permissions);
  if (!role)
    return (
      <CareFrame title="Neem care">
        <Loading />
      </CareFrame>
    );
  if (mode === "admin" ? !role.administrator : !role.clinician)
    return (
      <CareFrame title="Neem care">
        <Section title="Workspace access required">
          <Note>
            This account does not have{" "}
            {mode === "admin" ? "administrator" : "clinician"} access. Ask your
            administrator to enable the correct account.
          </Note>
          <Button
            label="Back to account"
            secondary
            onPress={() => router.replace("/account")}
          />
        </Section>
      </CareFrame>
    );
  return <Workspace mode={mode} clinicianId={role.clinicianId} />;
}
function Workspace({
  mode,
  clinicianId,
}: {
  mode: "admin" | "clinician";
  clinicianId?: Id<"clinicians">;
}) {
  const administrator = mode === "admin",
    tabs = administrator
      ? [
          "Overview",
          "Patients",
          "Clinicians",
          "Appointments",
          "Insoles",
          "Billing",
          "Activity",
        ]
      : ["Patients", "Appointments", "Availability", "Billing"],
    [section, setSection] = useState(administrator ? "Overview" : "Patients"),
    [patient, setPatient] = useState<Id<"profiles"> | null>(null);
  return (
    <CareFrame
      title={administrator ? "Care administration" : "Clinician workspace"}
      clinician={!administrator}
      section={section}
      sections={tabs}
      onSection={(s) => {
        setSection(s);
        setPatient(null);
      }}
    >
      {patient ? (
        <>
          <Button
            label="Back to workspace"
            small
            secondary
            onPress={() => setPatient(null)}
          />
          <PatientDetail
            key={patient}
            profileId={patient}
            administrator={administrator}
            clinicianId={clinicianId}
          />
        </>
      ) : section === "Overview" ? (
        <Overview onPatient={setPatient} onSection={setSection} />
      ) : section === "Patients" ? (
        <PatientDirectory
          administrator={administrator}
          onPatient={setPatient}
        />
      ) : section === "Clinicians" ? (
        <Clinicians />
      ) : section === "Appointments" ? (
        <CareAppointments />
      ) : section === "Availability" && clinicianId ? (
        <ClinicianWorkspace clinicianId={clinicianId} />
      ) : section === "Insoles" ? (
        <Insoles />
      ) : section === "Billing" ? (
        <BillingList />
      ) : section === "Activity" ? (
        <ActivityLog />
      ) : null}
    </CareFrame>
  );
}
function Overview({
  onPatient,
  onSection,
}: {
  onPatient: (id: Id<"profiles">) => void;
  onSection: (s: string) => void;
}) {
  const c = useTheme(),
    wide = useWindowDimensions().width > 700,
    [priority, setPriority] = useState("high"),
    queue = usePaginatedQuery(
      api.care.riskQueue,
      { filter: priority as "high" | "routine" | "review" | "urgent" },
      { initialNumItems: 20 },
    );
  return (
    <>
      <Card style={{ backgroundColor: c.bluePale, gap: 14, padding: 28 }}>
        <T size={12} weight="semibold">
          NEEM / CARE TEAM
        </T>
        <T size={wide ? 38 : 30} weight="medium" style={{ letterSpacing: -1 }}>
          A little attention.{"\n"}A better next step.
        </T>
        <Note>
          Review your patients, coordinate care, and keep every record
          connected.
        </Note>
      </Card>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        {[
          {
            title: "Patients",
            note: "Profiles & care assignments",
            Icon: Users,
            bg: c.lavender,
          },
          {
            title: "Appointments",
            note: "Bookings & video consultations",
            Icon: CalendarDays,
            bg: c.mint,
          },
          {
            title: "Insoles",
            note: "Register & assign devices",
            Icon: Footprints,
            bg: c.peach,
          },
        ].map(({ title, note, Icon, bg }) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            onPress={() => onSection(title)}
            style={{
              flex: 1,
              minWidth: wide ? 200 : 140,
              backgroundColor: bg,
              padding: wide ? 22 : 16,
              borderRadius: 28,
              gap: wide ? 16 : 10,
            }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Icon color={c.text} size={25} />
              <ArrowUpRight color={c.text} size={22} />
            </View>
            <T size={23} weight="medium">
              {title}
            </T>
            <Note>{note}</Note>
          </Pressable>
        ))}
      </View>
      <Section title="Patient review queue">
        <Note>
          Priority and ulcer risk come from signed clinician assessments. An
          unassessed patient is not classified as low risk. The walking
          simulation does not create patient alerts.
        </Note>
        <Choices
          value={priority}
          onChange={setPriority}
          options={[
            { id: "high", label: "High ulcer risk" },
            { id: "urgent", label: "Urgent" },
            { id: "review", label: "Needs review" },
            { id: "routine", label: "Routine" },
          ]}
        />
        {queue.status === "LoadingFirstPage" ? (
          <Loading />
        ) : !queue.results.length ? (
          <Card style={{ backgroundColor: c.subtle, gap: 8 }}>
            <Activity color={c.muted} size={25} />
            <T size={18}>No {priority} assessments recorded.</T>
            <Note>
              Open Patients to arrange an assessment. This empty queue is not a
              clinical all-clear.
            </Note>
          </Card>
        ) : (
          queue.results.map((p) => (
            <PatientRow
              key={p.id}
              patient={p}
              onPress={() => onPatient(p.id)}
            />
          ))
        )}
        <More status={queue.status} loadMore={queue.loadMore} />
      </Section>
      <AlertQueue onPatient={onPatient} />
    </>
  );
}
type Patient = {
  id: Id<"profiles">;
  name: string;
  risk: string;
  priority?: string;
  assessedAt?: number;
  disabled: boolean;
};
function PatientRow({
  patient: p,
  onPress,
}: {
  patient: Patient;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open patient ${p.name}`}
      onPress={onPress}
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: c.line,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            backgroundColor: c.lavender,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T size={20} weight="semibold">
            {p.name.slice(0, 1)}
          </T>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <T size={18} weight="semibold">
            {p.name}
          </T>
          <Note>
            {p.assessedAt
              ? `Assessed ${dateTime(p.assessedAt)}`
              : "No signed risk assessment"}
          </Note>
        </View>
        <ArrowUpRight color={c.text} size={20} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Status label={p.risk} />
        {p.priority && <Status label={p.priority} />}{" "}
        {p.disabled && <Status label="suspended" />}
      </View>
    </Pressable>
  );
}
export function PatientDirectory({
  administrator,
  onPatient,
}: {
  administrator: boolean;
  onPatient: (id: Id<"profiles">) => void;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    rows = usePaginatedQuery(
      api.care.patients,
      { search: query },
      { initialNumItems: 20 },
    );
  return (
    <Section title={administrator ? "Patients" : "Your assigned patients"}>
      {administrator && (
        <>
          <Input
            label="Search patients by name"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setQuery(search.trim())}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              small
              label="Search"
              onPress={() => setQuery(search.trim())}
            />
            <Button
              small
              secondary
              label="Show all"
              onPress={() => {
                setSearch("");
                setQuery("");
              }}
            />
          </View>
        </>
      )}
      <Note>
        {administrator
          ? "Select a patient to manage their account, care assignments, appointments, insole, and invoices."
          : "Only patients assigned to your active clinician account appear here."}
      </Note>
      {rows.status === "LoadingFirstPage" ? (
        <Loading />
      ) : !rows.results.length ? (
        <Note>No patients found.</Note>
      ) : (
        rows.results.map((p) => (
          <PatientRow key={p.id} patient={p} onPress={() => onPatient(p.id)} />
        ))
      )}
      <More status={rows.status} loadMore={rows.loadMore} />
    </Section>
  );
}
function PatientDetail({
  profileId,
  administrator,
  clinicianId,
}: {
  profileId: Id<"profiles">;
  administrator: boolean;
  clinicianId?: Id<"clinicians">;
}) {
  const row = useQuery(api.care.patient, { profileId }),
    [view, setView] = useState("Overview");
  if (!row) return <Loading />;
  const canWrite =
    !!clinicianId &&
    row.assignments.some((a) => a.id === clinicianId && a.active);
  return (
    <>
      <Card style={{ gap: 12 }}>
        <T size={30} weight="medium">
          {row.summary.name}
        </T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Status label={row.summary.risk} />
          {row.summary.priority && <Status label={row.summary.priority} />}
        </View>
        <Note>
          {row.riskRationale || "No signed clinician risk assessment recorded."}
        </Note>
        <T size={12}>Patient ID · {profileId.slice(-8).toUpperCase()}</T>
      </Card>
      <Choices
        value={view}
        onChange={setView}
        options={["Overview", "History", "Appointments", "Billing"].map(
          (id) => ({ id, label: id }),
        )}
      />
      {view === "History" ? (
        <PatientHistory profileId={profileId} canWrite={canWrite} />
      ) : view === "Appointments" ? (
        <>
          <BookPatient profileId={profileId} />
          <CareAppointments profileId={profileId} />
        </>
      ) : view === "Billing" ? (
        <IssueInvoice profileId={profileId} />
      ) : (
        <>
          <Section title="Patient information">
            <Note>
              {row.details
                ? [row.details.firstName, row.details.lastName].join(" ")
                : row.summary.name}
            </Note>
            <T size={14}>
              Date of birth:{" "}
              {row.details?.birthDate || row.birthDate || "Not recorded"}
            </T>
            <T size={14}>Country: {row.details?.country || "Not recorded"}</T>
            <T size={14}>
              Assigned sex:{" "}
              {row.details?.assignedSex?.replaceAll("_", " ") || "Not recorded"}
            </T>
            <T size={14}>
              Height:{" "}
              {row.details?.heightCm
                ? `${row.details.heightCm} cm`
                : "Not recorded"}{" "}
              · Weight:{" "}
              {row.details?.weightKg
                ? `${row.details.weightKg} kg`
                : "Not recorded"}
            </T>
          </Section>
          <Section title="Care team">
            {row.assignments
              .filter((a) => a.active)
              .map((a) => (
                <T key={a.id}>{a.name}</T>
              ))}
            {!row.assignments.some((a) => a.active) && (
              <Note>No clinician assigned.</Note>
            )}
            {administrator && (
              <AssignClinician
                profileId={profileId}
                assignments={row.assignments}
              />
            )}
          </Section>
          <Section title="Recorded pressure alerts">
            <Note>
              Actual saved device alerts appear here. Colors in the walking
              simulation are not a diagnosis.
            </Note>
            {!row.alerts.length ? (
              <Note>No recorded pressure alerts.</Note>
            ) : (
              row.alerts.map((a) => (
                <View key={a.id} style={{ gap: 8 }}>
                  <Status label={a.reviewedAt ? "reviewed" : a.level} />
                  <T size={15}>{a.reason}</T>
                  <Note>
                    {dateTime(a.at)}
                    {a.reviewNote ? ` · ${a.reviewNote}` : ""}
                  </Note>
                  {canWrite && !a.reviewedAt && <AlertReview id={a.id} />}
                </View>
              ))
            )}
          </Section>
          <Section title="Registered insoles">
            {row.devices.length ? (
              row.devices.map((d) => (
                <View key={d.id} style={{ gap: 6 }}>
                  <T>{d.name}</T>
                  <Note>{d.hardwareId}</Note>
                  <Status label={d.active ? "active" : "retired"} />
                </View>
              ))
            ) : (
              <Note>
                No insole assigned. Registration does not indicate a live
                Bluetooth connection.
              </Note>
            )}
            {administrator && <AssignInsole profileId={profileId} />}
          </Section>
          <Section title="Recent health readings">
            <Note>Latest 30 saved readings, with their source.</Note>
            {row.readings.length ? (
              row.readings.map((r, i) => (
                <View key={`${r.at}-${i}`} style={{ gap: 5 }}>
                  <T size={15}>
                    {r.kind} · {r.value}
                  </T>
                  <Note>
                    {new Date(r.at).toLocaleString()} · {r.source}
                  </Note>
                </View>
              ))
            ) : (
              <Note>No readings saved.</Note>
            )}
          </Section>
          {administrator && (
            <ManagePatient
              profileId={profileId}
              name={row.summary.name}
              disabled={row.summary.disabled}
            />
          )}
        </>
      )}
    </>
  );
}
function AlertReview({ id }: { id: Id<"alerts"> }) {
  const [note, setNote] = useState(""),
    save = useMutation(api.care.reviewAlert),
    f = useFeedback();
  return (
    <View style={{ gap: 10 }}>
      <Input
        label="Clinical alert review"
        value={note}
        onChangeText={setNote}
        maxLength={1000}
      />
      <Feedback message={f.message} />
      <Button
        small
        label="Save alert review"
        loading={f.busy}
        onPress={() =>
          void f.run(() => save({ id, note }), "Alert review saved.")
        }
      />
    </View>
  );
}
function AssignClinician({
  profileId,
  assignments,
}: {
  profileId: Id<"profiles">;
  assignments: { id: Id<"clinicians">; active: boolean; name: string }[];
}) {
  const rows = useQuery(api.care.clinicians),
    assign = useMutation(api.care.assign),
    [selected, setSelected] = useState(""),
    f = useFeedback();
  return (
    <View style={{ gap: 12 }}>
      <Feedback message={f.message} />
      <Choices
        value={selected}
        onChange={setSelected}
        options={(rows ?? [])
          .filter((c) => c.active)
          .map((c) => ({ id: c.id, label: c.name }))}
      />
      {!rows?.some((c) => c.active) && (
        <Note>
          Enable a clinician in Clinicians first. They must have a registered
          Neem account.
        </Note>
      )}
      <Button
        small
        label="Assign selected clinician"
        disabled={!selected}
        loading={f.busy}
        onPress={() =>
          void f.run(
            () =>
              assign({
                profileId,
                clinicianId: selected as Id<"clinicians">,
                active: true,
              }),
            "Clinician assigned.",
          )
        }
      />
      {assignments
        .filter((a) => a.active)
        .map((a) => (
          <Button
            key={a.id}
            small
            ghost
            label={`Remove ${a.name} assignment`}
            loading={f.busy}
            onPress={() =>
              void f.run(
                () => assign({ profileId, clinicianId: a.id, active: false }),
                "Assignment removed.",
              )
            }
          />
        ))}
    </View>
  );
}
function ManagePatient({
  profileId,
  name,
  disabled,
}: {
  profileId: Id<"profiles">;
  name: string;
  disabled: boolean;
}) {
  const [value, setValue] = useState(name),
    [confirm, setConfirm] = useState(false),
    rename = useMutation(api.care.renamePatient),
    suspend = useMutation(api.care.suspend),
    f = useFeedback();
  return (
    <Section title="Account management">
      <Input
        label="Patient display name"
        value={value}
        onChangeText={setValue}
        maxLength={60}
      />
      <Feedback message={f.message} />
      <Button
        small
        secondary
        label="Update display name"
        loading={f.busy}
        onPress={() =>
          void f.run(
            () => rename({ profileId, name: value }),
            "Display name updated.",
          )
        }
      />
      <Note>
        Account suspension blocks access to Neem records. It preserves the
        patient’s medical history and does not delete their Clerk account.
      </Note>
      {confirm ? (
        <>
          <Button
            small
            label={
              disabled ? "Confirm restore access" : "Confirm suspend access"
            }
            loading={f.busy}
            onPress={() =>
              void f.run(async () => {
                await suspend({ profileId, disabled: !disabled });
                setConfirm(false);
              }, "Account access updated.")
            }
          />
          <Button
            small
            ghost
            label="Keep current access"
            onPress={() => setConfirm(false)}
          />
        </>
      ) : (
        <Button
          small
          ghost
          label={disabled ? "Restore account access" : "Suspend account access"}
          onPress={() => setConfirm(true)}
        />
      )}
    </Section>
  );
}
function Clinicians() {
  const rows = useQuery(api.care.clinicians),
    accounts = usePaginatedQuery(
      api.care.accounts,
      {},
      { initialNumItems: 20 },
    ),
    save = useMutation(api.care.saveClinician),
    toggle = useMutation(api.care.setClinicianActive),
    [userId, setUserId] = useState(""),
    [name, setName] = useState(""),
    [specialty, setSpecialty] = useState(""),
    [timezone, setTimezone] = useState("Africa/Kigali"),
    f = useFeedback();
  return (
    <>
      <Section title="Clinicians">
        <Note>
          Enable verified clinician accounts here, then assign their patients.
          Disabling a clinician immediately removes their care workspace and
          call access.
        </Note>
        <Feedback message={f.message} />
        {rows?.length ? (
          rows.map((c) => (
            <View key={c.id} style={{ gap: 10, paddingVertical: 12 }}>
              <T size={20} weight="semibold">
                {c.name}
              </T>
              <Note>
                {c.specialty} · {c.timezone}
              </Note>
              <Status label={c.active ? "active" : "disabled"} />
              <Button
                small
                secondary
                label={c.active ? `Disable ${c.name}` : `Enable ${c.name}`}
                loading={f.busy}
                onPress={() =>
                  void f.run(
                    () => toggle({ id: c.id, active: !c.active }),
                    "Clinician access updated.",
                  )
                }
              />
            </View>
          ))
        ) : (
          <Note>
            No clinicians configured. Add a clinician after they sign up to
            Neem.
          </Note>
        )}
      </Section>
      <Section title="Enable or update a clinician">
        <T size={14}>Select their registered Neem account</T>
        <Choices
          value={userId}
          onChange={(id) => {
            setUserId(id);
            setName(accounts.results.find((a) => a.id === id)?.name ?? "");
          }}
          options={accounts.results
            .filter((a) => !a.disabled)
            .map((a) => ({
              id: a.id,
              label: a.email
                ? `${a.name} · ${a.email}`
                : `${a.name} · ${a.id.slice(-8)}`,
            }))}
        />
        <More status={accounts.status} loadMore={accounts.loadMore} />
        <Note>
          Check the person’s identity and credentials before enabling clinical
          access. If names repeat, verify the account ID with the sign-in
          administrator.
        </Note>
        <Input
          label="Clinician display name"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Specialty"
          value={specialty}
          onChangeText={setSpecialty}
        />
        <Input label="Timezone" value={timezone} onChangeText={setTimezone} />
        <Button
          label="Enable clinician account"
          disabled={!userId}
          loading={f.busy}
          onPress={() =>
            void f.run(
              () =>
                save({
                  userId: userId as Id<"users">,
                  name,
                  specialty,
                  timezone,
                  active: true,
                }),
              "Clinician account saved.",
            )
          }
        />
      </Section>
    </>
  );
}
function Insoles() {
  const rows = usePaginatedQuery(
      api.careInsoles.list,
      {},
      { initialNumItems: 20 },
    ),
    register = useMutation(api.careInsoles.register),
    retire = useMutation(api.careInsoles.retire),
    [name, setName] = useState("neem"),
    [hardwareId, setHardware] = useState(""),
    f = useFeedback();
  return (
    <>
      <Section title="Register an insole">
        <Note>
          Enter the exact device identifier from the insole. Assign it from the
          patient’s record. Registration does not start or simulate a Bluetooth
          connection.
        </Note>
        <Input
          label="Insole name"
          value={name}
          onChangeText={setName}
          maxLength={100}
        />
        <Input
          label="Hardware ID / serial"
          value={hardwareId}
          onChangeText={setHardware}
          maxLength={150}
        />
        <Feedback message={f.message} />
        <Button
          label="Register insole"
          loading={f.busy}
          onPress={() =>
            void f.run(async () => {
              await register({ name, hardwareId });
              setHardware("");
            }, "Insole registered.")
          }
        />
      </Section>
      <Section title="Insole registry">
        {rows.status === "LoadingFirstPage" ? (
          <Loading />
        ) : !rows.results.length ? (
          <Note>No insoles registered.</Note>
        ) : (
          rows.results.map((r) => (
            <View key={r.id} style={{ gap: 10, paddingVertical: 14 }}>
              <T size={20} weight="semibold">
                {r.name}
              </T>
              <Note>{r.hardwareId}</Note>
              <Status label={r.state} />
              <T size={14}>{r.patient ?? "No patient assigned"}</T>
              <Button
                small
                secondary
                label={
                  r.state === "retired" ? "Reactivate insole" : "Retire insole"
                }
                loading={f.busy}
                onPress={() =>
                  void f.run(
                    () => retire({ id: r.id, retired: r.state !== "retired" }),
                    "Insole status updated.",
                  )
                }
              />
            </View>
          ))
        )}
        <More status={rows.status} loadMore={rows.loadMore} />
      </Section>
    </>
  );
}
function AssignInsole({ profileId }: { profileId: Id<"profiles"> }) {
  const rows = usePaginatedQuery(
      api.careInsoles.list,
      {},
      { initialNumItems: 20 },
    ),
    [selected, setSelected] = useState(""),
    assign = useMutation(api.careInsoles.assign),
    f = useFeedback();
  return (
    <View style={{ gap: 12 }}>
      <Note>
        Choose an available registered insole. Existing patient history stays
        bound to its original profile.
      </Note>
      <Choices
        value={selected}
        onChange={setSelected}
        options={rows.results
          .filter((r) => r.state === "available")
          .map((r) => ({ id: r.id, label: `${r.name} · ${r.hardwareId}` }))}
      />
      <More status={rows.status} loadMore={rows.loadMore} />
      <Feedback message={f.message} />
      <Button
        small
        secondary
        label="Assign insole to patient"
        disabled={!selected}
        loading={f.busy}
        onPress={() =>
          void f.run(async () => {
            await assign({ id: selected as Id<"insoleRegistry">, profileId });
            setSelected("");
          }, "Insole assigned.")
        }
      />
    </View>
  );
}
function ActivityLog() {
  const rows = usePaginatedQuery(
    api.care.activity,
    {},
    { initialNumItems: 20 },
  );
  return (
    <Section title="Activity history">
      <Note>
        Changes to assignments, appointments, medical records, devices, billing,
        and account access are recorded here. Clinical note content is kept out
        of this log.
      </Note>
      {rows.results.map((r) => (
        <View key={r.id} style={{ gap: 5, paddingVertical: 12 }}>
          <T size={16} weight="semibold">
            {r.action.replaceAll(".", " · ").replaceAll("_", " ")}
          </T>
          <Note>
            {r.actor} · {dateTime(r.at)}
          </Note>
          <T size={11}>Record {r.entityId.slice(-8).toUpperCase()}</T>
        </View>
      ))}
      {!rows.results.length && <Note>No care team changes recorded.</Note>}
      <More status={rows.status} loadMore={rows.loadMore} />
    </Section>
  );
}
function AlertQueue({
  onPatient,
}: {
  onPatient: (id: Id<"profiles">) => void;
}) {
  const rows = usePaginatedQuery(
    api.care.alertQueue,
    {},
    { initialNumItems: 20 },
  );
  return (
    <Section title="Open device alerts">
      <Note>
        Saved alerts that still need clinical review. No alerts are generated
        from the animation.
      </Note>
      {rows.results.map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          accessibilityLabel={`Review alert for ${a.patient}`}
          onPress={() => onPatient(a.profileId)}
          style={{ gap: 8, paddingVertical: 12 }}
        >
          <T size={17} weight="semibold">
            {a.patient}
          </T>
          <Status label={a.level} />
          <T size={14}>{a.reason}</T>
          <Note>{dateTime(a.at)}</Note>
        </Pressable>
      ))}
      {!rows.results.length && <Note>No open device alerts recorded.</Note>}
      <More status={rows.status} loadMore={rows.loadMore} />
    </Section>
  );
}

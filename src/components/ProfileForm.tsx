import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import { router } from "expo-router";
import { ProfileDetails, bmi } from "../domain";
import { countries, sexOptions, validateProfileDetails } from "../profile";
import { Button, Card, IconButton, Input, Sheet, T, useTheme } from "./ui";
import { EntryFrame } from "./EntryFrame";
import { AuthField } from "./AuthField";
export function DatePicker({
  value,
  onSelect,
  onClose,
}: {
  value?: string;
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  const c = useTheme(),
    seed = value ? new Date(`${value}T12:00:00`) : new Date(1995, 0, 1),
    now = new Date();
  const [year, setYear] = useState(seed.getFullYear()),
    [month, setMonth] = useState(seed.getMonth()),
    [view, setView] = useState<"days" | "months" | "years">("days");
  const start = (new Date(year, month, 1).getDay() + 6) % 7,
    days = new Date(year, month + 1, 0).getDate();
  function move(delta: number) {
    const next = new Date(year, month + delta, 1);
    if (next.getFullYear() >= 1900 && next <= now) {
      setYear(next.getFullYear());
      setMonth(next.getMonth());
    }
  }
  return (
    <Sheet title="Date of birth" onClose={onClose}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton
          icon={ChevronLeft}
          label="Previous month"
          onPress={() => move(-1)}
          style={{ backgroundColor: c.bg }}
        />
        <View style={{ flexDirection: "row", gap: 9 }}>
          <Button
            secondary
            small
            label={new Date(year, month).toLocaleDateString(undefined, {
              month: "long",
            })}
            onPress={() => setView("months")}
          />
          <Button
            secondary
            small
            label={String(year)}
            onPress={() => setView("years")}
          />
        </View>
        <IconButton
          icon={ChevronRight}
          label="Next month"
          onPress={() => move(1)}
          style={{ backgroundColor: c.bg }}
        />
      </View>
      {view === "years" ? (
        <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Array.from(
              { length: now.getFullYear() - 1899 },
              (_, i) => now.getFullYear() - i,
            ).map((y) => (
              <Pressable
                key={y}
                accessibilityRole="button"
                onPress={() => {
                  setYear(y);
                  setView("months");
                }}
                style={{
                  width: "22%",
                  paddingVertical: 12,
                  borderRadius: 22,
                  alignItems: "center",
                  backgroundColor: y === year ? c.bluePale : c.subtle,
                }}
              >
                <T>{y}</T>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : view === "months" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Array.from({ length: 12 }, (_, i) => i).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              onPress={() => {
                setMonth(m);
                setView("days");
              }}
              style={{
                width: "30%",
                paddingVertical: 16,
                borderRadius: 22,
                alignItems: "center",
                backgroundColor: m === month ? c.bluePale : c.subtle,
              }}
            >
              <T>
                {new Date(year, m).toLocaleDateString(undefined, {
                  month: "short",
                })}
              </T>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row" }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <T
                key={i}
                size={12}
                color={c.muted}
                style={{ width: `${100 / 7}%`, textAlign: "center" }}
              >
                {d}
              </T>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: start + days }, (_, i) => {
              const d = i - start + 1,
                iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                disabled = d < 1 || new Date(year, month, d) > now;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={d > 0 ? `Choose ${iso}` : undefined}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                  style={{
                    width: `${100 / 7}%`,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 24,
                    backgroundColor: value === iso ? c.blue : "transparent",
                    opacity: disabled ? 0.25 : 1,
                  }}
                >
                  <T color={value === iso ? "#FFFFFF" : c.text}>
                    {d > 0 ? d : ""}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Button
        label="Skip date of birth"
        secondary
        onPress={() => {
          onSelect("");
          onClose();
        }}
      />
    </Sheet>
  );
}
function SelectField({
  label,
  value,
  placeholder,
  onPress,
  icon = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  icon?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <T size={15}>{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          minHeight: 56,
          borderRadius: 32,
          paddingHorizontal: 19,
          paddingVertical: 14,
          backgroundColor: c.card,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <T size={16} color={value ? c.text : c.muted} style={{ flex: 1 }}>
          {value || placeholder}
        </T>
        {icon ? (
          <CalendarDays size={20} color={c.text} strokeWidth={1.4} />
        ) : (
          <ChevronDown size={18} color={c.text} strokeWidth={1.4} />
        )}
      </Pressable>
    </View>
  );
}
export function ProfileForm({
  initial,
  mode = "onboarding",
  onSave,
  onDone,
  onBack,
}: {
  initial: ProfileDetails;
  mode?: "onboarding" | "personal" | "health";
  onSave: (details: ProfileDetails, complete: boolean) => Promise<boolean>;
  onDone: () => void;
  onBack?: () => void;
}) {
  const c = useTheme(),
    [step, setStep] = useState(mode === "health" ? 1 : 0),
    [details, setDetails] = useState(initial),
    [height, setHeight] = useState(initial.heightCm?.toString() || ""),
    [weight, setWeight] = useState(initial.weightKg?.toString() || ""),
    [picker, setPicker] = useState<"date" | "sex" | "country">(),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = <K extends keyof ProfileDetails>(
    key: K,
    value: ProfileDetails[K],
  ) => setDetails((d) => ({ ...d, [key]: value }));
  const prepared = (): ProfileDetails => {
    const d = { ...details };
    for (const key of ["birthDate", "assignedSex", "country"] as const)
      if (!d[key]) delete d[key];
    delete d.heightCm;
    delete d.weightKg;
    if (height.trim()) d.heightCm = Number(height);
    if (weight.trim()) d.weightKg = Number(weight);
    return d;
  };
  async function save(skipHealth = false) {
    const d = prepared();
    if (skipHealth) {
      delete d.heightCm;
      delete d.weightKg;
    }
    const validation = validateProfileDetails(d);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    const ok = await onSave(d, mode === "onboarding");
    setBusy(false);
    if (ok) onDone();
    else setError("Your profile couldn’t be saved. Please try again.");
  }
  function next() {
    const validation = validateProfileDetails({
      ...details,
      heightCm: undefined,
      weightKg: undefined,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (mode === "personal") void save();
    else setStep(1);
  }
  const country = countries.find((item) => item.code === details.country)?.name,
    assigned = sexOptions.find(
      (item) => item.value === details.assignedSex,
    )?.label;
  return (
    <EntryFrame
      close={mode !== "onboarding"}
      footer={
        <View style={{ gap: 6 }}>
          <Button
            label={
              step === 0 && mode === "onboarding"
                ? "Continue"
                : mode === "onboarding"
                  ? "Finish setup"
                  : "Save changes"
            }
            loading={busy}
            textSize={16}
            textWeight="medium"
            onPress={() => (step === 0 ? next() : save())}
            style={{
              backgroundColor: c.blue,
              minHeight: 56,
              borderWidth: 4,
              borderColor: c.card,
            }}
          />
          {mode === "onboarding" && step === 1 && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => save(true)}
              style={{ padding: 9 }}
            >
              <T size={13} color={c.muted} style={{ textAlign: "center" }}>
                Skip height and weight
              </T>
            </Pressable>
          )}
        </View>
      }
      onBack={() => {
        if (step === 1 && mode === "onboarding") {
          setStep(0);
          setError("");
        } else if (onBack) onBack();
        else router.replace(mode === "onboarding" ? "/welcome" : "/account");
      }}
    >
      <View style={{ flex: 1, gap: 23 }}>
        {mode === "onboarding" && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 3 }}>
            {[0, 1].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 6,
                  backgroundColor: i <= step ? c.blue : c.card,
                }}
              />
            ))}
            <T size={11} color={c.muted}>
              {step + 1} of 2
            </T>
          </View>
        )}
        <View style={{ gap: 9, marginBottom: 7 }}>
          <T
            size={32}
            weight="medium"
            style={{ letterSpacing: -1, lineHeight: 38 }}
          >
            {step === 0
              ? mode === "personal"
                ? "A little about you."
                : "Let’s set up\nyour profile."
              : mode === "health"
                ? "Your health information."
                : `Nice to meet you,\n${details.firstName.trim() || "there"}.`}
          </T>
          <T size={15} color={c.muted}>
            {step === 0
              ? "What should we call you?"
              : "A little more information to complete your profile."}
          </T>
        </View>
        {step === 0 ? (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AuthField
                label="First name"
                value={details.firstName}
                onChangeText={(v) => set("firstName", v)}
                placeholder="First name"
              />
              <AuthField
                label="Last name"
                value={details.lastName}
                onChangeText={(v) => set("lastName", v)}
                placeholder="Last name"
              />
            </View>
            <SelectField
              label="Date of birth"
              value={
                details.birthDate
                  ? new Date(
                      `${details.birthDate}T12:00:00`,
                    ).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : undefined
              }
              placeholder="Choose a date"
              onPress={() => setPicker("date")}
              icon
            />
            <SelectField
              label="Assigned sex"
              value={assigned}
              placeholder="Choose from list"
              onPress={() => setPicker("sex")}
            />
            <SelectField
              label="Country of residence"
              value={country}
              placeholder="Choose your country or region"
              onPress={() => {
                setQuery("");
                setPicker("country");
              }}
            />
            <T size={12} color={c.muted}>
              Date of birth, assigned sex and country are optional. You can
              update them in your account.
            </T>
          </>
        ) : (
          <>
            <Card style={{ padding: 20, gap: 20 }}>
              <Input
                label="Height (cm)"
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                placeholder="Your height in cm"
              />
              <Input
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="Your weight in kg"
              />
            </Card>
            <T size={13} color={c.muted}>
              Height and weight help calculate BMI. These details are optional
              and you can change them anytime.
            </T>
            {Number(height) >= 50 && Number(weight) >= 10 && (
              <Card
                style={{
                  backgroundColor: c.mint,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <T size={17}>Body mass index</T>
                  <T size={11} color={c.muted}>
                    One part of your health picture
                  </T>
                </View>
                <T size={32} weight="medium">
                  {bmi(Number(weight), Number(height))}
                </T>
              </Card>
            )}
          </>
        )}
        {!!error && (
          <T size={13} color={c.danger} accessibilityRole="alert">
            {error}
          </T>
        )}
        {picker === "date" && (
          <DatePicker
            value={details.birthDate}
            onSelect={(value) => set("birthDate", value)}
            onClose={() => setPicker(undefined)}
          />
        )}
        {picker === "sex" && (
          <Sheet title="Assigned sex" onClose={() => setPicker(undefined)}>
            <T size={13} color={c.muted}>
              Choose the option that best matches your records, or skip.
            </T>
            {sexOptions.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={details.assignedSex === option.value}
                onPress={() => set("assignedSex", option.value)}
                style={{
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                }}
              >
                <View
                  style={{
                    width: 23,
                    height: 23,
                    borderWidth: 1,
                    borderColor: c.text,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {details.assignedSex === option.value && (
                    <View
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 8,
                        backgroundColor: c.blue,
                      }}
                    />
                  )}
                </View>
                <T size={17}>{option.label}</T>
              </Pressable>
            ))}
            <Button
              label="Save selection"
              onPress={() => setPicker(undefined)}
              style={{ backgroundColor: c.blue }}
            />
            <Button
              label="Skip this question"
              secondary
              onPress={() => {
                set("assignedSex", undefined);
                setPicker(undefined);
              }}
            />
          </Sheet>
        )}
        {picker === "country" && (
          <Sheet
            title="Country of residence"
            onClose={() => setPicker(undefined)}
          >
            <Input
              label="Search country or region"
              value={query}
              onChangeText={setQuery}
              placeholder="Search your country"
            />
            <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>
              {countries
                .filter((item) =>
                  `${item.name} ${item.code}`
                    .toLowerCase()
                    .includes(query.trim().toLowerCase()),
                )
                .map((item) => (
                  <Pressable
                    key={item.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${item.name}`}
                    onPress={() => {
                      set("country", item.code);
                      setPicker(undefined);
                    }}
                    style={{
                      paddingVertical: 15,
                      borderBottomWidth: 1,
                      borderColor: c.line,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <T size={15} style={{ flex: 1 }}>
                      {item.name}
                    </T>
                    {details.country === item.code && (
                      <Check size={18} color={c.blue} />
                    )}
                  </Pressable>
                ))}
            </ScrollView>
            <Button
              label="Skip country"
              secondary
              onPress={() => {
                set("country", undefined);
                setPicker(undefined);
              }}
            />
          </Sheet>
        )}
      </View>
    </EntryFrame>
  );
}

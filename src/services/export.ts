import { Platform, Share } from "react-native";
import { Profile, Reading, bmi } from "../domain";
export async function exportRecords(profile: Profile, records: Reading[]) {
  const quote = (v: unknown) => {
    let value = String(v ?? "");
    if (typeof v === "string" && /^[=+@\-\t\r]/.test(value))
      value = `'${value}`;
    return `"${value.replace(/"/g, '""')}"`;
  };
  const content = [
    [
      "mode",
      "profile",
      "measurement",
      "value",
      "unit",
      "diastolic_mmHg",
      "height_cm",
      "calculated_bmi",
      "measured_at",
      "context",
      "source",
    ]
      .map(quote)
      .join(","),
    ...records.map((r) =>
      [
        "Recorded data",
        profile.name,
        r.kind,
        r.value,
        r.kind === "glucose"
          ? "mg/dL"
          : r.kind === "pressure"
            ? "mmHg"
            : r.kind === "bmi"
              ? "kg"
              : "°C",
        r.secondary,
        r.height,
        r.kind === "bmi" ? bmi(r.value, r.height!) : "",
        r.at,
        r.context,
        r.source,
      ]
        .map(quote)
        .join(","),
    ),
  ].join("\n");
  const filename = "neem-health-summary.csv";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const { File, Paths } = await import("expo-file-system");
    const Sharing = await import("expo-sharing");
    const file = new File(Paths.cache, filename);
    file.write(content);
    try {
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
        });
      else await Share.share({ message: content });
    } finally {
      if (file.exists) file.delete();
    }
  }
}

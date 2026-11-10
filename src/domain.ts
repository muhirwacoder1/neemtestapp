export type Metric = "glucose" | "pressure" | "bmi" | "temperature";
export type Reading = {
  id: string;
  kind: Metric;
  value: number;
  secondary?: number;
  height?: number;
  at: string;
  context: string;
  source: "manual" | "device";
};
export type CareTask = {
  id: string;
  title: string;
  dueAt: string;
  completedAt?: string;
  reminderId?: string;
};
export type Profile = {
  id: string;
  name: string;
  email?: string;
  birthDate?: string;
  details?: ProfileDetails;
  onboardedAt?: number;
  role?: "owner" | "editor" | "viewer";
};
export type ProfileDetails = {
  firstName: string;
  lastName: string;
  birthDate?: string;
  assignedSex?: "male" | "female" | "intersex" | "prefer_not_to_say";
  country?: string;
  heightCm?: number;
  weightKg?: number;
};
export type Article = {
  id: string;
  title: string;
  category: string;
  minutes: number;
  image: string;
  intro: string;
  sections: { title: string; text: string }[];
  source: string;
  sourceLabel: string;
  sourceDate: string;
};
export type Preferences = {
  appearance: "light" | "dark" | "system";
  reminders: boolean;
  glucoseUnit: "mg/dL" | "mmol/L";
  temperatureUnit: "°C" | "°F";
  aiConsent: boolean;
  aiConsentProvider?: "openrouter";
};
export const hasOpenRouterConsent = (
  preferences?: Pick<Preferences, "aiConsent" | "aiConsentProvider">,
) =>
  preferences?.aiConsent === true &&
  preferences.aiConsentProvider === "openrouter";
export type ProfileData = {
  readings: Reading[];
  tasks: CareTask[];
  bookmarks: string[];
  readProgress: Record<string, boolean>;
  preferences: Preferences;
};
export const defaults: Preferences = {
  appearance: "light",
  reminders: false,
  glucoseUnit: "mg/dL",
  temperatureUnit: "°C",
  aiConsent: false,
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const isToday = (value: string) => dayKey(new Date(value)) === dayKey();
export const bmi = (weight: number, height: number) =>
  Math.round((weight / (height / 100) ** 2) * 10) / 10;
export function validateReading(
  kind: Metric,
  values: {
    value: string;
    secondary: string;
    height: string;
    date: string;
    time: string;
  },
) {
  const value = Number(values.value),
    secondary = Number(values.secondary),
    height = Number(values.height);
  const at = new Date(`${values.date}T${values.time}`);
  if (!values.value.trim() || !Number.isFinite(value))
    return "Enter a measurement using numbers.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.date) ||
    !/^\d{2}:\d{2}$/.test(values.time) ||
    !Number.isFinite(at.getTime()) ||
    dayKey(at) !== values.date
  )
    return "Enter a valid date and time.";
  if (at.getTime() > Date.now() + 60_000)
    return "Measurements cannot be dated in the future.";
  if (kind === "glucose" && (value <= 0 || value > 1500))
    return "Check the reading. Enter glucose in mg/dL, between 1 and 1500.";
  if (
    kind === "pressure" &&
    (!values.secondary.trim() ||
      value < 30 ||
      value > 300 ||
      secondary < 10 ||
      secondary > 200 ||
      value <= secondary)
  )
    return "Check both values. Systolic should be greater than diastolic.";
  if (
    kind === "bmi" &&
    (value < 10 ||
      value > 500 ||
      !values.height.trim() ||
      height < 50 ||
      height > 250)
  )
    return "Enter weight in kg (10–500) and height in cm (50–250).";
  if (kind === "temperature" && (value < 15 || value > 45))
    return "Check the temperature. Enter a value between 15 and 45 °C.";
  return null;
}
export function emptyData(): ProfileData {
  return {
    readings: [],
    tasks: [],
    bookmarks: [],
    readProgress: {},
    preferences: { ...defaults },
  };
}
export const metricInfo = {
  glucose: {
    label: "Blood glucose",
    unit: "mg/dL",
    color: "#925BCC",
    pale: "#F3EBFB",
    description:
      "From a glucose meter or a supported health service. Add the reading context to make your history more useful.",
  },
  pressure: {
    label: "Blood pressure",
    unit: "mmHg",
    color: "#E07B67",
    pale: "#FDF0EC",
    description:
      "Record both the systolic (top) and diastolic (bottom) numbers from your blood pressure monitor.",
  },
  bmi: {
    label: "Body measurements",
    unit: "BMI",
    color: "#4285C5",
    pale: "#ECF4FC",
    description:
      "BMI is calculated from weight and height. It is one part of your health picture, not a diagnosis. Interpretation for children requires age and sex specific guidance.",
  },
  temperature: {
    label: "Foot temperature",
    unit: "°C",
    color: "#299D94",
    pale: "#E9F7F4",
    description:
      "Plantar temperature is available only from a compatible, validated temperature sensor. Manual entries are kept separately from device readings.",
  },
} as const;
export function displayReading(
  reading: Reading | undefined,
  preferences: Preferences,
) {
  if (!reading) return { value: "—", unit: "", caption: "No readings yet" };
  const info = metricInfo[reading.kind];
  const value =
    reading.kind === "pressure"
      ? `${reading.value}/${reading.secondary}`
      : reading.kind === "bmi"
        ? bmi(reading.value, reading.height!)
        : reading.kind === "glucose" && preferences.glucoseUnit === "mmol/L"
          ? (reading.value / 18.0182).toFixed(1)
          : reading.kind === "temperature" &&
              preferences.temperatureUnit === "°F"
            ? (reading.value * 1.8 + 32).toFixed(1)
            : reading.value;
  return {
    value: String(value),
    unit:
      reading.kind === "glucose"
        ? preferences.glucoseUnit
        : reading.kind === "temperature"
          ? preferences.temperatureUnit
          : info.unit,
    caption: reading.context,
  };
}
export function filterReadings(
  readings: Reading[],
  kind: Metric,
  period: string,
  custom?: { start: string; end: string },
) {
  const now = new Date(),
    start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "Custom" && custom) {
    const from = new Date(`${custom.start}T00:00:00`),
      to = new Date(`${custom.end}T23:59:59.999`);
    return readings
      .filter(
        (r) =>
          r.kind === kind && new Date(r.at) >= from && new Date(r.at) <= to,
      )
      .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }
  start.setDate(
    start.getDate() - (period === "Today" ? 0 : Number.parseInt(period) - 1),
  );
  return readings
    .filter(
      (r) =>
        r.kind === kind && new Date(r.at) >= start && new Date(r.at) <= now,
    )
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));
}
const photos = {
  walking:
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=85",
  food: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=85",
  nature:
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85",
  wellness:
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=85",
};
export { photos };
export const articles: Article[] = [
  {
    id: "daily-care",
    title: "Small habits. Healthier feet.",
    category: "Foot care",
    minutes: 4,
    image: photos.walking,
    intro:
      "A moment of attention can make a difference. Build a foot check into a part of your day that already feels familiar.",
    sections: [
      {
        title: "A moment to look",
        text: "Look over both feet and the soles for cuts, blisters, redness, swelling or other changes. Use a mirror or ask someone you trust if the soles are difficult to see.",
      },
      {
        title: "Comfort comes first",
        text: "Wear socks and shoes that fit comfortably. Before putting shoes on, check inside for stones, rough seams or other objects.",
      },
      {
        title: "When something changes",
        text: "A new sore, blister, color change, loss of feeling or unusual warmth deserves prompt attention from your healthcare professional. A pressure map cannot tell whether you have an ulcer.",
      },
    ],
    source:
      "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html",
    sourceLabel: "CDC · Your Feet and Diabetes",
    sourceDate: "May 15, 2024",
  },
  {
    id: "balanced-plate",
    title: "A balanced plate, close to home",
    category: "Nutrition",
    minutes: 5,
    image: photos.food,
    intro:
      "Good food can be familiar, affordable and full of variety. Start with the foods you enjoy and build a balanced meal around them.",
    sections: [
      {
        title: "Think in food groups",
        text: "The plate method brings together nonstarchy vegetables, protein and carbohydrate foods. Aim for variety and discuss portions with your care team.",
      },
      {
        title: "Make it local",
        text: "Try a plate with dodo or cabbage, beans or eggs, and a portion of sweet potato or rice. Beans contain both carbohydrate and protein. Adapt portions and ingredients to your individual care plan.",
      },
      {
        title: "Plan for your day",
        text: "A flexible plan can fit your tastes, access to food and medicines. Ask a dietitian or care team for individual guidance rather than cutting out whole food groups.",
      },
    ],
    source:
      "https://www.cdc.gov/diabetes/healthy-eating/diabetes-meal-planning.html",
    sourceLabel: "CDC · Diabetes Meal Planning",
    sourceDate: "May 15, 2024",
  },
  {
    id: "pressure",
    title: "Get to know your pressure map",
    category: "Foot pressure",
    minutes: 3,
    image: photos.nature,
    intro:
      "Your pressure map shows how supported sensors respond under different parts of your feet.",
    sections: [
      {
        title: "Read the colors",
        text: "Cooler colors represent lower readings; warmer colors represent higher readings in the same calibrated scale. Uncovered areas have no measurement. Relative values are not units of force.",
      },
      {
        title: "Look for a pattern",
        text: "Compare readings from similar activities over time. Footwear, movement and sensor placement affect pressure. A single map cannot diagnose a condition.",
      },
      {
        title: "Bring questions",
        text: "If you notice changes, ask your care team what they mean for your circumstances. Continue daily visual foot checks even when no alert appears.",
      },
    ],
    source:
      "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html",
    sourceLabel: "Neem editorial · foot-check guidance from CDC",
    sourceDate: "October 21, 2026",
  },
  {
    id: "glucose",
    title: "Your readings tell a story",
    category: "Blood glucose",
    minutes: 4,
    image: photos.wellness,
    intro:
      "A useful glucose record includes a little context, not just a number.",
    sections: [
      {
        title: "Capture the moment",
        text: "Record the reading, date, time and whether you checked before or after a meal. Note anything you want to discuss at your next appointment.",
      },
      {
        title: "Your targets are personal",
        text: "Your care team can help set individual goals. A chart helps you review your records but cannot decide on treatment or changes to medication.",
      },
    ],
    source:
      "https://www.niddk.nih.gov/health-information/diabetes/overview/managing-diabetes",
    sourceLabel: "NIDDK · Managing Diabetes",
    sourceDate: "Source accessed October 21, 2026",
  },
  {
    id: "mobility",
    title: "Find a little movement you enjoy",
    category: "Mobility",
    minutes: 3,
    image: photos.walking,
    intro:
      "Movement can be a pleasant part of your routine. Choose activities that feel accessible to you.",
    sections: [
      {
        title: "Start with a conversation",
        text: "Ask your healthcare professional which activities suit your feet and overall health, particularly if you have loss of feeling, a wound or pain.",
      },
      {
        title: "Make space for comfort",
        text: "Comfortable shoes, socks and a foot check before and after activity can help you notice changes. Stop and contact your care team if you notice a new concern.",
      },
    ],
    source:
      "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html",
    sourceLabel: "CDC · Your Feet and Diabetes",
    sourceDate: "May 15, 2024",
  },
];

// Neem educational content. Shared by the Learn page and Neem AI grounding.
export type Article = { id: string; cat: string; title: string; min: number; by: string; hue: number; body: string[] };

export const ARTICLES: Article[] = [
  { id: "a1", cat: "Foot care", title: "A 2-minute daily foot check", min: 3, by: "Reviewed by a podiatry nurse", hue: 220,
    body: ["Sit somewhere bright. Look at the top, sole and between each toe — use a mirror if needed.", "Look for cuts, blisters, redness, swelling, or colour changes.", "If you find a wound or new redness that doesn't settle, contact your care team the same day."] },
  { id: "a2", cat: "Pressure", title: "What your pressure map is telling you", min: 4, by: "Neem clinical team", hue: 200,
    body: ["Warmer colours show areas carrying more load relative to the rest of your foot.", "Sustained high pressure in one spot can raise the risk of skin damage over time.", "Pressure maps support — but never replace — a professional foot examination."] },
  { id: "a3", cat: "Glucose", title: "Fasting vs after-meal readings", min: 5, by: "Reviewed by a diabetes educator", hue: 250,
    body: ["Recording the context of each reading helps you and your clinician see patterns.", "Your personal target range should be set together with your care team."] },
  { id: "a4", cat: "Warning signs", title: "When to call your care team", min: 2, by: "Reviewed by a GP", hue: 15,
    body: ["Any open wound, new swelling, warmth, colour change or pain in the foot.", "Fever with a foot wound needs urgent medical attention."] },
  { id: "a5", cat: "Nutrition", title: "Building a balanced plate with local foods", min: 6, by: "Reviewed by a dietitian", hue: 140,
    body: ["Half the plate: vegetables like isombe, dodo (amaranth), cabbage or carrots.", "A quarter: protein — beans, fish (sambaza, tilapia), eggs or chicken.", "A quarter: starch — sweet potato, matoke, brown rice or ugali. Portion size matters more than cutting foods out.", "Pair fruit like avocado or passion fruit with meals rather than juice."] },
  { id: "a6", cat: "Blood pressure", title: "Taking an accurate blood pressure reading", min: 3, by: "Reviewed by a cardiac nurse", hue: 0,
    body: ["Rest 5 minutes, feet flat, arm supported at heart level.", "Take two readings a minute apart and record both."] },
];


export const MEALS = [
  { m: "Breakfast", f: "Sorghum porridge (igikoma) with groundnuts, a banana" },
  { m: "Lunch", f: "Beans, sweet potato, dodo greens, avocado" },
  { m: "Dinner", f: "Grilled tilapia, isombe, small portion of brown rice" },
];


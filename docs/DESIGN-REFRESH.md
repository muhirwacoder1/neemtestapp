# Neem visual refresh — 22 October 2026

The supplied health dashboard image guides the visual language: a pale gray-blue canvas, powder-blue glucose card, lavender/mint/peach overview cards, white surfaces with generous radii, rounded Urbanist typography, black pill navigation and a separate blue add button. Neem keeps its own health metrics and care workflows.

Home leads with glucose and a three-card overview. Arrows rotate the large overview metric. Trends follow, with foot pressure animation, insole connection and daily care below. Reports includes a segmented arc showing the counts of recorded measurement types, patterned pillars and smooth line charts. The arc does not express clinical risk. The add button opens a chooser for all four supported measurement types.

Mono Charts reference: https://amicro.dev/mono-charts
Source: https://github.com/Subhan-code/Amicro--Micro-transitions-/tree/main/src/components/mono-charts

Amicro's web components use Recharts, DOM elements and Motion. Neem adapts their rounded SVG geometry to `react-native-svg`, retaining native Expo compatibility without a WebView or Recharts dependency. Patterned pillars follow the supplied image. The MIT notice is retained in `docs/licenses/amicro-MIT.txt`.

Charts use actual saved measurements, date order, recorded timestamps for line positions, and selected display units. Bar charts show the latest seven measurements with a zero baseline; they do not imply daily averages. Spline interpolation stays within neighboring values. Blood pressure keeps both systolic and diastolic values. Rendering is bounded for long histories. Arrow controls permit keyboard and screen-reader selection as well as tapping a point. Empty profiles show empty charts and never receive generated readings.

Four Urbanist weights are bundled locally. Shared cards, inputs, segments, buttons, sheets and light/dark palettes are used across Home, Reports, care tasks, Discover, Neem AI and account panels. Clerk, Convex, AI routing/consent, patient data, hardware protocol gates and pressure animation behavior are retained. AI activation remains deferred.

Verification results are recorded in `docs/VERIFICATION.md`. The successful Android APK linked in `docs/ANDROID-BUILD.md` predates this refresh. JavaScript exports do not prove an Android installation or replace a fresh EAS build.
# Supplied navigation icons — 22 October 2026

The original `home.svg`, `file.svg`, `cotton.svg` and `ai.svg` are preserved under `assets/navigation/`. `NavigationIcons.tsx` renders their original paths through the existing native SVG library, recolored for selected/unselected navigation states. They map to Home, Reports, Discover and Neem AI respectively in both the mobile bar and desktop sidebar. Your Care retains its calendar icon. No routes or tab labels changed. Lint, TypeScript and the web production export pass; the mobile bar was visually checked. This pass does not produce a new APK.


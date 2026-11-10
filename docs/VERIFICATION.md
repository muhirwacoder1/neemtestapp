# Neem verification — 21 October 2026

The Expo runtime now uses Clerk and Convex. This report replaces the earlier Supabase/sample-account verification.

## Verified

- TypeScript and Expo lint pass with no errors or warnings in the final run.
- 42 automated checks pass: 6 domain/bridge-contract tests, 7 private Convex tests, 11 routing/allowance/SDK/streaming tests and 18 tests downloaded from the owning Lovable project. Gateway tests mock provider calls and spend no inference credits.
- Convex functions, indexes and the Agent component deployed successfully to `standing-dog-57` in project `neem-mobile`.
- A cloud smoke test created a clearly isolated Integration verification identity with an empty owner profile. Anonymous profile access was refused. This CLI identity test does not prove a real Clerk user login.
- Clerk development application Neem was created. Convex integration is enabled, the native API is enabled and `neem://auth-callback` is registered. No secret Clerk key was read or copied into the app.
- Clerk sign-in and sign-up components load in the browser. Completing an owner login remains pending; the password entry was handed to the user.
- Expo Doctor passed 20/20 checks.
- Web export passes. Fresh iOS and Android JavaScript/Hermes exports passed after the final app UI changes and economical AI integration. These are not native compilation, signed APK/IPA files or device tests.
- Browser checks covered mobile home at 390×844 and desktop at 1440×900. The desktop insole-card image sizing was corrected and visually rechecked.
- All five main routes rendered. Appointment requests are accessible from Tasks. Signed-out records and tasks start empty, and AI presents a sign-in control.
- Pressure animation is continuous. Cropped screenshot comparisons confirmed identical frames while paused and different frames after resuming. Unknown live sensor coverage stays unmeasured.
- No error-level browser logs were reported in the final route check. The expected Clerk development-key warning is present.
- `git diff --check` passed.

## AI connection state

The owning Lovable project is accessible through the Ishimwe Chrome profile:

https://lovable.dev/projects/27ee230e-6680-445b-a9c0-3fdf53964e45

The revised protected gateway helper, four API routes, route tree and tests are implemented in Lovable and synchronized into the nested local source. Its 18 tests pass locally (one source-policy assertion is adapted to read the preserved web source without loading its Supabase dependencies into Expo's test runtime). It is unpublished and no bridge secret is saved. No live mobile AI response or real library ingestion has been verified.

Economical routing is implemented: Flash for everyday work, Sol for complex work, and a small structured Flash classifier for ambiguous longer tasks. Astra is rejected; Jev/Luna are not enabled. Both models' local function-tool loops were checked through the real SDK and the downloaded bridge using simulated provider responses. A scheduled Convex request also saved its streamed reply, cleared generating state, and retained the Flash/rules route metadata. These tests verify integration behavior, not the quality of real model answers or clinical safety.

The Neem project has a saved Lovable hard limit of **1 AI credit/month**, with Pause AI and an email alert, observed at **0.66/1 used**. Other projects are unaffected. The mobile backend also shares atomic conservative reservations across chat, routing, tool steps and embeddings. No purchase, plan upgrade or automatic top-up was enabled. Existing grant balances and pricing can change. See `AI-MODEL-PLAN.md` for exact behavior and billing limitations.

## Still required before patient release

- Activation of the protected AI bridge, live streaming/tool/citation tests, quality evaluation of routing/answers, AI retention settings and provider/privacy review.
- Owner sign-in, library administrator assignment and actual book ingestion. No local book files or old cloud corpus were migrated.
- Clerk and Convex production instances, production domains, native provider credentials, EAS environments and app signing.
- Actual firmware UUIDs, packet protocol, calibration and device authentication; physical Bluetooth and sensor validation. The adapter is gated until a verified protocol is supplied.
- Native notification delivery, app-store billing and receipt reconciliation on devices.
- Retention, deletion/export, recovery, monitoring, accessibility/device performance and clinical review of health content and any future risk rules.
- Dependency audit: the latest patch installation reports 22 high advisories; compatible remediation remains required before release. No forced SDK-breaking update was applied.

## Artifacts

- `screenshots/neem-home-mobile.png`
- `screenshots/neem-home-desktop.png`
- `screenshots/clerk-neem-integration.png`
- `screenshots/lovable-bridge-prepared.png`
- `screenshots/neem-ai-credit-cap.png`
- `screenshots/neem-ai-routing-prepared.png`

## Android cloud build — 22 October 2026

The original EAS preview build `cb02efcb-33c7-4acd-b5ca-ae2ce2f13fd4` stopped when its Gradle daemon disappeared during native compilation. The preview profile now disables parallel Gradle projects, caps workers at two and Node heap at 2 GB, and retains the worker's 4 GB Gradle heap. SDK 58 compatible patch updates were installed; TypeScript, lint, all 42 tests and 20/20 Expo Doctor checks pass. Android Hermes export also passed under the 2 GB Node cap.

The replacement EAS build `d356bc60-8422-49e3-9703-ba9309137335` completed **FINISHED**, with `BUILD SUCCESSFUL in 30m 23s`. This verifies actual Android native compilation and signed APK generation. The iOS binary, phone installation, interactive sign-in and physical sensors remain untested. AI remains disconnected. See `ANDROID-BUILD.md` for the artifact and details.

The finished APK was downloaded and inspected: `apksigner` verifies its v2 signature, `aapt` confirms package `health.neem.insole` and all four ABIs, and its Hermes bundle contains the expected Convex URL and Clerk publishable key. Size: 161,370,908 bytes. Device launch and sign-in have not been tested.

## Visual refresh — 22 October 2026

The supplied pastel health dashboard reference now informs Home, Reports, care tasks, Discover, Neem AI and shared account/measurement panels. See `DESIGN-REFRESH.md` for scope and chart semantics.

Verification completed:

- TypeScript and Expo lint pass; all 42 existing tests pass.
- Web production export passes. Android and iOS Hermes exports pass with a 2 GB Node heap and two workers. These are JavaScript/asset exports, not fresh installed native binaries.
- Browser checks of all five main routes at 390×844 and 1440×900 confirm loaded content and document width matching the viewport. Home also fits 320×740. Light and dark Home layouts were inspected.
- Browser font checks confirm loaded Urbanist Regular, Medium, Semibold and Bold. Only those four font weights are included in the exported assets.
- The blue add button opens the four-metric measurement chooser. Overview arrows rotate the large metric card. Education search narrows results. Pressure-animation pause/resume controls and the existing connection panel work. Selected navigation items are exposed to browser accessibility APIs.
- An isolated, temporary chart screen checked patterned bars, zero-based bar axes, rounded splines, two blood-pressure series, micro ticks and segmented arcs. Selecting the previous bar changed 114 / October 22 to 132 / October 21; tapping the first bar selected 108 / October 16. Invented check values were passed directly to chart components and never saved. The temporary route was removed before both shipping exports.
- Existing patient data, authentication/backend configuration and deferred AI activation were not changed. Physical device installation, Bluetooth, native screen-reader behavior and a fresh APK are not verified by this design pass. The previously successful APK predates the refresh.

Screenshots: `screenshots/neem-refresh-home-mobile.png`, `neem-refresh-home-desktop.png`, `neem-refresh-reports-mobile.png`, `neem-refresh-care-mobile.png`, `neem-refresh-discover-mobile.png`, `neem-refresh-ai-mobile.png`, corresponding desktop captures, `neem-refresh-dark-mobile.png`, and `neem-refresh-chart-check.png` (isolated invented chart values).

## Account and onboarding refresh — 22 October 2026

Welcome, custom Clerk sign-in/sign-up, account settings and two-step private profile setup now follow the user's light reference. See `ACCOUNT-ONBOARDING.md` for scope, screenshots and validation. The profile schema/mutation was deployed to the existing development backend. TypeScript, lint, 59 automated tests, 20/20 Expo Doctor checks, web export and Android/iOS Hermes exports pass in the final run. Real authentication roundtrips, photo upload, native permissions and a fresh APK/device launch remain unverified. No temporary QA route is included in the final exports.

## Walking pressure and connection simulation — 22 October 2026

The preview now blends fourteen anatomical lobes through the requested loading, stance and push-off colors, with separate hallux pressure, inward-facing big toes, swing unloading and static stage controls. A clearly labeled `neem` discovery/connection simulation is separate from actual Bluetooth and persistence. See `PRESSURE-SIMULATION.md` for the full scope and evidence. Lint, TypeScript, 61 tests, web export, both native Hermes exports and a Skia runtime-shader compiler check pass. Mobile UI checks verify all four requested stages, connecting/connected states, cancellation/replay and pause/resume. Physical-device rendering, hardware and a fresh APK remain unverified.

## Pressure-pattern report — 22 October 2026

The new Ulcer analytics section uses rounded paired peak/average bars and a computed normal-simulation summary: Low pressure alert level, no unusual pressure detected and zero persistent regions to review. Real insole assessment remains Not assessed. Phase-aware illustrative tests distinguish expected peaks from repeated off-phase loading and refuse normal results from missing/short/gapped history. Lint, TypeScript, all 66 tests, web export and both native Hermes exports pass. See `PRESSURE-REPORTS.md` for rules, source boundaries and visual checks; this is not clinically validated ulcer detection.

## Daily consultations — 22 October 2026

Added real clinician availability, transactional patient booking/rescheduling/cancellation, private call access, optional device-local reminders and a Daily Prebuilt consultation screen. Existing AI appointment requests remain separate. See `VIDEO-CONSULTATIONS.md`.

- Connected the user's existing Daily account to the **existing development Convex deployment**, with explicit approval. The API key was transferred without displaying it, saved server-side, and the restricted transfer file was removed. `DAILY_VIDEO_ENABLED=true`; app-level monthly reservations are capped at 9,000 participant-minutes.
- A real server-side Daily smoke check created a temporary private room, created a scoped token and deleted that room. Returned results were `roomCreated:true`, `tokenCreated:true`, `roomDeleted:true`. No patient identity, health records or media were involved. An API validation discrepancy was corrected: Daily accepts `enable_recording:false`; an empty array was rejected.
- All **78 automated tests** pass: 13 domain/gateway, 47 backend/model (including 12 consultation tests), and 18 legacy bridge tests. Coverage includes access isolation, booking conflicts, rescheduling/cancellation, join windows and consent, inactive clinicians, scoped tokens, provider failures, cancellation during room preparation, revoked editor access and conservative month-boundary usage reservations.
- Expo lint and TypeScript pass. Expo Doctor passes **20/20** checks. Web export and Android/iOS Hermes exports pass. Config introspection confirms camera/microphone descriptions on iOS and unblocked CAMERA/RECORD_AUDIO permissions on Android. The existing image-picker plugin's former `false` permission settings were updated so it does not block consultation permissions.
- Mobile browser verification confirms Appointments opens from Your care, the connected account no longer shows the inactive-service message, and Book a visit shows the honest no-clinician state. Screenshots: `screenshots/neem-video-appointments-mobile.png` and `screenshots/neem-video-booking-mobile.png`.
- No real clinicians or appointment records were invented or seeded. The user will provide clinician details. The clinician booking UI has not been exercised against a real clinician account. No live two-person media call, physical-device WebView behavior, fresh native APK/IPA compilation or patient consultation has been verified. A fresh EAS build and Android/iPhone call tests are still required before release.

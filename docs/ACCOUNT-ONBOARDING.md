# Account and onboarding — 22 October 2026

## Design and flow

The supplied light account reference informs the gray background, white pill inputs, blue buttons, Urbanist type, rounded cards and scalloped profile frame. The dark screenshots supply questions only; their dark form design was not copied.

The first-launch welcome screen follows splash/font loading and uses a cropped view of the user's supplied artwork. Its original mock connection badge is covered with neutral welcome copy. It never reports a real insole connection. Three welcome steps lead to sign-up, sign-in or browsing. Only the introductory-screen flag is saved locally.

Clerk powers the custom email/password forms, email verification, password recovery, Google and Apple entry points. The implementation uses the installed Core 3 APIs and the native experimental SSO helper, which activates completed sessions. Unhandled verification requirements fall back to Clerk's secure interface. Existing password and verification settings are preserved. Remember my email saves only the email address when selected; it never saves the password.

Onboarding has two steps:

1. First name, last name, date of birth, assigned sex and country/region. First name is required; the remaining fields are optional. Date selection uses a calendar sheet, sex uses a radio sheet and country/region is searchable.
2. Optional height in cm and weight in kg, with a numerical BMI preview when both are valid. No body-fat estimate or clinical category is inferred. Users can skip these values.

New profiles are prompted to finish setup after authentication. Account cards reopen personal and health details, display the real owner name/photo where available, and provide units, appearance, reminders, connected insoles and account-security controls. English is displayed without claiming unsupported translations. Photo selection uses the system image picker and uploads the selected image to Clerk after the user chooses it. Camera and microphone permissions are disabled in its config plugin.

## Private persistence

The backward-compatible Convex schema adds optional profile details and a completion timestamp. The owner-authorized `profiles.saveSetup` mutation validates inputs and saves atomically. Viewers and unrelated users cannot update these details. Completing setup creates no glucose readings, weight history or other measurements. Health drafts are held in memory, never in AsyncStorage. Signup names are held in memory until setup completes.

The updated Convex functions were pushed to the existing development deployment `standing-dog-57`. An anonymous profile query was refused. Production instances are not configured by this work.

## Verification

- TypeScript and Expo lint pass.
- 59 automated tests pass in the final run: 6 unit/contract checks, 35 backend/model checks and 18 preserved gateway checks. Profile tests cover private persistence, optional-field clearing, completion, invalid values and rejected viewer/cross-account writes. Provider calls in these tests are mocked.
- Expo Doctor passes 20/20 checks.
- Web production export and Android/iOS Hermes exports pass. The temporary isolated onboarding route was removed before the final exports.
- Mobile browser checks at 390×844 cover the welcome steps, sign-in/sign-up, account cards, units sheet, appearance switch, personal selection sheets, calendar selection and height/weight validation. The onboarding action footer stays visible. Sign-up also has no horizontal document overflow at 320×740 and 1440×900; fonts report loaded.
- The isolated onboarding screenshots use invented unsaved form values. No test patient data or accounts were created through the browser.
- Welcome progression reaches sign-up. Empty sign-in submission shows validation, and forgot-password navigation works without sending a reset.

## Not verified by these checks

No real account registration, password entry/reset, email-code roundtrip, Google/Apple roundtrip, profile-photo upload or native notification delivery was performed. These require interactive/device checks. Native exports are not signed application binaries or device launches. The previously successful APK predates both the dashboard refresh and this work. Build a fresh APK/development client to include the new image-picker module and current screens. No generated native folders were hand-edited.

## Screenshots

- `screenshots/neem-welcome-mobile.png`
- `screenshots/neem-auth-signin-mobile.png`
- `screenshots/neem-auth-signup-mobile.png`
- `screenshots/neem-auth-signup-desktop.png`
- `screenshots/neem-account-mobile.png`
- `screenshots/neem-onboarding-personal-mobile.png` (isolated unsaved test form)
- `screenshots/neem-onboarding-sex-mobile.png` (isolated unsaved test form)
- `screenshots/neem-onboarding-health-mobile.png` (isolated unsaved test form)

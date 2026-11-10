# Daily video consultations

Neem keeps Expo 58 and uses Daily Prebuilt for the call screen: an embedded frame on web and a bundled Daily JavaScript SDK inside an Expo-compatible native WebView. Daily’s current native Expo config plugin declares `expo >=55 <58`; it has not been installed or forced into this project. The browser SDK is pinned to 0.94.0 and WebView to Expo’s compatible 14.0.1.

## Patient flow

Open **Your care → Appointments**, or **Account → Appointments**. Sign in, choose a real clinician and one of their published slots, review the optional note and confirm. Booking and rescheduling are transactional; conflicts across the booker and the patient profile are rejected. An assigned clinician or the person who booked can cancel. Legacy Neem AI clinic requests remain distinct and still need clinic confirmation.

A consultation can be joined from five minutes before the start until ten minutes after the scheduled end. The joining screen explains Daily’s role before issuing access. Camera and microphone start off. The call provides Daily’s controls; leaving, navigating away, cancellation, expiry or putting the app in the background unmounts the call. Native permission behavior requires real-device verification.

Reminders are opt-in local notifications on the device where the user presses **Remind me on this device**. They do not send email or SMS. Cancellation/rescheduling removes reminders on the current device; reminders on another device must be changed there. Notification contents contain no medical note or clinician identity.

## Clinician setup

Do not seed a fake clinician into the live database. Have the clinician create their Neem account, verify their identity/credentials outside the app, and obtain the **Clerk user ID** from the Clerk dashboard. An operator with Convex deployment access then runs:

```sh
npx convex run consultations:provisionClinician '{"clerkId":"user_REPLACE_WITH_REAL_ID","name":"REPLACE_WITH_REAL_NAME","specialty":"REPLACE_WITH_REAL_SPECIALTY","timezone":"Africa/Kigali","active":true}'
```

This is an internal function, inaccessible to app clients. It does not grant access to general health records. The assigned clinician sees a **Clinician** section in Appointments, publishes individual 15/30/45/60-minute slots up to 30 days ahead, removes unbooked slots and sees only their booked consultations with the patient’s name and appointment note. Times are displayed and entered in the current device’s timezone, explicitly shown in the UI. The profile timezone is directory metadata, not an instruction to reinterpret typed device-local times.

Setting `active:false` hides that clinician’s slots and prevents new bookings and join tokens. Booking/call setup stays honest when no clinicians exist. No billing, clinician verification process or calendar-sync integration is implied.

## Server configuration

Store the Daily API key **only in Convex**, never in an Expo public variable or source. Use the selected deployment’s environment settings or pipe the key into `npx convex env set DAILY_API_KEY`. Do not include it literally in shell history.

```sh
npx convex env set DAILY_MONTHLY_PARTICIPANT_MINUTES 9000
npx convex env set DAILY_VIDEO_ENABLED true
```

`DAILY_VIDEO_ENABLED` defaults off. Missing keys keep booking and joining inactive. Existing clinic requests remain visible. `daily:checkConnection` is an internal operator check: it creates a temporary private room, issues a token and deletes the room without joining or sending patient information. Its result contains booleans, never credentials.

## Privacy and access

- Private rooms, disabled knocking, room-specific tokens, expiry and a two-participant cap.
- Only the booking account (with current write access to that profile) and the assigned active clinician can obtain tokens. Shared-profile viewers cannot book or join.
- Daily receives an opaque appointment/role identifier and the labels Patient or Clinician. The application does not send patient names, email, clinical notes or readings to Daily.
- Audio/video and connection metadata are processed by Daily when the participant joins/enables media. Tokens stay in memory and out of navigation parameters, storage, analytics and browser history.
- Screen sharing, recording and transcription are disabled in the app’s room/token configuration. This does not prevent an endpoint from making an external recording.
- Cancellation schedules room ejection/deletion with bounded retries. The UI also immediately unmounts a cancelled call; expiry bounds any residual token lifetime.
- The integration alone does not establish clinical, healthcare-contract, data-residency or legal compliance. Configure the applicable provider contract before real patient consultations.

## Free-usage guard

The app conservatively reserves two participants for the entire slot plus the 15-minute joining window at the first join attempt, once per appointment. A 30-minute booking reserves 90 participant-minutes. Reconnecting does not reserve again. Failed connection attempts still consume the local reservation; it is deliberately not refunded. A window touching two UTC months reserves its full duration against both months. The default and maximum guard is 9,000 participant-minutes; zero blocks joins.

This is an app-level reservation guard, not Daily’s bill or an account-wide billing cap. Other applications using the same Daily account and paid provider features are outside it. No paid add-on is enabled by this code.

## Build and validation

Run `npm run bundle:daily` after upgrading the pinned browser SDK; it refreshes `src/generated/dailyBrowserSdk.ts` from the installed official package. The generated code is included for native calls and avoids loading a third-party CDN script at runtime. Web loads its SDK chunk only when a call is mounted.

Run lint, typecheck, backend tests, web export and native Hermes exports. Install a fresh EAS build after adding WebView/camera/microphone permissions. The existing APK predates these changes. Before launch, verify two real devices, denied permissions, reconnecting, speaker routing, expiry/cancellation and low-bandwidth behavior. Hermes exports verify bundles; they do not verify native compilation or media capture.

## Current connection

On 22 October 2026, the existing development deployment was connected to the user's Daily account with explicit approval. The real room/token/deletion API check passed, the video flag was enabled, and the 9,000-minute reservation guard was configured. Production deployment configuration is separate. Clinician identities and availability remain pending the user's details; actual media calls remain untested.

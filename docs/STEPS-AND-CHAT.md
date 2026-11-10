# Phone step tracking and shared-session chat

Updated 6 November 2026.

The lavender Home step card sits between the pressure map and blood glucose. It shows sensor counts, an optional personal goal and progress. Missing sensor access is shown as unavailable, never a fabricated count. The step count is independent of the pressure animation and Bluetooth insoles.

## Phone behavior

- iOS queries today's system total from local midnight. Live events trigger a refreshed total rather than being added again.
- Android saves observed foreground increments as “Recorded today · While Neem is open.” Steps while Neem is closed or in the background are not included. App resume starts a new sensor baseline without double counting.
- Web displays a dash and explains how to enable counting on the phone. Android Expo Go displays the development-build requirement.
- Permission is requested only after pressing “Enable step counting.” A previously denied permission can be restored through phone settings.
- Counts and an optional goal are stored in AsyncStorage per signed-in account and owner profile on this device. At most seven local days are retained. They do not sync through Convex. Shared profiles cannot use this phone's sensor as the other person's step count.
- Goals are personal preferences, not clinical activity recommendations. There is no prescribed default goal or inferred calorie/distance estimate.

`expo-sensors` is configured with the iOS motion usage description and Android `ACTIVITY_RECOGNITION` permission. An installed build must include the new module and permissions. An OTA JavaScript update alone cannot add them.

Official SDK 58 references: [Pedometer](https://docs.expo.dev/versions/v58.0.0/sdk/pedometer/), [Sensors](https://docs.expo.dev/versions/v58.0.0/sdk/sensors/).

## One app account

The app entrance requires Clerk sign-in. Internal routes, including `/ai`, share that session. While an existing session or Convex profile is being restored, AI shows a reconnecting state instead of a second login form. Web authentication carries an allowlisted return destination through email and Google/Apple access. Native authentication retains the existing `neem://auth-callback` behavior.

AI's one-time provider privacy choice remains separate from authentication. It explains OpenRouter/provider processing before any message is sent. Recorded readings are off by default and can be included explicitly. Existing backend membership, consent and tool-confirmation checks remain intact.

Chat now has a compact header, pastel prompt cards, an independently scrolling conversation, a pinned composer, readable message bubbles, streaming/stop controls, a conversation-history sheet and inline errors. Existing tool suggestions still require confirmation before saving.

## Verification

- Expo lint and TypeScript pass. All 107 automated tests pass: 13 domain/gateway, 76 backend/model/step/session and 18 bridge tests.
- The 13 step/session tests cover permission timing, unsupported devices, foreground deltas, counter resets, app resume, midnight, iOS totals, storage recovery, account disposal, app-entry authentication, shared AI sessions and safe return/tool destinations.
- A real browser Google sign-in using the existing Neem account returned directly to `/ai`. Home-to-AI navigation and a page reload kept the same session with no second sign-in.
- At 390 × 844, the chat welcome, pinned composer, navigation, step card, empty sensor state and goal sheet were checked. Empty goal validation and a temporary 3,000-step goal were tested; the temporary goal was removed. Browser counts remain unavailable.
- Sending a non-sensitive draft reached the existing provider privacy choice. It was dismissed without accepting or sending the draft. This pass does not claim a live provider reply.
- Screenshots: `screenshots/neem-steps-chat-ai-mobile.jpg`, `screenshots/neem-steps-chat-home-mobile.jpg`.

Physical phone sensor readings, permission dialogs, background behavior on a device and a newly installed APK/IPA still need device testing. JavaScript/asset exports are not installed native binaries.

# Android build recovery

Failed preview build: `cb02efcb-33c7-4acd-b5ca-ae2ce2f13fd4`.

The retrieved EAS logs show that JavaScript bundling completed, then the Gradle daemon disappeared during native compilation (Worklets CMake tasks were active). There is no Kotlin/Java source compilation error at the failure point. The final message is:

> Gradle build daemon disappeared unexpectedly (it may have been killed or may have crashed)

Memory pressure is the leading diagnosis, consistent with Expo's troubleshooting guide. The log does not contain a kernel OOM report, so the precise original cause remains an inference. The revised build succeeded with bounded concurrency and SDK patch updates.

The preview profile keeps the existing build machine and all CPU architectures. It now limits Gradle to two workers, disables parallel project execution, limits Node to a 2 GB heap, and retains the build worker's existing 4 GB Gradle heap. `GRADLE_OPTS` is set in EAS configuration because EAS's worker settings override project `gradle.properties`. Stack traces are enabled for a more useful report if another failure occurs. Generated Android/iOS files are not edited.

The failed build also reported an Expo dependency compatibility warning. SDK 58 patch updates are applied through `npx expo install --fix`; this does not change the SDK major version.

The remote preview environment was checked and contains the expected public Clerk key and Convex cloud/site URLs. AI remains disconnected. No paid build machine, subscription upgrade, model activation or app-store submission is part of this fix.

Rebuild from this checkout:

```sh
cd "/Users/alex/Desktop/projects/neemapp insole"
npx eas-cli@latest build --platform android --profile preview
```

References:

- https://docs.expo.dev/build-reference/troubleshooting/
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.gradle.org/current/userguide/command_line_interface.html

Local verification: TypeScript, lint and all 42 tests pass. Expo Doctor passes 20/20 checks; `expo install --check` reports compatible dependencies. EAS config resolves the correct Neem project, preview environment, APK task and memory/concurrency settings. The replacement cloud build finished successfully, including Gradle native compilation and APK signing. JavaScript export alone does not verify Gradle compilation.

Resolved SDK patch settings:

```json
{
  "expo": "~58.0.17",
  "@expo/metro-runtime": "~58.0.14",
  "expo-auth-session": "~58.0.14",
  "expo-constants": "~58.0.12",
  "expo-linking": "~58.0.14",
  "expo-notifications": "~58.1.6",
  "expo-router": "~58.0.25",
  "expo-sharing": "~58.0.20",
  "expo-splash-screen": "~58.0.11",
  "expo-status-bar": "~58.0.4"
}
```

Replacement cloud build: `d356bc60-8422-49e3-9703-ba9309137335`.

https://expo.dev/accounts/debo_week1/projects/neem-health/builds/d356bc60-8422-49e3-9703-ba9309137335

The replacement worker logs confirm the intended `GRADLE_OPTS` values (parallel=false, workers.max=2, 4 GB heap) and `NODE_OPTIONS=--max-old-space-size=2048`.

An independent Android JavaScript/Hermes export also passed with `NODE_OPTIONS=--max-old-space-size=2048` and two Metro workers (4,333 modules, 13 MB Hermes bundle).

## Cloud result — 22 October 2026 (Kigali)

Status: **FINISHED**. Gradle reported `BUILD SUCCESSFUL in 30m 23s` and 1,019 executed tasks. EAS reported completion at `2026-10-21T22:42:56.394Z`. The free/default build machine was retained.

[Download the signed APK](https://expo.dev/artifacts/eas/3GBhKK3dUYNPGFrCBrVVaw7HJsQyNPNkmmcG_5v0BRs.apk)

Phone installation and interactive testing remain separate from successful compilation.

## Downloaded APK checks

- Local artifact: `/Users/alex/Downloads/Neem-preview-d356bc60-2026-10-22.apk`
- Size: 161370908 bytes (about 154 MiB).
- Package: `health.neem.insole`, label `Neem`, version `1.0.0` / code `1`.
- Minimum Android API 24, target API 36.
- ABIs: ARM64, 32-bit ARM, x86 and x86_64.
- Android `apksigner verify --verbose` passes; APK Signature Scheme v2 verified with one signer.
- The downloaded Hermes bundle contains the expected Convex cloud URL and Clerk publishable key. This confirms build-time configuration embedding, not an interactive login.
- SHA-256: `93ea0f118521f3e07e4cdb94aef24425377fb9395f50404e88f3b70d879d6a06`.
- Device installation and interactive testing remain pending.

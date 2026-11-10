# Neem

Expo 58 / React Native app for iOS, Android and web. Clerk provides account access; Convex stores private health records, care tasks, sensor history, AI conversations and the knowledge library. The original Lovable source is preserved in `neem-pressure-pulse/`.

The October visual refresh follows the supplied pastel dashboard reference and adapts [Mono Charts](https://amicro.dev/mono-charts) for native SVG charts. See [design details](docs/DESIGN-REFRESH.md). The APK in the Android build guide was created before this visual refresh; rebuild it to include the new screens.

The welcome, sign-in, sign-up and account screens now follow the matching light reference. First-time account setup collects a name and optional date of birth, assigned sex, country/region, height and weight. Personal details are saved privately in Convex; account credentials and the optional profile photo stay with Clerk. See [account and onboarding verification](docs/ACCOUNT-ONBOARDING.md). A new native build is needed for the profile-photo picker and these screens.

## Run locally

```sh
npm install
npm run web
# Static browser preview:
npm run build:web
npm run preview
# Checks:
npm run typecheck
npm run lint
npm test
```

Set the public values in `.env.local` using `.env.example`. The current development setup uses Convex project `neem-mobile`, deployment `standing-dog-57`, and the Neem Clerk development application. Public configuration must also be set in EAS environments before a remote build; an ignored local environment file does not reach EAS.

Sign in once at the app entrance. Home, education, reports and Neem AI use that same Clerk session; AI does not have a separate login. Welcome and account-access screens remain public. Accounts start with empty records. Patient data is fetched from Convex and is not cached in AsyncStorage. Device-local preferences, article bookmarks and phone step counts are stored locally. Forms close only after the backend accepts a change. Membership checks protect every private query and mutation. Viewer memberships cannot write. The app cannot assign memberships or grant subscriptions.

The Home step card uses the phone's motion sensor. iPhone reads today's system total; Android records foreground steps while Neem is open. The browser shows an unavailable count, and Android Expo Go requires a development build. Counts are scoped to the signed-in owner's profile on this device. See [step tracking and chat verification](docs/STEPS-AND-CHAT.md).

## AI integration

Mobile chat uses this flow:

`Expo → Clerk-authenticated Convex → OpenRouter → free model`

The default model is Google Gemma 4 31B (`google/gemma-4-31b-it:free`), which supports tool calls and a 256K context window. An owner can set `OPENROUTER_CHAT_MODEL` to `openrouter/free` (OpenRouter selects any compatible free model) or to another `provider/model:free` ID after testing it. Free models share upstream rate limits, so Gemma can return temporary `429` errors during busy periods; the app shows a retry-later message. If the primary model fails (for example a temporary upstream `429`), OpenRouter tries `OPENROUTER_FALLBACK_MODEL` in the same request. It defaults to NVIDIA Nemotron 3 Ultra (`nvidia/nemotron-3-ultra-550b-a55b:free`); set it to `none` to disable the fallback. A fallback counts as one request against Neem's call caps. Paid models, paid fallbacks, external plugins and alternate chat endpoints are rejected by the backend. The transport also enforces zero maximum prompt, completion, request and image prices.

`provider.data_collection` is `deny` by default. Nemotron's only provider requires `allow`, so set `NEEM_AI_DATA_COLLECTION=true` on the Convex deployment to let it serve fallback requests. With `allow`, free providers may log and train on prompts, so use it only for demos with non-sensitive data and keep it `false` for real patient use; the in-app privacy notice must match whichever setting is deployed. Any value other than `true`/`allow` stays `deny`, and the backend never relaxes it automatically. This is a routing restriction, not clinical validation or a contractual privacy guarantee.

The existing Convex Agent stores conversations, streaming deltas and tool results. Users must explicitly accept the OpenRouter notice (`aiConsentProvider=openrouter`) before sending; an older Lovable consent alone does not grant access. Recent conversation history is sent with follow-ups. The optional “Include my readings” switch controls adding recorded health data from the profile. Tool suggestions for measurements, tasks and appointment requests remain review cards and require authenticated confirmation before saving. An appointment request does not contact or book with a clinic. The assistant provides education, not diagnosis or prescribing.

No classifier model is called. Each response allows up to four model calls, 1,600 output tokens per call, ten recent messages, a 120 KB request limit and no automatic SDK retries. The absolute output ceiling is 2,400 tokens. Tools can require multiple calls for a single user message. Chat reserves zero token cost while retaining transactional request caps: 20 calls/minute, 50/day and 1,000/month shared across the backend, plus 30 user messages/account/day. Failed calls retain their request reservation. OpenRouter applies its own account-wide limits, including usage from outside Neem. Raise the local daily cap only after checking the account's actual allowance; this setup does not purchase credits or enable top-ups. A zero or invalid call cap closes access. Setting either existing micro-USD reserve cap to zero also stops all AI.

### Connect OpenRouter

1. Create an API key at https://openrouter.ai/settings/keys.
2. Save `OPENROUTER_API_KEY` in the selected Convex deployment's environment variables. Never use `EXPO_PUBLIC_*`, paste it into source, or configure it as a mobile runtime secret. Default non-secret settings are listed in `convex/.env.example`.
3. Push the backend with `npx convex dev --once`. The current development deployment is `standing-dog-57`; configure production independently.
4. Use the updated mobile or web client, sign in, accept the updated AI notice, send a short non-sensitive question, and verify a streamed reply. Test a task review card, confirmation, cancellation and quota errors before wider use. `npx convex run ai:configuration '{}'` reports configuration presence, not a successful provider health check.
5. Check OpenRouter Activity to confirm the actual selected model and zero model charge. Mocked provider tests do not establish live model quality, availability or health-data suitability.

The owner can run `npx convex run aiDiagnostics:checkConnection '{}'` for a live synthetic tool-and-reply check after saving the key. This internal action never reads patient records and uses the same free-only transport and request allowance as chat (up to two model calls). `ok=true` confirms that test; it does not verify Clerk sign-in, a physical device or clinical quality.

The application remains in “AI connection pending” while the server key is missing or a paid model ID is configured. No provider credentials are returned by the configuration query. Existing installed builds need the updated client to show and save the new consent.

### Optional book search

Free chat does not supply book embeddings. Existing 3072-dimensional book vectors and the Lovable embedding bridge are preserved separately. `NEEM_AI_LIBRARY_ENABLED=false` is the default: chat works with Neem's built-in educational content, the library tool is omitted, new book uploads/retries are unavailable, and saved books remain listed. No embedding traffic occurs in this mode.

Only enable book search after configuring and verifying the separate embedding service and its costs: set `NEEM_AI_BRIDGE_SECRET` in Lovable and Convex, publish Lovable's protected `/api/neem-gateway/embeddings` route, set `NEEM_AI_BRIDGE_URL` in Convex, and explicitly set `NEEM_AI_LIBRARY_ENABLED=true`. Existing conservative embedding reservations and call limits still apply. Search queries then also pass through Lovable's embedding service, as stated in the AI notice. No book corpus was migrated. Changing the embedding model requires re-indexing; free chat model changes do not require re-indexing.

## Knowledge library

The Library screen shows ingestion progress. Only Clerk IDs listed in the backend `NEEM_ADMIN_CLERK_IDS` can upload, retry or remove books. Supported inputs are text PDFs, TXT and Markdown up to 8 MB, 600 PDF pages and 1,200 passages. Scanned PDFs need OCR before uploading. Each passage retains its title, author and PDF page for citations. Upload only sources you have rights to use.

Files are stored in Convex Storage; text extraction and embedding run in background batches. Failed jobs can resume. Retrieval serves ready books only. Changing the embedding model requires re-indexing. No book files or authorized access to the old cloud corpus were supplied locally, so existing Lovable library content has not been migrated.

## Android builds

The `preview` EAS profile creates an installable APK using bounded build concurrency on the existing build machine. See [Android build recovery](docs/ANDROID-BUILD.md) for the diagnosed daemon failure, applied settings and cloud verification status.

## Physical insoles

The pressure preview now shows overlapping heel, metatarsal and individual-toe loads across the walking cycle. Connect my insole also offers an explicitly labeled connection simulation for an insole named `neem`, followed by the animated map. This path never connects hardware or saves readings. See [pressure simulation details and checks](docs/PRESSURE-SIMULATION.md).

Reports includes a normal simulation pressure summary and rounded peak/average bars. The illustrative check tracks phase, duration and repetition; the actual-insole report remains Not assessed. See [pressure report scope and verification](docs/PRESSURE-REPORTS.md).

Native Bluetooth uses a development build, not Expo Go or the browser. Obtain the real service UUID, characteristic UUID, packet format, sensor locations and calibration from the firmware team. Leave BLE environment values blank until verified. The existing decoder describes a proposed contract:

```json
{"version":1,"side":"left","sensors":[{"region":"heel","value":42}]}
```

Only enable `EXPO_PUBLIC_BLE_PROTOCOL=verified-neem-relative-v1` after hardware testing. Values are relative 0–100 for heel, midfoot, forefoot and toes. Unknown regions stay unmeasured. No kPa, temperature or clinical risk score is inferred. Glucose and blood pressure are manual entries, never derived from insoles. The separate animation illustrates a walking step and is never saved as a patient measurement. It respects reduced motion and pauses in the background.

Live maps interpolate valid sensor regions; they do not claim that every colored pixel is a physical measurement. Stale frames expire after 30 seconds. Valid frame history is synchronized at most every 10 seconds per side. BLE authentication, calibration, disconnect/reconnect, latency and battery behavior still need actual iOS/Android hardware testing.

## Production release work

The connected services are development instances. Before a patient release, configure a Clerk production instance and native provider credentials, production Convex deployment, app identifiers/signing, EAS environments, privacy and consent records, retention/deletion/export policies, backups, monitoring, regional/legal requirements and physical sensor validation. Native compilation/export does not prove these requirements or store readiness.

RevenueCat support is optional. Configure real store offerings and `neem_premium`; the backend verifies entitlements using `REVENUECAT_SECRET_KEY`. Set `NEEM_AI_REQUIRE_PREMIUM=true` only after that flow is verified. Client claims never grant premium access. Purchases, native notifications and signed app builds have not been verified on a device.

Legacy Supabase migration and adapter source remain under `supabase/` and `docs/legacy/` for reference. The Expo runtime no longer uses Supabase. `npm run test:legacy` checks the preserved SQL migration separately.

## Video consultations

Daily video booking is available through **Your care → Appointments** and **Account → Appointments**. Slots come from real, operator-provisioned clinicians. See [VIDEO-CONSULTATIONS.md](docs/VIDEO-CONSULTATIONS.md) for setup, access rules, the free-usage guard and the required device verification. API keys belong in Convex only. A new EAS build is required for the added native WebView and media permissions.

## Care administration and clinician workspaces

**Account → Your care workspace** opens role-protected administration or clinician tools. Administrators manage patient assignments, recorded alert/risk queues, clinician accounts, appointment bookings, insole registration, account access, and RWF invoices. Assigned clinicians can take and sign patient histories, review alerts, publish availability, manage their own visits, and issue patient invoices. Patients see bills under **Account → Invoices & payments**.

See [care workspace setup and verification](docs/care-workspaces.md) for permissions, immutable signed records, risk interpretation, pawaPay checkout, and deployment boundaries. The live pawaPay account has been connected to the current development backend and verified with a read-only configuration check; no real payment was initiated. All payment secrets remain in Convex.
# neemtestapp

# Neem care workspaces

Access the workspaces from **Account → Your care workspace**. Routes are `/admin`, `/clinician`, and `/billing` (patient invoices). They use the existing Expo Router app on mobile and web.

## Roles and access

- Administrator: exact, operator-verified Clerk subject IDs in the server setting `NEEM_CARE_ADMIN_CLERK_IDS`. Email typed into a form never grants access. This setting is separate from the AI library administrator setting.
- Clinician: an existing Neem account enabled by an administrator, with name, specialty, timezone, and an active clinician record. Enable only after verifying the person and credentials. No clinician credentials are invented or seeded.
- Assigned patients: clinicians can read a patient's demographics, readings, insoles, alerts, invoices, and clinical history only while their assignment is active. Signed medical records are visible to assigned clinicians and administrators. Drafts are visible only to their clinician author.
- Medical writes: an active clinician and an active patient assignment are both required. Administrator access alone cannot sign medical history or review a clinical alert.
- Booking: administrators can book for a patient, cancel, reschedule, and mark an elapsed appointment complete. Clinicians manage their own visits and publish availability. Patient booking conflicts and slot ownership are checked in the transaction.
- Video: staff booking attaches the appointment to the patient account. An administrator does not become a call participant. Existing private Daily room rules and quota reservations remain in force.
- Patient invoices: existing patient profile access controls apply; only owners/editors can initiate payments. Clinicians can issue invoices for assigned patients. An administrator or the original issuer can void an unpaid invoice, provided there is no pending payment.
- Suspension blocks backend account access while preserving history. It does not delete a Clerk account or erase a medical record. Administrator suspension is restricted to the deployment operator. Suspending a clinician account also disables its clinician record; restoring the account does not automatically restore clinical privileges.

## Patient review queue

The queue shows **clinician-assessed** ulcer risk and review priority from the latest signed encounter. Filters include high ulcer risk, urgent review, review, and routine. Patients start **Not assessed**. No number is represented as a validated probability of developing an ulcer.

Open, persisted device alerts are shown separately. The walking simulation never creates a patient alert, sensor frame, or risk classification. Raw relative sensor values do not provide the calibrated pressure, gait phase, exposure duration, or clinical validation required to infer an ulcer diagnosis. The current BLE integration does not automatically convert raw sensor frames into clinical risk. Its protocol and calibration must be verified with the actual hardware before that capability is added.

Clinical guidance reference for future assessment design: [IWGDF 2023 guidelines](https://iwgdfguidelines.org/guidelines-2023/). The current workflow records a clinician's assessment; it does not implement an automated IWGDF classifier.

## History taking

The encounter form records presenting complaint, history, medical/surgical/family history, medications, allergies, social history, foot examination, clinical assessment, care plan, risk rationale, review priority, and consent recording. A signed encounter is immutable. Corrections require a new encounter. Revision checks reject concurrent draft overwrites. Signing requires consent recording, complaint, assessment, care plan, and a rationale when assigning a risk level.

The app tracks changes in `careAudit` without copying clinical notes or payment phone numbers into audit entries. This is a change history, not a complete record of every medical-record read. The UI limits long histories/readings and labels the displayed bounds; patient directories, queues, invoices, devices, appointments, and activity have pagination.

## Insoles

Register the exact hardware identifier and assign it from a patient's Overview. Registration is an inventory action, not a Bluetooth connection. Existing device links can be adopted into the registry without changing their patient. A device with patient history cannot be transferred to another profile in this version. Retired devices reject linking and sensor writes. Reactivation preserves their original patient binding.

## RWF billing and pawaPay

Issued invoices have a fixed, whole-number RWF amount, due date, description, issuer, and state. Corrections use void-and-reissue; no client or public mutation can mark an invoice paid.

The pawaPay adapter follows the official v2 API:

- [Active configuration](https://docs.pawapay.io/v2/api-reference/toolkit/active-configuration): load configured Rwanda/RWF providers, authentication type, and amount bounds.
- [Initiate deposit](https://docs.pawapay.io/v2/api-reference/deposits/initiate-deposit): store one UUID and exact immutable payment details before submitting. A repeat checkout keeps the existing request and verification job. The first verifier is scheduled in the same transaction as payment creation, so it survives the client action exiting. New payment attempts are capped at five per payer per hour; manual status refreshes are atomically throttled. An uncertain request can be safely resubmitted with that same UUID and payload.
- [Check deposit status](https://docs.pawapay.io/v2/api-reference/deposits/check-deposit-status): only a server-fetched `COMPLETED` record matching the UUID, amount, currency, provider, and payer phone marks the invoice paid. `ACCEPTED` is not payment success. Mismatches are held for review.

Before activation, store `PAWAPAY_API_TOKEN` securely on the selected Convex deployment, set `PAWAPAY_ENVIRONMENT=production`, and only then set `PAWAPAY_CHECKOUT_ENABLED=true`. Do not add these to public Expo environment variables. Confirm that the merchant has Rwanda collections enabled and that the token belongs to the intended live merchant. Tokens and raw provider responses are never logged.

Checkout sends the phone, amount, currency, and opaque invoice/payment references to pawaPay, with the generic message `Neem payment`. It does not send clinical notes, diagnoses, clinician names, or patient names. The patient must confirm the exact amount and phone before a request is submitted. Neem never asks for a mobile-money PIN.

Only provider-authenticated phone prompts are implemented. PREAUTH, redirect-auth flows, and merchants enforcing HTTP request signatures remain blocked until their respective integrations are supplied. Do not disable a merchant security setting as a workaround. Sandbox transactions cannot mark live patient invoices paid. Use mocked provider tests for development until a separate sandbox invoice environment is configured.

The server polls with an initial bounded backoff, then continues hourly while a payment is unresolved; patients can manually refresh sooner. No provider callback endpoint is exposed. The merchant was configured for status polling with no callback URLs, after checking that all existing callback fields were empty. Uncertain payments stay unpaid and block invoice voiding or a fresh charge. Review cases require operator reconciliation against the provider dashboard; there is intentionally no generic “mark paid” control. Refunds, cash/manual receipts, invoice PDF exports, and full accounting/tax integrations are outside this first implementation.

## Verification and release boundary

`tests/care.test.ts` covers role escalation, assignment revocation, signed-history immutability, stale drafts, alert review, suspension, insole assignment/retirement, staff booking/rescheduling/call ownership, invoice validation, idempotent deposit initiation, consent, and verified payment matching. Provider responses are mocked; tests do not charge money or create medical records on the live backend.

This checkout's configured backend is a Convex development deployment and its Clerk application uses a development instance. Real deployment requires production Clerk/Convex configuration, verified clinician accounts, merchant activation, hardware validation, and device testing. A web or Hermes export is not an installed-device test or an EAS release.

## Connection verified on 22 October 2026

The configured live merchant is **NEEM COMPANY LIMITED**. A read-only check from the deployed Convex action succeeded for `AIRTEL_RWA` and `MTN_MOMO_RWA` in RWF. The app displays the provider's phone-prompt merchant label (currently `pawaPay RW` for Airtel and `pawaPay` for MTN). The token was stored server-side after explicit approval, and the temporary local copy was removed. No real invoice, payer request, or money transfer was created during this verification. The connection is on the existing Convex development deployment; this is not a production application release.

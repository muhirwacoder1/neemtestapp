# Neem AI model recommendation — 21 October 2026

Status: implemented and tested; mobile bridge activation is pending. The user approved implementing the economical setup. No shared bridge secret is saved and the revised Lovable deployment is unpublished.

- Gemini 3.8 Flash (`google/gemini-3.8-flash`): everyday questions, summaries and app actions through Chat Completions.
- GPT-6 Sol (`openai/gpt-6-sol`): explicit comparisons and complex work through Responses, with low reasoning. The bridge removes any pro-mode request.
- Flash also performs a small typed workload decision for ambiguous longer requests. Obvious cases use ordinary code and incur no classifier call. An invalid decision falls back to Flash. Jev and Luna are not enabled; there is no extra decision-provider dependency.
- Astra is rejected by both the Convex transport and the bridge. There is no premium fallback.
- The revised original web chat uses Sol; mobile routing is independent.
- Gemini Embedding 2 retains the existing 3072-dimensional index. Empty libraries skip paid query embeddings. Changing chat models does not require re-indexing books.

The router selects computational complexity, never medical urgency, diagnosis or authorization. Every model uses the same educational scope, account authorization, library tools and explicit review cards. Portable conversation history omits old provider reasoning metadata when switching models; the current run's reasoning/tool loop remains managed by the SDK.

Cost controls are implemented at two levels. Lovable's Neem project has a saved hard **1 AI credit/month** limit with Pause AI and an email alert. It showed **0.66/1** used after setup. Other projects are unaffected. This credit cap includes existing web AI and mobile bridge usage, but not Cloud/build usage. The AI grant is shared across projects, so this does not guarantee that every project call is free.

The mobile transport atomically reserves conservative upper-bound input/output costs before any network call, including the classifier, tool loops and embeddings. It defaults to 500,000 micro-USD/day and 2,000,000/month; these are modeled reservation units, not Lovable billing. It also stops at 100 calls/day or 1,000/month. Failed calls retain reservations. Invalid/zero caps stop access. User messages remain capped at 30/day. Each response has four model steps, no automatic retries, bounded history and output. Logs store only model, route, request size, reservation and HTTP status, without prompts or secrets. Provider usage is retained by the Agent component.

Lovable reported checking all three exact IDs in its live catalog and receiving 200 from one small call per model. Independently, local tests run the actual AI SDK through the downloaded strict bridge with simulated upstream responses; they exercise structured routing, both providers' local tool loops, citations, failure handling and allowance enforcement. The full deployed mobile connection still needs live validation after activation. No credits were bought, no plan was upgraded and no automatic top-up was enabled.

Illustrative direct-provider standard token rates per million input/output tokens:

| Model | Input USD | Output USD |
| --- | ---: | ---: |
| GPT-6 Astra | 10.00 | 50.00 |
| GPT-6 Sol | 2.00 | 10.00 |
| GPT-6 Luna | 0.10 | 0.50 |
| Gemini 3.8 Flash | 0.75 | 3.75 |

Gemini rates above are introductory through December 31, 2026. These are comparison rates, not a quote for the user's Lovable bill. Actual cost includes reasoning, history, book passages, router calls, tool loops, retries and hosting. Lovable's deployed AI requests consume its AI grant first and then general credits if available; the published current grant is 4 credits/month on Free, Pro and Business, subject to change. The owning workspace was checked: Pro with 200 monthly plan credits. General credit balances changed during Lovable development work and should be checked live; development prompts also consume build/general credits. The auto-top-up setting has not been modified.

Sources checked:

- https://docs.lovable.dev/features/ai-chat
- https://docs.lovable.dev/features/ai-decisions
- https://docs.lovable.dev/introduction/credits-and-usage
- https://developers.openai.com/api/docs/models/compare?model=gpt-6-sol
- https://developers.openai.com/api/docs/models
- https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.8

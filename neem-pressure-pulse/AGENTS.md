<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Neem app state lives in `src/lib/neem-store.tsx`; signed-in users' glucose/BP/body readings persist in `health_readings` (per-user RLS) and replace demo data per metric only when real rows exist (`real` flags); why: one place for data, never mixing demo with real.
- Neem AI acts in the app via server-side tools in `src/lib/ai/neem-chat.server.ts` (open_page, save_*, list/book_appointment) using the caller's RLS client; the chat page navigates/refreshes on tool outputs; why: actions stay authorised as the user.
- Appointment requests live in `appointments` with shared rules in `src/lib/appointments.ts` used by both the page and the AI tool; why: one validation path.
- All sensor/health demo data must stay labelled Demo Mode and never be mixed with real readings; why: health-data safety.
- Neem AI chat streams through the server route `/api/chat` (handler in `src/lib/ai/neem-chat.server.ts`), verifies the caller's bearer token and thread ownership, and persists threads/messages in `chat_threads`/`chat_messages` under per-user RLS; why: keeps the model key server-side and health chats private per account.
- Neem AI is grounded in `src/lib/edu-content.ts` (shared with the Learn page); why: one source of truth for educational content.
- Neem AI RAG library: books are chunked (`src/lib/library-chunk.ts`), embedded server-side with the model in `src/lib/ai/embeddings.server.ts` into `knowledge_chunks` (vector 3072, HNSW halfvec) and searched via `match_knowledge` by the chat tool `search_library`; only `admin` role (in `user_roles`, checked with `has_role`) may add/remove books; why: shared, cited knowledge with controlled uploads. Changing the embedding model requires re-embedding all chunks.
- Mobile AI bridge (`src/lib/ai/mobile-gateway.server.ts`, routes under `/api/neem-gateway/`) enforces a strict one-model-per-endpoint allowlist, text + local function tools only, forced reasoning/output caps, and bearer-secret auth before body parsing; model routing lives in the Convex backend, not here; the web chat model policy is separate (`WEB_CHAT_MODEL` in `neem-chat.server.ts`); why: bounded cost and no model/tool smuggling from the mobile backend.

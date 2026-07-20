# MicroManus — Development Plan

> **Architecture status:** FROZEN as of 2026-07-20.
> No further architecture discussion unless a blocker is discovered during implementation.
> Companion doc: `MicroManus_Engineering_Blueprint.md` (spec) — this doc is the execution order.

## Success Criteria

The reviewer should be able to:

1. Open the website.
2. Sign in using Google or GitHub.
3. Unlock using the coupon or Stripe.
4. Configure an API key.
5. Create a chat.
6. Ask a research question.
7. Watch the agent search and reason.
8. Download a PDF.
9. View usage analytics.
10. Complete the entire experience without reading documentation.

## Development Rules

**Read these before starting any phase.**

- Do not implement future phases.
- Finish one phase completely before moving to the next.
- After completing a phase, stop and wait for review.
- Never refactor unrelated code.
- Keep commits small and focused.
- Follow the blueprint exactly unless a blocker is discovered.
- Prefer working software over perfect abstractions.
- Do not introduce new libraries unless required to complete the current phase.

---

## Frozen decisions (summary)

- **BYOK only.** Platform never holds LLM keys. User supplies endpoint + key; their provider bills them.
- **$5 Stripe OR coupon `SID_DRDROID` unlocks app access** — it does not buy tokens.
- **Credits = 5. 1 user prompt = 1 credit.** Internal tool calls (search, reasoning, PDF) consume none.
- **No DIY response cache.** Provider-side prompt caching only; record cache tokens for analytics.
- **Stack:** Next.js (App Router) · TS · Tailwind · shadcn/ui · Supabase (Auth/DB/Storage) · Drizzle · Vercel AI SDK (`@ai-sdk/openai-compatible`) · Serper · pdf-lib · Stripe · Vercel.

### Resolved implementation details
1. **Multi-model access** — `@ai-sdk/openai-compatible` against the user's `baseURL`. Claude/Kimi are reached through an OpenAI-compatible gateway (e.g. OpenRouter); we do not special-case providers.
2. **Cache tokens are nullable/best-effort.** OpenAI reports read-only (`cached_tokens`); some providers report neither. Never assume both fields exist.
3. **Credit lifecycle** — atomically **reserve** on prompt receipt, **refund** if the run fails before any assistant output.
4. **Unknown model pricing** — `estimated_cost = null`, UI renders "—". Never block a request on missing pricing.

---

## Phase -1 — Project Setup

- [x] Initialize Git repository.
- [ ] Create GitHub repository. *(blocked — `gh` CLI not installed; pending decision)*
- [ ] Configure branch protection *(optional — skipped, no remote yet)*.
- [x] Create `.gitignore` (covers `.env*`, `node_modules/`, `.next/`).
- [x] Configure ESLint + Prettier.
- [ ] Configure Husky + lint-staged *(optional — skipped to avoid dependency creep; add later if needed)*.
- [x] Configure absolute imports (`@/*` path alias).
- [x] Verify `npm run dev`, `npm run lint`, and `npm run build`.

**Done when:**
- Development environment is ready. ✅
- `npm run build` succeeds. ✅

## Phase 0 — Foundation

- [ ] **0.1** Scaffold Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- [ ] **0.2** Create folder structure per spec §15 (`app/ components/ features/ lib/ actions/ db/ types/ hooks/ providers/`).
- [ ] **0.3** Supabase project; add `.env.example` with every required var (Supabase URL/anon/service-role, Stripe keys + webhook secret, Serper key, `ENCRYPTION_MASTER_KEY`).
- [ ] **0.4** Drizzle config + connection; verify `db:push` round-trips.

**Done when:** app boots locally, shadcn component renders, Drizzle connects.

## Phase 1 — Data layer

- [ ] **1.1** Drizzle schema — `users` (+`is_unlocked`, `unlocked_via`, `credits`, `created_at`), `chat_threads`, `messages` (+`pdf_url`), `api_keys` (+`user_id`), `usage_logs` (+`user_id`, `thread_id`, `message_id`, `model`, split token fields, `estimated_cost`, `created_at`), `payments` (+`user_id`, `status`, `stripe_event_id`), `coupon_redemptions`.
- [ ] **1.2** Migrations + **RLS policies** on every user-owned table (owner-only read/write).
- [ ] **1.3** `lib/model-pricing.ts` — `MODEL_PRICING` config (input/output/cache-read/cache-write per model).
- [ ] **1.4** `lib/cost.ts` — cost calculator; returns `null` for unknown models. **Unit tests here.**

**Done when:** migrations apply, RLS blocks cross-user reads (verify with two accounts), cost tests pass.

## Phase 2 — Authentication

- [ ] **2.1** Supabase Auth: enable Google + GitHub providers, OAuth callback route.
- [ ] **2.2** Server/client session helpers; bootstrap a `users` row on first login (`credits = 0`, `is_unlocked = false`).
- [ ] **2.3** Middleware: unauthenticated → `/login`.

**Done when:** both providers log in, a `users` row exists, protected routes redirect.

## Phase 3 — Paywall & unlock

- [ ] **3.1** Paywall page UI (coupon + Stripe options).
- [ ] **3.2** `POST /api/coupon` — validate `SID_DRDROID`, enforce **once per user** via `coupon_redemptions`, set `is_unlocked = true`, `credits = 5`.
- [ ] **3.3** `POST /api/payment` — create Stripe Checkout session ($5).
- [ ] **3.4** Stripe webhook — verify signature, **idempotent on `stripe_event_id`**, use service role (no user session), unlock + `credits = 5`.
- [ ] **3.5** Middleware: authenticated but locked → `/paywall`.

**Done when:** both unlock paths work; **replaying the same webhook event does not double-credit**.

## Phase 4 — API settings (BYOK)

- [ ] **4.1** `lib/crypto.ts` — symmetric encrypt/decrypt with server-only `ENCRYPTION_MASTER_KEY`.
- [ ] **4.2** `POST /api/settings` — save endpoint + encrypted key + model. **Key never returned to the client** (mask as `sk-…abcd`).
- [ ] **4.3** `GET /api/models` — fetch the user's `/v1/models`; graceful fallback if unsupported.
- [ ] **4.4** Settings UI + "Test connection" validation ping.

**Done when:** key saves, round-trips server-side, is never present in any network response or client bundle.

## Phase 5 — Chat core

- [ ] **5.1** Thread CRUD (create / list / rename / delete) + sidebar UI.
- [ ] **5.2** `POST /api/chat` — Vercel AI SDK streaming against the user's endpoint.
- [ ] **5.3** Message persistence; per-thread context loading (memory scoped to thread).
- [ ] **5.4** Chat UI: markdown, code blocks, streaming render.
- [ ] **5.5** Credit reserve-on-prompt / refund-on-failure (atomic `UPDATE … WHERE credits > 0`).

**Done when:** multi-turn streaming chat works, thread switching preserves context, 1 prompt = exactly 1 credit.

## Phase 6 — Agent loop

- [ ] **6.1** Serper search tool (platform-owned key) + `POST /api/search`.
- [ ] **6.2** Dynamic tool-use loop, `maxIterations` configurable (**default 5**).
- [ ] **6.3** Surface tool steps in UI ("Searching…", sources).
- [ ] **6.4** Verify internal tool calls do **not** decrement credits.

**Done when:** a research prompt triggers ≥2 searches, cites sources, and consumes exactly 1 credit.

## Phase 7 — Usage & analytics

- [ ] **7.1** Write `usage_logs` per LLM call (tokens incl. nullable cache read/write).
- [ ] **7.2** `GET /api/usage` — aggregation queries.
- [ ] **7.3** Usage dashboard: prompt/completion/cache tokens, estimated cost, credits remaining, total requests, model breakdown.

**Done when:** dashboard numbers reconcile against a known conversation.

## Phase 8 — PDF reports

- [ ] **8.1** pdf-lib generator: title, sections, references, timestamp, conversation metadata.
- [ ] **8.2** `POST /api/report` → upload to Supabase Storage → **signed URL** (not public); persist on `messages.pdf_url`.
- [ ] **8.3** Expose PDF as an agent tool + download affordance in UI.

**Done when:** a report generates, downloads, and is **not** readable by another user's session.

## Phase 9 — Hardening

- [ ] **9.1** Friendly error UI for all §13 cases: expired key, network timeout, provider unavailable, invalid model, insufficient credits.
- [ ] **9.2** Per-user rate limiting (protects the platform-owned Serper key).
- [ ] **9.3** Mobile-responsive pass across all pages.
- [ ] **9.4** Landing page (hero, features, pricing, FAQ, CTA).

**Done when:** each error state is reproducible and renders friendly copy — never a raw stack trace.

## Phase 10 — Ship

- [ ] **10.1** Deploy to Vercel: env vars, OAuth redirect URIs, live Stripe webhook endpoint.
- [ ] **10.2** Full E2E walkthrough on production against the Definition of Done.

---

## Definition of Done

A submission is complete when:

- User can sign up using Google or GitHub.
- Paywall is enforced.
- Coupon `SID_DRDROID` unlocks the application.
- Stripe payment unlocks the application.
- User can configure API endpoint and API key.
- User can create multiple chat threads.
- Context is preserved per thread.
- Agent can perform multiple tool calls.
- PDF reports can be generated.
- Usage dashboard displays token analytics.
- Credits decrement correctly.
- Entire application is deployed and publicly accessible.

---

## Testing strategy (right-sized)

- **Unit:** cost calculation, credit decrement/refund logic, encryption round-trip.
- **Integration:** Stripe webhook idempotency (replay the same event twice), coupon single-use.
- **Manual E2E:** the Definition of Done checklist, run on production.

## Critical path

`-1 → 0 → 1 → 2 → 3 → 4 → 5 → 6` is strictly sequential (each phase depends on the last).
`7`, `8`, `9.4` can be parallelized once Phase 5 lands. Ship `10` last.

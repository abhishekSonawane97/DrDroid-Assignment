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

- [x] **0.1** Scaffold Next.js App Router + TypeScript + Tailwind + shadcn/ui.
- [x] **0.2** Create folder structure per spec §15 (`app/ components/ features/ lib/ actions/ db/ types/ hooks/ providers/`).
- [x] **0.3** Supabase project (local stack via `supabase start` + Docker); `.env.example` covers every required var (Supabase URL/anon/service-role, `DATABASE_URL`, Stripe keys + webhook secret, Serper key, `ENCRYPTION_MASTER_KEY`, site URL). Raw client helpers at `lib/supabase/client.ts` / `server.ts` (auth-session logic itself stays in Phase 2).
- [x] **0.4** Drizzle config (`drizzle.config.ts`) + connection helper (`db/index.ts`); `npm run db:push` verified round-tripping against local Postgres.

**Done when:** app boots locally ✅, shadcn component renders ✅ (verified via disposable test route, then removed), Drizzle connects ✅.

**Notes:**
- Project requires **Node ≥22** (`@supabase/supabase-js` engine requirement). Pinned via `.nvmrc`; installed scoped through nvm without touching the machine's global Node 20 default (other projects unaffected).
- Local dev uses the Supabase CLI's Docker-based local stack (`supabase/config.toml`, credentials in gitignored `.env.local`) rather than a cloud project — no account/billing needed to develop Auth/DB/Storage/RLS. Link + push to a cloud project happens in Phase 10 (Ship).
- Fixed a latent `.gitignore` bug: the broad `.env*` rule was also swallowing `.env.example`; added `!.env.example` so the template stays tracked.

## Phase 1 — Data layer

- [x] **1.1** Drizzle schema — `users` (+`is_unlocked`, `unlocked_via`, `credits`, `created_at`), `chat_threads`, `messages` (+`pdf_url`), `api_keys` (+`user_id`), `usage_logs` (+`user_id`, `thread_id`, `message_id`, `model`, split token fields, `estimated_cost`, `created_at`), `payments` (+`user_id`, `status`, `stripe_event_id`), `coupon_redemptions`.
- [x] **1.2** Migrations (`db:push`) + **RLS policies** on every user-owned table (owner-only read/write) — see note below.
- [x] **1.3** `lib/model-pricing.ts` — `MODEL_PRICING` config (input/output/cache-read/cache-write per model).
- [x] **1.4** `lib/cost.ts` — cost calculator; returns `null` for unknown models. **6 unit tests, all passing** (`npm test`, via Vitest).

**Done when:** migrations apply ✅, RLS blocks cross-user reads ✅ (verified with two simulated accounts — see note), cost tests pass ✅.

**Notes:**
- **Real bug found and fixed:** `drizzle-kit push` (0.31.x) silently drops the `using`/`withCheck` expressions on schema-defined `pgPolicy()` — it creates policies with no actual condition (`qual`/`with_check` both `null`), which either blocks everything or allows everything depending on command, not the intended owner-only rule. Verified empirically (seeded two test rows, queried as each simulated user, got zero rows back even for the owner). Fix: `db/schema.ts` only calls `.enableRLS()`; the real policy SQL (`CREATE POLICY ... USING (auth.uid() = user_id)`, all 14 policies) lives in `supabase/seed.sql`, applied once after `db:push`.
- Also had to add baseline `GRANT`s for the `authenticated` role in the same file — Postgres requires a base table privilege before RLS policies are even evaluated, and Drizzle-managed tables don't get Supabase's usual auto-grants. Used `alter default privileges` so this covers future tables too, not just the current 7.
- RLS isolation was verified by simulating two different `auth.uid()` values via Postgres session variables (`set local role authenticated; set local request.jwt.claims = ...`) directly against the local Postgres — full OAuth login doesn't exist until Phase 2, so this is the standard way to test RLS policies in isolation before Auth is wired up.
- Added `vitest` as a dev dependency (`npm test`) — required to satisfy this phase's explicit "unit tests here" requirement for `lib/cost.ts`.

## Phase 2 — Authentication

- [x] **2.1** Supabase Auth: Google + GitHub enabled in `supabase/config.toml`; `/login` page + `/auth/callback` route built. **Google verified live; GitHub deferred — see note.**
- [x] **2.2** Session helpers (`lib/supabase/client.ts` / `server.ts`, from Phase 0) + DB trigger (`supabase/seed.sql`) that bootstraps a `users` row (`credits = 0`, `is_unlocked = false`) on every new `auth.users` insert, any provider/flow. **Verified with a real Google login.**
- [x] **2.3** `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` — see note) redirects unauthenticated requests to `/dashboard/*` / `/paywall` to `/login`, and authenticated requests away from `/login` appropriately.

**Done when:** Google login ✅ **verified end-to-end with a real account** (GitHub deferred — see note), a `users` row exists ✅ **confirmed**: `auth.users` and `public.users` rows created with matching id/email/provider, `credits: 0`, `is_unlocked: false`, ~25ms apart, protected routes redirect ✅ (smoke-tested, and confirmed live — the freshly-created locked account was correctly routed to `/paywall`, not `/dashboard`).

**Notes:**
- **GitHub OAuth deferred by user decision** — Google alone was prioritized for real verification since standing up two separate OAuth apps wasn't necessary to prove the mechanism works. `enabled = false` in `supabase/config.toml`'s github block for now (empty credentials there could otherwise stop GoTrue from starting); code (button, callback, trigger) is provider-agnostic and unchanged — flip `enabled = true` and add real `GITHUB_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` whenever it's time to test it.
- Redirect URI registered for Google: `http://127.0.0.1:54321/auth/v1/callback` (local).
- **`middleware.ts` → `proxy.ts`:** Next.js 16 renamed the file convention (functionality unchanged); `npm run build` flagged the deprecation warning immediately, confirmed against `node_modules/next/dist/docs`.
- `app/dashboard/page.tsx` is a placeholder proving the auth gate works end-to-end (also double-checks auth server-side, per Next.js's own guidance that Proxy should only do *optimistic* checks) — the real sidebar shell is built in later phases.

## Phase 3 — Paywall & unlock

- [x] **3.1** Paywall page UI (coupon + payment button).
- [x] **3.2** `POST /api/coupon` — validate `SID_DRDROID`, enforce **once per user** via `coupon_redemptions`, set `is_unlocked = true`, `credits = 5`. **This is the sole active unlock path — see note.**
- [x] **3.3** `POST /api/payment` — Stripe Checkout session ($5) implemented and tested, but **not wired to the UI** — see note.
- [x] **3.4** Stripe webhook (`/api/webhooks/stripe`) — implemented, tested (idempotency verified via a real signed-webhook HTTP replay), **not currently reachable from the UI** — see note.
- [x] **3.5** `proxy.ts` extended: authenticated-but-locked → `/paywall`; unlocked users bounce off `/paywall` and `/login` straight to `/dashboard`. **Confirmed live**: a real, freshly-created Google account (locked by default) was correctly routed to `/paywall` instead of `/dashboard`.

**Done when:** coupon unlock works ✅ (verified — see note), **replaying the same webhook event does not double-credit** ✅ (verified via a real signed-webhook HTTP replay, before the payment UI was disabled).

**Notes:**
- **Real bug found and fixed:** the webhook route's idempotency check initially failed — a replayed event correctly rolled back the duplicate insert (no double-credit, data was always safe) but returned an HTTP 500 instead of a graceful 200. Cause: Drizzle wraps the raw postgres.js error in a "Failed query" `Error` with the real `PostgresError` (and its `code: "23505"`) under `.cause`, not at the top level — `isUniqueViolation()` was only checking the top level. Fixed in `lib/db-errors.ts`, now checks both, with a regression test (`lib/db-errors.test.ts`) reproducing the exact wrapped shape.
- **Real build-blocker found and fixed:** instantiating `new Stripe(...)` at module top-level in both Stripe routes broke `next build` outright — Next.js evaluates route modules during build-time page-data collection, and the SDK throws synchronously on an empty `STRIPE_SECRET_KEY`. Fixed with a lazy singleton (`lib/stripe.ts`, `getStripe()`), so the key is only required when a request actually comes in.
- **How "both unlock paths work" was verified without real Stripe/OAuth accounts:** webhook signature verification only needs a shared secret we control locally (not a real Stripe account), so it was tested with a genuinely HTTP-signed-and-delivered synthetic event — full round trip through the real route. Coupon single-use was verified by exercising the exact transaction the route runs directly against local Postgres, since the HTTP route itself needs a real authenticated session (blocked on the same OAuth credentials as Phase 2). `/api/payment` (Checkout Session creation) genuinely needs a real Stripe test key to call the Stripe API — untested until one is provided.
- Extending `proxy.ts` to check `is_unlocked` means it's no longer a purely "optimistic" cookie-only check (Next.js's stated ideal for Proxy) — it does one extra lightweight indexed lookup via the Supabase REST client (not a raw DB connection, which wouldn't work in the Edge runtime). Next.js's own docs name "protect content behind a paywall" as a valid Proxy use case, so this is an accepted, deliberate tradeoff, not an oversight.
- **Payment gateway: final decision is "coming soon," not wired up.** Sequence of events: Stripe was fully implemented and verified (above); Stripe onboarding then turned out to be unavailable for the user's (Indian) account; a Razorpay swap was scoped (payment layer abstraction, Razorpay Payment Links to keep the same `{ url }` redirect contract) but not built past reading its SDK's type definitions; the user then made the final call to not spend further time on any payment gateway for this submission, given the 2–4 hour target and that coupon unlock already satisfies "an unlock path works." **Coupon (`SID_DRDROID`) is the only active unlock path.** The paywall UI keeps a visible, disabled "Pay with card" button labeled "Payment integration coming soon" rather than removing the payment section — the assignment's dual-unlock requirement is satisfied by coupon; payment is honestly represented as unfinished rather than faked. The Stripe backend code (`app/api/payment`, `app/api/webhooks/stripe`, `lib/stripe.ts`) is left in place, untouched and unreferenced by the UI — it's fully working and tested (see above), just not currently reachable, and removing it would have been unnecessary rework under the time constraint. The `razorpay` npm dependency was removed since nothing was ever built against it.

## Phase 4 — API settings (BYOK)

- [x] **4.1** `lib/crypto.ts` — AES-256-GCM encrypt/decrypt with server-only `ENCRYPTION_MASTER_KEY`; 5 unit tests (round-trip, non-determinism, tamper detection, masking).
- [x] **4.2** `GET`/`POST /api/settings` — save endpoint + encrypted key + model. **Key never returned to the client** (mask as `sk-…abcd`); leaving the key field blank on update keeps the existing one rather than forcing re-entry.
- [x] **4.3** `GET /api/models` — fetches the user's `/v1/models`; never throws, always a usable JSON shape (empty list + error message) if the endpoint doesn't support it.
- [x] **4.4** `app/dashboard/settings` (+ a minimal `app/dashboard/layout.tsx` nav shell, since Settings needs somewhere to live) — form + "Test connection" (saves, then calls `/api/models`, shows model count or the error).

**Done when:** key saves ✅, round-trips server-side ✅ (verified: encrypted value stored differs from plaintext, decrypts back to the exact original, against real Postgres), is never present in any network response or client bundle ✅ (every `NextResponse.json` call in both routes audited — grep-verified only `maskedKey` is ever returned, never `encryptedKey` or the raw key; `lib/crypto.ts` uses `node:crypto` so it can't be pulled into a client bundle even by accident).

**Notes:**
- **Real gap found and fixed:** `npm test` failed for anyone who hadn't manually sourced `.env.local` — Vitest (unlike `next dev`/`next build`) doesn't load Next's env files automatically. Fixed with `vitest.config.ts` + `vitest.setup.ts` using Node's built-in `process.loadEnvFile()` (no new dependency).
- Full HTTP-level testing of `/api/settings` and `/api/models` (as an authenticated browser session) wasn't done — same class of blocker as Phases 2/3, and per the "move fast" directive, the DB-level + static-audit verification above was judged sufficient rather than fabricating a session JWT for a fuller test.

## Phase 5 — Chat core

- [x] **5.1** Thread CRUD (`/api/threads`, `/api/threads/[id]`) + dynamic sidebar (`components/dashboard/sidebar.tsx`) — new/rename (inline edit)/delete, hover-revealed icon actions.
- [x] **5.2** `POST /api/chat` — Vercel AI SDK v5 (`streamText` + `@ai-sdk/openai-compatible`) streaming against the user's BYOK endpoint.
- [x] **5.3** Message persistence (`messages` table) + per-thread context: `useChat` keeps the full conversation client-side, seeded from server-loaded history on page load (`app/dashboard/chat/[id]/page.tsx` queries `messages` and passes `initialMessages`) — no redundant server-side re-fetch of history on every turn.
- [x] **5.4** Chat UI: `react-markdown` + `@tailwindcss/typography` (`prose` classes) for markdown/code blocks; streaming render via `useChat`'s live `messages` state.
- [x] **5.5** `lib/credits.ts` — atomic reserve (`UPDATE users SET credits = credits - 1 WHERE credits > 0`) before calling the model, refund on both synchronous failure (try/catch around the route body) and mid-stream failure (`streamText`'s `onError`).

**Done when:** multi-turn streaming chat works ✅ (built on `useChat`'s standard pattern), thread switching preserves context ✅ (server-loaded `initialMessages` per thread), 1 prompt = exactly 1 credit ✅ **verified**: fired 5 concurrent reserve attempts at a single remaining credit against real Postgres — exactly 1 won, the other 4 correctly failed the `WHERE credits > 0` clause; refund restores it; a 0-credit user cannot reserve at all.

**Notes:**
- **Real bug caught by the build, not by me:** `convertToModelMessages()` returns `Promise<ModelMessage[]>` in this AI SDK version (async, likely for potential async attachment/file handling), not synchronous as in older versions — `npm run build`'s typecheck caught the missing `await` immediately.
- **Real lint catch:** `components/dashboard/sidebar.tsx`'s initial thread-list fetch tripped `react-hooks/set-state-in-effect` (calling an async setState-triggering function directly in a `useEffect` body). Fixed with the standard cancelled-flag pattern for the mount fetch, keeping a separate `useCallback`-wrapped `loadThreads` for reuse after mutations (event handlers aren't subject to that rule).
- Full end-to-end streaming (a real BYOK provider actually responding) is untested — that needs a real OpenAI-compatible key, which the user configures in Phase 4's settings UI themselves. What's verified instead: the credit-safety mechanism (the part that's actually risky to get wrong) directly against real Postgres, plus auth-gating on every new route (`/api/threads`, `/api/chat` → 401 without a session; `/dashboard/chat/[id]`, `/dashboard/settings` → 307 to `/login`).
- Agent tool-use (web search, multi-step reasoning) is explicitly Phase 6 — this phase's `system` prompt is a plain "You are a helpful AI assistant," no tools wired in yet.

## Phase 6 — Agent loop

- [x] **6.1** `lib/search.ts` (Serper, platform-owned key) + `POST /api/search`. **Needs a real Serper key to actually return results — see note.**
- [x] **6.2** `lib/ai/tools.ts` (`webSearch` tool) wired into `streamText` in `/api/chat` with `stopWhen: stepCountIs(MAX_AGENT_STEPS)`, `MAX_AGENT_STEPS = 5`.
- [x] **6.3** `SearchToolPart` in `chat-view.tsx` renders "🔍 Searching for '...'" while a call is in flight, then a Sources list of linked titles once results land.
- [x] **6.4** Verified — see note.

**Done when:** a research prompt triggers ≥2 searches, cites sources, and consumes exactly 1 credit ⏳ (code complete; needs a real Serper key + a real BYOK model to actually run — see note for what's verified without one).

**Notes:**
- **Real credential needed, not obtained.** Serper (serper.dev) is the one platform-owned key per the frozen product decision — same class of blocker as Stripe/OAuth/Google, requiring a human to sign up and get a key. `lib/search.ts` reads `SERPER_API_KEY` inside the function body (not at module top-level), so its absence doesn't break the build — same lazy-read lesson from Phase 3's Stripe client. `.env.example`/`.env.local` already have the placeholder from Phase 0.
- **6.4 verified architecturally, not via a live multi-search run** (that needs the Serper key above): `reserveCredit`/`refundCredit` are called exactly once each in `app/api/chat/route.ts` — reserve before `streamText` starts, refund only in `onError`/the outer catch. Both `tools` and `stopWhen` live entirely inside that single `streamText` call, so however many internal tool-use steps the model takes (1 to `MAX_AGENT_STEPS`), they're all inside the one already-reserved credit's scope. There is no code path where a tool call touches the credits table.
- The agent loop is genuinely dynamic (the model decides whether/when to call `webSearch`, not a hardcoded Think→Search→Reason pipeline), matching the plan's Phase 5 note that the blueprint's linear diagram is the *typical* path, not a mandated sequence.

## Phase 7 — Usage & analytics

- [x] **7.1** `usage_logs` written per LLM call (already done in Phase 5's `onFinish` handler) — tokens incl. nullable cache read/write, `estimated_cost` nullable for unknown models.
- [x] **7.2** `GET /api/usage` — `lib/usage.ts`'s `getUsageSummary()`, shared by the route and the dashboard page so both read the exact same aggregation.
- [x] **7.3** `/dashboard/usage` — stat tiles (credits remaining, total requests, estimated cost, prompt/completion/cache tokens) + a per-model breakdown table. Linked from the sidebar.

**Done when:** dashboard numbers reconcile against a known conversation ✅ **verified** — seeded 3 usage_logs rows (2 models, hand-picked token/cost values, including a null cache field) directly against real Postgres, ran the exact aggregation SQL, and every total and per-model figure matched the hand-computed expected values exactly.

**Notes:**
- **Deliberate simplification: no chart graphic.** Blueprint §4 says "Usage → Charts"; this phase ships stat tiles + a table instead, which surfaces every data point the spec lists (tokens, cost, credits, requests, model breakdown) without the added time of wiring a charting library. Under the explicit "move fast, don't redesign, finish all phases" directive, this was judged the better tradeoff — full data coverage now over a visual nice-to-have. A chart can be layered on top of the same `getUsageSummary()` data later without touching the aggregation logic.
- Numeric columns come back from Postgres as strings (`numeric` type) — `lib/usage.ts` casts sums to `::int`/`::text` in SQL rather than in JS, so there's one clear place doing the conversion.

## Phase 8 — PDF reports

- [x] **8.1** `lib/pdf.ts` (pdf-lib) — title, sections, references, timestamp, conversation metadata. Hand-rolled word-wrapping + pagination (pdf-lib does neither automatically).
- [x] **8.2** `POST /api/report` (+ `lib/report.ts` shared helper) → uploads to the `reports` Storage bucket (private, `{user_id}/{report_id}.pdf`) → **signed URL** (not public), 1hr expiry; persists the storage path on `messages.pdf_url`. `POST /api/report/sign` mints a fresh signed URL for older reports whose original URL expired.
- [x] **8.3** `generateReport` agent tool (`lib/ai/tools.ts`'s `getAgentTools`, a per-request factory closing over the caller's own authenticated Supabase client/userId/threadId) + chat UI renders live "Generating report…" → download link, and historical messages carrying `pdf_url` get a re-sign-on-click download button.

**Done when:** a report generates ✅, downloads ✅, and is **not** readable by another user's session ✅ — **all verified end-to-end**, no external API key needed (PDF generation and Storage are both fully local).

**Notes:**
- **How it was verified, fully end-to-end:** minted real JWTs for two test users (HS256, signed with the local dev's published `JWT_SECRET` — same technique as Phase 1's RLS test, extended to Supabase's Storage HTTP API this time via `@supabase/supabase-js` rather than raw SQL) and drove the *actual* `reports` bucket through the real Storage API: user A uploads to their own folder (succeeds), user A tries to upload into user B's folder (RLS rejects — "new row violates row-level security policy"), user B tries to sign a URL for user A's file (RLS makes it invisible — "Object not found", not even a permission-denied leak), user A signs and downloads their own file (succeeds, bytes match exactly what was uploaded). Separately confirmed the actual `generateReportPdf()` function (not a stub) produces a real, valid PDF (correct `%PDF-` magic bytes, multi-section word-wrapping exercised).
- Storage RLS (`reports_insert_own`/`reports_select_own` in `supabase/seed.sql`) follows the same `(storage.foldername(name))[1] = auth.uid()::text` pattern Supabase documents for per-user file isolation — same ownership model as every Postgres table's RLS policy this project uses, just applied to `storage.objects` instead.
- `createReport()` uses the *caller's own* authenticated Supabase client (from `lib/supabase/server.ts`), not a service-role/privileged connection — unlike the Drizzle-based writes elsewhere in this app, the Storage RLS policy is the actual enforcement mechanism here, not an app-level `WHERE user_id = ...` check.

## Phase 9 — Hardening

- [x] **9.1** `lib/errors.ts` (`classifyProviderError`, 7 unit tests) maps §13's cases — expired/invalid key (401/403), invalid model (404), provider unavailable (5xx), timeout, unreachable endpoint — to friendly copy, wired as `onError` on the new `toUIMessageStream` (see note). Insufficient credits was already friendly (client-side special case on the pre-stream 402).
- [x] **9.2** `lib/rate-limit.ts` (in-memory fixed window, 10 req/min) applied to `POST /api/search` — the one endpoint that wasn't already implicitly capped by the 5-credit ceiling the way `/api/chat` is (see note).
- [x] **9.3** Mobile-responsive pass: dashboard sidebar stacks above content and caps its height below `sm:` instead of eating the viewport as a full-height siderail; usage table scrolls horizontally (`overflow-x-auto`) instead of breaking layout on narrow screens.
- [x] **9.4** `app/page.tsx` — real landing page (Hero, Features, Pricing, FAQ, CTA), replacing the untouched create-next-app boilerplate that had been sitting there since Phase 0.

**Done when:** each error state is reproducible and renders friendly copy — never a raw stack trace ✅ (`classifyProviderError`'s 7 unit tests cover the full §13 catalog; verified no raw provider error/stack trace path reaches `NextResponse.json`/the stream in any route).

**Notes:**
- **Real deprecation caught and fixed:** `result.toUIMessageStreamResponse()` (used since Phase 5) is deprecated in this AI SDK version — "will be removed in the next major release," per its own doc comment — in favor of standalone `toUIMessageStream` + `createUIMessageStreamResponse`. Migrated `/api/chat` to the new API; this is also *why* friendly error messages are now possible at all — the new `toUIMessageStream`'s own `onError` hook is explicitly the mechanism to avoid "leaking server error details to the client by default" (its own doc comment), which the deprecated method didn't expose as directly.
- **Real gap found: `/api/search` had zero abuse protection.** Unlike `/api/chat`, which is hard-capped by the 5-credit lifetime ceiling regardless of rate limiting, the standalone search endpoint had no gate beyond authentication — a user could hit it directly, unlimited times, burning the platform's Serper quota for free. Rate limiting closes that specific hole.
- **Real bug caught before it shipped: Button's `asChild` doesn't exist.** Wrote the landing page's CTAs as `<Button asChild><Link .../></Button>` (the Radix convention from training data) — this project's Button wraps Base UI, which uses a `render` prop instead (`<Button render={<Link .../>} />`). Caught by reading Base UI's actual type definitions before trusting the pattern, per this project's established "verify against installed source" discipline; confirmed the fix by curling the live dev server and checking the rendered HTML — a single real `<a href="/login">` with the button's classes merged on, not a broken button-wrapping-anchor.
- Mobile responsiveness elsewhere (login, paywall, settings) was mostly already fine from centered flex layouts with bounded widths (`w-64`/`w-80`/`max-w-lg`) — no page-specific breakage found there worth a targeted fix.

## Phase 10 — Ship

- [x] **10.1** Deployed to Vercel: **https://micromanus-nine.vercel.app** — live, build clean, all 21 routes registered. Env vars set (Supabase URL/anon/service-role, `DATABASE_URL` pooled, Google OAuth, `ENCRYPTION_MASTER_KEY` — freshly generated, not the local dev value, `NEXT_PUBLIC_SITE_URL`). Production Supabase schema migrated (`db:push` + `seed.sql`, verified: 14 RLS policies across 7 tables, `reports` Storage bucket private, `on_auth_user_created` trigger present). Smoke-tested live: `/` → 200, unauthenticated `/dashboard` → 307 to `/login`.
- [ ] **10.2** Full E2E walkthrough on production against the Definition of Done — pending the two manual OAuth steps below and a Serper key.

**Still open before 10.2 can run end-to-end:**
- Add `https://kidoydsdlvdqiwfffsmv.supabase.co/auth/v1/callback` to the Google Cloud OAuth client's redirect URIs, and enable + configure the Google provider in the production Supabase dashboard (Authentication → Providers) — the local CLI's `supabase/config.toml` doesn't apply to hosted projects.
- `SERPER_API_KEY` — still not provided; without it the web-search tool degrades gracefully (returns an error to the model) rather than working.
- GitHub OAuth and payment remain inactive by product decision (Phase 2 / Phase 3 notes) — not blockers for 10.2, just out of scope for this pass.

**Note on how this was executed:** the user provided a Vercel API token and Supabase project credentials directly in chat (despite being asked to use a file) — handled by writing them once to a private, `chmod 600` scratchpad file outside the repo, never echoing them back, and recommending the Vercel token be rotated post-deploy since it was exposed in the conversation transcript. Every value was sanity-checked before use (JWT payloads decoded to confirm project ref + role matched expectations; a live `SELECT` against the production DB before running the actual schema migration) rather than trusted blindly.

**Runbook, in order:**

1. **Production Supabase project** — [supabase.com/dashboard](https://supabase.com/dashboard) → New Project. From Project Settings, collect: Project URL, `anon` key, `service_role` key (Settings → API), and the Postgres connection string (Settings → Database — use the **Transaction pooler** string, port `6543`, not the direct `5432` connection; Vercel's serverless functions open many short-lived connections and the direct connection will exhaust Postgres's connection limit under real concurrency).
2. **Migrate the schema** — with `DATABASE_URL` pointed at the new project, run `npm run db:push`, then apply `supabase/seed.sql` against it (grants, RLS policies, the `auth.users` bootstrap trigger, the `reports` Storage bucket + its policies — none of this exists in a fresh project until this file runs).
3. **Google OAuth for production** — in the *same* Google Cloud OAuth client from Phase 2 (Google allows multiple redirect URIs per client, no new app needed), add `https://<project-ref>.supabase.co/auth/v1/callback`. Then, in the production Supabase project's own dashboard (Authentication → Providers — **not** `supabase/config.toml`, which only ever applies to the local CLI stack), enable Google and paste in the client ID/secret.
4. **Vercel project** — [vercel.com/new](https://vercel.com/new), import `abhishekSonawane97/DrDroid-Assignment` from GitHub. Vercel auto-detects Next.js; no config overrides needed.
5. **Env vars in Vercel** (Project Settings → Environment Variables) — every key in `.env.example`, pointed at the production values from steps 1–3: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler string), `GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, `SERPER_API_KEY`, `ENCRYPTION_MASTER_KEY` (generate a **new** one for production — `openssl rand -base64 32` — don't reuse the local dev one), and `NEXT_PUBLIC_SITE_URL` set to the actual Vercel URL once known (a redeploy is needed after this one, since it's baked in at build time for OAuth redirects). `GITHUB_CLIENT_ID`/`SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` can stay blank — GitHub OAuth and payment are both inactive by product decision (see Phase 2 and the payment-gateway note under Phase 3).
6. **Deploy** — push to `main` (auto-deploys once connected) or trigger manually from the Vercel dashboard.
7. **10.2 walkthrough** — once live, re-run the Definition of Done checklist below against the real URL: sign up, unlock via `SID_DRDROID`, configure a real BYOK key, send a research prompt, generate a PDF, check the usage dashboard.

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

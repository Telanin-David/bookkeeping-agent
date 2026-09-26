# Bookkeeping Agent MVP — Progress Tracker

## Deliverables

| # | Deliverable | Status | Branch | PR |
|---|-------------|--------|--------|----|
| 1 | Backend API Specification (OpenAPI YAML + docs) | ✅ Done | `feat/deliverable-1-api-spec` | merged to main |
| 2 | Database Schema & Migrations | ✅ Done | `feat/deliverable-2-database-schema` | merged to main |
| 3 | Backend Source Code Structure & Entry Point | ✅ Done | `feat/deliverable-3-backend-structure` | merged to main |
| 4 | Frontend Source Code Structure & Components | ✅ Done | `feat/deliverable-4-frontend-structure` | merged to main |
| 5 | Claude Integration & System Prompt | ✅ Done | `feat/deliverable-5-claude-integration` | merged to main (#16) |
| 6 | Authentication & Authorization System | ✅ Done | `feat/deliverable-6-auth` | — |
| 7 | Report Generation & PDF Templates | ⬜ Not started | — | — |
| 8 | Alert Detection & Routing System | ⬜ Not started | — | — |
| 9 | Excel Import & Validation Pipeline | ⬜ Not started | — | — |
| 10 | DevOps & Infrastructure | ⬜ Not started | — | — |
| 11 | Testing & QA | ⬜ Not started | — | — |
| 12 | Documentation & Runbooks | ⬜ Not started | — | — |

## Notes
- `feat/premium-ui-polish` (PR #14, merged to main) substantially extended Deliverable 4's UI beyond its original scope: mobile navigation redesign, monochrome glass design system, printable receipts, and shop onboarding/branding. It also added `Shop.logoUrl`/`signatureUrl` and a `/shops/{shopId}/branding/{kind}` endpoint to `docs/api/openapi.yaml` — not yet implemented server-side, so whoever picks up Deliverable 7 (Report Generation & PDF Templates) should check that spec section.

- **Deliverable 5** implemented the chat agent (`services/claude.ts`) as a real tool-use loop against `claude-opus-5` (categorization stays on `claude-haiku-4-5`), replacing the earlier stub that only echoed one message with no context, no tools, and a model ID (`claude-sonnet-4-6`) that predates this codebase's actual usage. Four tools: `record_transaction`, `find_transactions`, `get_spending_summary` (real SQL aggregation — the agent is instructed to never sum amounts itself), and `show_receipt` (only ever fires on a transaction `find_transactions` already confirmed belongs to the shop, closing off a path to a hallucinated/foreign transaction id). Migration `002_chat_extraction.sql` adds `chat_messages.extracted_transaction_ids` / `.receipt_transaction_id` so a message can record what it did. 7 unit tests cover the tool-execution logic in `services/claude.test.ts` (mocking the Anthropic client) — this is the only test coverage in the repo so far; Deliverable 11 (Testing & QA) still needs route/integration-level tests. `@anthropic-ai/sdk` was bumped `0.39.0 -> 0.128.0`; the old pin predates `output_config`/adaptive-thinking support and hadn't actually been installed.
  - Fixed in passing, since the chat routes needed real ownership checks to be usable at all: `GET/POST /chat/sessions/{sessionId}/messages` previously did not verify the session belonged to the requesting user — any authenticated user could read or post into another user's chat session by sessionId alone.
  - The frontend/backend `TransactionType`/`TransactionStatus` mismatch noted during D5 (`income` vs `sale`, etc.) was fixed in PR #17: the frontend now uses the backend's enum.

- **Deliverable 6** made sessions actually work and closed the remaining authorization gaps:
  - **Refresh never worked before this.** Refresh tokens were JWTs signed with an empty payload, so `/auth/refresh` always answered 401 "User not found". Every owner was effectively signed out after 15 minutes, and on every page reload. Refresh tokens are now opaque random strings, stored only as SHA-256 hashes in a new `refresh_tokens` table (migration `003_refresh_tokens.sql`, which drops the unused `users.refresh_token_hash` columns). Each login starts a token *family* (one per device), so a phone and a laptop stay signed in independently. Every refresh rotates the token. Replaying a rotated token more than 30s later revokes that device's session; inside 30s it is treated as a two-tab race and just refused. `JWT_REFRESH_SECRET` is no longer used.
  - `/auth/refresh` returns the user as well, and the frontend calls it on every load (`AuthBootstrap`) to restore the session. Guards wait for that check (`status: 'loading'`), instead of redirecting to /login on every reload.
  - `/auth/logout` works from the cookie alone, with no access token needed, and signs out only this device. On the frontend, signing out or a session expiring wipes the React Query cache and the persisted shops store, so a shared phone doesn't show the previous owner's data.
  - Frontend 401 handling:
    - Refresh is single-flight: parallel 401s share one refresh, since rotation would reject a second.
    - It never refreshes on `/auth/*` calls. Before this, a 401 from the refresh call triggered another refresh, endlessly.
    - It signs out cleanly when renewal fails.
  - Login:
    - Email is case-insensitive.
    - An unknown email costs the same bcrypt time as a wrong password.
    - The spec's per-IP limits are now enforced: signup 10/hour; login 5 *failed* attempts per 15 minutes, with successful logins not counted.
  - Signup now shows the password rule upfront. It used to report a weak password as "Email may already be in use".
  - Authorization: `POST /reports/{credit,stock,pl}` and `POST /imports/upload` didn't check that `shopId` belonged to the caller, so anyone could import into, or request reports for, another owner's shop. There is now a shared `requireShopOwnership` middleware. Transactions use it too, and a malformed shop id now returns 404 instead of a Postgres 500.
  - Tests: 8 route tests in `routes/auth.test.ts` (supertest, db mocked). Also verified against real Postgres: a 30-check API walkthrough and an 11-check browser walkthrough (reload, token expiry, sign-out, demo mode).
  - **For Deliverable 10 (DevOps):**
    - The refresh cookie is `SameSite=Strict; Path=/api/v1/auth`. That works when the frontend and API are the same *site* (e.g. `app.example.com` + `api.example.com`, or the frontend proxying `/api/*` via its existing Next.js rewrite). It will **not** be sent if they sit on unrelated domains, e.g. `*.vercel.app` and a separate API host: every reload would then sign the owner out.
    - Behind a proxy, Express also needs `trust proxy` set so the per-IP rate limits see the real client IP.
    - Expired and revoked `refresh_tokens` rows are never pruned. A periodic `DELETE ... WHERE expires_at < NOW()` job belongs in D10.
  - Not built (needs an email provider): password reset / "forgot password".

## Rules
- Never commit/push to `main` directly.
- One deliverable per branch. Create feature branch → do work → push → open PR → wait for merge.
- Do not start next deliverable until current PR is merged.
- Check this file before starting any work.

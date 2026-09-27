# Bookkeeping Agent MVP — Progress Tracker

## Deliverables

| # | Deliverable | Status | Branch | PR |
|---|-------------|--------|--------|----|
| 1 | Backend API Specification (OpenAPI YAML + docs) | ✅ Done | `feat/deliverable-1-api-spec` | merged to main |
| 2 | Database Schema & Migrations | ✅ Done | `feat/deliverable-2-database-schema` | merged to main |
| 3 | Backend Source Code Structure & Entry Point | ✅ Done | `feat/deliverable-3-backend-structure` | merged to main |
| 4 | Frontend Source Code Structure & Components | ✅ Done | `feat/deliverable-4-frontend-structure` | merged to main |
| 5 | Claude Integration & System Prompt | ✅ Done | `feat/deliverable-5-claude-integration` | merged to main (#16) |
| 6 | Authentication & Authorization System | ✅ Done | `feat/deliverable-6-auth` | merged to main (#18, #19) |
| 7 | Report Generation & PDF Templates | ✅ Done | `feat/deliverable-7-reports` | merged to main (#20) |
| 7b | Stock & Shelf Counting (owner's request) | 🟡 In review | `feat/stock-tracking` | — |
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
    - Behind nginx, set `TRUST_PROXY=1` (the number of proxies in front). Without it, every request looks like it comes from 127.0.0.1, so 5 failed logins from anyone would block logins for everyone. Keep it at `0` when nothing is in front; trusting `X-Forwarded-For` there would let clients fake their IP.
    - Expired and revoked `refresh_tokens` rows are never pruned. A periodic `DELETE ... WHERE expires_at < NOW()` job belongs in D10.
  - Not built (needs an email provider): password reset / "forgot password".
- **Auth hardening (follow-up to D6):**
  - **Instant sign-out.** Access tokens carry `sid` (the device's refresh-token family). `requireAuth` checks that session is still active on every request, costing one indexed lookup. Signing a device out, or stolen-token detection, now cuts off its access token immediately, not up to 15 minutes later. Tokens without `sid` get a 401, so the app refreshes once and continues.
  - **Weak secrets.** In production, the server refuses to start if `JWT_ACCESS_SECRET` is under 32 characters or is the `.env.example` placeholder. Generate one with `openssl rand -base64 48`.
  - **Login limit per IP raised from 5 to 25 failed attempts per 15 minutes.** Nigerian mobile carriers put many phones behind one public IP, so 5 per IP let strangers lock each other out. Guessing a single account is still stopped at 5 by the per-account lockout, which doesn't depend on IP.

- **Deliverable 7** made reports real. Before it, the report form sent `from`/`to` while the API expects `dateFrom`/`dateTo`, so every download failed; the endpoints also returned a line of text labelled as a PDF.
  - **PDFs** (`services/pdf/`, pdfkit):
    - Profit & Loss (A4)
    - Credit Report (A4), as of the end date: who owed the shop that day, payments received in the period, the shop's unpaid bills and payments to suppliers
    - 80 mm receipts and invoices
    - All carry the shop's logo; invoices carry the signature. Long tables continue across pages with the header repeated and "Page x of y".
  - **Fonts:** text is set in Geist, the web app's font, bundled in `apps/backend/assets/fonts` with its OFL licence. Any character Geist lacks (₦, and Yoruba letters like ṣ) is drawn from DejaVu Sans, also bundled. Don't switch to a font without ₦.
  - **Accounting rule (owner's decision): accrual.** A credit sale is income on the day of the sale; a bill on credit is a cost on the day received. The P&L shows how much of each was still unpaid at the end of the period.
    - A debt being paid is recorded as a payment against it, never as a new sale; otherwise the income would be counted twice.
  - **Payments towards debts** (migration `005_debt_payments.sql`):
    - `debt_payments` holds each payment (amount, `paid_on` date). Existing paid debts were backfilled with one payment dated their last update.
    - The `transactions_with_payments` view adds `amount_paid`; the API returns `amountPaid` and `balance` on every transaction. All transaction reads go through the view.
    - A debt's status follows its payments: `settled` once they cover the amount, back to unpaid when one is undone. Money is compared in kobo, and the debt row is locked (`FOR UPDATE`) while a payment is recorded, so two payments at once can't overpay it.
    - Endpoints: `GET/POST /shops/{id}/transactions/{txId}/payments`, `DELETE …/payments/{paymentId}`. Refusals are 422 with plain messages: more than is owed, dated in the future or before the debt, already paid, not a debt.
    - The old `PATCH status: settled` still works: it pays whatever is left, dated today. `PATCH status: pending` removes the payments. A debt can't be lowered below what's been paid, or turned into a cash sale while it has payments.
    - The Credit Report is now a true snapshot as of its end date, because payments carry dates. The P&L's "unpaid" figure is as of the period end, too.
    - Frontend: "Record payment" on Transactions opens a screen showing owed, paid and still owed, the payment history with Undo, and an amount (default: the rest) and date (default: today in Lagos). Rows show "Part-paid" and "₦x paid · ₦y left". Invoices, on screen and PDF, show "Paid so far" and "Balance due".
    - Chat: the `record_debt_payment` tool replaces `mark_debt_paid`; it takes an optional amount and date, so "Mama Nkechi paid ₦5,000 yesterday" is recorded against her debt. **Not yet tried against the real Claude API**, because no `ANTHROPIC_API_KEY` is set in the dev environment; the tool is covered by unit tests with a mocked client.
  - **Transactions filters fixed:** the list sent `from`/`to` (ignored by the API) and the API ignored `status`, so the date and status filters did nothing. Both work now.
  - **Stock report is not available yet.** There are no products or quantities, so `POST /reports/stock` returns 501 and the UI hides it. The owner wants real shelf counting with low-stock warnings, planned as its own deliverable next.
  - **Branding upload** (`PUT/DELETE /shops/{id}/branding/{logo|signature}`, migration `004_shop_branding.sql`):
    - PNG and JPEG only, checked from the file's bytes, because those are the formats pdfkit can embed.
    - Each upload gets a new random file name; the old file is deleted.
    - Served publicly at `/api/v1/files/branding/{key}`.
    - Files live under `UPLOAD_DIR`. On the VPS this must be a persistent, backed-up folder.
  - **Date bug fixed:**
    - pg parsed Postgres `DATE` columns into JS Dates at local midnight, and `toISOString()` shifted them a day early on any server east of UTC. On a Lagos-time VPS, every transaction would have shown the previous day. `DATE` is now read as plain `YYYY-MM-DD` text.
    - "Today", due-date lateness and receipt times now use `BUSINESS_TIME_ZONE` (default `Africa/Lagos`) instead of UTC. The chat agent used UTC "today", so it dated sales as yesterday between midnight and 1am.
  - **Frontend:**
    - Receipt page has "Share PDF" (the phone share sheet, e.g. WhatsApp; download on desktop).
    - Transactions show as cards on phones, so amount, status and "Record payment" aren't off-screen.
    - Plain labels replace jargon: "Credit sale"/"Bill on credit" for receivable/payable, and "Paid"/"Unpaid" for the statuses.
    - An invoice for a paid credit sale now says "Paid", not "Balance due".
    - Chat list no longer shows "1 Jan 1970" or creates duplicate empty chats.
    - The shared `Table` component's typing is fixed, so frontend `tsc` is now clean with 0 errors.
  - **Refusal fallbacks:** the chat loop calls `client.beta.messages.create` with the `server-side-fallback-2026-07-01` beta and `fallbacks: "default"`, so if `claude-opus-5` declines a turn, the API retries it on the fallback model instead of returning a refusal. `afterFallback()` drops any text from before the switch. Categorisation still uses the regular endpoint with `claude-haiku-4-5`.

- **Stock & shelf counting** (owner's request, built after Deliverable 7; migration `006_stock.sql`):
  - **Products:** name, unit (bag, carton, litre…), quantity on hand, an optional "warn me at" level, and optional cost and selling prices. Names are unique per shop, ignoring case. Removing a product keeps its history.
  - **Every change is a movement** (`stock_movements`): opening stock, restock, sale, shelf count or adjustment. `products.quantity` is always the sum of its movements; a Postgres trigger keeps it in step, including when a sale is deleted and its movements go with it.
  - **Sales and purchases carry stock:** a transaction can list `items` (product + quantity). Sales and credit sales take stock off the shelf; expenses and bills on credit put it on. The transaction and its stock are saved together or not at all.
    - Deleting the transaction puts the stock back.
    - Changing its date moves the stock change with it.
    - A transaction with items can't be flipped between a sale and a purchase.
  - **Selling more than is recorded is allowed.** The quantity goes negative and the product shows as out of stock. The alternative, refusing the sale, would lose real income from the books because a restock wasn't recorded. A shelf count puts it right.
  - **Shelf count:** the owner types what is actually on the shelf, and the app shows the difference ("2 bags missing"). The count stores what was counted, not the difference. The difference is always re-derived from the records before the count (`rebaseCounts`). So when a sale dated yesterday is entered after this morning's count, it isn't taken off the shelf twice.
  - **Low-stock alerts:**
    - One `low_stock` alert per spell of low stock. It is raised when the quantity falls to the warning level, updated while it stays low, and shown again if the product runs out even after "running low" was dismissed.
    - It is marked `resolved` (a new alert status) once the product is restocked above the level or removed.
    - These are in-app only. Email, SMS and WhatsApp delivery is Deliverable 8.
  - **Stock report PDF** (`POST /reports/stock`, no longer 501):
    - products running low or out
    - per product: start, in, sold, count differences, other changes, end, and value at cost
    - the shelf counts in the period
  - **Frontend:**
    - **Stock page:** add products; per product, a details view with add stock, remove stock (with a reason), edit and history with Undo; a shelf count screen; a "Running low" filter.
    - **Add stock:** can also record what was paid, as an expense or a bill on credit with the supplier, so profit stays right.
    - **Transaction form:** optional product lines, which fill in the amount (from the selling or cost price) and the description.
    - **Elsewhere:** a "Running low" card on the dashboard, a Resolved tab and a "Go to stock" link on alerts, and the Stock Report option on Reports.
    - Demo mode has sample products.
    - Fixed on the dashboard: bills on credit showed as "+" income and credit sales weren't counted as income.
  - **Chat:**
    - `record_transaction` takes `items` by product name. The name is matched exactly (any case), or to a single product containing it; otherwise the tool refuses and lists the real names.
    - New tools: `check_stock`, `adjust_stock` and `record_shelf_count`.
    - Covered by unit tests with a mocked client; the live AI test is deferred (see below).
  - **Known simplifications:**
    - Stock bought is a cost when bought, not when sold (no cost-of-goods-sold). Buying a lot of stock in one month lowers that month's profit even though the goods are still on the shelf.
    - No unit conversion (buying cartons, selling pieces). Such a product needs to be tracked in one unit.

## Before hosting (owner's decision)
- **Live AI test is the last step before the VPS launch**, once the owner has an `ANTHROPIC_API_KEY`. It covers the chat agent end to end: recording sales and expenses, `record_debt_payment` for part-payments ("Mama Nkechi paid ₦5,000 yesterday"), and the refusal fallback.
  - To keep it cheap, run most of it on the cheapest model (`claude-haiku-4-5`). The chat model will need to be configurable by an environment variable for this.
  - Haiku checks the wiring, but not how the production model (`claude-opus-5`) behaves, and the fallback beta may not apply to Haiku. So finish with a few messages on the production model.
- The key goes in the server's environment, never in the repo or in chat.

## Rules
- Never commit/push to `main` directly.
- One deliverable per branch. Create feature branch → do work → push → open PR → wait for merge.
- Do not start next deliverable until current PR is merged.
- Check this file before starting any work.

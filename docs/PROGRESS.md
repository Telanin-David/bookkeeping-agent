# Bookkeeping Agent MVP — Progress Tracker

## Deliverables

| # | Deliverable | Status | Branch | PR |
|---|-------------|--------|--------|----|
| 1 | Backend API Specification (OpenAPI YAML + docs) | ✅ Done | `feat/deliverable-1-api-spec` | merged to main |
| 2 | Database Schema & Migrations | ✅ Done | `feat/deliverable-2-database-schema` | merged to main |
| 3 | Backend Source Code Structure & Entry Point | ✅ Done | `feat/deliverable-3-backend-structure` | merged to main |
| 4 | Frontend Source Code Structure & Components | ✅ Done | `feat/deliverable-4-frontend-structure` | merged to main |
| 5 | Claude Integration & System Prompt | ✅ Done | `feat/deliverable-5-claude-integration` | — |
| 6 | Authentication & Authorization System | ⬜ Not started | — | — |
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
  - **Frontend/backend contract mismatch found, not fixed here:** the backend's `TransactionType` (and the DB `CHECK` constraint, and the OpenAPI spec) is `sale | expense | receivable | payable`. The frontend (built across Deliverable 4 and `feat/premium-ui-polish`, before this session touched the backend) uses `income | expense | receivable | payable | transfer` instead — `sale` vs `income`, an extra `transfer` value the backend doesn't support, and `completed`/`cancelled` statuses the backend doesn't have either (backend: `pending | settled | overdue`). Every frontend transaction/receipt screen was built and demoed against the wrong enum. This needs a real fix — decide which side is right and change the other — before Deliverable 6 or anyone wires the frontend to a live backend; right now the two have never actually been tested against each other.

## Rules
- Never commit/push to `main` directly.
- One deliverable per branch. Create feature branch → do work → push → open PR → wait for merge.
- Do not start next deliverable until current PR is merged.
- Check this file before starting any work.

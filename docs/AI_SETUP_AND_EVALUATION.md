# AI setup and evaluation

[Index](../README.md) · S4 implementation, 1 November 2026

The server-only Gemini REST adapter supports the Generate Content structured-output contract. It has no tools or financial-write capability. The authenticated owner’s current instruction is the only business context sent; contact lists, ledgers and message history are not sent. Exact customer matching, amounts, dates and all proposal validation run on the server. Missing/ambiguous input returns clarification. A valid extraction creates an ordinary S3 proposal; it never approves it.

## Activation gate

AI activation requires an explicit owner decision, server-only key, pinned model, reference prices, authentication, AI_ENABLED=true, AI_LIVE_DATA_ENABLED=true and AI_REVIEW_REFERENCE. The owner has authorized normal business mode and will finish provider/privacy setup manually. The reference records that decision and identifies pending reviews; it does not certify terms acceptance, credit eligibility, billing status or model accuracy. Never place a Gemini key in a public environment variable.

Gemini 3.5 Flash-Lite is selected for the normal business assistant. Business-data evaluation remains pending. Do not infer a model/rate from fixture configuration. A provider model disappearing fails closed; there is no automatic model replacement. [Google’s structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) was checked during implementation; real schema/model compatibility remains to be exercised with the selected account.

## Owner-directed business mode — 1 November 2026

The owner explicitly requested removal of the sample limitation and preparation for real customers, with remaining provider/privacy setup to be completed manually. The sample selector, allowlist, sample-only configuration and preview bypass have been removed. The normal authenticated assistant accepts free-text Roman Urdu, Urdu and English, resolves customers within the owner's tenant, and creates reviewable financial/order proposals. Gemini cannot approve or post them. Quotas, budget reservations, grounding, input/output limits and manual fallback remain active.

Ignored local configuration sets AI_ENABLED=true and AI_LIVE_DATA_ENABLED=true, selects gemini-3.5-flash-lite, and references this owner decision. These flags authorize the application path; they do not certify completed provider/privacy review. The key remains server-only. No real customer data was submitted during this change, no billing was changed, and no deployment or WhatsApp send was performed. The owner confirmed Free Tier with billing disabled; reference accounting rates remain USD 0.30 input / 2.50 output per million tokens. Account limits and current pricing must be checked before launch.

Previous provider checks established model/schema compatibility for three synthetic sale instructions, with correct 65000 paisa total and 0 received. They do not establish the full 60-case business accuracy target. 2.5 Flash-Lite returned unavailable to new users; 3.5 Flash-Lite was explicitly selected after provider guidance and pricing review. The temporary sample mode is superseded by this decision.

Provider terms, production billing/data settings, full language evaluation, actual owner sign-in and hosting remain pending owner/operator tasks; see [launch setup](LAUNCH_SETUP.md). Disable AI with AI_ENABLED=false and AI_LIVE_DATA_ENABLED=false while preserving manual operations if provider setup is incomplete.

## Limits and accounting

`POST /api/v1/assistant` accepts `{ "text": "..." }` with the app session, CSRF headers and an idempotency key. It is synchronous with at most two sequential calls of 15 seconds each. The hosting request timeout must permit 60 seconds. The API returns a clarification, a proposal reference, deterministic summary, or unavailable result. No streaming, conversation memory or recursive tool calls are enabled. This concretizes the earlier asynchronous endpoint sketch; a future asynchronous migration must preserve the execution ID and quota semantics.

Input is at most 2,000 characters. A conservative UTF-8 byte ceiling includes the system instruction/schema/repair overhead in the 4,000-token budget; long messages may require shortening. Output is capped at 600 tokens. Invalid, blocked and timed-out responses may use the one reserved retry. Numeric strings are integer paisa. Unsupported currencies, model-supplied IDs/fields, invented amounts/customer labels/quantities and inferred dates cannot form a ready proposal. Dates are resolved deterministically from the original instruction: named English/Urdu months with a year, ISO dates and day/month/year forms. Explicit times are preserved; date-only means 09:00 Pakistan time. A missing date defaults to next month first at 09:00 Pakistan time. Invalid, incomplete, multiple or relative dates clarify rather than being silently replaced. Credit-sale repayment dates are saved with the posted sale and shown before owner approval. Explicit bank/Raast and wallet receipt labels map to the existing bank-transfer/other methods; conflicting methods clarify. Otherwise the cash default is shown for owner review. Customer recovery now offers an explicit add/select step; only the original instruction, never directory data or selected IDs, goes to Gemini.

Atomic reservations serialize the global budget check and bind the input/model/prompt hash to the tenant and request key. Daily action periods use Asia/Karachi; monthly periods use UTC calendar months. In-flight executions consume one reserved action and both calls’ worst-case integer nano-USD cost. Successful clarification/summary/proposal charges one action, exact replay charges none. Failed processing charges no product action. Known successful token use settles to its recorded cost; unknown usage/invalid responses retain the full per-call conservative estimate. These estimates are not provider invoice reconciliation.

A crash leaves its reservation held. Repeated requests return `AI_IN_PROGRESS`, rather than making a duplicate call. Operators must reconcile by execution ID before any release; no automatic timeout refund is safe. The current implementation deliberately retains uncertain reservations until an audited reconciliation procedure exists. Manual entry, history, deterministic summary and export continue at quota exhaustion or provider outage.

`GET /api/v1/usage` and `/usage` show entitlements, completed actions and in-flight reservations. Free is the baseline; higher pilot tiers are manually provisioned, with expiry. Prices remain proposed, and no billing collection exists.

## Evidence and remaining evaluation

`tests/fixtures/language.ts` contains 60 authored cases, 20 per language, including ambiguity, unsupported requests and prompt injection. The offline test verifies their schema and grounding expectations. **It does not measure model accuracy.** `tests/ai.test.ts` checks the REST request contract, usage bounds and invalid responses. PostgreSQL tests exercise quota races, spending races, replay, two-call failures, withheld product charges, ambiguous customers, no posting and crash-held reservations.

Before live activation, run the selected model against these messages in a synthetic evaluation tenant through the metered service, with explicit spending authorization. Record model ID, prompt `intake-v3-user-audit`, actual response, intent/field correctness, clarification correctness, all token usage/cost and failures. Target >=90% exact extraction on unambiguous cases and zero unapproved posting. The fixture dates/customer balances must be prepared for the evaluation date; otherwise distinguish extraction from downstream business validation. No live-provider score, paid usage or credit eligibility has been measured in this local implementation.

Provider accounting reference: [Gemini thinking/output limits](https://ai.google.dev/gemini-api/docs/generate-content/thinking) describes max output tokens as including thought tokens. The adapter validates total-minus-prompt usage against the output cap; actual selected-model compatibility and billing still require the live evaluation.


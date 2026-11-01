# Executable audit case inventory

[Audit report](USER_AUDIT.md) · 1 November 2026

This inventories test definitions, not a substitute for execution. Final results are recorded in DEVELOPMENT_HANDOFF.md and the audit report. Each browser scenario runs on desktop and a 360px mobile viewport. Offline language goldens do not measure live-model accuracy.

## tests/ai.test.ts

1. AI cost calculation is exact and reserves both calls including ceiling
2. real-user commas and phones ground; date/time/phone digits never justify invented financial amounts
3. unknown tools, IDs, enum, money, dates and invented amounts cannot enter a proposal
4. Gemini REST adapter uses fixed origin, schema, no tools and bounded output

## tests/client-api.test.ts

1. stalled network becomes a recoverable error; no automatic retry or replacement request key
2. malformed successful response and lost connection never masquerade as a saved financial action

## tests/config.test.ts

1. local shell runs without keys, database or provider calls
2. business AI requires explicit live-data activation and an owner decision reference
3. the documented environment example is a valid disabled configuration
4. unknown flags fail closed instead of treating false-like strings as truthy
5. provider flags require authentication and reviewed account prerequisites
6. financial locale and all configured retry/workflow bounds cannot expand silently
7. invalid budgets are rejected and secret values are absent from errors/config
8. production environment requires explicit HTTPS app origins
9. emulator tokens cannot be enabled in production or on a remote emulator host

## tests/e2e/assistant-recovery.spec.ts

1. missing customer: invalid phone → correction → explicit inline add → preserved instruction → reviewable unposted proposal
2. duplicate customer: exact scoped selection → preserved instruction → reviewable unposted proposal

## tests/e2e/dashboard.spec.ts

1. overview is truthful, responsive, and links through every workspace section
2. unknown routes give a recovery path and security headers

## tests/e2e/s2.spec.ts

1. owner can sign in, onboard, maintain customers/suppliers, and sign out
2. API enforces session identity, tenant boundaries, CSRF, idempotency and logout revocation

## tests/e2e/s3.spec.ts

1. financial previews, partial repayment, orders and export work on the owner dashboard

## tests/e2e/s4.spec.ts

1. disconnected assistant preserves manual operations and truthful usage

## tests/e2e/s5.spec.ts

1. disconnected WhatsApp has private messages, disabled pairing, and no implied delivery

## tests/e2e/s7.spec.ts

1. owner can download private data and request deletion review without erasing records

## tests/instruction-date.test.ts

1. written dates override model guesses, date-only uses 09:00 Pakistan, explicit time is preserved
2. missing date defaults on the Pakistan calendar including December rollover
3. invalid, incomplete, multiple or ambiguous dates/times clarify instead of silently defaulting

## tests/integration/s2.test.ts

1. concurrent onboarding replay creates exactly one business and owner
2. customers support duplicate names, normalized phones, scoped search and idempotent creation
3. other owners cannot read, mutate, enumerate or use a foreign cursor
4. concurrent edits cannot overwrite a newer version; archive and restore preserve the record
5. pagination is bounded and business updates use optimistic versions
6. suspended tenants and revoked memberships lose access immediately
7. PostgreSQL rejects cross-tenant references, invalid locale and mutable audit history
8. opaque sessions are hashed, bounded, revocable and reject forged or expired cookies

## tests/integration/s3.test.ts

1. preview has no financial effect; repeated and concurrent approvals post once
2. credit sale, partial receipt and cash sale produce exact independent totals
3. competing repayments cannot overallocate or silently reduce an approved amount
4. edited, expired, rejected and foreign-owner approvals cannot post
5. orders and fulfillment do not post sales; conversion is separate and unique
6. full reversals preserve originals, release allocations and net reports correctly
7. failure after a sale insert rolls back every financial effect and permits safe retry
8. ledger/export are tenant-scoped and CSV escapes spreadsheet formulas

## tests/integration/s4.test.ts

1. AI returns an owner-review proposal, replay consumes one unit, never posts
2. written repayment dates and absent-date defaults survive approval; a model date cannot override source
3. failed/invalid model processing stops after two calls and retains provider cost without a product unit
4. concurrent daily/product and global/spend reservations cannot oversubscribe
5. ambiguous customer, invented amount and pending executions cannot post or blindly retry
6. customer recovery covers missing, case/space, phone, duplicate, archived and foreign selections
7. unsupported financial inputs never call the model or post, while malformed selection is rejected
8. receipt methods, per-customer balances and invalid repayment dates have explicit outcomes

## tests/integration/s5.test.ts

1. signed batched ingestion deduplicates, rejects forgery and never routes unknown destinations
2. hashed one-use pairing binds owner, generic yes/customer approval fail; exact owner control posts once
3. pairing attempts stop at five without rollback; another tenant cannot consume challenge
4. customer update requires exact owner approval and STOP cancels the queued send before dispatch
5. concurrent dispatch sends one intent; uncertain acceptance never retries and callbacks reconcile monotonically
6. job leases claim once and technical attempts never exceed three
7. paired WhatsApp owner adds customer, gets complete AI preview and exact approval; customer cannot invoke AI
8. rolling service send cap blocks transport across billing boundaries and only ages out later
9. definitely rejected sends retry at one/five minutes, stop at three attempts, and quiet hours defer before claiming

## tests/integration/s6.test.ts

1. three persisted checks/two reminders survive duplicate execution; quiet deferral anchors next check to actual send
2. fulfillment and due edits atomically cancel unsent follow-up; another tenant cannot stop it
3. owner-approved workflow customer update consumes one lifetime slot; opt-out cancels everything
4. expiry/restart/uncertain transport and third technical failure terminate without new allowances

## tests/integration/s7.test.ts

1. operator freeze blocks new writes while preserving owner history/export; resumed work never replays cancelled actions
2. pilot entitlements are audited, expire to Free, and never claim subscription payment
3. retention purges old message bodies and temporary authority while preserving posted ledger/audit/consent

## tests/integration/s8.test.ts

1. one paisa/maximum amounts post exactly; advances, overpayments, inconsistent lines and foreign allocations are rejected
2. report SQL and CSV use half-open Pakistan midnight and reversal date without changing current outstanding

## tests/language.test.ts

1. 60 authored language goldens cover three languages and require clarification for ambiguous/unsupported inputs

## tests/money.test.ts

1. money parsing is exact at one paisa, maximum, and rejected decimals/floats
2. Pakistan reporting day is a half-open UTC interval at local midnight

## tests/revocation.test.ts

1. production sessions fail closed for disabled, revoked, missing or malformed authentication times

## tests/validation.test.ts

1. Pakistani national and explicit international phones normalize consistently
2. caller-supplied tenant/role, invalid names and currencies are rejected
3. versions, pagination and search are bounded and strict

## tests/whatsapp.test.ts

1. signature binds exact raw bytes; streaming body bound rejects oversized input
2. window/consent/quiet-hour boundaries are exact and late delivery cannot regress
3. pairing/approval secrets are hashed before durable message storage
4. batched messages and statuses parse separately; invalid IDs/timestamps cannot route
5. financial WhatsApp previews show item prices, references and allocations; long details cannot get a partial approval
6. Meta retries only definite rate rejection; timeouts/5xx are UNKNOWN

## tests/workflow.test.ts

1. workflow window is fixed at owner enable/due boundaries with no late start
2. terminal/due-change/opt-out/deadline rules never infer financial or customer fulfillment

## Authored language fixtures

60 fixtures in tests/fixtures/language.ts: 20 English, 20 Roman Urdu, 20 Urdu. Per language: five sales (including one paisa and max), four confirmed receipts, one explicit order, two incomplete orders, two summaries, six unsupported/ambiguous/injection instructions. The fixture test checks authored expectations only; actual eight-case provider results are in LIVE_AI_RESULTS.json.

## Additional assertion matrices

- Date parser: explicit named/ISO/Urdu dates, provided/default time, missing date, Pakistan/year rollover, customer May/phone, malformed and conflicting clocks, relative/incomplete dates.
- Money/grounding: valid grouping, malformed grouping, excess decimals, unsupported currencies, source-exact quantity/price, no amount inferred from date/year/time/phone, no Ali-in-Malik customer grounding.
- Financial/customer/channel tests contain multiple assertions and races within named cases; their case totals count test definitions, not every assertion or every possible input.

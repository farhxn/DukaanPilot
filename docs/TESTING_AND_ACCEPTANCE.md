# Testing and acceptance

[Documentation index](../README.md) · Acceptance contract; actual results are in [release readiness](RELEASE_READINESS.md)

Local implementation and automated evidence now cover S1-S8 engineering work. The matrix below retains its required outcomes; RELEASE_READINESS.md maps each case to actual local evidence and remaining provider/pilot gates. Live model accuracy, real channel delivery, hosted recovery and the actual merchant pilot remain NOT RUN/BLOCKED.

## Acceptance matrix

| Case | Requirements / journey | Given / action | Required result | Future evidence |
|---|---|---|---|---|
| AC-01 | PR-01, PR-02, PR-11, J1 | Owner creates/edits/searches/archives customer and supplier contacts; owners A/B are in different tenants; A uses B’s IDs in lists, detail, mutation, export, proposal and job paths | Directory operations work within tenant; duplicate customer names require selection; no cross-tenant data/metadata disclosure or write; forged membership/token rejected | Directory and authorization integration report against two tenants |
| AC-02 | PR-01/08, J1 | Pair owner via valid code; replay/expire/brute-force code; customer imitates owner; revoked sender reuses approval | Only valid paired sender gains authority; five-attempt limit and ten-minute expiry enforced; revocation invalidates controls | Auth/channel tests and manual pairing walkthrough |
| AC-03 | PR-03, J2 | Synthetic Roman Urdu/Urdu/English inputs, ambiguous Ali, “kal”, missing amounts, model-invalid JSON | Correct preview for unambiguous input; targeted clarification or blocked draft otherwise; zero financial writes | Versioned fixture corpus and per-language precision results |
| AC-04 | PR-04/06, J2 | Replay same approval; edit payload; approve old version/hash; approve after 24h; competing web/WhatsApp approvals | Exactly one committed financial effect; stale/expired/unauthorized requests fail; result replay matches original | Database integration/race test with row counts |
| AC-05 | PR-06, J2/4/7 | Sale 650, receipt 200; cash sale 650; two concurrent receipts exceeding available due; full reversals | Due 450 for first case; cash sale due zero; no overallocations, negatives, or partial commits; correct compensating history | Exact-paisa ledger tests and transactional fault injection |
| AC-06 | PR-05, J3 | Customer requests order with missing price; owner approves; later fulfills and optionally approves conversion to sale | No invented price; no ledger effect on order approval/fulfillment; only one sale per order after approval | Order lifecycle integration tests |
| AC-07 | PR-07, J6 | Sales/collections on either side of midnight Asia/Karachi plus later reversal; export date range | Correct net sales and collections separately; total current outstanding exact; CSV scoped and formula-safe | Aggregate query tests and mobile screenshots |
| AC-08 | PR-04/08, J2/7 | Duplicate batch webhooks, crash after DB commit before reply, repeated idempotency key with changed body | Durable inbound processed once; posting origin unique; changed request hash conflicts; retries return saved result | Worker replay and commit-boundary fault tests |
| AC-09 | PR-08, J3 | Invalid raw-body signature, valid multiple-message webhook, unknown recipient, out-of-order statuses | No forged ingest; valid messages durably queued; recipient maps exact tenant; late status cannot regress delivered/read | Webhook contract tests plus controlled Meta test delivery |
| AC-10 | PR-09, J5 | Fake clock, worker restart, duplicate jobs, no owner reply, changed due date, fulfillment/cancellation | At most 3 logical checks, 2 owner reminders, 1 approved customer update; min 12h reminder spacing; hard expiry; no automatic restart | Persisted workflow event/counter traces under concurrency |
| AC-11 | PR-08/09, J5 | Quiet hours, no opt-in, STOP before dispatch, outside 24h window, rejected template, ambiguous send timeout | No prohibited send; dashboard fallback; pending customer sends cancelled; UNKNOWN never blindly resent; retry cap 3 total attempts | Policy unit tests, fake-clock cases, controlled provider callbacks |
| AC-12 | PR-07, PR-10, J6 | Parallel AI requests reach daily/monthly/spend cap; model times out; summary wording fails | Atomic reservations prevent oversubscription; <=2 model calls/instruction; provider costs retained; product unit charged once; manual entry and deterministic summary work | Quota/race tests, token accounting and failure report |
| AC-13 | PR-03/11 | Prompt says ignore rules/reveal tenants; malicious HTML/CSV; inspect client bundle/logs; unpaid project selected | No unauthorized tools/data; safe rendering/export; no secrets/raw prompts in ordinary logs; live confidential data blocked pending terms validation | Adversarial fixtures, bundle/log inspection, privacy checklist |
| AC-14 | PR-11, J7 | Isolated restore, retention purge, verified export/delete request, stale leases/outbox after crash | Target RPO/RTO measured; purge respects finance/audit policy; deletion journal reapplied; restored pending/uncertain sends not replayed blindly | Timed restore exercise and operator runbook review |

## Financial fixture details

Required exact fixtures include Rs 0.01, decimal parsing, maximum amount, above-maximum amount, unsupported currency, negative/zero amount, duplicate payment, customer mismatch, multiple-sales allocation, reversal with existing allocation, and explicit-total versus priced-line order. Walk-in cash sales must settle fully; Walk-in udhaar and customer advance/overpayment fail validation. Payment and sale reversal totals use the correction date as documented in schema.

For concurrent Rs 400 repayments against Rs 650, both must not commit unchanged. One may commit, leaving Rs 250, and the other must return stale/insufficient balance for a fresh preview. Do not silently reduce the second payment.

## Language evaluation

Prepare at least 60 synthetic labeled messages, at least 20 each for Roman Urdu, Urdu script, and English; include mixed-language numbers, customer ambiguity, and adversarial instructions. Separate unambiguous and ambiguous cases. Target at least 90% exact intent/required-field correctness on unambiguous fixtures and 100% no-posting behavior for all unapproved/ambiguous inputs. A wrong proposal is visible but still a product error; approvals are a safety barrier, not a substitute for extraction quality. Record model ID, prompt/schema version, date, token cost, and failures; do not claim statistically representative market accuracy from this small set.

## Verification layers

Unit tests cover parsing, exact money, policy decisions, date boundaries, workflow transitions, and quota math. PostgreSQL integration tests cover constraints, locks, transactions, tenant scoping, and replay. Contract tests exercise webhook raw bytes, batching, API validation, and provider failures. End-to-end tests cover the owner’s actual manual and AI approval paths on mobile web plus a permitted WhatsApp test exchange. Fake-clock tests prove timing without waiting in real time.

Test doubles cannot prove template approval, real credit eligibility, provider delivery, or legal readiness. Validate those with controlled account evidence and manual review. Use synthetic data until data terms/notice gates pass.

## Pilot sign-off record

For each case record status (NOT RUN/PASS/FAIL/BLOCKED), environment, application revision, model/prompt/provider versions if relevant, timestamp, evidence link, and reviewer. The original planning baseline started all cases as NOT RUN. Current local results and remaining live checks are recorded in RELEASE_READINESS.md; do not infer a pass from a document or fixture alone.

Block pilot release for any unauthorized write, cross-tenant access, duplicate posting, unbounded loop, prohibited customer send, untested restore, or missing live-data/provider prerequisite. Cosmetic issues can be documented with a fix date only if core journeys remain usable. Pilot success metrics in [requirements](PRODUCT_REQUIREMENTS.md) are evaluated after release and do not replace this release gate.

## Date regression acceptance — 1 November 2026

AC-03/04/05 add the reported Roman Urdu credit instruction with 1 December 2026, a missing-date instruction, explicit 3 pm, ISO offsets, Urdu digits/months, leap/invalid dates, multiple dates, incomplete dates, and Pakistan month/year boundaries. A provided written date must take priority over any model candidate. Date-only means 09:00 Pakistan; no date means next month first at 09:00. A credit-sale preview must show the date; exact owner approval must persist it; SQL must reject subsequent modification. The default never overwrites an invalid or ambiguous written date. Fully paid sales have no repayment due date. This does not add a scheduled receivable reminder or cash lending.

Actual current evidence is recorded in DEVELOPMENT_HANDOFF.md. Do not infer the full language-model accuracy acceptance from the individual live examples.

## Audit additions — 1 November 2026

The scoped audit and case inventory are in audit/USER_AUDIT.md and audit/TEST_CASES.md. Tests add new/duplicate/archived/foreign customer recovery, phone normalization, no substring-name matching, source-exact comma amounts, date/phone exclusion from numeric grounding, receipt methods, customer-specific summary, invalid raw calendar dates, network deadline/malformed response handling, paired-owner WhatsApp AI→preview→exact approval, customer-origin denial, oversized streamed provider response and rolling service cap across a month boundary. Recovery browser tests use E2E_AI_RECOVERY=true in the isolated test launcher and runner; they intercept extraction while using real owner/customer/proposal APIs. Baseline runs intentionally skip those four fixture-mode executions; run them separately and record their actual results. Eight live synthetic cases are recorded in audit/LIVE_AI_RESULTS.json; full language accuracy/live Meta acceptance remain separate.

## Free web deployment checks

The offline deployment preflight requires production HTTPS origins, verified PostgreSQL TLS, matching Firebase server credentials, no emulator/test output directory and explicit disabled WhatsApp/worker flags. Synthetic credential tests verify sanitized errors, SDK credential parsing without network access, and refusal of production-data preview contexts. Hosted acceptance cases and their current NOT RUN status are in [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md). Earlier local acceptance evidence does not prove the Netlify adapter, cloud IAM, pooled connection or hosted owner flow works.

# Release readiness

[Index](../README.md) · Engineering review, 1 November 2026

**Local implementation is available through S8 engineering acceptance. Live pilot release is NOT CLEARED.** Provider accounts, production identity/infrastructure, commercial/privacy review and actual merchant-pilot evidence cannot be supplied by synthetic tests. The owner requested those user-dependent parts be deferred until the end; none is represented as passed.

## Implemented

**AI setup update, 1 November 2026:** at the owner's request, sample-only restrictions were removed and normal business AI was enabled locally. Real Gemini 3.5 Flash-Lite previously passed three synthetic language checks. Provider/privacy setup and full business-data acceptance remain pending owner tasks. See [launch setup](LAUNCH_SETUP.md); the S8 evidence below remains the historical baseline.

S1–S3 provide the responsive dashboard, Firebase-to-opaque-session authentication, owner workspaces, contacts and exact financial core. Every order/sale/receipt/correction uses a version/hash-bound proposal. PostgreSQL locks, composite tenant references, immutable history and idempotency protect commits. Fulfillment does not post a sale. One-paisa/max amounts, concurrent receipts, rollback after an intermediate failure, reversals, date-based reports and CSV are exercised.

S4 includes server-only Gemini structured extraction, grounding/clarification, two-call/token/time limits, atomic daily/monthly action and internal-cost reservations, usage UI and 60 authored language cases. AI stays disabled; no model, rate or credit eligibility is asserted as evaluated. Manual entry and deterministic summaries do not use AI quota.

S5 includes signed raw-byte webhooks, batched durable deduplication, dedicated tenant routing, hashed one-use pairing/approval controls, owner/customer separation, consent history and STOP handling, a leased worker and policy outbox. An uncertain send becomes UNKNOWN and never blindly retries. Signed callbacks can reconcile its opaque reference; late callbacks cannot regress delivered/read. Paid templates stay disabled with zero allowance.

S6 implements one lifetime per pending order, a fixed due-derived deadline, at most 3 business checks/2 owner reminders/1 separately approved customer update, spacing from actual dispatch, quiet hours and zero scheduled AI calls. Fulfillment, cancellation, due edits, opt-out, unpairing, operational pause and technical exhaustion stop unsent work. Terminal workflows cannot restart or extend their deadline. Orders that enter this workflow cannot bypass its message cap by creating a new general update for the same closed workflow; follow up manually outside this automation instead.

S7 provides production auth/TLS guards and revocation checks, redacted failures, request/rate caps, health/queue metrics, audited operator pause/resume/trial entitlements, retention, owner export/privacy-review requests, encrypted logical backups and frozen isolated restore. Docker and a GitHub verification workflow are prepared but have not been executed in their target platforms.

## Actual verification

| Check | Result / practical limit |
|---|---|
| `npm run check` | PASS: lint with zero warnings, TypeScript and 25 unit/contract tests |
| `npm run test:integration` | PASS: 36 cases on native PostgreSQL, including financial races/faults, channel authority/replay, fake-clock workflow bounds, retention/freeze/export and report boundaries |
| `npm run test:restore` | PASS: 9,941 synthetic rows/37 tables restored into a new isolated target in 3.956 seconds; finance/audit/approval/consent/workflow checksums match; dispatch frozen |
| `npm run build` | PASS: optimized Next.js build; no live provider call required |
| Browser acceptance | PASS: all 16 sequential desktop/360px mobile checks, including sign-in/contacts, financial/workflow flows, disabled-provider fallbacks, data download and deletion-review request |
| Clean production dependencies | PASS: isolated offline `npm ci --omit=dev --ignore-scripts`, 372 packages; production-built server from this profile returned HTTP 200 for overview/login/liveness/readiness with CSP/frame protection |
| Production dependency audit | PASS: zero info/low/moderate/high/critical advisories after patched gRPC/glob overrides, 1 November 2026; advisories change, so rerun in CI/release |
| Worker/metrics CLI | PASS: one bounded local worker tick and redacted local metrics command; no pending real work, no outbound enabled |
| Client secret scan | PASS: final 22 browser static assets contain neither server-secret sentinels nor the local database password |
| Docker image / hosted GitHub workflow | NOT RUN: no Docker runtime/remote repository runner was configured |
| Real Firebase Google/ADC revocation, Gemini evaluation, Meta delivery | BLOCKED on the account/setup items below |
| Hosted restore, latest external deletion journal and actual two-week merchant pilot | NOT RUN; require the selected deployment/operator and consenting merchants |

The migration test exposed legacy sessions whose new authentication-time column had been backfilled with migration time. A new forward backfill migration invalidates/normalizes those rows before the constraint; the failed test-only migration was resolved and fresh isolated restore applies the complete migration chain. Applied migration SQL was not rewritten. A concurrent build caused two browser failures during form/reload activity; both passed after the build. Final acceptance runs build/generation before browser walkthroughs.

## Acceptance mapping

| Case | Local evidence | Remaining live/review dependency |
|---|---|---|
| AC-01 tenant/directory | S2/S3/S7 PostgreSQL + S2 browser owner/API flows PASS | Actual Google login/production identity verification |
| AC-02 channel identity | S5 hashed pairing, five-attempt cap, customer rejection, exact owner approval/replay/revocation PASS | Actual permitted Meta pairing walkthrough |
| AC-03 language quality | Schema/grounding and 60 authored expectations PASS | Selected model’s >=90% measured extraction target NOT RUN; no accuracy score claimed |
| AC-04 approval safety | Concurrent/replayed/stale/expired/hash-bound commits PASS | Live channel transport walkthrough remains separate |
| AC-05 finance | Exact paisa, allocations, reversal, competing receipts and fault rollback PASS | Merchant workflow review before live data |
| AC-06 order boundary | Manual order/fulfillment/separate sale conversion PASS | Actual customer-order intake walkthrough with a permitted recipient |
| AC-07 reports/export | SQL at both sides of Pakistan midnight, reversal date/current balance, scoped formula-safe CSV and mobile walkthrough PASS | Actual merchant export review |
| AC-08 replay/crash | Durable webhook dedup, idempotent controls, transactional rollback and leased jobs PASS | Real callback/transport recovery exercise |
| AC-09 webhook/status | Raw signature/batch/unknown route/monotonic callback tests PASS | Real Meta webhook/delivery confirmation |
| AC-10 loop bounds | Persisted duplicate/concurrent execution, quiet deferral/actual spacing, 3/2/1, stops/deadline/third failure/no restart PASS | Hosted continuously supervised worker rehearsal |
| AC-11 send policy | Window/consent/STOP/quiet/three attempts/UNKNOWN handling PASS; paid templates cannot send | Real provider policy/template/window callbacks with permitted recipients |
| AC-12 usage | Atomic quota/spend races, all attempts reserved, once-only action accounting, held crash reservations/manual fallback PASS | Real token/invoice reconciliation and operator alerts |
| AC-13 privacy/security | Allowlisted output, no model tools, safe rendering/CSV, secret exclusions, production guards and patched production audit PASS locally | Paid-data terms, real IAM/edge limits, privacy review; security is not certified by this table |
| AC-14 recovery/privacy | Encrypted snapshot/restore with constraints and frozen dispatch; body retention; verified-owner request/export PASS locally | Hosted backup scheduling/key custody; latest external deletion/suppression journal, legal erasure/retention policy and actual hosted RPO/RTO |

No entire provider-dependent case is signed off solely because its local half passes. The real 5–10-business/two-week pilot remains outside this synthetic engineering evidence.

## Inputs needed from the owner

1. **Firebase:** confirm Google provider and authorized domains for the supplied project, then complete one real Google login. For deployment, choose the ADC/workload identity with Firebase user-read/revocation permissions. Public web configuration is already present; do not send a private service-account key in chat.
2. **Gemini:** add the server key through ignored local settings/secret manager; provide the eligible project, credit type/balance/expiry, billing/data-terms status and reviewed model/rate choice. Then authorize the bounded synthetic model evaluation and record its actual score/cost before live data.
3. **Meta:** identify the business/app and dedicated test number, permitted recipients, webhook access, supported Graph version and token ownership/rotation. Add secrets through secret settings. Confirm customer/owner permission evidence and any future template budget; current paid-template allowance is zero.
4. **Deployment:** choose provider/project/region/domain, database/TLS, monthly budget and continuously supervised worker mode. Verify a current image digest/CI runner, least-privilege identities, encrypted backup/key storage, monitoring destination, external deletion/suppression journal and hosted restore.
5. **Business/pilot:** confirm proposed prices/caps, support contact, privacy/terms/retention/closure policy and consenting pilot merchants. Actual deployment, paid resource provisioning and live sends need their explicit authorization after these results are reviewable.

## Next actions

Owner response received 1 November 2026: Google setup is reported enabled; real login still needs verification. The owner has ordinary WhatsApp, no hosting, and unfinished business/policy decisions. A credential supplied in chat was not stored or used; request a replacement through local secret settings and the missing Gemini credit/billing details before provider activation. See PHASE_STATUS_AND_RELEASE.md for the updated account checklist. Local manual dashboard use remains available.

Review these artifacts and provide the non-secret setup decisions above. Resolve each live gate in staging with synthetic/permitted recipients, keep unrelated feature flags off, and record actual provider/hosting evidence. Only then review deployment and pilot sign-off. No additional application scaffolding is needed.

## Real-user audit update — 1 November 2026

The customer-recovery, amount/date/phone grounding, receipt/summary, client-error and WhatsApp owner approval fixes are described in audit/USER_AUDIT.md. Eight bounded real Gemini examples passed using an isolated synthetic tenant and zero posted sales; the authored 60-case corpus remains offline evidence. Paired-owner WhatsApp AI is implemented but live transport remains blocked by the owner's absent Meta account/number/secrets and public callback. The owner requires no paid WhatsApp use. Follow WHATSAPP_SETUP.md for free testing; service replies are not assumed indefinitely free, and the app adds a rolling 900-attempt/33-day cap. No public deployment, paid setup or real WhatsApp messages were performed.

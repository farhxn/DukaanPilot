# Real-user audit and regression report

[Project index](../../README.md) · 1 November 2026

Production audit: **64/100, Risky for public rollout**. The local business flows have automated evidence and the issues below have been repaired. Public WhatsApp remains blocked by the absent Meta account/number, credentials and public HTTPS endpoint. Production hosting, real Firebase sign-in, backups/monitoring and owner policy/commercial decisions still need their launch checks. This is a scoped engineering assessment, not a claim that every possible user input or production incident has been tested.

## What the screenshot means

The extracted customer did not match an active customer in the signed-in business. Previously the assistant returned a dead-end instruction to use a manual form. It now presents an inline customer step: add the missing person explicitly, choose among matching people, or restore an archived person. The original instruction remains available; financial posting still requires the exact owner approval. No customer is silently created and no fuzzy match silently receives a financial entry.

## Findings and implemented repairs

| ID | Priority | Real-user failure | Repair / regression evidence |
|---|---|---|---|
| U01 | High | New customer blocks the entire conversation | Inline add-and-prepare flow, editable name/phone, clear invalid-phone message; customer API idempotency; browser recovery cases |
| U02 | High | Duplicate names could select the wrong Ali | Scoped candidate choices with phone/ID; selected UUID authorized before any model call; ambiguous names never auto-selected; customer integration cases |
| U03 | High | Archived/foreign customers accidentally reused | Archived customers require restoration; foreign/invalid selections fail before provider use; no cross-tenant choices or financial effects |
| U04 | Medium | Case, extra spaces and local phones fail matching | Normalized whitespace/case matching and E.164 matching of Pakistani local phones; no transliteration/fuzzy guessing |
| U05 | High | Ali can be “grounded” inside Malik; date words can become customer names | Unicode-aware whole-name grounding; date spans excluded from customer-name evidence; regression unit cases |
| U06 | High | Dates/phone numbers could justify an invented amount | Exclude recognized date/time/phone spans before grounding money/quantities; exact source amounts remain required |
| U07 | Medium | 1,250 or Urdu digits rejected | Exact western/Pakistani comma grouping and Urdu/Arabic digits supported; malformed commas, excess precision, negatives and maximum amounts still rejected |
| U08 | High | Missing/written dates behave inconsistently | Source-owned date parsing/defaults retained; phone hyphens and customer May no longer look like incomplete dates; weekday ambiguity and conflicting ISO/extra times clarify; invalid API calendar dates rejected |
| U09 | Medium | Bank receipts default to cash; split methods are ambiguous | Explicit bank/Raast or wallet receipt labels map to existing methods; conflicting methods clarify; no gateway/payment collection added |
| U10 | High | “Ali's balance” returns the whole business balance | Customer-specific deterministic ledger balance after scoped resolution; global summary only when no customer is requested |
| U11 | Medium | Business validation becomes a generic “manual review” | Expose the existing safe field errors or domain explanation; preserve text and same retry key |
| U12 | High | Hung connection leaves the UI pending forever, or bad JSON looks successful | Read/write deadlines, recoverable unconfirmed-response errors, no silent automatic retry, same idempotency key retained; transport unit cases |
| U13 | High | WhatsApp owner gets only “review in dashboard” | Full bounded financial preview and exact owner-bound approval command; expiry shown in Pakistan time; queued preview expires with the control; large previews use dashboard without a partial approval prompt |
| U14 | Medium | WhatsApp cannot recover a missing/duplicate customer | Paired-owner ADD CUSTOMER command and scoped USE CUSTOMER id \| instruction; customer senders cannot invoke these owner capabilities |
| U15 | High | Service messages wrongly assumed always free | Dated Meta FAQ reviewed; 900 send-attempt cap over rolling 33 UTC days, including uncertain/rejected attempts, reserved before transport; calendar boundary cannot reset it early |
| U16 | Medium | Oversized Meta response buffered before checking size | Streaming 64 KiB ceiling and cancellation; result remains UNKNOWN with no blind resend |
| U17 | Low | Live directory says financial records “come next” | Updated the outdated caption to point to Ledger & udhaar |
| U18 | Medium | SSR controls can be active before handlers attach | Assistant input/submit stays disabled until hydration; browser recovery checks pass |
| U19 | Medium | Multi-line instructions are rejected despite a multi-line input | Allow line breaks/tabs in owner instructions while rejecting other control characters; multi-line bank sale and NUL-rejection regressions |
| U20 | High | WhatsApp approval can hide item unit prices, exact customer references or receipt allocations | Include untruncated item prices/line totals, identity/order/payment references, current balance, notes and allocations; any oversized full preview requires dashboard review without an approval command |

## Final verification

| Check | Actual result |
|---|---|
| Lint, types, unit/contracts | PASS: 33 tests |
| PostgreSQL integration | PASS: 42 cases |
| Browser baseline | PASS: 16 desktop/mobile cases; fixture-only cases run separately |
| Browser customer recovery | PASS: 4 desktop/mobile cases, including invalid phone correction and exact duplicate choice |
| Live Gemini | PASS: 8/8 synthetic cases; zero posted sales |
| Optimized build | PASS |
| Encrypted restore | PASS: 20,748 synthetic rows, 37 tables, 17.602 seconds; authoritative checksums match, dispatch frozen |
| Browser secret scan / local readiness | PASS: 22 assets, zero local Gemini key matches; main readiness HTTP 200 |
| Worker/operator smoke | PASS: one tick and redacted metrics; outbound disabled |
| Documentation links | PASS: 28 Markdown files |
| Real Meta delivery / hosting / hosted CI / Docker | NOT RUN: account/infrastructure unavailable |

## Coverage and evidence

[TEST_CASES.md](TEST_CASES.md) inventories the executable case names and the 60 authored language fixtures. The fixture expectations are offline contract examples, not 60 measured live-model successes. [LIVE_AI_RESULTS.json](LIVE_AI_RESULTS.json) records **8/8 actual synthetic Gemini checks**, eight calls, zero posted sales: reported credit/date wording, commas, local phone, explicit time, unknown customer, bank receipt, named-customer balance and ambiguous relative date. No real customer data or WhatsApp recipients were used.

The final command outcomes and browser evidence are recorded in [the development handoff](../DEVELOPMENT_HANDOFF.md). The recovery browser suite uses an isolated official Auth emulator and real customer/proposal APIs with extraction intercepted; server-side AI/customer integrity is separately tested on PostgreSQL. It never uses the real Gemini key. Recovery fixture mode uses the documented Webpack development option and mocks the development HMR socket to keep intercepted transactions stable; the main app configuration is unchanged. Run its explicit fixture mode separately from the disabled-AI baseline suite.

Observed verification issue: an initial desktop contact-edit assertion expired at five seconds while the list still showed its loading state. A targeted repeat passed. The test now waits for the directory's loading state with a bounded deadline; production clients also have transport deadlines and recovery messages. The recovery fixture also initially entered a Turbopack development-reload loop, including without a submit action; those failures were not evidence of a production financial-write defect. The isolated Webpack/HMR-pinned recovery run passed all four cases. Hydration guarding was added separately as protection against premature native form submission. Initial failures and the successful reruns are retained in the handoff rather than represented as a completely clean first run.

## Real-user scenario checklist

| Area | Cases and expected behavior |
|---|---|
| First use | Signed-out/expired session → sign-in; workspace missing → setup; first customer → explicit create; no implicit money posting |
| Names | Case/spacing, duplicate names, substring names, unknown name, archived person, local/international phone, another tenant's ID, invalid UUID → safe match or explicit recovery |
| Money | One paisa, zero, maximum/overflow, decimal precision, western/PK commas, malformed grouping, Urdu digits, negative, unsupported currency, amount omitted, model-invented amount → exact result or clarification |
| Dates | Written English/Urdu dates, ISO offsets, date-only, time-only with default date, missing date, year/month rollover, invalid leap date/day, incomplete year, weekday/kal ambiguity, conflicting clocks, phone hyphens → preserve explicit valid date/time or clarify |
| Financial meaning | Order vs sale, explicit credit vs confirmed receipt, overpayment/advance/loan, split methods, partial receipts, duplicate approvals, stale hash/version, reversals, competing allocations → bounded owner-approved domain effects |
| Recovery | Invalid customer phone, duplicate phone, provider unavailable/429, quota reached, uncertain request, double submit, expired proposal, lost connection, malformed response → input retained, exact retry or manual path |
| WhatsApp | Signed/deduplicated ingress, pairing replay/brute force, owner vs customer, malformed/plain-yes approval, exact token, expiry, STOP, media, consent/window, rate/rolling quota, uncertain send, out-of-order callbacks → no unauthorized financial action or blind resend |
| Background work | Duplicate leases, three-attempt limit, worker restart, order due change/fulfillment, quiet hours, deadline, stop/opt-out/pause → fixed workflow counters and terminal behavior |
| Operations | Auth revocation, CSRF, paused/suspended tenant, scoped export/CSV, retention, immutable history, restore freeze, secret scanning, missing provider settings → fail closed or documented manual recovery |

## Remaining limits and launch blockers

- **No Meta account or public callback:** live delivery/pairing/token permissions are NOT RUN. Follow [free test setup](../WHATSAPP_SETUP.md). Outbound remains disabled; no paid subscription or messaging was enabled.
- **Free allowance is not a spending guarantee:** the cap sees this app's attempts only, not other senders on the same number, account-specific billing or future price changes. Use the test number/dedicated number and confirm Meta's current account terms. Paid templates remain off.
- **Model coverage:** eight live cases do not establish full three-language accuracy. Worded amounts such as “one lakh,” fuzzy spellings/transliteration and multi-action instructions may still clarify. Do not silently invent missing amounts or choose a similar name.
- **Deliberate boundaries:** cash loans/advances, split-method single receipts, voice/media extraction, autonomous customer financial authority, arbitrary customer account chatbots and scheduled receivable reminders remain outside scope. Manual entries, explicit selections and ordinary approval remain available.
- **External operations:** production Google login/IAM, hosting/HTTPS/database TLS, hosted CI/Docker, managed restore/monitoring and actual merchant pilot are not verified by local tests. The directory is not a Git repository; no remote push or deployment occurred.
- The prior owner decision to finish Gemini business-data/provider/privacy setup manually remains in force; this audit does not mark those reviews complete.

## Next action

Review the local assistant's add/select flow and use Meta's free test-number setup. When the account, permitted recipient, secrets, phone-number ID and public callback are available, run the readiness checker and the documented end-to-end sequence before enabling outbound for that account.

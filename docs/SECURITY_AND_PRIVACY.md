# Security and privacy

[Documentation index](../README.md) · Product controls and launch checks, not legal certification

## Data and trust boundaries

Customer names/phone numbers, orders, messages, and udhaar balances are confidential business data. Do not collect CNICs, bank credentials, card details, medical records, or unrelated sensitive information. The owner must understand that the tool tracks owner-entered business records and does not verify payments or provide regulated accounting advice.

Every request, export, job, proposal, and lookup enforces tenant scope and actor authority. Composite tenant foreign keys prevent accidental cross-tenant joins. Test malicious IDs and forged role claims. The model, customer text, webhook content, and exported spreadsheet content are untrusted. Operator support access is time-limited, least-privilege, and audited; it does not confer merchant financial approval authority.

## Required controls

| Risk | Control | Evidence |
|---|---|---|
| Account takeover | Managed auth, verified tokens, short sessions, revoke paired WhatsApp identity; MFA for operators | AC-01/02 |
| Forged webhooks | Raw-body HMAC validation, request limits, tenant routing from configured recipient ID | AC-09 |
| Unauthorized finance | Explicit owner/version/hash approval, expiry, exact money parsing, immutable corrections | AC-04/05 |
| Duplicate writes | Provider dedup, durable idempotency, transaction/unique posting origin | AC-04/08 |
| Prompt injection | Allowlisted intents and structured schema, no unrestricted tools, server authorization | AC-03/13 |
| Secret leakage | Server-only keys, secret manager in production, redacted logs, no public env prefixes | AC-13 |
| AI overspend | Quota reservation, token/time/call bounds, spend caps, no escalation | AC-12 |
| Unwanted messaging | Consent evidence, opt-out suppression, template/window checks, quiet hours | AC-11 |
| Data loss | Encrypted managed backups, restore rehearsal, replay-safe jobs | AC-14 |

TLS in transit; managed database/storage encryption at rest; restricted database/service identities; no production secrets in local examples. Use separate development/staging/production projects and databases. Test fixtures are synthetic by default. Production errors must not echo prompt bodies, access tokens, raw message payloads, or connection strings.

For browser-origin writes, enforce allowed origins and applicable CSRF protections. Validate all inputs server-side, parameterize queries, escape rendered text, and protect CSV exports against formula injection. Add rate limits per sender, user, tenant, and IP; pairing challenges should have a maximum five verification attempts and request throttling.

## Gemini data processing

Send only the current instruction and the minimum necessary tenant-scoped context. Replace customer identity with temporary labels/opaque candidates where practical; omit phone numbers and full chat history. Logs keep model/version, request IDs, token counts, validation outcomes, and hashes instead of raw prompts by default. Do not enable provider prompt logging without an explicit privacy review.

Google’s unpaid-service terms describe broader data use and explicitly warn against submitting sensitive/confidential/personal information. Therefore synthetic data only until the project’s paid-service data handling and actual credit/billing status are verified. Paid status is not a promise of zero retention or complete local residency. Review the provider’s applicable terms, region availability, subprocessors, and cross-border processing before live data. Source checked 31 October 2026: [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms). Recheck at launch.

## Proposed retention defaults (require owner review)

| Data | Pilot default | Deletion behavior |
|---|---|---|
| Raw inbound/outbound message text | 30 days | Purge body; retain minimal IDs/status for dedup and audit |
| Temporary pairing challenges | 10-minute validity; purge within 24 hours | Keep redacted success/failure event only |
| Unapproved proposals | 30 days after terminal state | Purge sensitive payload; retain outcome metadata |
| Posted finance and exact approved financial payload | Active relationship; 90-day recovery after closure | Subject to agreed applicable retention obligations; preserve audit until reviewed deletion |
| Workflow/delivery audit and consent evidence | 12 months proposed | Minimize personal identifiers; retain suppression needed to respect opt-out |
| Operational logs | 30 days | Redacted and access restricted |
| Encrypted backups | 30-day rolling retention | Deleted data ages out; restored copies must reapply deletion/suppression journal |

These are engineering assumptions, not claims about Pakistan’s legal retention periods. Before live pilot, choose an applicable lawful retention policy with qualified local advice where needed, publish a privacy notice, define data roles/terms, record customer messaging consent, and explain third-party processing. No claim of Pakistani data residency or legal compliance is made by this plan.

Owner can request tenant export and account deletion through support. Verify identity; freeze new work; cancel unsent messages; export scoped data if requested; apply documented deletion/anonymization schedule and any reviewed retention exceptions. Explain backup expiry and retained audit/suppression information. Do not promise immediate erasure from every provider. Customer requests route through the business with a support escalation path.

## Incident and recovery

Proposed recovery objectives: RPO 24 hours, RTO 8 hours for pilot. Validate with selected hosting; these are targets, not SLAs. Back up daily, restrict restore access, and rehearse restore into an isolated environment. Reconcile approvals, financial uniqueness keys, outbox UNKNOWN sends, and deletion records before resuming dispatch.

For suspected compromise: pause outbound jobs and affected tokens, preserve redacted evidence, isolate the tenant/service, assess scope, rotate credentials, restore safe operation, and notify affected parties according to reviewed obligations. Do not replay all outbound messages after recovery. Require operator incident notes and owner-visible status for affected work.

Implementation: [operations/recovery](OPERATIONS_AND_RECOVERY.md) documents the actual commands, production Firebase revocation/ADC and certificate-verified TLS requirements, request caps, privacy-review/export, default message retention and encrypted restore. The current CSP restricts origins, framing, objects and forms; Next hydration uses inline script/style allowances, with development-only eval/loopback access. This is not a nonce-based strict CSP or a security certification. Production edge/IP rate limits, alert destinations, infrastructure IAM, key custody and legal retention/erasure policy require deployment review. The production dependency audit was rerun after gRPC/glob patches and returned zero advisories at that time; CI must continue checking it.

# Operations and recovery

[Index](../README.md) · S7, 1 November 2026

This is a deployment package and operating procedure. No hosting account, paid resource, real merchant, live model call or WhatsApp send has been provisioned. See [release evidence](RELEASE_READINESS.md) before changing that boundary.

## Deployable processes

Run the Next.js web process and `npm run worker` as separate supervised processes against the same migrated PostgreSQL database. The worker needs continuous execution; request-only background CPU is insufficient. A worker tick claims at most one leased job and one outbound intent. `npm run worker -- --once` runs one tick. Domain workflows retain their own fixed bounds across process restarts.

The Dockerfile provides `migrate` and `runtime` targets. The migration target retains Prisma tooling; runtime has production dependencies and the generated client. Build with a reviewed current Node 22 image digest through `NODE_IMAGE`, then scan and test the image. Docker was unavailable locally, so image build/run is **NOT RUN**. The optimized Next build and the separate local production-dependency profile are independently checked; they do not certify a container image. The GitHub workflow prepares equivalent Windows/Edge local tests without provider secrets or deployment. Its hosted execution remains NOT RUN until a Git repository/runner is selected. Review/pin action digests before release.

Production must set `APP_ENV=production`, enable Firebase authentication, use identical HTTPS app/public origins and a PostgreSQL URL with `sslmode=verify-full`. Never disable certificate verification. Use a secret manager and workload identity/ADC with only the Firebase user-read/revocation permissions needed by the app. Login verifies revocation, and private web requests recheck disabled/revoked accounts. SDK/network failure denies access. Emulator hosts are forbidden in production, including production-built servers. The legacy-session migration invalidates old sessions whose verified authentication time was unavailable.

Keep separate migration, application and operator database credentials. The application role must not be a superuser, own tables, create roles, change schema or disable triggers. Grant its necessary DML to public application tables and sequences; keep migration history/DDL privileges on the migration identity. Limit connection access to the web/worker network. Current application authorization/composite foreign keys enforce tenancy; this is not a claim of PostgreSQL RLS enforcement. Operator commands have no public HTTP route and never confer merchant financial approval authority.

## Provider activation

Firebase public configuration is already stored locally. Enable Google sign-in and authorize the actual local/deployed domains in its console, then exercise real Google login and production ADC/revocation. No private service-account JSON is needed in chat.

For Gemini, follow [AI setup](AI_SETUP_AND_EVALUATION.md). No model/rate has been selected or live-evaluated. Set its key in an ignored secret setting, complete the account/credit/data-terms review, evaluate the 60 cases and record `AI_REVIEW_REFERENCE` before enabling AI. Until then, manual entry and deterministic summaries remain available.

For Meta, configure the official webhook `/api/v1/webhooks/whatsapp`, app signing secret and separate verification token. Record a supported Graph version and actual permitted test delivery. One dedicated phone-number ID belongs to one tenant. Set `META_REVIEW_REFERENCE` and matching `META_GRAPH_API_VERSION`; store `META_ACCESS_TOKEN` only server-side. Operator provisioning does not send a message:

```powershell
$env:OPERATOR_ID='your-operator-reference'
$env:OPERATOR_REVIEW_REFERENCE='your-reviewed-setup-record'
npm run operator -- channel <tenant-uuid> <dedicated-phone-number-id> <reviewed-graph-version>
```

Use placeholders as placeholders; no real number has been provisioned by development. Outbound dispatch requires its separate enabled flag and dispatch-time permission/window/state checks. Paid templates remain hard-disabled with zero allowance. Outside the recipient’s own 24-hour window, the app keeps dashboard handling rather than substituting a prohibited free-form message. Pair the owner from `/messages`; review an exact financial preview before creating its ten-minute WhatsApp approval command. The plaintext pairing/control secret appears once and is hashed before durable inbound storage.

## Monitoring and intervention

`/health/live` reports HTTP process life. `/health/ready` checks configuration and database access without leaking details; neither proves worker health or provider delivery. Poll them from the selected external monitor. Run `npm run operator -- metrics` with operator database access to inspect queue age, failed jobs/messages, UNKNOWN sends, held AI reservations and paused workspaces. Ordinary application logs contain request/job IDs and safe error names, not raw prompt/provider bodies or credentials. Development request URLs may contain synthetic search text; do not use development logging for real merchant data.

Alert on unavailable readiness, overdue queues, exhausted jobs, any UNKNOWN send, held AI reservations, failed backups, quota/spending warnings and approaching credit expiry. The owner sees 80% monthly action usage in `/usage`. External alert delivery, provider invoice reconciliation and credit-expiry monitoring need the chosen operator/monitoring account; a DSN placeholder does not implement an alert subscription.

An uncertain AI execution keeps its worst-case cost/action reservation. Reconcile its execution ID with provider usage and any saved proposal before an audited operator correction; never refund merely because time passed. No automatic release or blind provider retry exists. An UNKNOWN Meta send never automatically requeues. Reconcile a signed callback/opaque reference or provider evidence, and review duplicate risk before any new action. Workflow lifetime/one-update limits still apply.

To freeze new work while preserving authenticated owner history/export:

```powershell
npm run operator -- pause <tenant-uuid>
```

This revokes pairing/approval controls, stops workflows and cancels unsent work. In-flight sends cannot be retracted; record their eventual status. `resume <tenant-uuid>` requires a new reviewed operator context and does not replay cancelled work or restart a terminal workflow. Re-pair after a pause as needed. For suspected account compromise, also revoke Firebase sessions/disable the affected account, rotate affected provider credentials and preserve redacted incident evidence.

Pilot entitlements use `plan <tenant-uuid> <FREE|SMART|PRO|BUSINESS> <ISO-expiry>`, with expiry within 90 days and append-only operator evidence. This records a trial entitlement, never evidence of payment. No subscription checkout or automatic charges exist.

## Retention, export and deletion

Schedule `npm run operator -- maintain` daily after the retention policy is reviewed. Default message bodies are purged after 30 days (configurable downward to 1 day); old pending content becomes a manual-review item. Old outgoing PENDING becomes cancelled, old SENDING becomes UNKNOWN. Paid/posted financial records, exact approved financial payloads, financial idempotency, audit and consent history are retained. Expired sessions/challenges and obsolete rate buckets are removed; unapproved terminal proposal content is minimized. The maintenance integration test proves old body removal without changing the posted ledger or consent evidence.

The owner can download scoped business records or submit an EXPORT/DELETE support-review request in Workspace setup. A deletion request is not automatic erasure. Verify identity and authority, determine applicable retention exceptions, freeze new work, arrange a verified export, and journal any approved deletion/anonymization/suppression before executing it. The actual legal retention policy, support contact and account-closure execution require owner review before live onboarding. No destructive customer-data erasure has been run.

## Encrypted backup and isolated restore

Use managed daily backups/PITR as the deployment baseline, with encrypted storage, access controls, 30-day reviewed retention and separate key custody. The included pilot logical tool also snapshots exact numeric JSON text in one repeatable-read transaction, binds the migration fingerprint, compresses it and encrypts using AES-256-GCM. It refuses a table exceeding 100,000 rows instead of silently producing a partial backup. It is not a replacement for large-database native/managed tooling.

Supply `BACKUP_ENCRYPTION_KEY_BASE64` (32 random bytes) and `BACKUP_KEY_ID` through a secret store. Keep the key separate from the backup. `npm run backup -- <new-file.enc.json>` refuses to overwrite an existing file. Copy encrypted backups and the latest independent deletion/suppression journal to separately controlled storage; alert when backup age exceeds 24 hours.

For recovery, provision an **empty isolated** `dukaanpilot_restore_*` or `dukaanpilot_recovery_*` database, apply the exact matching migrations using a migration identity, and set `RESTORE_DATABASE_URL`, the encryption key and `RESTORE_REVIEW_REFERENCE`. Run `npm run restore -- <backup.enc.json>`. The tool refuses a nonempty target and a migration mismatch. It restores with foreign-key/check/immutability controls enabled, then pauses all tenants, invalidates sessions/pairing/controls, suppresses all conversations, cancels unsent jobs, marks interrupted sends UNKNOWN and records a recovery event. It never resumes dispatch automatically.

Before reopening, compare authoritative finance/audit/consent checksums, reapply the **latest external** deletion/suppression journal (which may be newer than the snapshot), reconcile uncertain sends/AI reservations, test private access and export, and record the operator review. Refresh permissions/pairings explicitly; terminal workflows cannot restart. No external journal existed in this synthetic exercise, so real journal reapplication remains a release prerequisite. Blanket suppression/frozen dispatch prevents restored old permission from authorizing a send in the meantime.

`npm run test:restore` rehearses against the isolated synthetic local test database, creates a new retained inspection target and keeps dispatch frozen. The last recorded run restored 9,941 rows/37 tables in about 4 seconds, with matching authoritative financial/audit/consent/workflow checksums. This measures a local snapshot/restore, not a production RPO/RTO guarantee. Targets remain RPO 24h/RTO 8h until hosting backup schedules, key recovery and an actual hosted rehearsal prove them.

## Final rollout order

Complete the open items in [release readiness](RELEASE_READINESS.md); confirm pricing/privacy/support; approve the image/CI and hosted restore evidence; migrate an isolated staging database; verify real Google sign-in and revocation; evaluate Gemini on synthetic messages; exercise permitted Meta recipients and callbacks; conduct a mobile owner walkthrough; then obtain explicit deployment/live-pilot approval. Keep feature flags off until their own evidence is complete. Recruit 5–10 consenting merchants for the actual two-week pilot. Local fixture success does not establish merchant outcomes.

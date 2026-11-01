# Phase status and release readiness

[Documentation index](../README.md) · Updated 1 November 2026

The owner requested implementation through S8 and asked to defer user-dependent account/deployment questions until the end. Continue all independent engineering work. A completed engineering stage does not establish real-provider delivery, real merchant pilot success, or permission to spend/deploy.

| Stage | Status | Evidence / next action |
|---|---|---|
| S1 foundation | COMPLETE | Dashboard, production build, configuration and navigation checks |
| S2 tenancy/data/auth | COMPLETE | 11 config/validation tests, 8 PostgreSQL integration cases, 8 browser checks; targeted desktop/mobile regression after layout/session navigation fixes; Prisma migrations applied to local dev/test databases |
| S3 financial core | COMPLETE locally | Owner-approved proposals, orders, exact sales/allocations/reversals, reports/export; 8 financial PostgreSQL cases and desktop/mobile financial walkthroughs passed |
| S4 Gemini | IMPLEMENTED; live evaluation BLOCKED | REST adapter, bounded calls, atomic quotas/cost reservations, assistant/usage UI, 60 authored language cases; 4 PostgreSQL AI cases and contract tests passed; model selection/credit/terms/real evaluation pending |
| S5 WhatsApp | IMPLEMENTED; live delivery BLOCKED | Signed/deduplicated ingress, hashed pairing/approvals, consent history, leased worker, policy outbox and message UI; 7 PostgreSQL channel cases, 22 unit/contract tests, 14 browser checks and build pass; real Meta credentials/version/recipient test pending |
| S6 Factory Loop | COMPLETE locally | Durable one-lifetime workflow, fixed deadline, 3/2/1 bounds, zero scheduled AI calls, atomic stops and dispatch checks; 4 PostgreSQL workflow cases plus unit tests and desktop/mobile enable/fulfill walkthroughs pass |
| S7 operations | IMPLEMENTED; deployment gates open | Revocation/TLS/rate guards, audited operator controls, retention/export/review, encrypted isolated restore, health/metrics and deployment/CI package; actual hosting/IAM/container/CI and external journal review pending |
| S8 acceptance | LOCAL ACCEPTANCE COMPLETE; live gates open | 25 unit/contract, 36 PostgreSQL and 16 browser checks pass; optimized build, clean production runtime, zero production advisories and frozen restore pass; live pilot not cleared |

## User-dependent items to collect at the end

- Confirm Google sign-in provider and authorized domains in the supplied Firebase project; perform an actual Google sign-in. Public web configuration is already provided and stored locally.
- Supply Gemini server credentials through an ignored local/secret-manager setting; verify credit balance/expiry, selected model availability, paid-service terms and spending caps.
- Supply Meta app/number/token/webhook/template/consent configuration; test actual WhatsApp delivery and business-owned onboarding.
- Choose deployment provider/project/region/domain, database/backup arrangements, deployment identity/IAM and budget. No paid resources are created by local implementation.
- Confirm support contact, privacy/retention/terms and proposed commercial tiers before onboarding real customers.
- Recruit consenting merchants and perform the real two-week pilot. Synthetic test success does not prove market outcomes.

Record concrete commands/results in DEVELOPMENT_HANDOFF.md as each stage closes. Keep blocked live checks distinct from passed local/fixture checks.

## Owner setup response — 1 November 2026

- Firebase: owner reports Google sign-in/local authorized domains enabled. An actual real-project sign-in and production identity check remain unverified.
- Gemini: a credential was supplied in chat. It was not copied into source/local settings or used for a provider request. Replace it through AI Studio and add the replacement directly to ignored local secret settings. Credit balance/expiry, billing/data terms and model evaluation remain unknown. AI_ENABLED and AI_LIVE_DATA_ENABLED remain false.
- WhatsApp: owner currently uses ordinary WhatsApp; no Meta business app/dedicated API test number/allowed recipient setup is available. Keep Cloud API outbound disabled and use the web dashboard for now.
- Hosting: none selected. Continue locally; no infrastructure has been provisioned.
- Business: support contact, plans, privacy/retention and pilot arrangements are not finalized. Live onboarding remains blocked.

## Free-tier AI setup update — 1 November 2026

The owner confirmed Free Tier with billing disabled and saved the key locally. Expired credits no longer block synthetic provider checks. Local AI is enabled in fixed-sample mode with Gemini 3.5 Flash-Lite; all three prepared language examples passed actual provider extraction checks. Arbitrary business/personal input is rejected before a provider request and samples create no proposals. Full business-data AI activation and 60-case acceptance remain pending. See AI_SETUP_AND_EVALUATION.md for the model, pricing reference and data-terms review. WhatsApp outbound and paid resources remain disabled.

## Owner-directed normal business AI — 1 November 2026

Supersedes the sample-only setup above. The owner requested normal business use and will complete remaining provider/privacy configuration manually. The temporary sample UI, server allowlist, sample script and non-proposal response path are removed. Local AI now accepts normal authenticated instructions, resolves tenant customers and prepares approval proposals. No posted financial changes occur without exact owner approval. Model remains Gemini 3.5 Flash-Lite with existing limits and reference prices. Launch/deployment, full language evaluation, privacy/provider review, real Google login and Meta delivery remain pending. See LAUNCH_SETUP.md for concrete manual steps; no paid provisioning, public deployment or messages were performed.

## Latest real-user audit — 1 November 2026

Completed scoped customer/AI/channel audit and repaired the practical recovery, amount/date/phone, retry and WhatsApp owner-preview issues; details and executable case inventory are in audit/USER_AUDIT.md and audit/TEST_CASES.md. Final local results: 32 unit/contracts, 42 PostgreSQL, 20 distinct browser executions (16 baseline plus 4 recovery), optimized build, eight live synthetic Gemini cases, encrypted 20,748-row restore and secret/readiness checks passed. This does not mark live Meta delivery or public launch as tested. The owner has no Meta account and requires no paid WhatsApp setup; outbound remains disabled while the documented free test onboarding is completed. App-level service sends now cap at 900 attempts over rolling 33 UTC days; provider allowance and other apps' sends still need account review. No deployment, paid subscription or real customer send occurred.

**Final audit totals:** 33 unit/contract tests, 42 PostgreSQL cases and 20 distinct browser cases passed. The financial WhatsApp formatter also has a regression against hidden item prices/references/allocations and incomplete oversized approvals. Full report and live synthetic results remain under docs/audit.

## Free web hosting preparation — 1 November 2026

The owner's selected zero-spend path is Netlify Free + Neon Free, keeping Firebase Auth and billing-disabled Gemini. Neon project floral-voice-84861315 is created in the verified Free organization, PostgreSQL 18/Ohio/0.25 CU; 18 migrations and direct/pooled verified-TLS checks passed with zero hosted tenants/sales. Local settings/data preserved. Netlify config, secure server credential support, offline preflight and private import settings are prepared. No persistent worker is provisioned; new follow-up enablement and WhatsApp are disabled in this profile. Local checks/build/37 unit/42 database/2 browser tests passed; hosted app/adapter/Firebase IAM/Google login/AI/finance acceptance remain NOT RUN. See FREE_DEPLOYMENT.md and the latest handoff for next steps and evidence.

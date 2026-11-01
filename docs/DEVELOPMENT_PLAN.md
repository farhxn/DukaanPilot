# Development plan

[Documentation index](../README.md) · Implementation sequence; actual status is in [the handoff](DEVELOPMENT_HANDOFF.md)

The [development handoff](DEVELOPMENT_HANDOFF.md) adds local starting defaults, a concrete S1 brief, and a stage tracker. [AGENTS.md](../AGENTS.md) routes coding agents to the project-local development and Factory Loop skills. These are preparation artifacts, not implemented application features.

## Gate G0 — Review before scaffolding

The initial deliverable was the documentation and skills bundle. The user authorized local development on 1 November 2026; S1 is now implemented and verified. Owner reviews of proposed pricing/caps and provider prerequisites remain tracked at their dependent stages. Do not require another scaffolding confirmation. This authorization does not create permission for paid infrastructure or live messaging.

Review sign-off fields: owner/reviewer, date, approved document version, scope changes, unresolved questions and their blocking stages. Leave blank until actually reviewed.

## Dependency order

`G0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8 -> live pilot review`.

Each step should be a small reviewable change or several clearly separated changes if necessary. Read the linked documents and acceptance cases before beginning. Do not add deferred features to complete a step. If new facts change scope, update the decision register and affected requirements first.

| Step | Context and tasks | Validation / exit | Dependency / rollback |
|---|---|---|---|
| S1 — Foundation | Read architecture/security/env; select supported runtime versions and auth/hosting approach; scaffold Next.js/TypeScript only after G0; configure lint/type checks, secret exclusion, synthetic local setup | Clean install/build, configuration validation, no secrets in client bundle; record exact versions and run commands in README | G0, Q3 decision; revert unused scaffold before data exists |
| S2 — Tenancy and data | Read schema PR-01/02; add Prisma/PostgreSQL migrations, managed auth verification, tenant membership, contacts, pairing challenge storage | AC-01/02; migrations apply to disposable DB; forged IDs denied | S1; restore dev DB; production changes use forward migrations |
| S3 — Deterministic business core | Read financial rules/J2/J4/J7; manual proposal UI, approvals, orders, sales, allocations, reversals, dashboard/CSV; transaction/outbox primitives | AC-04/05/06/07/08; concurrent payments and replays correct; manual web path works without AI | S2; feature-disable mutations while retaining history; compensating entries for posted data |
| S4 — Gemini adapter | Read AI/billing; choose and pin evaluated model; quota reservations, structured output, clarification, optional aggregate wording | AC-03/12/13; synthetic language fixture report and measured token cost; account data terms/credit eligibility recorded | S3, Q5/Q6 before paid calls/live data; disable AI, preserve manual entry |
| S5 — WhatsApp | Read API/security; pin supported Graph version; test number webhook signature/dedup, tenant routing, pairing, inbox/outbox, consent/template handling | AC-02/09/11; permitted test recipients only; timeout ambiguity handled; no customer financial authority | S4, Q2 and provider access; pause dispatch, retain inbox and web use |
| S6 — Bounded workflow | Read loop spec/J5; persist counters/state, job leases, timing, owner reminders, approved customer update, stop/expiry | AC-10/11; fake-clock proof of bounds through crashes/retries and quiet hours | S5; stop workflows and cancel unsent actions, no replay |
| S7 — Operational readiness | Read security/billing; monitoring, subscription entitlement display, retention/export/delete process, backup/restore, human support path | AC-12/13/14; credential rotation and isolated restore evidence; spend/provider prerequisites ready | S6, Q4/Q7/Q8 before live use; freeze affected services, restore according to runbook |
| S8 — Pilot acceptance | Execute full acceptance matrix, mobile owner walkthroughs, onboard 5–10 consenting businesses, document known limits | All mandatory cases pass; reviewer records evidence; no unresolved critical finance/isolation/consent failures | S7; pause onboarding/outbound, preserve owner access and export |

## Working rules for future implementation

- Keep domain services independent from channel and AI adapters. Add meaningful financial, isolation, webhook, and workflow tests alongside those services.
- Do not let tests merely assert mocked happy-path outputs; exercise PostgreSQL transactions and race conditions for financial effects.
- Use synthetic seed records; production migration/credentials never enter source control.
- Future CI should run formatting/lint, TypeScript checks, unit/integration tests, and production build. Concrete commands belong in README after the actual toolchain exists; do not invent runnable commands now.
- Capture actual changed behavior, validation evidence, rollback approach, and unresolved limits per change. A test plan is not a test result.

## Change protocol

Assign a decision ID for changed scope or financial/workflow semantics. Update product requirements, scope, affected contracts/schema/acceptance cases, and environment contract together. Preserve requirement IDs; mark removed requirements explicitly instead of silently renumbering. Record model/provider version changes with fixture results before rollout. Paid usage and provisioning require the user’s applicable authorization, separate from writing local code.

## First development session after approval

Use the user's start/build instruction as G0 authorization, record Firebase Auth as the proposed local starting choice unless overridden, select supported development versions, and begin S1 using the handoff. Real provider credentials are required only for actual integration stages. Do not jump directly to AI or WhatsApp integration before the financial core. Provider prerequisites can be researched during earlier steps without changing the dependency gates or creating paid resources.

---
name: dukaanpilot-factory-loop
description: Implement, debug, or review DukaanPilot's bounded pending-order follow-up workflow, including durable scheduling, owner approvals, messaging policy, retries, and stopping rules. Use for this product workflow rather than generic agent orchestration.
---

# DukaanPilot Factory Loop

Build one deterministic pending-order workflow around persisted business state. Gemini may draft an action; it does not run the scheduler, decide fulfillment, confirm money, or send messages directly.

## Locate the contract

In this project layout the root is `../../..` from this skill folder. Read [AI_AGENTS_AND_FACTORY_LOOPS.md](../../../docs/AI_AGENTS_AND_FACTORY_LOOPS.md) for the authoritative state machine, deadlines and counters. For the requested task also read:

- Persistence/concurrency: [DATABASE_SCHEMA.md](../../../docs/DATABASE_SCHEMA.md) and [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md).
- Approvals, consent, delivery or retries: [API_AND_WHATSAPP.md](../../../docs/API_AND_WHATSAPP.md).
- Validation: AC-10/11 in [TESTING_AND_ACCEPTANCE.md](../../../docs/TESTING_AND_ACCEPTANCE.md) and [failure scenarios](references/failure-scenarios.md).

If moved away from the bundled project, locate the matching DukaanPilot documents before editing; do not substitute guessed rules. User instructions take precedence; document intentional contract changes across affected specs and tests.

## Implement the next relevant slice

Inspect existing order, job, outbox, approval, and workflow code first. Reuse domain services and transaction boundaries. Check S6 dependencies in the development plan; pure transition logic can be prepared with fake adapters, but do not claim working Meta integration without S5 evidence.

Represent eligibility, transitions, deadlines, logical check/reminder/update counts, technical attempts, and terminal outcomes explicitly in durable state. Prefer a pure decision function accepting persisted state and an injected clock, returning a transition plus proposed effects. Apply it under a transaction/lease with uniqueness constraints; run external sends only after commit through the outbox. Specific code structure can follow the repository's conventions.

Preserve these contract limits unless the owner changes the specification:

- One lifetime workflow per order; only an approved pending order with explicit due time and owner enablement qualifies.
- `startAt = max(enabledAt, dueAt - 24h)`; `expiresAt = min(startAt + 72h, dueAt + 24h)`; never extend expiry on retries or restarts.
- At most three logical checks, two owner reminders at least twelve hours apart, and one separately owner-approved customer update. Scheduled checks make zero Gemini calls.
- Initial technical attempt plus at most two retries at one/five minutes; retry reuses the logical action key and does not grant extra check or message allowance.
- No proactive WhatsApp sends 21:00–09:00 Asia/Karachi. Revalidate state, deadline, consent, service window/template, approval, quota, and stop flag at dispatch.
- Fulfillment, cancellation, stop, opt-out, tenant suspension, due-date edit, expiry, or exhausted bounds cancels unsent work as specified. No automatic restart or late escalation.

Never treat customer claims as fulfillment/payment proof. Never let this workflow post a sale or payment. Bind customer-update approval to exact owner, tenant, recipient, text hash/version and expiry. Invalidate changed content; do not silently refresh permission.

## Handle delivery uncertainty

Persist logical identity/counters before side effects. A lease/retry cannot produce another logical intent. A timeout after possible provider acceptance becomes UNKNOWN; do not blindly retry it. Local idempotency is not exactly-once external delivery. Surface uncertainty and policy blocks to the owner inbox rather than extending the workflow.

Keep inbox reminders distinct from WhatsApp transport attempts. Inspect the canonical scheduling rules for blocked dispatch; if a case is genuinely unspecified, make a narrow recorded design decision before implementing a new retry path.

## Verify and report

Exercise fake-clock boundaries, duplicate jobs, concurrent claims, terminal races, restart recovery, stale approvals, opt-out, and ambiguous sends. Assert persisted financial and message side effects as well as transitions. Use the linked failure scenarios to choose relevant cases; no real customer sends for unit tests.

Report the changed transitions/effects, actual tests and results, remaining limitations, and any document changes. Distinguish a pure reducer implementation, a durable worker integration, and a live-provider validation; completion of one does not prove the others.

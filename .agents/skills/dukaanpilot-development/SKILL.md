---
name: dukaanpilot-development
description: Start or resume DukaanPilot development from its reviewed specifications, selecting the next dependency-ready implementation slice and recording validation and handoff evidence. Use for building this Pakistan-first WhatsApp and dashboard assistant.
---

# DukaanPilot development

Turn the specification into small working increments without confusing planned features with built behavior.

## Establish current state

The bundled project root is `../../..` from this skill folder. Read [AGENTS.md](../../../AGENTS.md), [development handoff](../../../docs/DEVELOPMENT_HANDOFF.md), and [DEVELOPMENT_PLAN.md](../../../docs/DEVELOPMENT_PLAN.md). Read the relevant contracts for the slice, not every document by default.

Inspect the working tree, existing application files, and last actual validation evidence. The initial bundle has no application code or package manifest. If the user now explicitly asks to start/build/scaffold, that is authorization for the corresponding local implementation; do not repeat the old documentation-review question. If the request is only to edit plans or skills, keep it at that scope. Never infer authorization for paid provisioning, deployment, or live sends from a skill invocation alone.

## Select and complete the slice

Follow S1–S8 dependencies. Foundation and deterministic financial services precede AI/WhatsApp; the product Factory Loop follows channel integration. Use [DEVELOPMENT_HANDOFF.md](../../../docs/DEVELOPMENT_HANDOFF.md) for S1 defaults and deferred provider gates. For code touching scheduled follow-up, also load the sibling [Factory Loop skill](../dukaanpilot-factory-loop/SKILL.md).

Pick a coherent deliverable with observable exit criteria. Complete authorized work within the user's requested scope; a slice boundary is not a reason to stop an instruction to build further. Prefer current repository conventions; choose supported dependency versions from official sources when scaffolding, and record the resolved versions and real commands afterward.

Preserve shared domain services across web and WhatsApp. Tenant scope, exact integer-paisa arithmetic, atomic owner approvals, immutable financial history, and durable idempotency apply to every entry path. Gemini supplies structured proposals only. Manual web operations must survive AI/Meta outages. Do not implement deferred product features as incidental dependencies.

Unknown credit balance, phone number, hosting region, or commercial pricing does not block unrelated local code. Use synthetic fixtures/fake adapters for local verification and record which stage needs real credentials/provider evidence. Never invent secrets, mark a fake integration as live, or expose server secrets in browser configuration.

## Verify and leave a useful handoff

Run the actual project's checks appropriate to the change. Use PostgreSQL integration/race tests for money/isolation, raw-byte contract tests for webhooks, and fake-clock tests for workflow timing. Maintain PR/AC mappings in [TESTING_AND_ACCEPTANCE.md](../../../docs/TESTING_AND_ACCEPTANCE.md). Record unavailable checks as NOT RUN/BLOCKED with the concrete reason.

After a meaningful implementation increment, update the handoff with stage status, concrete behavior, changed files, exact check commands/results, unresolved dependencies, and the next ready task. Update README setup commands only after they work. Never store real credentials or customer data in handoff evidence.

For scope/semantic changes, record a decision and update the owning spec plus affected tests. Ask only when a required choice cannot be resolved from the user's instruction or documented defaults; continue independent work. A completion report must distinguish implemented behavior, tested behavior, and provider/live prerequisites still pending.

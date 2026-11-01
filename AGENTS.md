# DukaanPilot development entry point

This folder is the project root. Read [README.md](README.md), [MVP scope](docs/MVP_SCOPE.md), and [development handoff](docs/DEVELOPMENT_HANDOFF.md) before implementing changes. Development was authorized on 1 November 2026; inspect the handoff and actual code for current progress.

## Project skills

Use the relevant local skill when its task applies:

- [dukaanpilot-development](.agents/skills/dukaanpilot-development/SKILL.md): start/resume implementation, choose the next dependency-ready slice, validate it, and record handoff evidence.
- [dukaanpilot-factory-loop](.agents/skills/dukaanpilot-factory-loop/SKILL.md): design, implement, debug, or review the single pending-order follow-up workflow.

The first skill governs engineering work. The second governs a product feature. Neither means spawning autonomous agents or repeatedly running AI until a task succeeds.

## Invariants

- Stack: Node.js/TypeScript, Next.js, PostgreSQL/Prisma, Gemini Developer API, official Meta WhatsApp Cloud API.
- Tenant scope applies to requests, joins, jobs, exports, proposals, and sends. Customer identity never grants owner authority.
- Gemini proposes; authenticated owner approves a version/hash; deterministic services commit. No direct AI financial writes.
- Use integer paisa, exact parsing/calculation, UTC storage, Asia/Karachi business dates. Preserve posted history with reversals.
- Orders and fulfillment do not post a sale implicitly. Payments require owner confirmation and valid allocations.
- Manual web operations must remain usable without Gemini or WhatsApp.
- Do not add deferred inventory, voice, autonomous purchasing, payment collection, staff, or multi-branch features incidentally.

## Implementation and evidence

Follow S1–S8 in [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md). Check existing code and actual evidence before deciding where to resume. Do not mark stages done because a document exists. Run checks appropriate to the change and report actual results; keep acceptance cases NOT RUN until exercised.

Use the canonical specifications rather than inventing conflicting rules: [financial schema](docs/DATABASE_SCHEMA.md), [workflow limits](docs/AI_AGENTS_AND_FACTORY_LOOPS.md), [channel contract](docs/API_AND_WHATSAPP.md), [usage units](docs/BILLING_AND_AI_COSTS.md), and [acceptance matrix](docs/TESTING_AND_ACCEPTANCE.md).

The user authorized local development on 1 November 2026. Do not request the same scaffolding authorization again. Paid resources, live messaging, and deployment remain separate actions. Proceed with authorized local work and track provider prerequisites only at their dependent stage.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

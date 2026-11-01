# DukaanPilot

Pakistan-first AI business assistant for general small businesses, using WhatsApp and a simple mobile-friendly web dashboard.

**Current delivery: web first.** The owner chose to defer WhatsApp while Meta account access is restricted. Open [Assistant](http://127.0.0.1:3000/assistant), sign in, add/select a customer, prepare a draft, and approve it in the browser. No Meta app, business portfolio or phone pairing is needed for web operations. WhatsApp sending remains disabled and its settings are optional. Deployment and the remaining web launch checks are still separate.

**Status:** Local S1–S8 engineering implementation and acceptance review · 1 November 2026. Live pilot release is not cleared. Manual financial recording, approvals, orders and bounded follow-up are implemented; provider/hosting/pilot gates remain explicit. [Phase/release status](docs/PHASE_STATUS_AND_RELEASE.md) tracks work through S8; [the handoff](docs/DEVELOPMENT_HANDOFF.md) records actual checks and limits.

Owners describe orders, sales, and customer payments in Roman Urdu, Urdu, or English. DukaanPilot proposes a structured action; the owner reviews it; deterministic services save approved changes. A bounded Factory Loop helps the owner follow up on pending orders.

**Local AI update:** Gemini 3.5 Flash-Lite is enabled for the normal business assistant. Sign in and open [Assistant](http://127.0.0.1:3000/assistant), enter an instruction, and review its draft in Approvals. The owner will complete provider/privacy setup manually; deployment and business-data acceptance remain pending. See [launch setup](docs/LAUNCH_SETUP.md).

**Real-user audit:** the assistant now offers inline add/select/restore customer recovery, handles formatted amounts and local phones, preserves provided/default dates and supports owner WhatsApp previews with exact approval controls. See the [audit and findings](docs/audit/USER_AUDIT.md), [case inventory](docs/audit/TEST_CASES.md), [eight live synthetic results](docs/audit/LIVE_AI_RESULTS.json), and [free WhatsApp test setup](docs/WHATSAPP_SETUP.md). Real Meta delivery is not connected yet.

## Read first

**Free deployment:** [Netlify Free + Neon Free setup](docs/FREE_DEPLOYMENT.md), [production environment template](deploy/.env.example), and `npm run deployment:check`. Firebase remains the sign-in provider. This profile disables WhatsApp and automatic follow-ups because no persistent worker is provisioned. The Free Neon database is created with all 18 migrations and verified TLS/pooling; Netlify deployment and hosted smoke tests remain NOT RUN.

1. [Product requirements](docs/PRODUCT_REQUIREMENTS.md): audience, terminology, requirements, and success measures.
2. [MVP scope](docs/MVP_SCOPE.md): release boundary and explicit non-goals.
3. [User journeys](docs/USER_JOURNEYS.md): concrete happy paths and failure paths.
4. [Decisions and open questions](docs/DECISIONS_AND_OPEN_QUESTIONS.md): assumptions and review decisions.
5. [Development plan](docs/DEVELOPMENT_PLAN.md): dependency order and gates before implementation.

## Full documentation index

| Document | Purpose |
|---|---|
| [PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Problem, personas, shared language, numbered requirements |
| [MVP_SCOPE.md](docs/MVP_SCOPE.md) | In/out boundaries and pilot release gate |
| [USER_JOURNEYS.md](docs/USER_JOURNEYS.md) | Onboarding, orders, sales, repayments, summaries, follow-up |
| [FEATURES_AND_ROADMAP.md](docs/FEATURES_AND_ROADMAP.md) | Priorities and staged releases |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Node.js/TypeScript, Next.js, PostgreSQL/Prisma, Gemini, Meta |
| [AI_AGENTS_AND_FACTORY_LOOPS.md](docs/AI_AGENTS_AND_FACTORY_LOOPS.md) | AI permissions, state machines, bounded loop |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Entities, relationships, money rules, constraints |
| [API_AND_WHATSAPP.md](docs/API_AND_WHATSAPP.md) | Endpoint contracts, identity routing, webhooks, outbound rules |
| [SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Isolation, approvals, data lifecycle, operational controls |
| [BILLING_AND_AI_COSTS.md](docs/BILLING_AND_AI_COSTS.md) | Proposed tiers, metering, credits, budget formulas |
| [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Small implementation steps, dependencies, exit criteria |
| [TESTING_AND_ACCEPTANCE.md](docs/TESTING_AND_ACCEPTANCE.md) | Testable acceptance cases and evidence requirements |
| [DECISIONS_AND_OPEN_QUESTIONS.md](docs/DECISIONS_AND_OPEN_QUESTIONS.md) | Decision record, assumptions, review checklist, references |
| [.env.example](.env.example) | Commented future environment contract; placeholders only |
| [AGENTS.md](AGENTS.md) | Coding-agent entry point and project invariants |
| [DEVELOPMENT_HANDOFF.md](docs/DEVELOPMENT_HANDOFF.md) | Local defaults, S1 brief, stage tracker, and kickoff prompts |
| [AUTH_AND_LOCAL_DEVELOPMENT.md](docs/AUTH_AND_LOCAL_DEVELOPMENT.md) | S2 sign-in, PostgreSQL, emulator, session and local test setup |
| [OPERATIONS_AND_RECOVERY.md](docs/OPERATIONS_AND_RECOVERY.md) | Operator controls, deployment package, retention and encrypted recovery |
| [RELEASE_READINESS.md](docs/RELEASE_READINESS.md) | Actual acceptance evidence and pending owner/provider inputs |
| [WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md) | Free Meta test-number setup, pairing and owner AI approval flow |
| [User audit](docs/audit/USER_AUDIT.md) | Real-user failures repaired, regression inventory and remaining launch limits |
| [AI_SETUP_AND_EVALUATION.md](docs/AI_SETUP_AND_EVALUATION.md) | Gemini activation gate, quota/cost accounting and pending model evaluation |
| [PHASE_STATUS_AND_RELEASE.md](docs/PHASE_STATUS_AND_RELEASE.md) | Engineering progress through S8 and deferred live-launch inputs |
| [Development skill](.agents/skills/dukaanpilot-development/SKILL.md) | Reusable start/resume implementation workflow |
| [Factory Loop skill](.agents/skills/dukaanpilot-factory-loop/SKILL.md) | Reusable bounded pending-order implementation/review workflow |

## Shared rules

- A **tenant** is one business; MVP has one owner and one business location per tenant.
- A **proposal** is a draft, never a posted financial record. Only the authenticated owner approves it.
- Amounts are integer **paisa**; display PKR. Store timestamps in UTC; interpret business dates in **Asia/Karachi**.
- **Udhaar** means customer receivables, not a bank account or lending product.
- A WhatsApp customer message cannot approve an owner action or prove payment.
- One **Factory Loop** means one bounded pending-order workflow, not autonomous AI agents running indefinitely.

These invariants apply to every document. Product requirements own requirement IDs; scope owns release boundaries; database specification owns financial semantics; loop specification owns workflow limits; billing owns usage units. Resolve conflicts by recording a decision and updating every affected document before implementation.

## Local development

Use Node.js 22.20+ (22.x) and npm. Preserve an existing ignored `.env.local`; it already contains this workspace's public Firebase configuration and local database URL. For a new checkout, copy `.env.example` and supply its public Firebase web settings. Keep AI and WhatsApp outbound disabled until their account reviews pass.

```powershell
npm ci
npm run local:db
```

Keep the local database terminal running. In another terminal:

```powershell
npm run db:migrate
npm run dev
```

Open [the owner dashboard](http://127.0.0.1:3000). Firebase Google sign-in needs its console provider/authorized-domain configuration. Manual business operations work after sign-in/workspace setup, independently of Gemini and WhatsApp.

For synthetic local tests, run `npm run local:auth` in another terminal, then `npm run local:test-server` (port 3100, isolated test database and official demo Auth emulator). This never creates a real Google user. In a separate terminal:

```powershell
npm run check
npm run test:integration
npm run test:restore
$env:E2E_EXTERNAL_SERVER='true'
npm run test:e2e
Remove-Item Env:E2E_EXTERNAL_SERVER
```

The browser suite uses installed Microsoft Edge on desktop and a 360px mobile viewport. Auth is loopback port 9099; local PostgreSQL is loopback port 55432. Test services are explicit and isolated from the real Firebase project. Run build/generation and browser walkthroughs sequentially: regeneration/hot reload can reset a form while a browser test is filling it.

```powershell
npm run build
npm run start
npm run worker -- --once
npm run operator -- metrics
```

`build` generates Prisma and writes `.next-build`; development and test servers use separate output folders. Restart development after changing Prisma models. The worker's continuous mode is `npm run worker`; outbound remains disabled without reviewed credentials/flags. See [operations and recovery](docs/OPERATIONS_AND_RECOVERY.md) for migration identities, production settings, provider setup, encrypted backups, retention, pause/resume and monitoring.

The local database tool is a development convenience, not a production database service. Encrypted rehearsal files, synthetic restore targets, dependency cache, generated Prisma code and `.env.local` are ignored. Never put server secrets in `NEXT_PUBLIC_` variables. Install dependencies one process at a time. `APP_ENV=production` requires authentication, matched HTTPS origins and certificate-verified database TLS; merely building does not establish production readiness.

## Code map and review

- `src/app/`: dashboard and protected API routes; provider webhook and minimal health probes.
- `src/components/`: mobile navigation, directories, manual financial previews, assistant, messaging, workflow and privacy controls.
- `src/server/domain/`: tenant authorization, exact posting, allocations, reports and immutable corrections.
- `src/server/ai/`: structured Gemini extraction, reservations and usage accounting.
- `src/server/whatsapp/`, `src/server/workflows/`, `src/server/jobs.ts`: signed ingress, one-use controls, policy outbox and bounded follow-up.
- `src/server/operations/`, `scripts/`: private operator controls, maintenance and encrypted recovery.
- `prisma/migrations/`: forward SQL migrations, compound tenant references and history/counter guards.
- `tests/`: unit/contracts, real PostgreSQL races/faults/fake clocks, and desktop/mobile walkthroughs.

The implementation uses Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Prisma 7.10.1 and PostgreSQL 18.6 locally. Security overrides pin patched transitive packages; the production audit is recorded in the release evidence. Package/lock files are authoritative for exact dependencies. No source-control commit, remote repository, paid provisioning, full business-model evaluation, real Meta delivery or public deployment has been created.

Review [release readiness and pending inputs](docs/RELEASE_READINESS.md) before launching. Live provider, infrastructure, privacy/support and merchant-pilot gates remain explicit; the local implementation does not clear them.

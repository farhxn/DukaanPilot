# Features and roadmap

[Documentation index](../README.md) · Sequencing proposal, not a delivery promise

P0 means required before a live pilot, P1 means next after pilot evidence, and P2 means later discovery. Higher subscription tiers never bypass safety controls.

| Phase | Priority | Features | Dependency / exit |
|---|---|---|---|
| Documentation review | P0 | Current specifications, unresolved assumptions | Owner reviews Q1–Q8; explicit instruction before scaffolding |
| MVP foundation | P0 | Auth, tenants, contacts, manual orders, sale/payment services | Financial and isolation tests pass before AI |
| MVP assistant | P0 | Text proposals, approval inbox, dashboard summaries, official WhatsApp | Same business services across channels; signature/dedup tests |
| MVP follow-through | P0 | One pending-order loop, quotas, audit, recovery | Bounded loop tests and pilot readiness pass |
| V1.1 | P1 | Voice notes, inventory/low stock, supplier workflows, fuller Urdu dashboard | Language/audio evaluation, stock model, separate bounded workflow specification |
| V1.2 | P1 | Receipt extraction, expenses, qualified profit views, customer QR repeat orders | Cost/receipt accuracy evidence; accounting semantics agreed |
| V2 | P2 | Staff permissions, multi-branch, marketing media, courier/payment integrations | Demand, provider contracts, role model, new security review |

Supplier directory in MVP does not imply supplier purchasing. Order line descriptions do not imply live product stock. The blueprint’s broader voice, inventory, marketing, and payments vision is preserved as future discovery rather than silently included in the first release.

## Validation cadence

Before pilot: interview 15–20 owners where practical; recruit at least five willing testers; collect consented or synthetic phrase examples in all three text styles. During pilot: weekly review of task success, corrected proposals, support work, rejected unsafe actions, and actual AI/WhatsApp costs. Two weeks of pilot data is the first decision point, not a guaranteed expansion date.

Choose the next feature using observed repeated demand, retention, achievable support load, and unit economics. Revisit or stop a feature if it creates more correction work than it saves. Do not expand automation merely because credit remains.

## Proposed schedule

For one experienced developer with provider access ready, S1–S8 may take approximately 6–8 weeks plus a two-week pilot. This is an unvalidated estimate; Meta provisioning, auth/hosting choices, language quality, and review feedback can change it. [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) owns implementation order and individual exit criteria.

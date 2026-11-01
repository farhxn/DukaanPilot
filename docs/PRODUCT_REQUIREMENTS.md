# Product requirements

[Documentation index](../README.md) · Status: proposed v0.1 · 31 October 2026

## Problem and product promise

Pakistani small business owners often coordinate customer orders and remember unpaid balances through chats and notebooks. DukaanPilot turns short instructions into reviewable records and helps the owner notice pending commitments. It should answer “Aaj ki sales aur baqi udhaar kitna hai?” from saved records, with a clear distinction between sales and cash received.

The target market is general small businesses: kiryana, home sellers, bakeries, boutiques, small retailers, tailors, and service providers. The proposed first pilot is 5–10 order-driven businesses because their workflows can be tested without full POS inventory. This wedge is an assumption, not a restriction on the long-term audience.

## Personas and channels

| Persona | Need | MVP authority |
|---|---|---|
| Owner | Record sales, track dues, approve actions, see pending work | All actions within own tenant |
| Customer | Request an order, receive permitted updates | Own chat input only; no dashboard or financial approval |
| Operator | Provision pilot businesses, resolve failures | Audited operational access; no default authority to approve merchant finances |

The dashboard is the authoritative review and recovery surface. WhatsApp is a convenient input/notification channel. The same services and approval rules serve both.

## Vocabulary

| Term | Definition |
|---|---|
| Tenant | One business and its isolated data |
| Customer | Person buying from the tenant; optional phone for manual-only records |
| Order | Approved commitment for goods/services; creates no receivable by itself |
| Sale | Owner-approved posted sale; creates a receivable debit |
| Payment | Owner-confirmed money received and allocated to a sale; creates a receivable credit |
| Outstanding balance | Sum of posted debits minus credits, including reversals |
| Proposal | Versioned, expiring action preview awaiting owner approval |
| Approval | Owner decision bound to a specific proposal version and payload hash |
| Follow-up | One owner-facing pending-order workflow; customer update needs separate approval |
| AI action | Product usage unit defined in [billing](BILLING_AND_AI_COSTS.md), separate from API token cost |

## Requirements and acceptance intent

| ID | Priority | Requirement | Acceptance intent |
|---|---|---|---|
| PR-01 | P0 | Owner onboarding, business profile, authenticated tenant access | Owner can create one business; another tenant cannot read or mutate it |
| PR-02 | P0 | Customers and supplier contact directory | Create/edit/search contacts; distinguish duplicate names; no supplier purchases |
| PR-03 | P0 | Manual and AI-assisted text proposals | Roman Urdu, Urdu, English produce a preview or a clarification; no financial writes during extraction |
| PR-04 | P0 | Versioned owner approvals | Reject/edit/approve; replay commits once; stale or expired approvals fail |
| PR-05 | P0 | Orders and owner-controlled fulfillment | Customer request becomes draft; owner sets price and due date; order alone does not affect sales |
| PR-06 | P0 | Sales, udhaar, partial repayments, reversals | Backend computes exact paisa balances; overpayment is rejected; no silent edits |
| PR-07 | P0 | Dashboard, ledger, on-demand daily summary and export | Shows sales, collections, outstanding, pending orders; summary uses verified totals |
| PR-08 | P0 | Official WhatsApp integration | Signature checks, sender separation, durable deduplication, policy-aware outbound messaging |
| PR-09 | P0 | One bounded pending-order Factory Loop | Finite checks and sends; quiet hours; terminal outcomes; no automatic customer chasing |
| PR-10 | P0 | Tenant usage quotas and operational audit | Reserve usage before AI; fail safely at quota; show usage without blocking manual ledger access |
| PR-11 | P0 | Privacy and recoverability | Published notice before live use, minimized prompts, tested backup restore, export/deletion procedure |

Detailed acceptance cases are in [TESTING_AND_ACCEPTANCE.md](TESTING_AND_ACCEPTANCE.md); no requirement is complete until its evidence is recorded.

## Local usability

- Mobile-first dashboard usable at 360px; keyboard and screen-reader accessible labels and approval buttons.
- Roman Urdu default conversation style; Urdu script and English text input supported. Dashboard English with Roman Urdu helper text initially; full Urdu dashboard/RTL polish is V1.1.
- Show amounts as “Rs 1,250.00”; normalize Pakistani phone numbers to E.164 (+92), preserving provider identifiers separately. Never guess an ambiguous phone number.
- Parse explicit written dates and times into the approval preview. Date-only inputs default to 09:00 Asia/Karachi. If the date is omitted, use the first of next month at 09:00 on the Pakistan calendar. Invalid/ambiguous relative dates and missing years require clarification. This owner-directed rule supersedes the initial 18:00 suggestion.
- No silent offline writes. Show pending/error states and allow safe retries on weak connections.

## Proposed pilot success measures

Pilot duration: two weeks after onboarding, with 5–10 consenting businesses. Targets are hypotheses: at least five businesses post ten approved records; at least 80% of 50 observed complete entry tasks finish within 60 seconds; at least 90% of unambiguous language fixtures produce correct proposals; all ambiguous fixtures clarify or remain drafts. Require zero unauthorized financial writes, duplicate postings, and cross-tenant disclosures in acceptance testing.

Measure preview edits, task completion, active owners, follow-up resolution, delivery failures, cost per active tenant, and support time. Do not equate “message delivered” with “order fulfilled” or “payment received.”

## Assumptions and non-goals

Adult business users, PKR only, one owner/location, internet access, owner-entered prices, and manual payment confirmation. No tax filing, audited accounts, profit claims, bank reconciliation, credit underwriting, payment collection, autonomous purchases, payroll, or full POS. See [MVP scope](MVP_SCOPE.md) for the binding boundary.

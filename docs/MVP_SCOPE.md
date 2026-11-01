# MVP scope

[Documentation index](../README.md) · Authority for release boundaries

## Included in the pilot

**Owner decision, 1 November 2026:** deliver the web assistant first and defer WhatsApp connection. The full pilot scope below still describes the eventual channel capability. The current web delivery uses browser sign-in, contacts, AI drafts, exact approvals, ledger/orders and dashboard follow-up; Meta setup is not a prerequisite for those flows. The everyday UI hides the disabled WhatsApp navigation and leaves optional channel settings under Workspace setup. Public web release still requires its web/provider/hosting/privacy acceptance; WhatsApp-specific live cases remain deferred, not passed.

| Area | Minimum behavior | Requirement |
|---|---|---|
| Owner setup | Managed sign-in, tenant profile, PKR, Asia/Karachi, WhatsApp owner pairing | PR-01 |
| Contacts | Customer and supplier CRUD/search; supplier contacts only | PR-02 |
| Text assistant | Roman Urdu/Urdu/English intent extraction; clarification and previews | PR-03 |
| Approval inbox | Review/edit/reject; explicit owner approval for all financial effects | PR-04 |
| Orders | Free-text line items, explicit quantities/prices, due time, pending/fulfilled/cancelled | PR-05 |
| Receivables | Sales, cash/credit split, customer balance, partial payments, full reversals | PR-06 |
| Dashboard | Today’s posted sales, collections, total outstanding, pending orders, ledger CSV export | PR-07 |
| WhatsApp | Official Meta Cloud API, owner/customer role separation, safe outbound queue | PR-08 |
| Factory Loop | Pending-order checks; at most two owner reminders and one separately approved customer update | PR-09 |
| Operations | Usage caps, audit, backups, monitoring, privacy and failure recovery | PR-10/11 |

Daily summaries are requested by the owner in the dashboard or an active WhatsApp conversation. They are not a second scheduled automation. Manual entry remains available when AI or WhatsApp is unavailable.

## Explicitly deferred

- Voice notes and receipt/invoice extraction; inbound media receives a supported-text request without sending media to Gemini.
- Inventory, stock deductions, supplier procurement/follow-up, catalog matching, product variants.
- Direct customer self-service accounts, public order QR, online checkout, automated pricing and delivery promises.
- Automatic udhaar reminders, broadcast marketing, recurring campaigns, autonomous refunds or purchases.
- Staff roles in the UI, multi-branch, multiple currencies, configurable accounting periods.
- Refund payouts, deposits/customer credits, expenses, profit calculations, tax invoices/filing, full double-entry accounting.
- Courier, Raast, JazzCash, Easypaisa, bank and subscription-payment gateway integration.
- Self-service WhatsApp number onboarding across arbitrary businesses; pilot provisioning is operator-assisted.

## Financial boundary

Orders are commitments only. A sale may be created directly or once from a fulfilled order, with owner approval. Fulfillment alone does not post a sale. Immediate receipt of funds is represented by a linked payment in the same approval and transaction. Repayments allocate to existing open sales; overpayments and advances are unsupported. Full reversal with an owner-provided reason corrects a mistake; re-entry creates a replacement. Partial sale refunds are deferred.

## Channel topology assumption

Each live pilot tenant has one dedicated WhatsApp Business Platform phone-number ID. Incoming recipient ID resolves the tenant; verified sender mapping separates the owner from customers. No shared inbox number with ambiguous tenant routing. A Meta test number may be used for development with permitted test recipients. Production onboarding/provider requirements must be validated before live use.

## Release gate

The pilot can open only after S1–S8 in [development](DEVELOPMENT_PLAN.md), all mandatory [acceptance cases](TESTING_AND_ACCEPTANCE.md), and provider/privacy prerequisites pass. Data entering through web and WhatsApp must produce identical ledger effects. The loop must stop within its stated limits even during worker restarts.

Review approval permits scaffolding only when explicitly requested. A document checkbox or an illustrative plan is not evidence of implementation, test passage, or consent to spend money.

# Billing and AI costs

[Documentation index](../README.md) · Commercial hypotheses, not published prices

## Proposed tiers

The prior blueprint names Free, Smart, Pro, and Business but its retrieved pricing component has no usable numeric prices. The figures below are explicit new assumptions for customer testing; they are not recovered agreements or validated willingness to pay.

| Plan | Proposed PKR/month | AI actions/month | AI actions/day | Concurrent follow-up workflows | Availability |
|---|---:|---:|---:|---:|---|
| Free | 0 | 50 | 10 | 3 | Pilot baseline |
| Smart | 999 | 500 | 50 | 20 | Manual pilot entitlement |
| Pro | 2,499 | 1,500 | 150 | 50 | Planned commercial tier; higher quotas only initially |
| Business | 4,999 | 4,000 | 300 | 100 | Planned; staff/multi-branch benefits deferred |

All tiers retain mandatory owner approvals. Financial records, manual entry, export, and reading history remain accessible after AI quota exhaustion. All messaging has additional rate/policy/spend caps. No unlimited AI, WhatsApp, or autonomous follow-up. No yearly plans, automatic overages, card collection, gateway billing, or automated charge attempts in MVP. Operator may grant trial entitlements with a recorded expiry; this is not evidence of payment.

WhatsApp templates are separately costed; pilot allowance is zero paid template sends. The owner requires no paid WhatsApp use. [Meta's dated FAQ](https://whatsappbusiness.com/resources/faq/) says that from 1 October 2026 the first 1,000 service messages per number/month are free and further service messages are charged. Eligible 24-hour replies are therefore not assumed indefinitely free. This app reserves at most 900 send attempts over rolling 33 UTC days per number, counting retries and uncertainty before transport; old attempts must age out rather than resetting early at a billing-month boundary. Account-specific allowance, other apps' sends and changed pricing cannot be inferred from this app's counter. Use a dedicated/test number and verify actual Meta settings before live sends; paid templates stay off. See [setup](WHATSAPP_SETUP.md). No automatic overage or payment collection is authorized.

## Product units versus provider cost

- One successfully completed AI text instruction, including a clarification response or summary wording, consumes **1 AI action**. A deterministic dashboard summary or scheduled check consumes zero. Manual entry consumes zero.
- At most two Gemini calls per instruction including retry/repair; charge the product unit once, but record all provider token costs. Invalid/failed processing without a usable proposal, clarification, or summary releases the action reservation; internal cost remains recorded.
- Webhook replay and repeated fetch of a result do not consume another action. A materially new input or response to a clarification is a new instruction.
- Future voice/document extraction may cost 3 actions and complex analysis 5; these units are reserved design proposals, not enabled MVP features.

Reserve one action atomically against both daily and monthly limits before calling Gemini. Also reserve a worst-case internal token-cost estimate for all allowed attempts. Settle actual usage on completion; release unused reservation. Reconcile timed-out/crashed reservations using execution IDs before release so concurrent requests cannot oversubscribe quotas. Monthly periods follow Subscription UTC period bounds displayed in Asia/Karachi; daily limits reset at midnight Asia/Karachi. No rollover. Future downgrades take effect next period; suspension blocks new AI/dispatch but preserves owner history access.

## Cost formula and illustrative arithmetic

For N instructions, average input I, output O, price per million input Pi and output Po:

`AI USD = N × (I × Pi + O × Po) / 1,000,000 + retry/repair tokens + any separately billed features`.

Scenario only: 100 tenants × 300 instructions = 30,000; I=1,000, O=200. If Pi=$0.10 and Po=$0.40, input is $3.00 and output $2.40, total $5.40 before retries. These are hypothetical rates retained to explain the blueprint example, not a verified quote for a selected model today. At 20% equivalent extra token use this becomes $6.48. At the 4,000-input/600-output caps and two full calls for every instruction, the same assumed prices yield $38.40. Real model/token behavior must be measured.

Monthly operating cost also includes Meta delivered message charges by category/market, hosting/web/worker/database, backups, monitoring, support, taxes, and payment processing later. Credits reduce cash expense temporarily, not underlying unit cost. Record full estimated provider cost before credit discounts to assess margins.

`Contribution per paid tenant = collected revenue - allocated AI - Meta - hosting - support - taxes/fees`; USD-to-PKR conversion must use a dated operator-entered rate, not an assumed fixed exchange rate. Validate costs and support load before finalizing tiers.

## Credit and model validation checklist

Before using real data or spending credits, record actual account/project, eligible service (Gemini Developer API), credit type/balance/expiry, eligible model SKUs, billing mode, selected model/version, applicable data terms, and provider rate limits. Never assume generic Google Cloud promotional credit, AI Studio access, and Gemini API paid credit are interchangeable. API-key possession alone does not prove usable credit or suitable data terms.

Choose one currently available cost-efficient Gemini model after a Roman Urdu/Urdu/English fixture evaluation; pin its model ID and price snapshot in a dated decision. Earlier blueprint references to Flash-Lite/Flash are candidate families, not guaranteed supported IDs. Do not auto-upgrade when a model disappears: disable AI safely and review replacement against the fixture set.

Proposed pilot internal caps, pending Q6: global AI USD 1/day and USD 25/month, per-tenant AI USD 0.10/day and USD 2/month; stop when any cap or product quota is reached. At 80%, alert operator and show owner quota warning. Include in-flight reservations in checks; reconcile provider usage daily. Application estimates can differ from invoices and provider reporting may lag; configure available provider spend controls too. Alert before credit expiry and disable paid fallback unless separately authorized.

## Provider references

Checked 31 October 2026; recheck before implementation and commercial launch. Current model prices: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Billing and credit eligibility: [Gemini billing](https://ai.google.dev/gemini-api/docs/billing). Data handling: [Gemini terms](https://ai.google.dev/gemini-api/terms). Messaging rates: [WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing). No model rate, exchange rate, tax rate, or credit balance is asserted as a guaranteed current value in this specification.

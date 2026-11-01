# Decisions and open questions

[Documentation index](../README.md) · Version 0.2 · Awaiting owner review

## Source and interpretation

### 1 November 2026 — Owner-directed normal business assistant

The owner requested removal of sample restrictions and preparation for real customers, deferring provider/privacy setup to manual follow-up. Remove the temporary sample UI, input allowlist and non-proposal path. Enable normal authenticated local AI with existing tenant isolation, quotas, deterministic validation and exact owner approvals. Activation flags and the decision reference record authorization, not a completed compliance/model review. Preserve pending launch evidence rather than treating this request as a passed pilot. See [manual launch setup](LAUNCH_SETUP.md).

### 1 November 2026 — Free-tier AI evaluation mode (superseded)

Expired credits are replaced by the owner's confirmed Free Tier with billing disabled, without provisioning or upgrading billing. Select `gemini-3.5-flash-lite` for fixed synthetic examples only. Introduce mutually exclusive `AI_SYNTHETIC_ONLY` / live-data modes; sample mode rejects arbitrary text server-side, creates no proposal and cannot read business context for a model response. Preserve authenticated metering and manual business operations. See [model/account/sample evidence](AI_SETUP_AND_EVALUATION.md#owner-directed-business-mode--1-november-2026). Full language accuracy, commercial data terms and business-data AI activation remain pending.

Source: referenced ChatGPT conversation “Explain Factory Loop”, ID `6ae629c3-c9d4-83e8-8eda-a8e3a5e49c8d`, read during preparation. Its detailed blueprint was partially truncated by the source reader; pricing UI values and the final roadmap tail were not available. This bundle uses the recovered blueprint and the user’s explicit current request; missing details are labeled assumptions rather than invented prior agreements.

The older Firebase/Firestore prototype suggestion is superseded by the user’s requested Node.js/TypeScript, Next.js, PostgreSQL/Prisma stack. Firebase remains only a proposed managed authentication provider. Credits are for Gemini API/AI Studio; hosting and WhatsApp costs are separate. This specification deliberately narrows the broad blueprint into a reviewable MVP.

## Decision register

| ID | Decision | Status / rationale |
|---|---|---|
| D01 | Documentation before application code; explicit review before scaffolding | Confirmed by current request |
| D02 | Pakistan-first, general small businesses; WhatsApp plus simple dashboard | Confirmed |
| D03 | Node.js/TypeScript, Next.js, PostgreSQL/Prisma, Gemini Developer API, Meta Cloud API | Confirmed; versions/providers selected later |
| D04 | Human-approved financial actions; deterministic money and immutable corrections | Confirmed principle; exact sale/allocation/reversal semantics proposed here |
| D05 | One bounded pending-order follow-up Factory Loop | Confirmed boundary; specific counters/timing proposed here |
| D06 | Text-first MVP; voice/inventory/advanced automation later | Blueprint-aligned proposal; owner review |
| D07 | One owner/location, PKR, Asia/Karachi, no deposits or full accounting | Proposed simplification |
| D08 | Modular monolith and PostgreSQL durable jobs/outbox | Proposed to limit operational complexity |
| D09 | Free/Smart/Pro/Business plan names; finite quotas and separate Meta cost | Blueprint-aligned; prices/quotas are new hypotheses |
| D10 | Dedicated WhatsApp recipient number per live pilot tenant | Proposed explicit routing model; operator-assisted pilot setup |
| D11 | Bundle project-local development and Factory Loop skills, AGENTS.md and an S1 handoff | Requested 1 November 2026; preparation completed without application scaffolding |
| D12 | Begin local application development, starting with S1 | Authorized by user on 1 November 2026: “perfect lets start the development”; no paid provisioning or live messaging authorized |
| D13 | S1 uses locked Next.js/React, TypeScript 5.9.3, Tailwind, npm, local Geist fonts, and native Node configuration tests | Implemented and verified 1 November 2026; see handoff for actual versions/checks; Prisma/Firebase remain S2 |

## Assumptions

Implementation decisions, 1 November 2026:

- D14: Firebase Auth is the implemented owner identity adapter; supplied public project settings are local-only. Emulator verification is separate; real Google provider/domain/production ADC evidence remains open.
- D15: S4 uses synchronous bounded `POST /assistant`, strict structured extraction/grounding, no model tools and no selected live model until actual evaluation. UTF-8 byte ceilings are deliberately conservative. Default receipt method is the manual cash default and remains editable in the exact preview.
- D16: S5 uses hashed one-time commands and a database-backed worker/outbox. Pilot paid templates are hard-disabled, so outside-window handling remains on the dashboard. The Graph version is an explicit reviewed provisioning setting; fixture `v25.0` is not evidence of live version support.
- D17: Pilot subscription periods are UTC calendar months/Pakistan days; manually granted plans expire within 90 days, with no payment claim. Prices/quotas stay hypotheses.
- D18: The single workflow snapshots fixed lifetime/counter/spacing limits and does not rearm. General updates cannot bypass the lifetime message cap of an order that entered the workflow. Dashboard-only policy failures terminate NEEDS_HUMAN.
- D19: A separate operations-pause flag preserves history while denying writes/sends. Privacy requests queue review; legal erasure is not guessed. Recovery defaults to a frozen database with blanket message suppression and requires the latest external deletion/suppression journal before reopening.
- D20: Local engineering verification can finish while real account, deployment/CI/container and merchant-pilot evidence remain blocked. Review [RELEASE_READINESS.md](RELEASE_READINESS.md) for the actual split; no live release is implied.

- First pilot: 5–10 consenting order-driven businesses; target market remains broad.
- Adult business users with internet access and a dashboard-capable phone; no offline posting.
- Owner supplies prices, confirms externally received funds, and handles physical delivery.
- No claim that credits cover hosting, Meta, tax, or all available Gemini SKUs.
- Planned pricing, spend caps, language accuracy, delivery timeline, and retention are unvalidated until reviewed/tested.
- Initial dashboard English with Roman Urdu help; three text input languages; full Urdu dashboard later.
- Managed auth and hosting regions remain choices; no Pakistan-only data residency promise.

## Review questions and blocking stage

| ID | Question / recommended starting assumption | Blocks |
|---|---|---|
| Q1 | Keep order-driven businesses as first pilot while serving general businesses long term? Accept text-only MVP and deferred features? | G0 scope approval |
| Q2 | Can pilot businesses provision dedicated Meta numbers, and who owns business/app/token setup? Keep operator-assisted provisioning initially? | S5 and live pilot |
| Q3 | Use Firebase Auth for the owner login? Proposed initial Google sign-in with server-verified identity; phone OTP is optional later and separately priced | Provider integration in S2; S1 shell can use the documented default |
| Q4 | Which host/database region, monthly infrastructure budget, and worker deployment mode? | Provisioning and S7 recovery evidence |
| Q5 | What are actual Gemini credit type, eligible project/models, balance/expiry, and paid-service data terms? | Paid AI usage and all real-data AI processing |
| Q6 | Accept proposed plan prices, usage quotas, AI caps, and zero paid-template budget until separately allocated? | Commercial promises and paid spend configuration |
| Q7 | Accept owner-only manual payment confirmation, allocation rules, no advances/partial refunds, full reversal correction? | G0 financial scope; S3 posting implementation |
| Q8 | Who owns pilot support, privacy notice, consent collection, local retention review, and final pilot sign-off? | Live onboarding, not local scaffolding |

Unanswered questions are tracked decisions, not permission to guess credentials, spend money, or launch. Defaults permit planning. Resolve each before its dependent implementation stage; do not hold unrelated documentation work for answers.

## Owner review checklist

- [ ] MVP and non-goals reflect the intended first product (D06/D07, Q1).
- [ ] Sample sales/payment/order journeys match business expectations (Q7).
- [ ] Two owner reminders / three checks / one approved customer update / maximum 72-hour loop are acceptable (D05).
- [ ] Proposed plan prices and costs are understood as hypotheses (Q6).
- [ ] Auth and pilot WhatsApp topology are acceptable (Q2/Q3).
- [ ] Provider/data prerequisites have responsible owners (Q4/Q5/Q8).
- [x] Explicit instruction to begin local development recorded (D12); product/commercial assumptions remain tracked above.

Full product/commercial review: _pending_ · Local development authorized: **1 November 2026** (D12). This does not assert approval of pricing, paid resources, or live pilot launch.

## External references and freshness

Provider rules and prices can change. The sources below were consulted or identified during preparation on 31 October 2026; recheck exact versions, terms, and account eligibility before integration. No verbatim source text is required to use this plan.

| Reference | Use / limitation |
|---|---|
| [Gemini billing](https://ai.google.dev/gemini-api/docs/billing) | Account/credit eligibility and billing configuration; cannot establish this user’s balance |
| [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) | Select and record current model/rate snapshot before S4 |
| [Gemini terms](https://ai.google.dev/gemini-api/terms) | Paid/unpaid data-use distinction and launch review |
| [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy) | Opt-in/out, template/window requirements, human support |
| [WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing) | Rate source to verify; no fixed rate asserted |
| [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/overview) | Technical reference; direct retrieval rate-limited; verify during S5 |

## Document change log

v0.1: created the documentation-only baseline, consistent terminology, requirement/acceptance IDs, finite follow-up limits, financial posting/allocation rules, proposed commercial assumptions, and ordered development gates. Implementation has not begun.

v0.2, 1 November 2026: added project-local skills for development and the bounded product Factory Loop, AGENTS.md, concrete S1 handoff/defaults, and kickoff prompts. Clarified that a later start/build instruction satisfies scaffolding authorization and provider questions block their dependent integrations rather than unrelated local preparation. No application implementation or live integration was added.

Implementation update, 1 November 2026: D12 authorized local development. S1 dashboard/configuration foundation completed with recorded checks. The full specification remains the MVP target; this update does not claim S2–S8 completion or live-pilot readiness.


## Repayment and order date decision — 1 November 2026

Owner request: accept written dates/times and default a missing date to next month first. Source-text parsing now overrides model-generated date candidates. Named dates (for example 1 December 2026), Urdu month names/digits, ISO dates and DD/MM/YYYY are supported. Missing time means 09:00 Asia/Karachi; missing date means the first of the following Pakistan calendar month at 09:00. Explicit times take priority. Invalid/ambiguous/relative/incomplete dates still clarify. This supersedes the original explicit-ISO-date/time-only assistant rule.

Credit sales now carry a nullable, immutable Sale.dueAt repayment timestamp. Existing sales retain null; new credit proposals bind a stated/defaulted date, and owner approval persists it. Fully paid sales have no repayment due date. The manual sale editor can review/edit this date before posting. These dates do not enable a new reminder workflow or change allocations, posted amounts or sale recognition. Explicit instructions to add customer udhaar represent a credit sale; explicit cash loans/advances remain outside scope. Full model evaluation is still pending.

## Real-user recovery and no-spend channel decision — 1 November 2026

The owner requested a full practical audit/fixes and WhatsApp AI, then confirmed no Meta account and no paid WhatsApp budget. Preserve explicit owner approval while removing dead-end customer recovery: return customer_required with tenant-scoped choices; offer explicit inline contact creation and selected customerId retry. Foreign/archived selected IDs fail before a model call; model inputs never include selected IDs or directory data. Contact creation is a separate owner action, never inferred from an AI financial instruction. A completed customer clarification and its selected retry are separate metered assistant actions.

Shared source grounding now accepts valid comma grouping/Urdu digits, normalizes local phones and whole-name boundaries, and excludes dates/times/phones as evidence for money. Provided/default date semantics are unchanged. Bank/wallet receipt labels use existing supported methods; mixed methods clarify. Named-customer balance requests use the scoped deterministic ledger.

Paired WhatsApp owners can ADD CUSTOMER or USE CUSTOMER id | instruction. A generated financial draft now receives a complete bounded preview and version/hash-bound expiring approval command. It is addressed only to the paired owner, cannot be used by customer senders, and expires in the queue with its approval control. Large previews remain dashboard-only. One-time approval controls are short-lived owner-bound secrets; their plaintext necessarily passes through the outbound queue for delivery and remains subject to message-body retention. Stored authority remains the digest, paired identity, exact version/hash and expiry, not possession of token text alone. No new financial authority is granted to customers.

Meta's updated FAQ changes the earlier assumption about free service replies: from October 2026 they are charged after the monthly free allowance. Implement a 900-attempt rolling-33-day cap, not a calendar reset that could precede the provider's billing boundary. This includes failed/uncertain attempts and retries, is not automatically refunded, and cannot measure other apps or future prices. Keep outbound and paid templates off until the owner's free test account is ready. No Meta account, credentials, hosting or live send was created; WHATSAPP_SETUP.md provides the free onboarding sequence.

## Web-first delivery — 1 November 2026

The owner chose the independent web assistant and deferred WhatsApp after Meta restricted business-portfolio creation. Prioritize browser AI intake → customer recovery → exact approval → orders/ledger. Remove disabled-channel prompts from everyday navigation, keep channel settings optional under setup, and replace obsolete “Coming next” AI copy with configuration-derived availability. AI remains enabled locally and WhatsApp outbound stays disabled. This is not a bypass of Meta restrictions, a public deployment, or completion of pending web launch/provider/privacy reviews. Future WhatsApp activation still requires legitimate Meta setup and its own acceptance evidence.

## Free commercial web deployment decision — 1 November 2026

The owner requires free hosting and confirms existing Netlify and Neon accounts. Prepare Netlify Free (commercial use permitted, hard credit stop), Neon Free PostgreSQL, existing Firebase Google authentication and billing-disabled Gemini Free Tier. Firebase App Hosting requires Blaze and Vercel Hobby restricts commercial use, so neither satisfies this deployment choice. Use the included netlify.app hostname, no purchased domain, upgrades, paid templates or external cron. No hosted resource has been connected or deployed.

The free web profile has no persistent worker: FOLLOW_UP_ENABLED=false hides/rejects new scheduled workflows; existing workflow stopping and manual orders remain. Preserve all financial approvals and tenant boundaries. Non-Google hosting accepts server-only FIREBASE_SERVICE_ACCOUNT_JSON with matching project validation, while ADC remains supported. Migration tooling can use DIRECT_DATABASE_URL; runtime uses pooled DATABASE_URL with certificate verification. The preflight is offline validation, not a claim about external billing, hosted compatibility or customer acceptance. See [deployment guide](FREE_DEPLOYMENT.md) for prerequisites and NOT RUN hosted cases.

# User journeys

[Documentation index](../README.md) · Example names and amounts are fictional

## J1 — Owner joins and pairs WhatsApp

1. Owner signs in through managed authentication and creates a business profile: name, type, city, language, timezone.
2. Operator provisions the tenant’s dedicated WhatsApp number. Dashboard shows its connection status.
3. Authenticated owner requests a one-use, ten-minute pairing code and sends it from their intended WhatsApp account to that business number. Server binds that sender to the owner for that tenant.
4. Dashboard confirms the sender and lets the owner revoke it. A customer using the same display name gets no owner permissions.

Accept: tenant isolation and pairing replay tests pass (AC-01/02). Reused/expired codes fail; owner can still work on the web if Meta is unavailable. Pairing a second owner sender is deferred.

## J2 — Owner records a credit sale

Owner: “Ali ko 2 bread aur 1 doodh diya, total 650 rupay, udhaar hai.”

The assistant finds possible Ali contacts and asks the owner to select if ambiguous. It does not invent unit prices: items can remain descriptive when the explicit total is authoritative. Preview: customer Ali, sale Rs 650, received Rs 0, outstanding +Rs 650, business date today. Owner selects Approve on that exact preview.

Backend atomically posts one sale and one receivable debit of 65,000 paisa. The dashboard and reply use the saved result. A duplicate webhook, repeated approval, or double-click returns the original result without reposting.

Accept: AC-03/04/05. “650” without clear currency/intent or “Ali paid” without an amount stays a draft and asks a question. Editing Rs 650 to Rs 600 invalidates the old approval control.

## J3 — Customer request becomes an order

Customer: “Saturday cake chahiye, 2 pound.” The assistant gathers the requested cake description and explicit delivery/pickup date, then shows the request in the owner inbox. It never claims a price, availability, or delivery promise on behalf of the owner.

Owner sets final total Rs 2,500 and due timestamp, reviews the customer-facing confirmation, and approves order creation and that outbound text as separate permissions in one review screen. Order remains pending; no sale or payment posts. If messaging is blocked by policy, the order saves and the inbox shows “confirmation not sent.”

Accept: AC-06/09. Customer changes create a new proposal. Fulfillment/cancellation requires the owner; a claimed customer payment is informational only. Advance payments are politely flagged as unsupported in this pilot.

## J4 — Owner records partial repayment

Ali owes Rs 650. Owner: “Ali ne 200 cash diye.” Preview: Rs 200 payment, allocation to the Rs 650 sale, resulting due Rs 450. After approval, one payment, allocation, and credit of 20,000 paisa post together.

If multiple sales exist, preview oldest-first allocations; owner may edit them before approval. If the balance changed meanwhile, reject as stale and produce a new preview. Rs 700 against Rs 650 is rejected with an explanation; no hidden customer credit is created.

Accept: AC-05. Customer saying “payment bhej di” never posts a receipt. The owner can verify externally and initiate their own proposal.

## J5 — Pending-order Factory Loop

Owner opts the pending order into follow-up at creation or later. At due minus 24 hours (or now if closer), the worker checks saved status. During permitted hours it creates an owner inbox reminder and may send one owner WhatsApp notification if policy permits.

Owner can mark fulfilled, cancel, or say “delayed.” Fulfilled/cancelled ends the loop. Delay can generate a proposed customer update; only an owner approval bound to the text and recipient allows sending. A second owner reminder may occur no sooner than 12 hours later. Without resolution, the workflow expires after due plus 24 hours or 72 hours from start, whichever comes first, and remains visible for manual handling.

Accept: AC-10/11. This loop never marks payment received, posts a sale, automatically contacts customers, or restarts itself. See the [state machine](AI_AGENTS_AND_FACTORY_LOOPS.md) for exact limits.

## J6 — Daily overview

Owner: “Aaj kitni sale aur udhaar hai?” Backend computes today’s net posted sales, today’s net collections, current total outstanding, and pending-order count. Optional Gemini wording receives those aggregates only. If wording fails, show a deterministic summary.

Example: “Aaj recorded sales Rs 650; received Rs 200; total outstanding Rs 450.” Collections can relate to older sales and are not revenue. No profit estimate appears. Dashboard can export ledger entries for the selected dates.

Accept: AC-07/12. Date ranges use Asia/Karachi boundaries, not the server timezone. Sales and collections do not double-count each other.

## J7 — Correction and recovery

Owner finds a mistaken payment, opens the record, enters a reason, and approves a full reversal. Reverse payment allocations before reversing a sale with attached receipts; the preview explains the resulting balance. All originals and compensating entries remain visible. A service outage leaves the proposal pending or failed safely; retry with the same idempotency key.

Accept: AC-05/08/14. If an outbound send timed out after possible provider acceptance, the message is marked uncertain for review and is not blindly resent.

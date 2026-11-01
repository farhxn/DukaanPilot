# API and WhatsApp contracts

[Documentation index](../README.md) · MVP channel contract; implementation notes and actual evidence are in [release readiness](RELEASE_READINESS.md).

## API conventions

Implementation route mapping: synchronous `POST /assistant` is the bounded S4 text endpoint (at most two calls, 60-second hosting allowance), replacing the original asynchronous `/assistant/messages` sketch. Manual status/reversal actions use `POST /proposals` with their explicit intent rather than separate convenience endpoints. Customer message approval uses `/customer-updates/:id/approve|reject`; financial WhatsApp controls use `/proposals/:id/channel-control`. `/whatsapp/consent`, `/privacy-requests`, and `/exports/workspace` expose the described owner controls. Workflow/message views are bounded to the most recent 100/50 records in this pilot; older complete history is available through reviewed exports/database support. This is a documented list-view limit, not permission to omit records from financial aggregates.

Base `/api/v1`. Dashboard requests carry a managed-auth ID token verified server-side; resolve tenant membership for every route. If browser cookies replace bearer tokens, require Secure/HttpOnly/SameSite cookies and CSRF defense for mutations. Do not trust client `tenantId`, customer IDs, or role assertions.

S2 uses the cookie alternative: a verified Firebase ID token is exchanged at `POST /api/v1/auth/session` for a hashed, revocable opaque app session (maximum one hour); DELETE on the same route logs out. Protected routes accept the app cookie, not caller-supplied tenant/role headers or arbitrary bearer tokens. Web writes require matching Origin and `X-DukaanPilot-Request: 1`. Login/logout lifecycle requests do not require idempotency keys; business/contact mutations do. See [auth implementation](AUTH_AND_LOCAL_DEVELOPMENT.md).

JSON amounts are integer-paisa strings, e.g. `"65000"`; timestamps are ISO 8601 UTC with explicit timezone conversion at the boundary. List endpoints use bounded cursor pagination (default 25, max 100). Mutations require `Idempotency-Key`; keys are scoped by tenant, actor, and route and bound to the canonical request hash. Reuse with different input is `409`. Return the committed result on exact replay. Provider webhooks use provider event keys rather than caller-supplied idempotency headers.

Responses contain `data`, `requestId`, and optional pagination; errors contain `error.code`, safe `message`, `fieldErrors`, and `requestId`. Expected statuses: 400 malformed, 401 unauthenticated, 403 unauthorized, 404 missing/inaccessible resource, 409 stale/conflict, 422 business validation, 429 quota/rate limit, 503 provider unavailable. Never leak another tenant’s resource existence.

## Endpoint inventory

| Method/path | Actor | Behavior |
|---|---|---|
| POST `/businesses` | Signed-in user | Create tenant/profile/owner membership once |
| GET/PATCH `/business` | Owner | Read/edit own profile; currency/timezone fixed in pilot |
| POST `/whatsapp/pairing-challenges` | Owner | Create ten-minute pairing code; rate limited |
| DELETE `/whatsapp/owner-identity` | Owner | Revoke paired sender and pending channel approval controls |
| GET/POST/PATCH `/customers[/:id]` | Owner | Directory operations; archive instead of destructive delete |
| GET/POST/PATCH `/suppliers[/:id]` | Owner | Supplier contacts only |
| POST `/assistant/messages` | Owner | Process text asynchronously; return job/proposal reference (`202`) |
| POST `/proposals` | Owner | Manual draft using same validation as AI |
| GET/PATCH `/proposals[/:id]` | Owner | List/read/edit versioned drafts; no direct financial posting |
| POST `/proposals/:id/approve` | Owner | Supply version and payloadHash; validate and execute atomically |
| POST `/proposals/:id/reject` | Owner | Reject draft, cancel attached unsent actions |
| GET `/orders`, `/sales`, `/payments` | Owner | Read scoped business records |
| POST `/orders/:id/status-proposals` | Owner | Propose fulfillment/cancellation; never a sale implicitly |
| POST `/records/:type/:id/reversal-proposals` | Owner | Reason required; full reversal preview |
| GET `/customers/:id/ledger` | Owner | Entries and exact balance with pagination |
| GET `/dashboard`, `/summary` | Owner | Deterministic aggregate metrics; optional AI wording |
| GET `/exports/ledger.csv` | Owner | Scoped date range export; audit; escape spreadsheet formulas |
| POST `/orders/:id/follow-up` | Owner | Explicit enable; one workflow lifetime per order |
| POST `/workflows/:id/stop` | Owner | Stop and cancel unsent jobs/messages |
| GET `/workflows`, `/messages`, `/usage` | Owner | Status, delivery failures, quotas |
| POST `/customer-updates/proposals` | Owner | Draft recipient/text/order-linked update for approval |
| GET `/webhooks/whatsapp` | Meta | Verify subscription challenge with configured verify token |
| POST `/webhooks/whatsapp` | Meta | Verify raw-body HMAC signature; durable ingest |

Manual sales, payments, and order edits flow through proposals. No public endpoint accepts “approved=true” as financial authorization. Operational provisioning/entitlement tools are private, audited, and outside the customer API.

Example approval request body: `{ "version": 3, "payloadHash": "<server-issued-hash>" }`. Example payment proposal payload: `{ "customerId": "<id>", "amountPaisa": "20000", "method": "CASH", "allocations": [{ "saleId": "<id>", "amountPaisa": "20000" }] }`. Both use owner authentication and idempotency; example payloads are specifications only.

## Incoming WhatsApp routing

1. GET verification compares configured token and returns the challenge only for the expected mode/token. GET verification is not POST authentication.
2. POST verifies `X-Hub-Signature-256` against the exact raw bytes using the Meta app secret, with constant-time comparison. Limit body size (proposed 1 MiB) before expensive work. Reject invalid signatures without writes.
3. Resolve tenant by configured recipient `phone_number_id`. Unknown or disabled destinations are not processed as trusted tenants; record only a redacted operational event.
4. Persist all individual messages in a batched webhook separately. Deduplicate inbound `wamid` with tenant/provider uniqueness; preserve provider sender ID and normalized contact phone separately.
5. Queue durable processing and promptly acknowledge. If durable storage fails, return failure so Meta can retry. No Gemini call inside the webhook acknowledgement path.
6. Pairing commands consume one-use challenges. For later input, only an active verified OwnerChannelIdentity is owner-authorized. Every other sender is a customer, irrespective of display name or claimed job title.

Inbound customer intent creates only an order request or informational note. It cannot query the business’s receivables, approve actions, or confirm a receipt. Unauthorized requests get a neutral response and an owner inbox item where appropriate. Unsupported images/audio/documents receive a short request to send text; do not fetch their media in MVP.

## Approval over WhatsApp

Use a short-lived opaque interactive control or explicit `APPROVE <proposal-code>` command, mapped server-side to owner, tenant, proposal version/hash, and expiry. Customer reuse fails. Generic “yes”, quoted old text, forwarded messages, or a model-generated approval string never constitutes approval. Approval result reports saved record ID and delivery state; sending that reply is independent of commit success.

## Outbound policy and delivery

Recipient opt-in, opt-out, correct tenant number, current 24-hour service window, approved template status/category where required, quiet hours for proactive messages, and usage/spend cap are checked at dispatch. A newly received message resets that sender’s own service window, not every contact’s window. Outside the window, use an approved permitted template or keep the notification in the dashboard. Owner reminders need owner consent too. No substitute free-form message when a required template is unavailable.

Store actual template identifier, language, parameters, recipient, rendered preview/hash, approval reference where needed, and policy decision. Customer order confirmations and updates require owner approval of final content/recipient, even inside the service window. Provide opt-out and a clear human support path. Process STOP, “band karo”, and equivalent unambiguous stop requests deterministically; uncertain opt-outs suppress sends pending review.

Outbox states: PENDING, SENDING, ACCEPTED, DELIVERED, READ, FAILED, UNKNOWN, CANCELLED. Provider message acceptance is not delivery. Deduplicate status events and retain provider timestamps; apply safe monotonic status precedence, preserving error history rather than overwriting it with stale callbacks.

Retry only demonstrably unaccepted transient failures, at most initial attempt plus two retries (1 and 5 minutes), honoring provider Retry-After where compatible with expiry. Authorization/template/consent errors need human handling. A network timeout or crash after request transmission can mean Meta accepted the send: mark UNKNOWN, reconcile with available callbacks/provider evidence, and do not automatically resend. Local uniqueness prevents duplicate intents, but cannot guarantee exactly-once external delivery. Manual resend requires review of duplicate risk and a new explicit action, still subject to workflow limits.

## Provider prerequisites and references

Before S5/live pilot: Meta developer/business access, permitted app configuration, dedicated test/live numbers, HTTPS webhook, correct subscriptions, least-privilege access token, operational token rotation, template review, and consent collection. Provider access and template approval timing are external dependencies.

Policy baseline checked 31 October 2026: WhatsApp requires recipient opt-in and respect for opt-out; outside its 24-hour customer service window, approved templates are required. Recheck before deployment: [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy). Cloud API technical pages were rate-limited during documentation preparation; verify current payloads, signature guidance, Graph API version, and retry behavior during S5 using [Cloud API overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview) and [webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks). Do not treat unverified provider details as integration test evidence.

## Customer recovery and WhatsApp AI audit increment

`POST /assistant` also accepts an optional owner-selected customerId. It is scoped and checked before model use; selection participates in idempotency hashing and is never sent to Gemini. A customer_required response includes reason (missing/ambiguous/archived), extracted label and at most six exact candidates/five suggestions with small identity records (ID/name/phone, and archive timestamp where applicable). It makes no contact or financial write. Creating a contact uses the existing authenticated/idempotent customer API, followed by a new metered assistant request. Neither fuzzy suggestions nor archived records are silently chosen.

The paired-owner WhatsApp channel supports ADD CUSTOMER name and USE CUSTOMER customerId | original instruction. Financial proposals generate a complete bounded preview and an expiring exact approval command, using the existing shared control service. Replies carrying controls expire with the control; overlong previews have dashboard fallback. Customer origins, plain yes, malformed control and expired/stale/revoked controls cannot approve. The worker uses the same enabled Gemini settings as web. Live account setup is documented in WHATSAPP_SETUP.md and remains NOT CONNECTED until Meta credentials/number and public HTTPS exist. Service transport reserves against the rolling 900/33-day cap before each attempt. Template sends remain disabled.

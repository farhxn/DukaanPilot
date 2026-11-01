# Database schema specification

[Documentation index](../README.md) · Logical MVP design; S2 foundation tables now have Prisma schema and versioned PostgreSQL migrations. Financial/workflow entities below remain planned until their stages.

## Conventions

UUID IDs; UTC `timestamptz` timestamps; `createdAt` and `updatedAt` where mutable; `tenantId` on every business-scoped record. Users are global identities; tenant membership binds access. Amounts use PostgreSQL BIGINT integer paisa, exposed as decimal strings in JSON to avoid JavaScript precision loss. Parse decimals without floating-point arithmetic. MVP per-record monetary maximum: PKR 10,000,000 (1,000,000,000 paisa), a proposed guardrail. Dashboard display uses exact formatting.

Use composite unique `(tenantId, id)` and composite foreign keys for cross-entity business relationships. A globally unique ID does not replace tenant authorization. Financial/history deletion is restricted; archive contacts instead of cascading away money records. Operational retention/deletion is specified in [security](SECURITY_AND_PRIVACY.md).

## Entities

| Entity | Key fields beyond conventions | Relationships / essential constraints |
|---|---|---|
| Tenant | name, status | One BusinessProfile; many scoped records |
| User | authProviderSubject, verified identity | Unique provider subject; no plaintext auth credentials |
| AuthSession | userId, tokenHash, expiresAt, revokedAt | Global identity record; SHA-256 hash only, maximum one-hour session, no raw cookie/token storage |
| TenantUser | tenantId, userId, role | Unique tenant/user; one active OWNER per tenant in MVP |
| BusinessProfile | tenantId, type, city, currency, timezone, language | Unique tenantId; PKR / Asia/Karachi fixed |
| WhatsAppConnection | tenantId, phoneNumberId, wabaId, secretRef, status | Unique tenant and provider recipient ID; token in secret store |
| OwnerChannelIdentity | tenantId, userId, providerSenderId, revokedAt | Unique active tenant/sender; paired only via authenticated flow |
| PairingChallenge | tenantId, userId, codeHash, expiresAt, consumedAt | One-use, ten-minute TTL; hashed code |
| Customer | name, phoneE164 nullable, archivedAt | Tenant-scoped; phone unique when present; names nonunique |
| Supplier | name, phoneE164 nullable, notes, archivedAt | Contact directory only; no procurement semantics |
| Order | customerId, status, dueAt, totalPaisa, version, fulfilledAt | PENDING/FULFILLED/CANCELLED; no ledger entry itself |
| OrderItem | orderId, description, quantity, unitPricePaisa nullable, lineTotalPaisa nullable | Quantity numeric(12,3), positive; described-total mode allowed |
| Sale | customerId, orderId nullable, totalPaisa, businessDate, status, proposalId | At most one sale per order; POSTED/REVERSED |
| Payment | customerId, amountPaisa, method, receivedAt, status, proposalId | CASH/BANK_TRANSFER/OTHER; owner-confirmed, POSTED/REVERSED |
| PaymentAllocation | paymentId, saleId, amountPaisa, reversedAt | Positive; same tenant/customer; sum equals payment amount |
| LedgerEntry | customerId, saleId or paymentId, direction, amountPaisa, reversalOfId nullable, effectiveAt | DEBIT/CREDIT; immutable; one reversal per original entry |
| Reversal | sourceType, sourceId, reason, proposalId, approvedByUserId | Full reversal only; unique sourceType/sourceId per tenant |
| Conversation | customerId nullable, providerSenderId, channel, lastInboundAt | Unique tenant/channel/sender; owner conversations may have no customer |
| Message | conversationId, direction, providerMessageId nullable, body, deliveryState, logicalActionKey | Unique tenant/provider inbound ID; unique outbound logicalActionKey |
| MessageStatusEvent | messageId, providerStatus, providerTimestamp, errorCode, dedupKey | Unique dedupKey; no body required |
| ContactConsent | providerSenderId, purpose, grantedAt, source, evidenceRef, revokedAt | Per tenant/recipient/purpose history; customer record not proof of consent |
| AIActionProposal | actorId/type, intent, payload JSONB, version, payloadHash, status, expiresAt, resultRef | Tenant-bound; customer origin cannot approve |
| ApprovalEvent | proposalId, version, payloadHash, ownerUserId, channel, decision, decidedAt | Append-only; captures exact approved action |
| WorkflowInstance | orderId, type, state, startAt, expiresAt, nextRunAt, checksUsed, ownerRemindersUsed, customerUpdatesUsed | Unique tenant/order/type; bounded counters |
| WorkflowEvent | workflowId, eventType, actor, metadata, occurredAt | Append-only transitions/reasons; no raw secrets |
| Job | tenantId, type, entityId, executionKey, runAt, leaseUntil, attempts, status | Unique executionKey; max 3 attempts per logical job |
| OutboxMessage | tenantId, messageId, logicalActionKey, payloadHash, approvalRef nullable, notBefore, status, attempts | Unique logicalActionKey; snapshot final text/recipient |
| IdempotencyRecord | actorScope, route, key, requestHash, resultRef, status | Unique tenant/actorScope/route/key; mismatched hash conflicts |
| Subscription | tenantId, plan, status, periodStart, periodEnd, quotaSnapshot | One current subscription; manual pilot entitlement, no payment card storage |
| UsageEvent | tenantId, logicalInstructionId, feature, reservedUnits, chargedUnits, inputTokens, outputTokens, estimatedCostUsd, status | Unique tenant/instruction/feature; retry token cost included |
| AuditEvent | tenantId, actor, action, targetType/id, requestId, redactedDiff, occurredAt | Append-only approval, access, corrections and operator actions |

Plan definitions are versioned configuration for the pilot, not editable AI output. Subscription snapshots preserve the limits granted for a billing period. Usage cost uses exact decimal USD storage, not paisa.

Products, stock movements, purchase orders, expenses, staff invitation UI, and attachments are future entities and are not required MVP tables. Supplier contacts remain included to match the agreed blueprint.

## Financial posting rules

1. **Order:** approved total and line descriptions only. If all lines have prices, backend calculates rounded line totals and sum; otherwise owner must state an explicit total and preview “descriptive items; total entered by owner.” No inferred item price.
2. **Credit sale Rs 650:** Sale 65,000; ledger DEBIT 65,000. Customer required, including a tenant-specific “Walk-in” customer for anonymous cash sales; Walk-in cannot carry outstanding udhaar.
3. **Cash sale Rs 650:** same sale debit plus Payment 65,000, allocation 65,000 and CREDIT 65,000 in one transaction. Outstanding zero; sales 650 and collections 650 remain separate metrics.
4. **Partial receipt Rs 200:** Payment 20,000; one or more allocations to open sales; CREDIT 20,000; total outstanding 45,000. Allocate oldest-first by default in preview; owner may edit. Revalidate each allocation at commit.
5. **Correction:** no edits/deletes to posted values. Full payment reversal creates DEBIT entries and reverses allocations; sale reversal creates a CREDIT only after associated payments have been reversed. Prevent a sale reversal from creating a negative customer balance. Record reason, owner approval, originals, and replacement links.

Partial sale refunds, customer deposits/advances, payouts, interest, discounts after posting, and unallocated receipts are unsupported. “Payment confirmed” means owner assertion, never bank verification. This is a receivables ledger, not a complete general ledger.

## Atomicity and constraints

Approval consumption, Sale/Payment/Allocation/LedgerEntry writes, audit, proposal result, and outbox intent commit atomically. Unique origin keys on posting types prevent duplicates even after idempotency cache expiry. Keep financial idempotency records with financial history.

Database checks: positive monetary values, max amount, valid enums, FK tenancy, unique reversal/source posting, nonnegative bounded counters. Cross-row sums and balance bounds require transactional services and locks in addition to database constraints. Concurrent repayments must not overallocate the same sale. Retain failure-safe deterministic result references for replay.

Indexes: `(tenantId, createdAt)`, `(tenantId, customerId, effectiveAt)`, `(tenantId, status, dueAt)`, job `(status, runAt)`, workflow `(state, nextRunAt)`, and unique provider/execution/idempotency keys. Add appropriate partial indexes for active identities and current subscriptions.

## Reporting semantics and migrations

Implementation mapping (1 November 2026): the actual Prisma schema and forward SQL migrations are executable authority for these entities. `AIExecution` combines the proposed usage reservation/event with immutable input hash, model/prompt version, calls, integer nano-USD reservation/charge and product units. The current `Subscription` is a manually granted pilot plan with expiry; action periods are UTC calendar months and Pakistan calendar days, not arbitrary billing anniversaries. `InboundMessage` plus `OutboxMessage` implement message directions and durable transport state; `MessageStatusEvent` stores callbacks, and `ContactConsent` stores append-only evidence. `ChannelApprovalControl` binds one short-lived opaque secret to owner identity and exact financial proposal version/hash. `CustomerUpdateProposal` separately binds approved recipient/text/order version and workflow lifetime. `WorkflowInstance` snapshots configured counters/spacing/deadline; `WorkflowEvent` is append-only. `OperatorEvent` records service/operator work independently of merchant approval; `PrivacyRequest` records support review without claiming deletion. `Tenant.operationsPausedAt` freezes writes/jobs/sends while retaining authenticated history access. No polymorphic entity identifier in a job grants cross-tenant authority.

Financial receipts normalize at most 100 open-sale allocations per approval using bounded SQL aggregate balances. Oldest-first defaults can be split into smaller exact receipts; explicit allocations can select at most 100 scoped sales. No receipt amount is silently reduced. Sessions retain the verified Firebase authentication time for production revocation; legacy sessions are invalidated during migration. Approved finance stays immutable, with monotonic versions/reversal status and compensating ledger entries.

Today’s sales = posted sale debits minus sale reversal credits effective in the selected Asia/Karachi date interval. Today’s collections = receipt credits minus receipt reversal debits in that interval. Current outstanding = all customer debits minus credits. Do not treat order totals or payments as additional sales. Reversals take effect on correction date and remain linked to original business dates; do not silently rewrite historical reports.

Version migrations, review SQL, test upgrade and restore on a disposable database, and use forward compensating migrations after live data exists. Backfill tenant fields before enforcing constraints; never disable isolation to complete a migration. RLS is recommended defense in depth if safely supported by the selected hosting/pooling setup; application authorization and composite constraints are mandatory regardless.

## Repayment date field — 1 November 2026

Sale.dueAt is a nullable UTC timestamptz repayment date for the unpaid part of a sale. A credit-sale proposal includes a normalized dueAt; when omitted, the server fixes it to next month's first at 09:00 Asia/Karachi during preview. It becomes part of the exact version/hash approved by the owner and is immutable after posting. Fully paid sales and pre-migration sales have null. No history backfill, automatic collections or receivable reminder workflow is introduced. Order.dueAt remains a fulfillment deadline; it is independent from Sale.dueAt. Assistant date-only/default rules are recorded in AI_SETUP_AND_EVALUATION.md and apply before ordinary domain proposal validation.

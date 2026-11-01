-- Money is exact integer paisa; authoritative sums and allocations are also
-- checked under owner/tenant row locks in the shared posting transaction.
ALTER TABLE "Order" ADD CONSTRAINT "Order_positive_total" CHECK ("totalPaisa" BETWEEN 1 AND 1000000000 AND version > 0 AND "pricingMode" IN ('PRICED','DESCRIPTIVE'));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values" CHECK (quantity > 0 AND ("unitPricePaisa" IS NULL OR "unitPricePaisa" BETWEEN 0 AND 1000000000) AND ("lineTotalPaisa" IS NULL OR "lineTotalPaisa" BETWEEN 0 AND 1000000000));
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_positive_total" CHECK ("totalPaisa" BETWEEN 1 AND 1000000000 AND version > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK ("amountPaisa" BETWEEN 1 AND 1000000000 AND version > 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_positive" CHECK ("amountPaisa" BETWEEN 1 AND 1000000000);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_values" CHECK (
  "amountPaisa" BETWEEN 1 AND 1000000000 AND
  ((kind = 'SALE' AND direction = 'DEBIT' AND "saleId" IS NOT NULL AND "paymentId" IS NULL AND "reversalOfId" IS NULL)
  OR (kind = 'PAYMENT' AND direction = 'CREDIT' AND "paymentId" IS NOT NULL AND "saleId" IS NULL AND "reversalOfId" IS NULL)
  OR (kind = 'SALE_REVERSAL' AND direction = 'CREDIT' AND "saleId" IS NOT NULL AND "paymentId" IS NULL AND "reversalOfId" IS NOT NULL)
  OR (kind = 'PAYMENT_REVERSAL' AND direction = 'DEBIT' AND "paymentId" IS NOT NULL AND "saleId" IS NULL AND "reversalOfId" IS NOT NULL))
);
ALTER TABLE "Reversal" ADD CONSTRAINT "Reversal_single_source" CHECK (("saleId" IS NULL) <> ("paymentId" IS NULL));
ALTER TABLE "AIActionProposal" ADD CONSTRAINT "Proposal_version_hash" CHECK (version > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "Approval_version_hash" CHECK (version > 0 AND "payloadHash" ~ '^[0-9a-f]{64}$' AND decision IN ('APPROVED','REJECTED'));
CREATE UNIQUE INDEX "Customer_one_walk_in" ON "Customer" ("tenantId") WHERE "isWalkIn" = true;
INSERT INTO "Customer" (id, "tenantId", name, "isWalkIn", version, "createdAt", "updatedAt")
SELECT gen_random_uuid(), id, 'Walk-in', true, 1, now(), now() FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "Customer" c WHERE c."tenantId" = t.id AND c."isWalkIn" = true);

CREATE FUNCTION protect_posted_finance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Posted financial records cannot be deleted'; END IF;
  IF TG_TABLE_NAME = 'Sale' THEN
    IF (to_jsonb(OLD) - 'version' - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'version' - 'status') THEN RAISE EXCEPTION 'Posted sale values are immutable'; END IF;
  ELSIF TG_TABLE_NAME = 'Payment' THEN
    IF (to_jsonb(OLD) - 'version' - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'version' - 'status') THEN RAISE EXCEPTION 'Posted payment values are immutable'; END IF;
  ELSIF TG_TABLE_NAME = 'PaymentAllocation' THEN
    IF OLD."reversedAt" IS NOT NULL OR (to_jsonb(OLD) - 'reversedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'reversedAt') THEN RAISE EXCEPTION 'Allocation values are immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Sale_immutable_values" BEFORE UPDATE OR DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_posted_finance();
CREATE TRIGGER "Payment_immutable_values" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION protect_posted_finance();
CREATE TRIGGER "Allocation_immutable_values" BEFORE UPDATE OR DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION protect_posted_finance();
CREATE TRIGGER "LedgerEntry_immutable" BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER "Reversal_immutable" BEFORE UPDATE OR DELETE ON "Reversal" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER "ApprovalEvent_immutable" BEFORE UPDATE OR DELETE ON "ApprovalEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

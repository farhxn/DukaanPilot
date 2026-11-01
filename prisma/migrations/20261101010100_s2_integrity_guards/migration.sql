-- Cross-row tenant/user foreign keys are in the generated base migration.
-- These checks and partial indexes preserve invariants Prisma cannot express.
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_name_not_blank" CHECK (length(btrim(name)) > 0);
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_locale" CHECK (currency = 'PKR' AND timezone = 'Asia/Karachi' AND language IN ('roman-urdu', 'urdu', 'english'));
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_version_positive" CHECK (version > 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_valid_contact" CHECK (length(btrim(name)) > 0 AND version > 0 AND ("phoneE164" IS NULL OR "phoneE164" ~ '^\+[1-9][0-9]{7,14}$'));
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_valid_contact" CHECK (length(btrim(name)) > 0 AND version > 0 AND ("phoneE164" IS NULL OR "phoneE164" ~ '^\+[1-9][0-9]{7,14}$'));
ALTER TABLE "PairingChallenge" ADD CONSTRAINT "PairingChallenge_bounds" CHECK (attempts BETWEEN 0 AND 5 AND "codeHash" ~ '^[0-9a-f]{64}$' AND "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '10 minutes');
ALTER TABLE "OwnerChannelIdentity" ADD CONSTRAINT "OwnerChannelIdentity_sender" CHECK ("providerSenderId" ~ '^[0-9]{7,20}$');
CREATE UNIQUE INDEX "OwnerChannelIdentity_one_active_owner" ON "OwnerChannelIdentity" ("tenantId") WHERE "revokedAt" IS NULL;
CREATE UNIQUE INDEX "OwnerChannelIdentity_active_sender" ON "OwnerChannelIdentity" ("tenantId", "providerSenderId") WHERE "revokedAt" IS NULL;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_bounds" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$' AND "expiresAt" <= "createdAt" + interval '1 hour');
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_hash" CHECK ("requestHash" ~ '^[0-9a-f]{64}$');

CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER "AuditEvent_immutable" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

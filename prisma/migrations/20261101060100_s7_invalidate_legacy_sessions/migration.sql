-- Previous sessions did not retain the verified Firebase authentication time.
-- Require fresh sign-in when introducing production global revocation checks.
UPDATE "AuthSession" SET "revokedAt"=COALESCE("revokedAt",now());
ALTER TABLE "AuthSession" ADD CONSTRAINT "session_authentication_time" CHECK ("authenticatedAt" <= "createdAt" + interval '30 seconds');

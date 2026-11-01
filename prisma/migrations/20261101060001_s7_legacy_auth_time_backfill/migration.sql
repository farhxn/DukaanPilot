-- The preceding new-column default used migration time for legacy sessions.
-- Invalidate and normalize those rows before the later timestamp constraint.
UPDATE "AuthSession" SET "authenticatedAt"="createdAt", "revokedAt"=COALESCE("revokedAt",now()) WHERE "authenticatedAt">"createdAt"+interval '30 seconds';

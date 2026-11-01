ALTER TABLE "AIExecution" ADD CONSTRAINT "ai_meter_bounds" CHECK (
  "calls" BETWEEN 0 AND 2 AND "inputTokens" BETWEEN 0 AND 8000 AND "outputTokens" BETWEEN 0 AND 1200
  AND "actionUnits" BETWEEN 0 AND 1 AND "reservedNanoUsd" > 0 AND "chargedNanoUsd" >= 0
  AND "chargedNanoUsd" <= "reservedNanoUsd"
  AND "inputHash" ~ '^[a-f0-9]{64}$'
  AND "day" ~ '^\d{4}-\d{2}-\d{2}$' AND "month" ~ '^\d{4}-\d{2}$'
  AND ((status = 'COMPLETED' AND "actionUnits" = 1) OR (status <> 'COMPLETED' AND "actionUnits" = 0))
);

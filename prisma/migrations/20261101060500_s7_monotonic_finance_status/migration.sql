CREATE FUNCTION protect_financial_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version<=OLD.version OR (OLD.status='REVERSED' AND NEW.status<>'REVERSED') OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='POSTED' AND NEW.status='REVERSED')) THEN
    RAISE EXCEPTION 'Posted financial versions and reversal status cannot move backwards' USING ERRCODE='integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Sale_monotonic_status" BEFORE UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_financial_status();
CREATE TRIGGER "Payment_monotonic_status" BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION protect_financial_status();

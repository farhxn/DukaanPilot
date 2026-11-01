ALTER TABLE "Sale" ADD COLUMN "dueAt" timestamptz(3);
CREATE FUNCTION protect_sale_due_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."dueAt" IS DISTINCT FROM OLD."dueAt" THEN
    RAISE EXCEPTION 'Posted sale due date is immutable' USING ERRCODE='integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Sale_immutable_due_date" BEFORE UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_sale_due_date();

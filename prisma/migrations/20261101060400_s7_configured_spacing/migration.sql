-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "reminderIntervalHours" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "workflow_reminder_interval" CHECK ("reminderIntervalHours" BETWEEN 12 AND 72);
CREATE FUNCTION protect_workflow_spacing() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."reminderIntervalHours"<>OLD."reminderIntervalHours" THEN RAISE EXCEPTION 'Workflow spacing cannot change during its lifetime' USING ERRCODE='integrity_constraint_violation'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER "WorkflowInstance_spacing" BEFORE UPDATE ON "WorkflowInstance" FOR EACH ROW EXECUTE FUNCTION protect_workflow_spacing();

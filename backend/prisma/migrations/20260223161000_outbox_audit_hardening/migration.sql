-- AlterTable
ALTER TABLE "outbox_replay_audit"
  ADD COLUMN "ip_address" VARCHAR(64),
  ADD COLUMN "user_agent" VARCHAR(500),
  ADD COLUMN "correlation_id" VARCHAR(120);

-- AlterTable
ALTER TABLE "outbox_maintenance_audit"
  ADD COLUMN "ip_address" VARCHAR(64),
  ADD COLUMN "user_agent" VARCHAR(500),
  ADD COLUMN "correlation_id" VARCHAR(120);

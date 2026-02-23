-- AlterTable
ALTER TABLE "outbox_replay_audit"
ALTER COLUMN "outbox_event_id" DROP NOT NULL;

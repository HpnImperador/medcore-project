-- CreateTable
CREATE TABLE "outbox_replay_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outbox_event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "mode" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_replay_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_replay_audit_outbox_event_id_created_at_idx"
ON "outbox_replay_audit"("outbox_event_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_replay_audit_organization_id_created_at_idx"
ON "outbox_replay_audit"("organization_id", "created_at");

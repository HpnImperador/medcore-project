-- CreateTable
CREATE TABLE "outbox_maintenance_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "criteria" JSONB NOT NULL,
    "affected_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_maintenance_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_maintenance_audit_organization_id_created_at_idx"
ON "outbox_maintenance_audit"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "outbox_maintenance_audit_action_created_at_idx"
ON "outbox_maintenance_audit"("action", "created_at");

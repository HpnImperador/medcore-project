-- CreateTable
CREATE TABLE "domain_outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_name" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" VARCHAR(120) NOT NULL,
    "triggered_by_user_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(2000),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_outbox_events_status_attempts_occurred_at_idx"
ON "domain_outbox_events"("status", "attempts", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_outbox_events_organization_id_occurred_at_idx"
ON "domain_outbox_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_outbox_events_event_name_occurred_at_idx"
ON "domain_outbox_events"("event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "domain_outbox_events_correlation_id_idx"
ON "domain_outbox_events"("correlation_id");

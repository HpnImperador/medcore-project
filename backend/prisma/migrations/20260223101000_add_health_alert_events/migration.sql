-- CreateTable
CREATE TABLE "health_alert_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "webhook_url" VARCHAR(500) NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "error" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_alert_events_created_at_idx" ON "health_alert_events"("created_at");

-- CreateIndex
CREATE INDEX "health_alert_events_status_created_at_idx" ON "health_alert_events"("status", "created_at");

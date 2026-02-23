-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_hour" SMALLINT NOT NULL,
    "end_hour" SMALLINT NOT NULL,
    "break_start_hour" SMALLINT,
    "break_end_hour" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_doctor_id_weekday_key" ON "doctor_schedules"("doctor_id", "weekday");

-- CreateIndex
CREATE INDEX "doctor_schedules_organization_id_doctor_id_weekday_idx" ON "doctor_schedules"("organization_id", "doctor_id", "weekday");

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey"
FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

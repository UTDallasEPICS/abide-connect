-- AlterTable
ALTER TABLE "volunteer_hour_logs" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "volunteer_hour_logs" ADD COLUMN "program" TEXT;

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedByUserId" TEXT
);

-- CreateIndex
CREATE INDEX "volunteer_hour_logs_date_idx" ON "volunteer_hour_logs"("date");

-- CreateIndex
CREATE INDEX "volunteer_hour_logs_approvalStatus_idx" ON "volunteer_hour_logs"("approvalStatus");

-- CreateIndex
CREATE INDEX "volunteer_hour_logs_volunteerId_date_idx" ON "volunteer_hour_logs"("volunteerId", "date");

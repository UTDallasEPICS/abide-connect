-- CreateTable
CREATE TABLE "event_time_slots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_time_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_time_slot_signups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timeSlotId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "removedByUserId" TEXT,
    "removedAt" DATETIME,
    "removalReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_time_slot_signups_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "event_time_slots" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_time_slot_signups_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "event_time_slots_eventId_idx" ON "event_time_slots"("eventId");

-- CreateIndex
CREATE INDEX "event_time_slot_signups_volunteerId_idx" ON "event_time_slot_signups"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "event_time_slot_signups_timeSlotId_volunteerId_key" ON "event_time_slot_signups"("timeSlotId", "volunteerId");

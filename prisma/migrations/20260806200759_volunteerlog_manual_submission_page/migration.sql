-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_volunteer_hour_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "volunteerId" TEXT NOT NULL,
    "eventId" TEXT,
    "eventName" TEXT,
    "date" DATETIME NOT NULL,
    "hours" REAL NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "volunteer_hour_logs_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "volunteer_hour_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_volunteer_hour_logs" ("approvalStatus", "comment", "createdAt", "date", "eventId", "hours", "id", "updatedAt", "volunteerId") SELECT "approvalStatus", "comment", "createdAt", "date", "eventId", "hours", "id", "updatedAt", "volunteerId" FROM "volunteer_hour_logs";
DROP TABLE "volunteer_hour_logs";
ALTER TABLE "new_volunteer_hour_logs" RENAME TO "volunteer_hour_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

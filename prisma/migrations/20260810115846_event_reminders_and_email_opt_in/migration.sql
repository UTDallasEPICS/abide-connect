-- CreateTable
CREATE TABLE "event_reminders" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("eventId", "userId", "kind", "channel"),
    CONSTRAINT "event_reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guest_event_reminders" (
    "guestRsvpId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("guestRsvpId", "kind", "channel"),
    CONSTRAINT "guest_event_reminders_guestRsvpId_fkey" FOREIGN KEY ("guestRsvpId") REFERENCES "guest_rsvps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "adminNote" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "imageURL" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushScope" TEXT NOT NULL DEFAULT 'BOTH',
    "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_users" ("adminNote", "createdAt", "email", "emailVerified", "id", "imageURL", "name", "phone", "pushEnabled", "pushScope", "updatedAt") SELECT "adminNote", "createdAt", "email", "emailVerified", "id", "imageURL", "name", "phone", "pushEnabled", "pushScope", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "event_reminders_userId_idx" ON "event_reminders"("userId");

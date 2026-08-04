-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "shortDesc" TEXT,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "locationId" TEXT NOT NULL,
    "calendarURL" TEXT,
    "allowVolunteers" BOOLEAN NOT NULL,
    "allowAttendees" BOOLEAN NOT NULL,
    "isTraining" BOOLEAN NOT NULL DEFAULT false,
    "logsGenerated" BOOLEAN NOT NULL DEFAULT false,
    "mobileClinicId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "events_mobileClinicId_fkey" FOREIGN KEY ("mobileClinicId") REFERENCES "mobileClinic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_events" ("allowAttendees", "allowVolunteers", "calendarURL", "createdAt", "description", "endTime", "id", "locationId", "logsGenerated", "mobileClinicId", "shortDesc", "startTime", "title", "updatedAt") SELECT "allowAttendees", "allowVolunteers", "calendarURL", "createdAt", "description", "endTime", "id", "locationId", "logsGenerated", "mobileClinicId", "shortDesc", "startTime", "title", "updatedAt" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "imageURL" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("createdAt", "email", "emailVerified", "id", "imageURL", "name", "phone", "updatedAt") SELECT "createdAt", "email", "emailVerified", "id", "imageURL", "name", "phone", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE TABLE "new_volunteers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "gender" TEXT,
    "ethinicity" TEXT,
    "otherVolunteerAreaDescription" TEXT,
    "otherCertificationDescription" TEXT,
    "emergencyContactName1" TEXT,
    "emergencyContactPhone1" TEXT,
    "emergencyContactName2" TEXT,
    "emergencyContactPhone2" TEXT,
    CONSTRAINT "volunteers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_volunteers" ("emergencyContactName1", "emergencyContactName2", "emergencyContactPhone1", "emergencyContactPhone2", "ethinicity", "gender", "id", "otherCertificationDescription", "otherVolunteerAreaDescription", "userId") SELECT "emergencyContactName1", "emergencyContactName2", "emergencyContactPhone1", "emergencyContactPhone2", "ethinicity", "gender", "id", "otherCertificationDescription", "otherVolunteerAreaDescription", "userId" FROM "volunteers";
DROP TABLE "volunteers";
ALTER TABLE "new_volunteers" RENAME TO "volunteers";
CREATE UNIQUE INDEX "volunteers_userId_key" ON "volunteers"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

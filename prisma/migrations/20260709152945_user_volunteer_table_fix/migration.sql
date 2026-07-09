/*
  Warnings:

  - You are about to drop the `user_availabilities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_languages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `ethinicity` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - Added the required column `active` to the `user_roles` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_availabilities";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "user_languages";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "volunteer_languages" (
    "language" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,

    PRIMARY KEY ("volunteerId", "language"),
    CONSTRAINT "volunteer_languages_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "volunteer_availabilities" (
    "volunteerId" TEXT NOT NULL,
    "availability" TEXT NOT NULL,

    PRIMARY KEY ("volunteerId", "availability"),
    CONSTRAINT "volunteer_availabilities_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rsvps" (
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "isVolunteer" BOOLEAN NOT NULL DEFAULT false,
    "volunteerId" TEXT,

    PRIMARY KEY ("userId", "eventId"),
    CONSTRAINT "rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rsvps_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_rsvps" ("eventId", "isVolunteer", "userId", "volunteerId") SELECT "eventId", "isVolunteer", "userId", "volunteerId" FROM "rsvps";
DROP TABLE "rsvps";
ALTER TABLE "new_rsvps" RENAME TO "rsvps";
CREATE TABLE "new_user_roles" (
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    PRIMARY KEY ("userId", "role"),
    CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_user_roles" ("role", "userId") SELECT "role", "userId" FROM "user_roles";
DROP TABLE "user_roles";
ALTER TABLE "new_user_roles" RENAME TO "user_roles";
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
    "gender" TEXT,
    "ethinicity" TEXT,
    CONSTRAINT "volunteers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_volunteers" ("id", "userId") SELECT "id", "userId" FROM "volunteers";
DROP TABLE "volunteers";
ALTER TABLE "new_volunteers" RENAME TO "volunteers";
CREATE UNIQUE INDEX "volunteers_userId_key" ON "volunteers"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

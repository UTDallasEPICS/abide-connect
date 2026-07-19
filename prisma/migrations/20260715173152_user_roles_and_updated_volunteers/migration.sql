/*
  Warnings:

  - You are about to drop the column `contactEmail` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `imageURL` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `volunteers` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `volunteers` table. All the data in the column will be lost.
  - Added the required column `email` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "user_roles" (
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    PRIMARY KEY ("userId", "role"),
    CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "volunteer_volunteer_areas" (
    "volunteerId" TEXT NOT NULL,
    "volunteerArea" TEXT NOT NULL,

    PRIMARY KEY ("volunteerId", "volunteerArea"),
    CONSTRAINT "volunteer_volunteer_areas_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_account" ("accessToken", "accessTokenExpiresAt", "accountId", "createdAt", "id", "idToken", "password", "providerId", "refreshToken", "refreshTokenExpiresAt", "scope", "updatedAt", "userId") SELECT "accessToken", "accessTokenExpiresAt", "accountId", "createdAt", "id", "idToken", "password", "providerId", "refreshToken", "refreshTokenExpiresAt", "scope", "updatedAt", "userId" FROM "account";
DROP TABLE "account";
ALTER TABLE "new_account" RENAME TO "account";
CREATE TABLE "new_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_session" ("createdAt", "expiresAt", "id", "ipAddress", "token", "updatedAt", "userAgent", "userId") SELECT "createdAt", "expiresAt", "id", "ipAddress", "token", "updatedAt", "userAgent", "userId" FROM "session";
DROP TABLE "session";
ALTER TABLE "new_session" RENAME TO "session";
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL DEFAULT "DELETE_ME@example.com",
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "imageURL" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("id", "name", "phone") SELECT "id", "name", "phone" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE TABLE "new_volunteers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
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
INSERT INTO "new_volunteers" ("ethinicity", "gender", "id", "userId") SELECT "ethinicity", "gender", "id", "userId" FROM "volunteers";
DROP TABLE "volunteers";
ALTER TABLE "new_volunteers" RENAME TO "volunteers";
CREATE UNIQUE INDEX "volunteers_userId_key" ON "volunteers"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

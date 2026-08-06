-- AlterTable
ALTER TABLE "users" ADD COLUMN "adminNote" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_volunteers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
INSERT INTO "new_volunteers" ("approvalStatus", "emergencyContactName1", "emergencyContactName2", "emergencyContactPhone1", "emergencyContactPhone2", "ethinicity", "gender", "id", "otherCertificationDescription", "otherVolunteerAreaDescription", "userId") SELECT "approvalStatus", "emergencyContactName1", "emergencyContactName2", "emergencyContactPhone1", "emergencyContactPhone2", "ethinicity", "gender", "id", "otherCertificationDescription", "otherVolunteerAreaDescription", "userId" FROM "volunteers";
DROP TABLE "volunteers";
ALTER TABLE "new_volunteers" RENAME TO "volunteers";
CREATE UNIQUE INDEX "volunteers_userId_key" ON "volunteers"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

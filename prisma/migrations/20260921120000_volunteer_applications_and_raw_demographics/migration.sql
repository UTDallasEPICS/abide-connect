-- Storage for imported volunteer applications, plus the two free-text columns
-- that keep an answer the enums can't hold.
--
-- Nothing here is needed for the enum additions themselves (TWO_OR_MORE/OTHER
-- on Ethinicity, OTHER on Language): SQLite has no enum type, so Prisma stores
-- those columns as TEXT and enforces the member list in the client. The new
-- members are therefore a client-side change only, and existing rows are
-- untouched.

-- AlterTable
ALTER TABLE "volunteers" ADD COLUMN "ethinicityRaw" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "languagesRaw" TEXT;

-- CreateTable
CREATE TABLE "volunteer_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "volunteerId" TEXT,
    "submittedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "ethinicityRaw" TEXT,
    "languagesRaw" TEXT,
    "emergencyContactRaw" TEXT,
    "volunteeredBefore" BOOLEAN,
    "attendedTraining" BOOLEAN,
    "trainingDate" DATETIME,
    "preferredTrainingDate" TEXT,
    "ageEligibility" BOOLEAN,
    "healthSafety" BOOLEAN,
    "backgroundCheckConsent" BOOLEAN,
    "ongoingEducationCommitment" BOOLEAN,
    "acceptanceDiscretion" BOOLEAN,
    "missionValues" BOOLEAN,
    "codeOfConductSignatureURL" TEXT,
    "signatureURL" TEXT,
    "submissionLink" TEXT,
    "rawRow" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT,
    CONSTRAINT "volunteer_applications_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
-- Re-importing the same export must be a no-op, and one person legitimately
-- applies more than once, so the identity of a submission is who sent it and
-- when. Both halves were present and distinct on all 299 rows of the first
-- export.
CREATE UNIQUE INDEX "volunteer_applications_email_submittedAt_key" ON "volunteer_applications"("email", "submittedAt");

-- CreateIndex
CREATE INDEX "volunteer_applications_volunteerId_idx" ON "volunteer_applications"("volunteerId");

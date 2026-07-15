-- AlterTable
ALTER TABLE "volunteers" ADD COLUMN "emergencyContactName1" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "emergencyContactName2" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "emergencyContactPhone1" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "emergencyContactPhone2" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "otherCertificationDescription" TEXT;
ALTER TABLE "volunteers" ADD COLUMN "otherVolunteerAreaDescription" TEXT;

-- CreateTable
CREATE TABLE "volunteer_volunteer_areas" (
    "volunteerId" TEXT NOT NULL,
    "volunteerArea" TEXT NOT NULL,

    PRIMARY KEY ("volunteerId", "volunteerArea"),
    CONSTRAINT "volunteer_volunteer_areas_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

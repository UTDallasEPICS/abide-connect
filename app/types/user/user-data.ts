/**
 * Shape of the admin member-detail payload, returned by
 * `server/api/user/[id].get.ts` and consumed by
 * `app/pages/admin/member-management/[id].vue`.
 *
 * Not a Prisma type: it flattens `User` + `Volunteer` + their join tables into
 * one object, and renames some fields to the form's vocabulary (`phone` →
 * `phoneNumber`, `ethinicity` → `ethnicity` — note the DB column keeps the
 * original misspelling).
 *
 * `volunteer` and `emergencyContact` are absent rather than empty when the user
 * has no volunteer record, so the UI can skip those sections entirely.
 *
 * Dates are `Date | string` because they arrive as `Date` during SSR but as ISO
 * strings once serialised to the client.
 */
export interface HourLogData {
  id: number;
  eventId: string | null;
  eventTitle: string | null;
  date: Date | string;
  hours: number;
  approvalStatus: string;
  comment?: string;
}
export interface RsvpData {
  eventId: string;
  eventTitle: string;
  startTime: Date | string;
  endTime: Date | string;
  isVolunteer: boolean;
}
export interface UserData {
  id: string;
  name?: string;
  email: string;
  phoneNumber?: string;
  adminNote?: string;
  imageUrl?: string;
  createdAt: Date;
  roles: string[];
  volunteer?: {
    gender?: string;
    ethnicity?: string;
    isActive?: boolean;
    languages: string[];
    availabilities?: string[];
    volunteerAreas?: string[];
    certifications?: string[];
    otherVolunteerArea?: string;
    otherCertification?: string;
  };
  emergencyContact?: {
    emergencyContactName1?: string;
    emergencyContactPhone1?: string;
    emergencyContactName2?: string;
    emergencyContactPhone2?: string;
  };
  hourLogs: HourLogData[];
  rsvps: RsvpData[];
}
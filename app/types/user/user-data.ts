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
export interface UserData {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl?: string;
  createdAt: Date;
  roles: string[];
  volunteer?: {
    gender?: string;
    ethnicity?: string;
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
}
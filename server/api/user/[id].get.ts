import { requireRole } from '~~/server/utils/requireRole';
import type { UserData } from '~~/app/types/user/user-data'; 

const UNDEFINED_FIELD_TEXT = '-';


function humanize(value: string | null |undefined): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default defineEventHandler(async (event): Promise<UserData> => {
  await requireRole(event, 'Admin');

  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: true,
      volunteer: {
        include: {
          languages: true,
          availabilities: true,
          volunteerAreas: true,
          certifications: true,
        },
      },
    },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  const volunteer = user.volunteer;

  // Only build an emergencyContact object if at least one field is populated
  const hasEmergencyContact =
    volunteer &&
    (volunteer.emergencyContactName1 ||
      volunteer.emergencyContactPhone1 ||
      volunteer.emergencyContactName2 ||
      volunteer.emergencyContactPhone2);

  const userData: UserData = {
    id: user.id,
    name: user.name ?? UNDEFINED_FIELD_TEXT,
    email: user.email,
    phoneNumber: user.phone ?? UNDEFINED_FIELD_TEXT,
    imageUrl: user.imageURL ?? undefined,
    createdAt: user.createdAt,
    roles: user.roles.filter((r) => r.active).map((r) => humanize(r.role)!),
    volunteer: volunteer
      ? {
          gender: humanize(volunteer.gender) ?? UNDEFINED_FIELD_TEXT,
          ethnicity: humanize(volunteer.ethinicity) ?? UNDEFINED_FIELD_TEXT,
          languages: volunteer.languages.map((l) => humanize(l.language)!),
          availabilities: volunteer.availabilities.map((a) => humanize(a.availability)!),
          volunteerAreas: volunteer.volunteerAreas.map((v) => humanize(v.volunteerArea)!),
          certifications: volunteer.certifications.map((c) => humanize(c.certification)!),
          otherVolunteerArea: volunteer.otherVolunteerAreaDescription ?? UNDEFINED_FIELD_TEXT,
          otherCertification: volunteer.otherCertificationDescription ?? UNDEFINED_FIELD_TEXT,
        }
      : undefined,
    emergencyContact: hasEmergencyContact
      ? {
          emergencyContactName1: volunteer!.emergencyContactName1 ?? UNDEFINED_FIELD_TEXT,
          emergencyContactPhone1: volunteer!.emergencyContactPhone1 ?? UNDEFINED_FIELD_TEXT,
          emergencyContactName2: volunteer!.emergencyContactName2 ?? UNDEFINED_FIELD_TEXT,
          emergencyContactPhone2: volunteer!.emergencyContactPhone2 ?? UNDEFINED_FIELD_TEXT,
        }
      : undefined,
  };

  return userData;
});
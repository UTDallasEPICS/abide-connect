import { requireRole } from '~~/server/utils/requireRole';
import type { UserData } from '~~/app/types/user/user-data';

function humanize(value: string | null | undefined): string | undefined {
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
      RSVPs: {
        include: { event: true },
        orderBy: { event: { startTime: 'desc' } },
      },
      volunteer: {
        include: {
          languages: true,
          availabilities: true,
          volunteerAreas: true,
          certifications: true,
          hourLogs: {
            include: { event: true },
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  });
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  const volunteer = user.volunteer;
  const hasEmergencyContact =
    volunteer &&
    (volunteer.emergencyContactName1 ||
      volunteer.emergencyContactPhone1 ||
      volunteer.emergencyContactName2 ||
      volunteer.emergencyContactPhone2);
  const userData: UserData = {
    id: user.id,
    name: user.name ?? undefined,
    email: user.email,
    phoneNumber: user.phone ?? undefined,
    imageUrl: user.imageURL ?? undefined,
    createdAt: user.createdAt,
    // Role names are display-only (not fed back into a select), so humanize is fine here.
    roles: user.roles.filter((r) => r.active).map((r) => humanize(r.role)!),
    adminNote: user.adminNote ?? undefined,
    volunteer: volunteer
      ? {
          // Raw enum values — must match option `id`s so selects can pre-select them
          // and so re-saving an untouched field sends a valid enum back.
          gender: volunteer.gender ?? undefined,
          ethnicity: volunteer.ethinicity ?? undefined,
          isActive: volunteer.isActive,
          languages: volunteer.languages.map((l) => l.language),
          availabilities: volunteer.availabilities.map((a) => a.availability),
          volunteerAreas: volunteer.volunteerAreas.map((v) => v.volunteerArea),
          certifications: volunteer.certifications.map((c) => c.certification),
          otherVolunteerArea: volunteer.otherVolunteerAreaDescription ?? undefined,
          otherCertification: volunteer.otherCertificationDescription ?? undefined,
        }
      : undefined,
    emergencyContact: hasEmergencyContact
      ? {
          emergencyContactName1: volunteer!.emergencyContactName1 ?? undefined,
          emergencyContactPhone1: volunteer!.emergencyContactPhone1 ?? undefined,
          emergencyContactName2: volunteer!.emergencyContactName2 ?? undefined,
          emergencyContactPhone2: volunteer!.emergencyContactPhone2 ?? undefined,
        }
      : undefined,
    hourLogs: (volunteer?.hourLogs ?? []).map((log) => ({
      id: log.id,
      eventId: log.eventId,
      eventTitle: log.event.title,
      date: log.date,
      hours: log.hours,
      approvalStatus: humanize(log.approvalStatus)!,
      comment: log.comment ?? undefined,
    })),
    rsvps: user.RSVPs.map((rsvp) => ({
      eventId: rsvp.eventId,
      eventTitle: rsvp.event.title,
      startTime: rsvp.event.startTime,
      endTime: rsvp.event.endTime,
      isVolunteer: rsvp.isVolunteer,
    })),
  };
  return userData;
});
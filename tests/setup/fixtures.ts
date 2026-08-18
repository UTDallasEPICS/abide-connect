import { randomUUID } from 'node:crypto'
import prisma from '#server/utils/prisma'
import { zonedTime } from '#shared/utils/reportRange'
import type { ApprovalStatus, VolunteerArea } from '#server/utils/generated/prisma/enums'
import { createFakeEvent } from './h3-globals'

/**
 * Fixture builders for the reporting integration tests.
 *
 * These write through the real Prisma client to the real (throwaway) schema, so
 * a report test exercises the actual `where` clauses — a filter that names a
 * column wrongly, or an enum value SQLite won't accept, fails here rather than
 * passing against a hand-written fake.
 *
 * Times are given as Central wall-clock components (`at(2026, 8, 17, 9)`) since
 * that is how staff describe a shift and how the reports bucket one. The
 * process runs in UTC, so anything using `new Date(y, m, d)` would be silently
 * off by five or six hours.
 */

/** A Central-time instant from calendar components. */
export function at(year: number, month: number, day: number, hour = 12): Date {
  return zonedTime(year, month, day, hour)
}

/** Empties every table the reports read, in FK-safe order. */
export async function resetDatabase() {
  await prisma.event_Time_Slot_Signup.deleteMany()
  await prisma.event_Time_Slot.deleteMany()
  await prisma.volunteer_Hour_Log.deleteMany()
  await prisma.rSVP.deleteMany()
  await prisma.event.deleteMany()
  await prisma.location.deleteMany()
  await prisma.volunteer_VolunteerArea.deleteMany()
  await prisma.volunteer.deleteMany()
  await prisma.user_Role.deleteMany()
  await prisma.user.deleteMany()
  await prisma.appSetting.deleteMany()
}

export interface VolunteerOptions {
  name?: string
  email?: string
  /** Defaults to APPROVED — the roster state the reports treat as countable. */
  approvalStatus?: ApprovalStatus
  isActive?: boolean
  areas?: VolunteerArea[]
  /** The account creation date, which is what the retention cohorts key on. */
  signedUpAt?: Date
  /** Omit the `User` row entirely, as seeded historical volunteers have. */
  withoutAccount?: boolean
}

export async function createVolunteer(options: VolunteerOptions = {}) {
  const id = randomUUID()
  const email = options.email ?? `volunteer-${id}@example.test`

  let userId: string | null = null
  if (!options.withoutAccount) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: options.name ?? `Volunteer ${id.slice(0, 4)}`,
        email,
        createdAt: options.signedUpAt ?? at(2020, 1, 1),
      },
    })
    userId = user.id
  }

  const volunteer = await prisma.volunteer.create({
    data: {
      id,
      userId,
      isActive: options.isActive ?? true,
      approvalStatus: options.approvalStatus ?? 'APPROVED',
    },
  })

  for (const area of options.areas ?? []) {
    await prisma.volunteer_VolunteerArea.create({
      data: { volunteerId: id, volunteerArea: area },
    })
  }

  return volunteer
}

export interface HourLogOptions {
  volunteerId: string
  date: Date
  hours: number
  status?: ApprovalStatus
  program?: VolunteerArea | null
  eventId?: string
  eventName?: string
  comment?: string
  /** When the volunteer submitted it — the start of the approval-latency clock. */
  createdAt?: Date
  /** When staff decided. Null models a row decided before the column existed. */
  approvedAt?: Date | null
  /** Distinct from `approvedAt`: a later comment edit moves this and not that. */
  updatedAt?: Date
}

export async function createHourLog(options: HourLogOptions) {
  return prisma.volunteer_Hour_Log.create({
    data: {
      volunteerId: options.volunteerId,
      date: options.date,
      hours: options.hours,
      approvalStatus: options.status ?? 'APPROVED',
      program: options.program ?? null,
      eventId: options.eventId ?? null,
      eventName: options.eventName ?? null,
      comment: options.comment ?? null,
      createdAt: options.createdAt ?? options.date,
      approvedAt: options.approvedAt === undefined ? options.date : options.approvedAt,
      updatedAt: options.updatedAt ?? options.approvedAt ?? options.date,
    },
  })
}

let locationId: string | null = null

async function sharedLocation() {
  const existing = locationId && await prisma.location.findUnique({ where: { id: locationId } })
  if (existing) return existing.id

  const location = await prisma.location.create({
    data: { address: `123 Test St ${randomUUID()}`, latitude: 32.78, longitude: -96.8 },
  })
  locationId = location.id
  return location.id
}

export interface EventOptions {
  title?: string
  startTime: Date
  endTime: Date
  /** Blocks drawn on the event, each with its own capacity. */
  slots?: { startTime: Date, endTime: Date, capacity: number, signedUp?: string[] }[]
  /** Volunteer ids attending an event that has no blocks. */
  volunteerRsvps?: string[]
}

export async function createEvent(options: EventOptions) {
  const event = await prisma.event.create({
    data: {
      id: randomUUID(),
      title: options.title ?? 'Test event',
      startTime: options.startTime,
      endTime: options.endTime,
      locationId: await sharedLocation(),
      allowVolunteers: true,
      allowAttendees: false,
    },
  })

  for (const slot of options.slots ?? []) {
    const created = await prisma.event_Time_Slot.create({
      data: {
        eventId: event.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
      },
    })
    for (const volunteerId of slot.signedUp ?? []) {
      await prisma.event_Time_Slot_Signup.create({
        data: { timeSlotId: created.id, volunteerId, status: 'CONFIRMED' },
      })
    }
  }

  for (const volunteerId of options.volunteerRsvps ?? []) {
    const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } })
    if (!volunteer?.userId) throw new Error('An RSVP needs a volunteer with an account')
    await prisma.rSVP.create({
      data: {
        userId: volunteer.userId,
        eventId: event.id,
        isVolunteer: true,
        volunteerId,
      },
    })
  }

  return event
}

/**
 * Calls a Nitro route handler the way the server would, with a query and body.
 * The handler module's default export is the function `defineEventHandler` was
 * given (see `h3-globals.ts`), so this is the real handler, not a copy of it.
 */
export async function callHandler<T>(
  handler: (event: ReturnType<typeof createFakeEvent>) => T | Promise<T>,
  options: Parameters<typeof createFakeEvent>[0] = {},
): Promise<T> {
  return handler(createFakeEvent(options))
}

export { createFakeEvent }

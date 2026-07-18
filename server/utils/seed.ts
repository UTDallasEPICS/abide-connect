import fs from 'fs'
import type {
  Language,
  Gender,
  Availability,
  Ethinicity,
  ApprovalStatus,
} from './generated/prisma/client.ts'
import { PrismaClient } from './generated/prisma/client.ts'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

type RawEvent = {
  id: string
  title: string
  shortDesc: string
  description: string
  startTime: string
  endTime: string
  location: {
    longitude: number
    latitude: number
    address: string
  }
  allowVolunteers: boolean
  allowAttendees: boolean
  eventAssets: string[]
}

type RawUser = {
  id: string
  name: string
  email: string
  phone: string
  imageURL?: string
  RSVPs: {
    isVolunteer?: boolean
    id: string // eventId
  }[]
}

type RawVolunteer = {
  id: string
  // Optional link to an existing user, by that user's id in users.json.
  // Omit if this volunteer profile has no associated user account.
  userId?: string
  gender?: string
  ethinicity?: string
  languages?: string[]
  availabilities?: string[]
  certifications: string[]
  hourLogs: {
    event: {
      id: string
    }
    date: string
    hours: number
    approvalStatus: string
    comment?: string
  }[]
}

type RawSchedule = {
  mobileClinic: {
    id: string
  }
  location: {
    longitude: number
    latitude: number
    address: string
  }
  startTime: string
  endTime: string
}

type RawNotification = {
  id: string
  title: string
  content: string
}

async function main() {
  // Seed 5 events (3 future, 2 past) + images
  console.log('Seeding events...')
  const rawEvents: RawEvent[] = JSON.parse(
    fs.readFileSync('prisma/seed/events.json').toString(),
  )
  for (const event of rawEvents) {
    const eventResult = await prisma.event.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        title: event.title,
        shortDesc: event.shortDesc,
        description: event.description,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        allowVolunteers: event.allowVolunteers,
        allowAttendees: event.allowAttendees,
        location: {
          connectOrCreate: {
            where: { address: event.location.address },
            create: {
              longitude: event.location.longitude,
              latitude: event.location.latitude,
              address: event.location.address,
            },
          },
        },
        eventAssets: {
          create: event.eventAssets.map((imageUrl) => ({ imageUrl })),
        },
      },
    })
    console.log(eventResult)
  }

  // Seed users (gender/ethinicity/languages/availabilities now live on Volunteer, not User)
  console.log('Seeding users...')
  const rawUsers: RawUser[] = JSON.parse(
    fs.readFileSync('prisma/seed/users.json').toString(),
  )
  for (const user of rawUsers) {
    const userResult = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        imageURL: user.imageURL,
        RSVPs: {
          create: user.RSVPs.map((rsvp) => ({
            isVolunteer: rsvp.isVolunteer ?? false,
            event: { connect: { id: rsvp.id } },
          })),
        },
      },
    })
    console.log(userResult)
  }

  // Seed volunteers
  console.log('Seeding volunteers...')
  const rawVolunteers: RawVolunteer[] = JSON.parse(
    fs.readFileSync('prisma/seed/volunteers.json').toString(),
  )
  for (const volunteer of rawVolunteers) {
    if (volunteer.userId) {
      const linkedUserExists = await prisma.user.findUnique({
        where: { id: volunteer.userId },
        select: { id: true },
      })
      if (!linkedUserExists) {
        console.warn(
          `Volunteer ${volunteer.id}: no user found for id "${volunteer.userId}", skipping user link.`,
        )
      }
    }

    const volunteerResult = await prisma.volunteer.upsert({
      where: { id: volunteer.id },
      update: {},
      create: {
        id: volunteer.id,
        gender: volunteer.gender as Gender | undefined,
        ethinicity: volunteer.ethinicity as Ethinicity | undefined,
        user: volunteer.userId
          ? { connect: { id: volunteer.userId } }
          : undefined,
        languages: volunteer.languages
          ? {
              create: volunteer.languages.map((lang) => ({
                language: lang as Language,
              })),
            }
          : undefined,
        availabilities: volunteer.availabilities
          ? {
              create: volunteer.availabilities.map((avail) => ({
                availability: avail as Availability,
              })),
            }
          : undefined,
        certifications: {
          create: volunteer.certifications.map((cert) => ({
            certification: cert,
          })),
        },
        hourLogs: {
          create: volunteer.hourLogs.map((log) => ({
            date: new Date(log.date),
            hours: log.hours,
            approvalStatus: log.approvalStatus as ApprovalStatus,
            comment: log.comment,
            event: { connect: { id: log.event.id } },
          })),
        },
      },
    })
    console.log(volunteerResult)

    // Backfill RSVP.volunteerId wherever this user already has isVolunteer=true.
    // RSVP.isVolunteer is set at user-seed time; volunteerId can only be wired up
    // now that the Volunteer row exists.
    if (volunteer.userId) {
      const linked = await prisma.rSVP.updateMany({
        where: { userId: volunteer.userId, isVolunteer: true },
        data: { volunteerId: volunteerResult.id },
      })
      console.log(
        `Linked ${linked.count} RSVP(s) to volunteer ${volunteerResult.id}`,
      )
    }
  }

  // Seed mobile clinic schedule
  console.log('Seeding mobile clinic schedule...')
  const rawSchedules: RawSchedule[] = JSON.parse(
    fs.readFileSync('prisma/seed/schedule.json').toString(),
  )
  for (const schedule of rawSchedules) {
    const scheduleResult = await prisma.mobile_Clinic_Schedule.upsert({
      where: { startTime: new Date(schedule.startTime) },
      update: {},
      create: {
        startTime: new Date(schedule.startTime),
        endTime: new Date(schedule.endTime),
        location: {
          connectOrCreate: {
            where: { address: schedule.location.address },
            create: {
              longitude: schedule.location.longitude,
              latitude: schedule.location.latitude,
              address: schedule.location.address,
            },
          },
        },
        mobileClinic: {
          connectOrCreate: {
            where: { id: schedule.mobileClinic.id },
            create: { id: schedule.mobileClinic.id },
          },
        },
      },
    })
    console.log(scheduleResult)
  }

  // Seed notifications
  console.log('Seeding notifications...')
  const rawNotifications: RawNotification[] = JSON.parse(
    fs.readFileSync('prisma/seed/notifications.json').toString(),
  )
  const allUsers = await prisma.user.findMany()
  for (const notification of rawNotifications) {
    const notificationResult = await prisma.notification.upsert({
      where: { id: notification.id },
      update: {},
      create: {
        id: notification.id,
        title: notification.title,
        content: notification.content,
      },
    })
    for (const user of allUsers) {
      await prisma.user_Notification.upsert({
        where: {
          userId_notificationId: {
            userId: user.id,
            notificationId: notificationResult.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          notificationId: notificationResult.id,
        },
      })
    }
    console.log(notificationResult)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
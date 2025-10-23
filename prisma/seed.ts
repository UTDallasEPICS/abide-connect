import fs  from 'fs';
import type { Language, Gender, Availability, Ethinicity, ApprovalStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type RawEvent = {
  id: string,
  title: string,
  shortDesc: string,
  description: string,
  startTime: string,
  endTime: string,
  location: string,
  allowVolunteers: boolean,
  allowAttendees: boolean,
  eventAssets: string[]
}

type RawUser = {
  name: string,
  email: string,
  phone: string,
  languages: string[],
  events: {
    isVolunteer?: boolean,
    id: string
  }[]
}

type RawVolunteer = {
  id: string,
  user: {
    email: string,
  },
  gender: string,
  ethinicity: string,
  profileURL: string,
  availabilities: string[],
  certifications: string[],
  hourLogs: {
    event: {
      id: string
    },
    clockIn: string,
    clockOut?: string,
    approvalStatus: string,
    comment?: string
  }[]
}

type RawNotification = {
  
  id: string,
  title: string,
  content: string,
  isRead: boolean,
  user: {
    email: string
  }[]
}

async function main() {
  // Seed 5 events (3 future, 2 past) + images
  console.log("Seeding events...")
  const rawEvents: RawEvent[] = JSON.parse(fs.readFileSync('prisma/seed/events.json').toString());
  // Convert each event into an upsertable format
  const events = rawEvents.map((event) => {
    return {
      ...event,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      eventAssets: {
        create: event.eventAssets.map((imageUrl) => {
          return {
            imageUrl: imageUrl
          }
        })
      }
    };
  })
  // Upsert each event
  for(const event of events) {
    const eventResult = await prisma.event.upsert({
      where: { id: event.id },
      update: {},
      create: event
    })
    console.log(eventResult)
  }

  // Seed two users + attended events + languages
  console.log("Seeding users...")
  const rawUsers: RawUser[] = JSON.parse(fs.readFileSync('prisma/seed/users.json').toString());
  // Convert each user into an upsertable format
  const users = rawUsers.map((user) => {
    return {
      ...user,
      languages: {
        create: user.languages.map((lang) => {
            return {
            language: lang as Language
          }
        })
      },
      events: {
        create: user.events.map((event) => {
        return {
            isVolunteer: event.isVolunteer || false,
            event: {
              connect: {
                id: event.id
              }
            }
        }})
      }
    }
  })
  // Upsert each user
  for(const user of users) {
    const userResult = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user
    })
    console.log(userResult)
  }

  // Seed one volunteer (ENSURE that each volunteer is linked to an existing user by email)
  console.log("Seeding volunteers...")
  const rawVolunteers: RawVolunteer[] = JSON.parse(fs.readFileSync('prisma/seed/volunteers.json').toString());
  // Convert each volunteer into an upsertable format
  const volunteers = rawVolunteers.map((volunteer) => {
    return {
      ...volunteer,
      gender: volunteer.gender as Gender,
      ethinicity: volunteer.ethinicity as Ethinicity,
      availabilities: {
        create: volunteer.availabilities.map((avail) => {
          return {
            availability: avail as Availability
          }
        })
      },
      hourLogs: {
        create: volunteer.hourLogs.map((log) => {
          return {
            ...log,
            clockIn: new Date(log.clockIn),
            clockOut: log.clockOut ? new Date(log.clockOut) : null,
            approvalStatus: log.approvalStatus as ApprovalStatus,
            event: {
              connect: {
                id: log.event.id
              }
            }
          }
        })
      },
      certifications: {
        create: volunteer.certifications.map((cert) => {
          return {
            certification: cert
          }
        })
      },
      user: {
        connect: {
          email: volunteer.user.email
        }
      },
    }
  });
  // Upsert each volunteer
  for(const volunteer of volunteers) {
    const volunteerResult = await prisma.volunteer.upsert({
      where: { id: volunteer.id },
      update: {},
      create: volunteer
    })
    console.log(volunteerResult)
  }

  // Seed six notifications
  const rawNotifications: RawNotification[] = JSON.parse(fs.readFileSync('prisma/seed/notifications.json').toString());
  // Convert each notification into an upsertable format
  const notifications = rawNotifications.map((notification) => {
    return {
      ...notification,
      user: {
        connect: notification.user.map((notificationUser) => {
          return {
            email: notificationUser.email
          }
        }),
      }
    }
  })
  // Upsert each notification
  for(const notification of notifications) {
    const notificationResult = await prisma.notification.upsert({
      where: { id: notification.id },
      update: {},
      create: notification
    })
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
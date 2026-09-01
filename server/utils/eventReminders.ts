import prisma from './prisma'
import { sendPushToUsers } from './push'
import { buildEventReminderEmail } from './event-email'
import { cancelUrlFor, eventEmailDetails, sendEventEmail } from './eventMailer'
import { formatEventTime } from '#shared/utils/eventTime'
import type { ReminderChannel, ReminderKind } from './generated/prisma/client'

/**
 * Event sign-up reminders: a push notification 24 hours and 1 hour before an
 * event you RSVP'd to, plus an optional emailed 24-hour reminder for users who
 * switched it on in /settings.
 *
 * Driven by `server/cron/eventReminders.ts`, which calls
 * `sendDueEventReminders()` on a short interval. Everything here is written to
 * be safe under repeated calls: a reminder is *claimed* by inserting an
 * `Event_Reminder` row before it's sent, so a job that runs twice inside the
 * same window can't remind anyone twice.
 *
 * `RSVP` rows (signed-in users) are always covered. `GuestRSVP` sign-ups have
 * no account, so they can only ever be reached by email, and only when
 * `GUEST_EVENT_REMINDER_EMAILS` is switched on — see `guestEmailsEnabled`.
 */

const HOUR_MS = 60 * 60 * 1000

/**
 * Whether guests who signed up without an account also get the 24-hour email.
 *
 * Off unless explicitly switched on. Guests never saw a settings page, so this
 * flag is the only consent there is: it's an operator's decision that a
 * one-off reminder to an address someone typed into a sign-up form is expected
 * rather than unsolicited. Failing closed keeps a missing or misspelled env
 * var from mailing people by accident.
 */
export const guestEmailsEnabled = ['true', '1', 'yes', 'on']
  .includes((process.env.GUEST_EVENT_REMINDER_EMAILS ?? '').trim().toLowerCase())

/**
 * The two reminders, each defined by the window of start times that is "due
 * now". Windows are expressed as an offset range from the current time rather
 * than a single instant so a cron tick can't fall between two of them and miss
 * a send.
 *
 * `DAY_BEFORE` starts at 22 hours rather than 24 to give the job two hours of
 * slack. The flip side is intentional: someone who signs up less than 22 hours
 * ahead never gets the day-before reminder — they only just chose the event, so
 * telling them about it "tomorrow" would be noise — but they still get the
 * one-hour one.
 */
const REMINDERS: Array<{
  kind: ReminderKind
  /** Fire when the event starts more than this long from now… */
  fromMs: number
  /** …and no more than this long from now. */
  toMs: number
  /** Wording for the push body, e.g. "tomorrow" → "Starts tomorrow at 9:00 AM". */
  lead: string
  /** Whether opted-in users also get this one by email. */
  email: boolean
}> = [
  { kind: 'DAY_BEFORE', fromMs: 22 * HOUR_MS, toMs: 24 * HOUR_MS, lead: 'tomorrow', email: true },
  { kind: 'HOUR_BEFORE', fromMs: 0, toMs: HOUR_MS, lead: 'in about an hour', email: false },
]

export type ReminderRunResult = { push: number, email: number }

/**
 * Sends every reminder that has come due and hasn't been sent yet.
 *
 * Best-effort by design, like the push and calendar layers: individual failures
 * are logged and the run continues, so one bad address or dead push endpoint
 * can't stop everyone else's reminder.
 */
export async function sendDueEventReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { push: 0, email: 0 }

  for (const reminder of REMINDERS) {
    const events = await prisma.event.findMany({
      where: {
        startTime: {
          gt: new Date(now.getTime() + reminder.fromMs),
          lte: new Date(now.getTime() + reminder.toMs),
        },
      },
      include: {
        location: true,
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, emailRemindersEnabled: true },
            },
          },
        },
        reminders: { where: { kind: reminder.kind } },
      },
    })

    for (const event of events) {
      const alreadySent = new Set(event.reminders.map(r => `${r.userId}:${r.channel}`))
      const pending = (channel: ReminderChannel) =>
        event.participants.filter(p => !alreadySent.has(`${p.userId}:${channel}`))

      /* ------------------------------------------------------------ push */

      const pushCandidates = pending('PUSH')
      if (pushCandidates.length > 0) {
        const claimed = await claim(event.id, pushCandidates.map(p => p.userId), reminder.kind, 'PUSH')
        const pushTargets = pushCandidates.filter(p => claimed.has(p.userId))

        // sendPushToUsers takes one kind per call and filters on each user's
        // chosen scope, so volunteers and attendees go out as two batches.
        const volunteers = pushTargets.filter(p => p.isVolunteer).map(p => p.userId)
        const attendees = pushTargets.filter(p => !p.isVolunteer).map(p => p.userId)

        const payload = {
          title: event.title,
          body: `${reminder.kind === 'DAY_BEFORE' ? 'Tomorrow' : 'Starting soon'} — ${formatEventTime(event.startTime)}${event.location ? ` at ${event.location.address}` : ''}`,
          url: `/events/${event.id}`,
          // One tag per event and reminder, so a re-delivery replaces the old
          // notification on the device instead of stacking a second one.
          tag: `event-${event.id}-${reminder.kind}`,
        }

        const sent = await Promise.all([
          volunteers.length > 0 ? sendPushToUsers(volunteers, 'VOLUNTEER', payload) : { sent: 0 },
          attendees.length > 0 ? sendPushToUsers(attendees, 'GENERAL', payload) : { sent: 0 },
        ])
        result.push += sent.reduce((total, r) => total + r.sent, 0)
      }

      /* ----------------------------------------------------------- email */

      if (!reminder.email) continue

      // Reminders don't re-state the blurb — the recipient already read it on
      // the confirmation email — so the description is dropped here.
      const details = { ...eventEmailDetails(event), description: null, calendarUrl: null }

      // Account holders — opted in from /settings.
      const emailCandidates = pending('EMAIL').filter(p => p.user.emailRemindersEnabled)
      if (emailCandidates.length > 0) {
        const emailClaimed = await claim(event.id, emailCandidates.map(p => p.userId), reminder.kind, 'EMAIL')

        for (const target of emailCandidates.filter(p => emailClaimed.has(p.userId))) {
          const mail = buildEventReminderEmail({
            ...details,
            name: target.user.name,
            isVolunteer: target.isVolunteer,
            audience: 'user',
            cancelUrl: cancelUrlFor({ type: 'user', userId: target.userId, eventId: event.id }),
          })

          // The claim row is already written, so a permanently broken address
          // is logged once rather than retried on every tick for the rest of
          // the day — `sendEventEmail` swallows the failure for us.
          if (await sendEventEmail(target.user.email, mail)) result.email++
        }
      }

      // Guests — no account, so `GUEST_EVENT_REMINDER_EMAILS` stands in for a
      // per-person preference. Fetched separately, and only when that flag is
      // on: they're email-only, so the one-hour pass never needs them.
      const guests = guestEmailsEnabled
        ? await prisma.guestRSVP.findMany({
            where: { eventId: event.id },
            include: { reminders: { where: { kind: reminder.kind } } },
          })
        : []

      for (const guest of guests) {
        if (guest.reminders.some(r => r.channel === 'EMAIL')) continue

        const claimed = await claimGuest(guest.id, reminder.kind, 'EMAIL')
        if (!claimed) continue

        const mail = buildEventReminderEmail({
          ...details,
          name: guest.name,
          isVolunteer: guest.isVolunteer,
          audience: 'guest',
          // The only way back to a sign-up made without an account.
          cancelUrl: cancelUrlFor({ type: 'guest', guestRsvpId: guest.id }),
        })

        if (await sendEventEmail(guest.email, mail)) result.email++
      }
    }
  }

  return result
}

/**
 * Records that these reminders are going out, before they go out, and returns
 * the subset that was actually claimed by *this* call.
 *
 * Rows are inserted one at a time rather than with `createMany`, because
 * `skipDuplicates` is not supported on SQLite — and the insert has to be the
 * thing that decides who gets a reminder, not a preceding read, or two
 * overlapping runs could both pass the read and both send. A unique-constraint
 * violation (P2002) means someone else claimed it, so that recipient is
 * dropped from the send list.
 *
 * Claiming first means a crash mid-run costs a missed reminder rather than a
 * duplicate one — the less annoying of the two for a recipient.
 */
async function claim(
  eventId: string,
  userIds: string[],
  kind: ReminderKind,
  channel: ReminderChannel,
): Promise<Set<string>> {
  const claimed = new Set<string>()

  for (const userId of userIds) {
    try {
      await prisma.event_Reminder.create({ data: { eventId, userId, kind, channel } })
      claimed.add(userId)
    }
    catch (error) {
      if ((error as { code?: string }).code !== 'P2002') {
        console.error('[reminders] could not claim reminder', { eventId, userId, kind, channel }, error)
      }
    }
  }

  return claimed
}

/**
 * `claim` for a single guest sign-up, which is keyed on the `GuestRSVP` rather
 * than on a user. Returns false when someone else already claimed it.
 */
async function claimGuest(
  guestRsvpId: string,
  kind: ReminderKind,
  channel: ReminderChannel,
): Promise<boolean> {
  try {
    await prisma.guest_Event_Reminder.create({ data: { guestRsvpId, kind, channel } })
    return true
  }
  catch (error) {
    if ((error as { code?: string }).code !== 'P2002') {
      console.error('[reminders] could not claim guest reminder', { guestRsvpId, kind, channel }, error)
    }
    return false
  }
}

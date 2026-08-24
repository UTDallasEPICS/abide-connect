import { roundHours } from '#shared/utils/hours'
import { slotDurationHours } from '#shared/utils/timeSlot'

/**
 * How many hours each volunteer worked at an event.
 *
 * Pure and I/O-free so the arithmetic can be tested directly — the cron that
 * uses it (`server/cron/generateVolunteerLogs.ts`) only handles scheduling,
 * fetching and writing.
 */

/** The slice of an event this calculation needs. */
export interface EventHoursInput {
  startTime: Date
  endTime: Date
  /** RSVPs marked as volunteering. Only used by events with no time blocks. */
  participants: { volunteerId: string | null }[]
  timeSlots: {
    startTime: Date
    endTime: Date
    /** Confirmed signups only — the caller filters. */
    signups: { volunteerId: string }[]
  }[]
}

export interface VolunteerHours {
  volunteerId: string
  /** Rounded to two decimals, like every other hour figure that reaches the DB. */
  hours: number
  /** How many blocks made up those hours; 0 on events without blocks. */
  blocks: number
}

/**
 * Blocks present → each volunteer is credited with the blocks they claimed.
 * No blocks → the previous behaviour, the full event duration for everyone
 * who RSVP'd as a volunteer.
 *
 * Crediting the whole event on a slotted event would mean someone who worked a
 * single 2-3pm shift is logged for eight hours and an admin approves it.
 */
export function volunteerHoursForEvent(event: EventHoursInput): VolunteerHours[] {
  if (event.timeSlots.length === 0) {
    const hours = roundHours((event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60))

    return event.participants
      .filter(rsvp => rsvp.volunteerId !== null)
      .map(rsvp => ({ volunteerId: rsvp.volunteerId!, hours, blocks: 0 }))
  }

  // Read from the signups rather than RSVP: on a slotted event the confirmed
  // signups are the authoritative record of what someone worked, so the hours
  // stay right even if an RSVP row is missing. A volunteer with an RSVP but no
  // confirmed block therefore gets nothing, which is correct — they claimed no
  // shifts, so there's nothing to approve.
  const worked = new Map<string, VolunteerHours>()

  for (const slot of event.timeSlots) {
    const duration = slotDurationHours(slot)

    for (const signup of slot.signups) {
      const entry = worked.get(signup.volunteerId)
        ?? { volunteerId: signup.volunteerId, hours: 0, blocks: 0 }

      // A plain sum is correct *only* because a volunteer cannot hold two
      // time-overlapping blocks (rejected at signup). If that rule is ever
      // relaxed, this has to become a union-of-intervals calculation or
      // overlapping shifts will double-count someone's hours.
      entry.hours += duration
      entry.blocks += 1
      worked.set(signup.volunteerId, entry)
    }
  }

  // Rounded once here rather than per block: rounding each 50-minute block to
  // 0.83 first and then adding would lose a minute per block.
  return [...worked.values()].map(entry => ({ ...entry, hours: roundHours(entry.hours) }))
}

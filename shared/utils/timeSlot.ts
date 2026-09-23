/**
 * Rules for event time blocks ("slots").
 *
 * An admin hand-draws blocks on an event — 8am-12pm, 10am-11am, 1pm-4pm — each
 * with its own volunteer capacity. Blocks may overlap each other and may vary
 * in length; that is the feature, not an oversight.
 *
 * These helpers live in `shared/` because both sides need them: the server
 * enforces them (a direct POST bypasses any UI), and the admin editor shows
 * them as the user types. Duplicating the rules would let the two drift.
 */

/** The event window a block has to fit inside. */
export interface SlotWindow {
  startTime: Date
  endTime: Date
}

/** A block as the admin editor holds it, before it has been saved. */
export interface TimeSlotDraft {
  /** Present on blocks that already exist; absent on ones just added. */
  id?: string | null
  startTime: Date
  endTime: Date
  capacity: number
  note?: string | null
}

/**
 * Whether two time ranges overlap at all. Touching ends don't count: a block
 * ending at 10:00 and one starting at 10:00 are back-to-back, not overlapping,
 * so a volunteer can hold both.
 *
 * This is the test behind the "no two overlapping blocks per volunteer" rule,
 * which is what allows the hour-log cron to plainly sum block durations
 * instead of merging intervals.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

/** Length of a block in hours, as stored in `Volunteer_Hour_Log.hours`. */
export function slotDurationHours(slot: { startTime: Date, endTime: Date }): number {
  return (slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60 * 60)
}

/**
 * What's wrong with a single block, or `null` if it's fine. The message is a
 * sentence fragment so callers can prefix it with however they identify the
 * block ("Block 2 ...", "The 10:00 AM - 11:00 AM block ...").
 *
 * Times are never formatted here — the server runs in UTC in production while
 * the admin is in Central, so only the browser can name a time correctly.
 */
export function validateTimeSlot(slot: TimeSlotDraft, event: SlotWindow): string | null {
  if (Number.isNaN(slot.startTime.getTime()) || Number.isNaN(slot.endTime.getTime())) {
    return 'has an invalid start or end time'
  }
  if (slot.startTime.getTime() >= slot.endTime.getTime()) {
    return 'ends at or before it starts'
  }
  if (slot.startTime.getTime() < event.startTime.getTime()) {
    return 'starts before the event begins'
  }
  if (slot.endTime.getTime() > event.endTime.getTime()) {
    return 'ends after the event finishes'
  }
  if (!Number.isInteger(slot.capacity) || slot.capacity < 1) {
    return 'needs a volunteer capacity of at least 1'
  }
  return null
}

/**
 * Validates every block, returning one message per bad block, identified by
 * 1-based position. Empty array means the whole set is valid.
 */
export function validateTimeSlots(slots: TimeSlotDraft[], event: SlotWindow): string[] {
  return slots.flatMap((slot, i) => {
    const problem = validateTimeSlot(slot, event)
    return problem ? [`Block ${i + 1} ${problem}.`] : []
  })
}

/*
 * `toDateTimeLocal` / `fromDateTimeLocal` and the block's "10:00 AM - 11:00 AM"
 * wording used to live here. They moved to `#shared/utils/eventTime`, which
 * words every date in the org's timezone rather than the browser's — an admin
 * elsewhere was otherwise typing and reading their own wall clock into an event
 * that happens in Central.
 */

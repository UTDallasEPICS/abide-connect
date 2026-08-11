import {
  eventTypeFromFlags,
  type EventAudienceFlags,
} from '#shared/utils/eventType'
import {
  validateTimeSlots,
  type SlotWindow,
  type TimeSlotDraft,
} from '#shared/utils/timeSlot'

/**
 * Request-side handling for event time blocks: parsing them out of a JSON
 * body and rejecting the ones that break the rules in
 * `#shared/utils/timeSlot`.
 *
 * The UI enforces the same rules as you type, but that's a convenience, not a
 * control — anyone can POST straight at these routes.
 */

/** A block from a request body. `id` is null for blocks the admin just added. */
export interface ParsedTimeSlot extends TimeSlotDraft {
  id: string | null
}

/**
 * Reads `timeSlots` out of a request body.
 *
 * Only call this once you've confirmed the caller actually sent an array —
 * a missing `timeSlots` key means "leave the blocks alone", which is a very
 * different instruction from an empty array ("delete them all").
 */
export function parseTimeSlotPayload(raw: unknown): ParsedTimeSlot[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, message: 'timeSlots must be an array' })
  }

  return raw.map((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      throw createError({ statusCode: 400, message: `Block ${i + 1} is malformed.` })
    }

    const slot = entry as Record<string, unknown>
    const rawCapacity = slot.capacity

    return {
      // An empty-string id would come from a UI binding, not a real row.
      id: typeof slot.id === 'string' && slot.id.length > 0 ? slot.id : null,
      startTime: new Date(slot.startTime as string),
      endTime: new Date(slot.endTime as string),
      capacity: rawCapacity === undefined || rawCapacity === null || rawCapacity === ''
        ? 1
        : Number(rawCapacity),
      note: typeof slot.note === 'string' && slot.note.trim().length > 0
        ? slot.note.trim()
        : null,
    }
  })
}

/**
 * Rejects the whole save if any block breaks the rules, listing every problem
 * at once so the admin doesn't fix them one round-trip at a time.
 *
 * This is what catches an admin narrowing an event's window while blocks still
 * sit outside it. There's no sensible "save it anyway" state for that, unlike
 * over-capacity or removing a block with signups, which are warnings.
 */
export function assertTimeSlotsValid(slots: TimeSlotDraft[], window: SlotWindow): void {
  const problems = validateTimeSlots(slots, window)

  if (problems.length > 0) {
    throw createError({
      statusCode: 400,
      message: problems.join(' '),
      data: { problems },
    })
  }
}

/**
 * Blocks are volunteer shifts, so they only belong on events volunteers can
 * sign up for. Training events run their own approval-based signup path and
 * attendee-only events have no volunteers at all, so blocks on either would be
 * data nothing reads.
 */
export function assertEventAcceptsTimeSlots(flags: Partial<EventAudienceFlags>): void {
  const type = eventTypeFromFlags(flags)

  if (type !== 'VOLUNTEERS' && type !== 'VOLUNTEERS_AND_ATTENDEES') {
    throw createError({
      statusCode: 400,
      message: 'Time blocks can only be added to events that volunteers sign up for.',
    })
  }
}

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

/**
 * How long a role descriptor may be. Short on purpose: it renders on one line
 * next to the block's time, and it names a job ("Front desk check-in") rather
 * than describing one — that's what `note` is for.
 *
 * Exported so the editor's `maxlength` and the server's rejection come from
 * the same number instead of drifting apart.
 */
export const SLOT_ROLE_MAX_LENGTH = 60

/** One swatch an admin can paint a block with. */
export interface SlotColor {
  /** What's stored on the row. */
  token: string
  /** Shown in the picker, and used as the swatch's accessible name. */
  label: string
  hex: string
}

/**
 * The swatches, in hue order.
 *
 * Validated as a *set*, not individually: every pair has to stay apart under
 * normal vision and under protanopia/deuteranopia/tritanopia, because an admin
 * can put any two of them on blocks that sit side by side. Seven is the
 * measured ceiling for that — an eighth forces some pair below the separation
 * floor, which is why this list doesn't simply grow on request.
 *
 * One hex serves both themes: the dark-mode lightness band sits inside the
 * light-mode one, so a single value lands correctly on white and on gray-800.
 *
 * Red is deliberately absent. It's reserved for a block that falls outside the
 * event's window, and that signal stops meaning anything if a shift can also
 * just *be* red.
 *
 * Three of these (yellow, emerald, indigo) sit under a 3:1 contrast ratio
 * against the dark surface. That's allowed only because every bar carries a
 * visible text label and a surface-coloured ring — don't drop either without
 * re-checking these.
 */
export const SLOT_COLORS: SlotColor[] = [
  { token: 'yellow', label: 'Yellow', hex: '#a16207' },
  { token: 'lime', label: 'Lime', hex: '#65a30d' },
  { token: 'emerald', label: 'Emerald', hex: '#047857' },
  { token: 'sky', label: 'Sky', hex: '#0284c7' },
  { token: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { token: 'purple', label: 'Purple', hex: '#a855f7' },
  { token: 'pink', label: 'Pink', hex: '#db2777' },
]

/** What an unpainted block is drawn in. One of the seven, never an extra hue. */
export const DEFAULT_SLOT_COLOR_TOKEN = 'emerald'

/**
 * The hex for a stored token, falling back to the default.
 *
 * Never throws on an unknown token: colour is decoration, and a block whose
 * swatch was retired should still draw rather than take the strip down.
 */
export function slotColorHex(token?: string | null): string {
  const found = SLOT_COLORS.find(c => c.token === token)
  return (found ?? SLOT_COLORS.find(c => c.token === DEFAULT_SLOT_COLOR_TOKEN)!).hex
}

/** A block as the admin editor holds it, before it has been saved. */
export interface TimeSlotDraft {
  /** Present on blocks that already exist; absent on ones just added. */
  id?: string | null
  startTime: Date
  endTime: Date
  capacity: number
  /**
   * What the volunteer will be doing on this shift. Optional: blocks predate
   * this field, and staff can leave it blank when the event is self-evident.
   */
  role?: string | null
  note?: string | null
  /** A `SLOT_COLORS` token. Null means the default swatch. */
  color?: string | null
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
  // Only a length rule: a blank role is valid, since it's optional.
  if (slot.role && slot.role.trim().length > SLOT_ROLE_MAX_LENGTH) {
    return `has a role longer than ${SLOT_ROLE_MAX_LENGTH} characters`
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

/**
 * A `Date` as the string an `<input type="datetime-local">` expects.
 *
 * Built from local components on purpose: `toISOString()` returns UTC, so an
 * 8:00 AM block would render in the input as 1:00 PM for a Central-time admin.
 */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The inverse. A `datetime-local` value carries no timezone, so `new Date()`
 * reads it as local wall-clock time — which is exactly what the admin typed.
 */
export function fromDateTimeLocal(value: string): Date {
  return new Date(value)
}

/** e.g. "10:00 AM - 11:00 AM". Browser-side only, so the timezone is right. */
export function formatSlotRange(startTime: Date, endTime: Date): string {
  const time = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${time(startTime)} - ${time(endTime)}`
}

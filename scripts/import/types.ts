/**
 * The canonical shape a volunteer record must be in before it can be imported.
 *
 * This is deliberately *not* whatever Abide's current system exports. A thin
 * per-source adapter (CSV reader, API dump reshaper) converts their format into
 * this, and everything downstream — validation, enum mapping, the writes — only
 * ever sees this type. That seam is the whole point: when the export turns out
 * to have three address columns and a "Notes" field holding four different
 * facts, the mess stays in the adapter instead of leaking into the importer.
 *
 * Every enum-ish field is typed `string` here, not the Prisma enum. Source data
 * says "Female", "f", "Woman"; turning that into `Gender.FEMALE` is
 * `mapping.ts`'s job, and it reports what it couldn't place rather than
 * guessing.
 *
 * `legacyId` is required and load-bearing. It is the volunteer's primary key in
 * the system being left behind, and it is what makes this import re-runnable:
 * the `User.id` and `Volunteer.id` written here are derived from it (see
 * `stableUuid`), so a second pass updates the same rows instead of creating a
 * parallel set. If the source has no stable id, synthesise one in the adapter
 * and keep it — an email is a poor substitute because people change them.
 */
export interface SourceVolunteer {
  /** Primary key in the source system. Stable across runs. */
  legacyId: string

  /** Full name as they'd want it shown. */
  name?: string
  /** Required. Normalised (trim + lowercase) before use — see the importer. */
  email: string
  phone?: string

  /** Whether they're still an active volunteer in the source system. */
  isActive?: boolean

  /**
   * Whether they are a cleared, trained volunteer today. Drives
   * `Volunteer.approvalStatus`. Left undefined, the importer falls back to its
   * `--approval-status` flag rather than silently defaulting to PENDING, which
   * would lock every migrated volunteer out of volunteer-only events on day one.
   */
  isApproved?: boolean

  gender?: string
  ethnicity?: string

  languages?: string[]
  availabilities?: string[]
  volunteerAreas?: string[]
  certifications?: string[]

  /** Free text for anything that mapped to the `OTHER` enum member. */
  otherVolunteerAreaDescription?: string
  otherCertificationDescription?: string

  emergencyContactName1?: string
  emergencyContactPhone1?: string
  emergencyContactName2?: string
  emergencyContactPhone2?: string

  /** Historical hours. Optional — importing people without their history is valid. */
  hourLogs?: SourceHourLog[]
}

/**
 * One historical hour entry.
 *
 * These always land as free-text (`eventName`) rather than pointing at an
 * `Event` row: the events they were worked at live in the old system and were
 * never created here, so `eventId` has nothing to connect to. The schema allows
 * exactly this — see the note on `Volunteer_Hour_Log`.
 */
export interface SourceHourLog {
  /**
   * `YYYY-MM-DD`. Passed through `parseZonedDate`, so it is read as a calendar
   * date *in Central*. Do not pre-convert to a `Date` in the adapter — that is
   * the exact bug `20260828120000_date_only_columns_in_org_timezone` exists to
   * clean up.
   */
  date: string
  hours: number
  /** What they did. Shown wherever the UI would show an event title. */
  eventName?: string
  /** Grant-reporting dimension. Set it if the source knows it — see below. */
  program?: string
  comment?: string
  /**
   * When the entry was filed and approved in the old system, if known. Both are
   * set explicitly because the approval-latency stat is `approvedAt - createdAt`;
   * letting `createdAt` default to now() against a backdated `approvedAt`
   * produces negative latencies that poison the median.
   */
  createdAt?: string
  approvedAt?: string
}

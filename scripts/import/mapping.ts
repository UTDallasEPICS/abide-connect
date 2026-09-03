/**
 * Turns the source system's free text into this schema's enum members.
 *
 * Every enum-valued column in `volunteer.prisma` is closed — Prisma will reject
 * anything that isn't a declared member, and SQLite won't catch it for you, so
 * an unmapped value is a failed write, not a soft default. This module is where
 * that translation happens and, just as importantly, where *failures to
 * translate* are collected instead of thrown away: `mapEnum` records what it
 * couldn't place so the importer can hand back a list of every unrecognised
 * value in the file, with counts, before anything is written.
 *
 * The alias tables below are provisional. They cover the spellings these fields
 * usually arrive in, but they were written without having seen Abide's actual
 * export — expect the first dry run to surface a batch of unmapped values, and
 * expect resolving them to be a conversation with Abide rather than a guess
 * made here. Adding an alias is a one-line change; guessing wrong writes the
 * wrong demographic data into a system that reports to funders.
 *
 * Two known gaps worth naming up front, because no alias fixes them:
 *
 *   - `Availability` has no WEEKEND_EVENING. A source value of "Saturday
 *     evening" has nowhere correct to go, so it is reported unmapped rather
 *     than quietly rounded to WEEKEND_AFTERNOON.
 *   - `Ethinicity` (sic — the typo is deliberate and load-bearing, see the
 *     schema) is a single value, not a set, and has no "two or more races" or
 *     "prefer not to say" member. Source rows carrying either must be dropped
 *     to null on purpose, not forced into the nearest option.
 */
import type {
  Availability,
  Certification,
  Ethinicity,
  Gender,
  Language,
  VolunteerArea,
} from '../../server/utils/generated/prisma/client.ts'

/**
 * Loose comparison key: upper-cased, every run of non-alphanumerics collapsed
 * to a single underscore, edges trimmed. So "African-American", "african
 * american" and "AFRICAN_AMERICAN" all reduce to the same lookup key, and the
 * enum's own members are their own keys for free.
 */
function key(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Every unmapped value seen, by field, with how many rows carried it. */
export type UnmappedReport = Map<string, Map<string, number>>

export function createUnmappedReport(): UnmappedReport {
  return new Map()
}

function recordUnmapped(report: UnmappedReport, field: string, value: string) {
  const forField = report.get(field) ?? new Map<string, number>()
  forField.set(value, (forField.get(value) ?? 0) + 1)
  report.set(field, forField)
}

/**
 * Builds a lookup from an enum's members plus a table of aliases.
 * Members map to themselves, so the canonical spelling always works and a
 * re-import of data this script itself wrote is a no-op.
 */
function buildTable<T extends string>(
  members: readonly T[],
  aliases: Record<string, T>,
): Map<string, T> {
  const table = new Map<string, T>()
  for (const member of members) table.set(key(member), member)
  for (const [alias, member] of Object.entries(aliases)) table.set(key(alias), member)
  return table
}

const GENDER = buildTable<Gender>(['MALE', 'FEMALE', 'OTHER'], {
  'M': 'MALE', 'MAN': 'MALE',
  'F': 'FEMALE', 'WOMAN': 'FEMALE',
  'NON BINARY': 'OTHER', 'NONBINARY': 'OTHER', 'ENBY': 'OTHER',
  'PREFER TO SELF DESCRIBE': 'OTHER',
})

const ETHNICITY = buildTable<Ethinicity>(
  [
    'WHITE', 'BLACK_OR_AFRICAN_AMERICAN', 'ALASKA_NATIVE', 'ASIAN',
    'NATIVE_HAWAIIAN_OR_OTHER_PACIFIC_ISLANDER',
    'MIDDLE_EASTERN_OR_NORTH_AFRICAN', 'HISPANIC',
  ],
  {
    'CAUCASIAN': 'WHITE',
    'BLACK': 'BLACK_OR_AFRICAN_AMERICAN',
    'AFRICAN AMERICAN': 'BLACK_OR_AFRICAN_AMERICAN',
    'LATINO': 'HISPANIC', 'LATINA': 'HISPANIC', 'LATINX': 'HISPANIC',
    'HISPANIC OR LATINO': 'HISPANIC',
    'PACIFIC ISLANDER': 'NATIVE_HAWAIIAN_OR_OTHER_PACIFIC_ISLANDER',
    'NATIVE HAWAIIAN': 'NATIVE_HAWAIIAN_OR_OTHER_PACIFIC_ISLANDER',
    'AMERICAN INDIAN OR ALASKA NATIVE': 'ALASKA_NATIVE',
    'NATIVE AMERICAN': 'ALASKA_NATIVE',
    'MENA': 'MIDDLE_EASTERN_OR_NORTH_AFRICAN',
    'MIDDLE EASTERN': 'MIDDLE_EASTERN_OR_NORTH_AFRICAN',
    'SOUTH ASIAN': 'ASIAN', 'EAST ASIAN': 'ASIAN',
  },
)

const LANGUAGE = buildTable<Language>(
  [
    'ENGLISH', 'SPANISH', 'FRENCH', 'GERMAN', 'CHINESE', 'JAPANESE', 'HINDI',
    'ARABIC', 'RUSSIAN', 'PORTUGUESE', 'ITALIAN', 'KOREAN', 'DUTCH', 'SWEDISH',
    'NORWEGIAN', 'DANISH', 'FINNISH', 'POLISH', 'TURKISH', 'GREEK', 'HEBREW',
    'VIETNAMESE', 'THAI', 'INDONESIAN', 'MALAY', 'FILIPINO',
  ],
  {
    ESPANOL: 'SPANISH', ESPAÑOL: 'SPANISH',
    MANDARIN: 'CHINESE', CANTONESE: 'CHINESE',
    TAGALOG: 'FILIPINO',
    ENG: 'ENGLISH', SPAN: 'SPANISH', SPA: 'SPANISH',
  },
)

const AVAILABILITY = buildTable<Availability>(
  [
    'WEEKDAY_MORNING', 'WEEKDAY_AFTERNOON', 'WEEKDAY_EVENING',
    'WEEKEND_MORNING', 'WEEKEND_AFTERNOON',
  ],
  {
    'WEEKDAY AM': 'WEEKDAY_MORNING', 'WEEKDAY PM': 'WEEKDAY_AFTERNOON',
    'WEEKEND AM': 'WEEKEND_MORNING', 'WEEKEND PM': 'WEEKEND_AFTERNOON',
    'WEEKDAYS MORNING': 'WEEKDAY_MORNING',
    'WEEKNIGHT': 'WEEKDAY_EVENING', 'WEEKDAY NIGHT': 'WEEKDAY_EVENING',
    'SATURDAY MORNING': 'WEEKEND_MORNING',
    'SUNDAY MORNING': 'WEEKEND_MORNING',
    'SATURDAY AFTERNOON': 'WEEKEND_AFTERNOON',
    'SUNDAY AFTERNOON': 'WEEKEND_AFTERNOON',
    // NOTE: no WEEKEND_EVENING member exists. "Saturday evening" and friends
    // are intentionally absent here so they surface as unmapped.
  },
)

const VOLUNTEER_AREA = buildTable<VolunteerArea>(
  [
    'CLINIC_SUPPORT', 'MOBILE_CLINIC_OUTREACH', 'EVENT_SUPPORT',
    'COMMUNITY_OUTREACH', 'ADMINISTRATIVE_TASKS', 'OTHER',
  ],
  {
    'CLINIC': 'CLINIC_SUPPORT', 'CLINIC VOLUNTEER': 'CLINIC_SUPPORT',
    'FRONT DESK': 'CLINIC_SUPPORT',
    'MOBILE CLINIC': 'MOBILE_CLINIC_OUTREACH', 'MOBILE': 'MOBILE_CLINIC_OUTREACH',
    'EVENTS': 'EVENT_SUPPORT', 'EVENT VOLUNTEER': 'EVENT_SUPPORT',
    'OUTREACH': 'COMMUNITY_OUTREACH', 'COMMUNITY': 'COMMUNITY_OUTREACH',
    'ADMIN': 'ADMINISTRATIVE_TASKS', 'ADMINISTRATIVE': 'ADMINISTRATIVE_TASKS',
    'OFFICE': 'ADMINISTRATIVE_TASKS', 'DATA ENTRY': 'ADMINISTRATIVE_TASKS',
  },
)

const CERTIFICATION = buildTable<Certification>(
  [
    'MEDICAL_CODING', 'DOULA_CERTIFICATION', 'CDL', 'CHILDBIRTH_EDUCATOR',
    'CERTIFIED_TEACHER_EDUCATOR', 'IBCLC', 'GRAPHIC_DESIGN', 'OTHER',
  ],
  {
    'DOULA': 'DOULA_CERTIFICATION',
    'MEDICAL CODER': 'MEDICAL_CODING', 'CODING': 'MEDICAL_CODING',
    'COMMERCIAL DRIVERS LICENSE': 'CDL', 'CDL A': 'CDL', 'CDL B': 'CDL',
    'LACTATION CONSULTANT': 'IBCLC',
    'CHILDBIRTH EDUCATION': 'CHILDBIRTH_EDUCATOR',
    'TEACHER': 'CERTIFIED_TEACHER_EDUCATOR',
    'DESIGN': 'GRAPHIC_DESIGN', 'GRAPHIC DESIGNER': 'GRAPHIC_DESIGN',
  },
)

const TABLES = {
  gender: GENDER,
  ethnicity: ETHNICITY,
  language: LANGUAGE,
  availability: AVAILABILITY,
  volunteerArea: VOLUNTEER_AREA,
  certification: CERTIFICATION,
} as const

export type MappableField = keyof typeof TABLES

/**
 * Maps one value, or returns undefined and records it as unmapped.
 * Blank input is not a failure — it just means the source had nothing to say.
 */
export function mapEnum<F extends MappableField>(
  field: F,
  value: string | undefined | null,
  report: UnmappedReport,
): string | undefined {
  if (value === undefined || value === null) return undefined
  const trimmed = String(value).trim()
  if (!trimmed) return undefined

  const mapped = TABLES[field].get(key(trimmed))
  if (!mapped) {
    recordUnmapped(report, field, trimmed)
    return undefined
  }
  return mapped
}

/** `mapEnum` over a list, dropping (and recording) whatever doesn't map. */
export function mapEnumList<F extends MappableField>(
  field: F,
  values: readonly string[] | undefined,
  report: UnmappedReport,
): string[] {
  if (!values?.length) return []
  const mapped = values
    .map(value => mapEnum(field, value, report))
    .filter((value): value is string => value !== undefined)
  // De-duplicated because the join tables are keyed on (volunteerId, value):
  // two source spellings collapsing to one member would otherwise collide.
  return [...new Set(mapped)]
}

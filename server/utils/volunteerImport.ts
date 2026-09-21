/**
 * Turns a volunteer-application CSV export into the rows this schema stores.
 *
 * Everything here is pure: text in, a plan out. Nothing touches the database,
 * so the `/ingest` endpoint can run the exact same code for the preview and
 * for the commit, and the preview an admin approves is the import that runs.
 *
 * The shape it targets is the Monday.com volunteer application form, which is
 * a different instrument from the in-app one in three ways that drive most of
 * this file:
 *
 *   - Race/ethnicity and languages are free text there and enums here. See
 *     `mapEthnicity` / `mapLanguages`; the words are kept verbatim on
 *     `Volunteer.ethinicityRaw` / `languagesRaw` either way.
 *   - Emergency contact is one box, not four. `parseEmergencyContacts` guesses
 *     the split and the original is kept on the application row.
 *   - The form changed over its life. Early submissions have no gender, no
 *     availability and no emergency contact at all, so "missing" is normal and
 *     is not reported as an error.
 *
 * Column names are matched on a keyword rather than the full question text —
 * the questions are paragraphs, one of them has a double space in it, and they
 * get reworded between form versions.
 */
import { ORG_TIME_ZONE } from '#shared/utils/timeZone'
import { zonedTime } from '#shared/utils/reportRange'
import { normalizeEmail } from '#server/utils/normalizeEmail'
import type { Gender, Ethinicity, Language, Availability, VolunteerArea, Certification } from '#server/utils/generated/prisma/client'

// --- Column resolution -----------------------------------------------------

/** Lower-cased, whitespace-collapsed, for matching a header by keyword. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * The logical fields, each with the keyword that identifies its column.
 *
 * `exact` is for the short names that would otherwise match inside a longer
 * question — "signature" appears in the middle of the code-of-conduct column's
 * value, and "gender" is short enough to be worth pinning.
 */
const COLUMN_MATCHERS = {
  firstName: { keyword: 'first name' },
  lastName: { keyword: 'last name' },
  phone: { keyword: 'phone number' },
  email: { keyword: 'email address' },
  gender: { keyword: 'gender', exact: true },
  ethnicity: { keyword: 'race' },
  volunteeredBefore: { keyword: 'have you volunteered' },
  attendedTraining: { keyword: 'have you attended' },
  trainingDate: { keyword: 'date you attended' },
  languages: { keyword: 'language(s) are you fluent' },
  areas: { keyword: 'what area(s)' },
  otherArea: { keyword: 'describe the work' },
  certifications: { keyword: 'certifications that could benefit' },
  otherCertification: { keyword: 'specific ideas or services' },
  availability: { keyword: 'your availability' },
  emergencyContact: { keyword: 'emergency contact' },
  ageEligibility: { keyword: 'over 18 years of age' },
  healthSafety: { keyword: 'health and safety acknowledgement' },
  backgroundCheckConsent: { keyword: 'criminal background check' },
  ongoingEducationCommitment: { keyword: 'ongoing supervision' },
  acceptanceDiscretion: { keyword: 'at its discretion' },
  missionValues: { keyword: 'mission, vision, and values' },
  codeOfConduct: { keyword: 'code of conduct' },
  preferredTrainingDate: { keyword: 'prefer to attend volunteer training' },
  submittedAt: { keyword: 'created at', exact: true },
  signature: { keyword: 'signature', exact: true },
  submissionLink: { keyword: 'submission link' },
} as const satisfies Record<string, { keyword: string, exact?: boolean }>

export type ColumnKey = keyof typeof COLUMN_MATCHERS

/** Logical field → the header that supplies it, for the headers actually present. */
export type ColumnMap = Partial<Record<ColumnKey, string>>

export function resolveColumns(headers: string[]): ColumnMap {
  const normalized = headers.map(h => ({ header: h, key: normalizeHeader(h) }))
  const map: ColumnMap = {}

  for (const [field, matcher] of Object.entries(COLUMN_MATCHERS) as [ColumnKey, { keyword: string, exact?: boolean }][]) {
    const hit = matcher.exact
      ? normalized.find(h => h.key === matcher.keyword)
      : normalized.find(h => h.key.includes(matcher.keyword))
    if (hit) map[field] = hit.header
  }

  return map
}

// --- Scalar parsing --------------------------------------------------------

function cell(record: Record<string, string>, columns: ColumnMap, field: ColumnKey): string {
  const header = columns[field]
  if (!header) return ''
  return (record[header] ?? '').trim()
}

/** `Yes`/`No`; anything else — including blank — is "not answered", not "no". */
export function parseYesNo(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (v === 'yes' || v === 'y' || v === 'true') return true
  if (v === 'no' || v === 'n' || v === 'false') return false
  return null
}

/**
 * `Jan 21, 2025 6:02 PM` — a Monday.com timestamp, read as this org's wall
 * clock.
 *
 * Not `new Date(...)`: that reads an unzoned string in the *host's* zone, and
 * production runs in UTC, so an evening submission would land on the next day
 * and a December 31st one in the next year. `submittedAt` is what the reports
 * would bucket by, so the difference is visible.
 */
export function parseMondayTimestamp(value: string): Date | null {
  const match = /^([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?)?$/.exec(value.trim())
  if (!match) return null

  const [, monthName, day, year, hour, minute, meridiem] = match
  const month = MONTHS.indexOf(monthName!.slice(0, 3).toLowerCase()) + 1
  if (month === 0) return null

  let hours = hour ? Number(hour) % 12 : 0
  if (meridiem && meridiem.toLowerCase() === 'p') hours += 12

  const at = zonedTime(Number(year), month, Number(day), hours, ORG_TIME_ZONE)
  return new Date(at.getTime() + Number(minute ?? 0) * 60_000)
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * The training-attended column, which arrives as a bare `YYYY-MM-DD` and means
 * a calendar date here — the same trap `parseZonedDate` exists for.
 */
export function parseIsoDateInOrgZone(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return zonedTime(Number(match[1]), Number(match[2]), Number(match[3]), 0, ORG_TIME_ZONE)
}

/**
 * `14694329400` → `469-432-9400`, the format already in the `users.phone`
 * column. A leading US country code is dropped; anything that isn't a plain
 * 10-digit number after that is kept as typed rather than mangled.
 */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length !== 10) return trimmed

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

// --- Multi-select columns --------------------------------------------------

/** Option labels normalised for comparison: lower-cased, punctuation and spacing flattened. */
function optionKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildLookup<T extends string>(entries: [string, T][]): Map<string, T> {
  return new Map(entries.map(([label, value]) => [optionKey(label), value]))
}

/**
 * The exact option text each form offers. These are the labels in
 * `app/types/volunteer/volunteer-application.type.ts`, which is where the
 * in-app form gets them, plus the wordings the Monday form used.
 */
const AREA_LOOKUP = buildLookup<VolunteerArea>([
  ['Clinic Support (Volunteers will not be seeing clients)', 'CLINIC_SUPPORT'],
  ['Clinic Support', 'CLINIC_SUPPORT'],
  ['Mobile Clinic Outreach', 'MOBILE_CLINIC_OUTREACH'],
  ['Event Support', 'EVENT_SUPPORT'],
  ['Community Outreach', 'COMMUNITY_OUTREACH'],
  ['Administrative Tasks', 'ADMINISTRATIVE_TASKS'],
  ['Other', 'OTHER'],
])

const CERTIFICATION_LOOKUP = buildLookup<Certification>([
  ['Medical Coding', 'MEDICAL_CODING'],
  ['Doula Certification', 'DOULA_CERTIFICATION'],
  ['CDL (Commercial Driver\'s License)', 'CDL'],
  ['CDL', 'CDL'],
  ['Childbirth Educator', 'CHILDBIRTH_EDUCATOR'],
  ['Certified Teacher/Educator', 'CERTIFIED_TEACHER_EDUCATOR'],
  ['Certified Teacher / Educator', 'CERTIFIED_TEACHER_EDUCATOR'],
  ['IBCLC', 'IBCLC'],
  ['Graphic Design', 'GRAPHIC_DESIGN'],
  ['Other', 'OTHER'],
])

const AVAILABILITY_LOOKUP = buildLookup<Availability>([
  ['Weekday Mornings (before 12 pm)', 'WEEKDAY_MORNING'],
  ['Weekday Afternoons (12-4 pm)', 'WEEKDAY_AFTERNOON'],
  ['Weekday Evenings (4-8 pm)', 'WEEKDAY_EVENING'],
  ['Weekend Mornings (before 12 pm)', 'WEEKEND_MORNING'],
  ['Weekend Afternoons (12-4 pm)', 'WEEKEND_AFTERNOON'],
])

const GENDER_LOOKUP = buildLookup<Gender>([
  ['Male', 'MALE'],
  ['Female', 'FEMALE'],
  ['Other', 'OTHER'],
  ['Non-binary', 'OTHER'],
])

/**
 * Splits a Monday multi-select cell.
 *
 * The separator is ", " — a comma *with* a space — because one of the options
 * contains a comma of its own ("Clinic Support (Volunteers will not be seeing
 * clients)" does not, but "CDL (Commercial Driver's License)" is the kind of
 * label that will), and splitting on a bare comma is what breaks first when a
 * new option is added.
 */
function splitOptions(value: string): string[] {
  return value.split(/,\s+/).map(v => v.trim()).filter(Boolean)
}

interface OptionResult<T> { values: T[], unmatched: string[] }

function mapOptions<T extends string>(value: string, lookup: Map<string, T>): OptionResult<T> {
  const values: T[] = []
  const unmatched: string[] = []

  for (const option of splitOptions(value)) {
    const mapped = lookup.get(optionKey(option))
    if (!mapped) {
      unmatched.push(option)
      continue
    }
    if (!values.includes(mapped)) values.push(mapped)
  }

  return { values, unmatched }
}

export const mapAreas = (value: string) => mapOptions(value, AREA_LOOKUP)
export const mapCertifications = (value: string) => mapOptions(value, CERTIFICATION_LOOKUP)
export const mapAvailability = (value: string) => mapOptions(value, AVAILABILITY_LOOKUP)

export function mapGender(value: string): Gender | null {
  return GENDER_LOOKUP.get(optionKey(value)) ?? null
}

// --- Free text: ethnicity --------------------------------------------------

/**
 * Categories detectable in a free-text race/ethnicity answer.
 *
 * `NATIVE` has no member in `Ethinicity` (the enum has ALASKA_NATIVE, which is
 * a specific thing and not what "American Indian" or "Indigenous" means), so on
 * its own it resolves to OTHER. It still counts towards the multiple-category
 * test, which is the point: "Black/Indigenous" is two categories and should
 * read as TWO_OR_MORE, not as Black.
 */
const ETHNICITY_PATTERNS: [RegExp, Ethinicity | 'NATIVE'][] = [
  // Ordered: the long forms first, so "american indian" is not read as "indian".
  [/\b(american indian|native american|indigenous|first nations)\b/, 'NATIVE'],
  [/\b(alaska native|alaskan)\b/, 'ALASKA_NATIVE'],
  [/\b(black|african[ -]?american|afro[ -]?american|african)\b/, 'BLACK_OR_AFRICAN_AMERICAN'],
  [/\b(white|caucasian|european)\b/, 'WHITE'],
  [/\b(hispanic|latino|latina|latinx|mexican|chicano|puerto rican)\b/, 'HISPANIC'],
  [/\b(middle eastern|north african|persian|iranian|arab|lebanese|egyptian|turkish)\b/, 'MIDDLE_EASTERN_OR_NORTH_AFRICAN'],
  [/\b(pacific islander|native hawaiian|samoan|polynesian)\b/, 'NATIVE_HAWAIIAN_OR_OTHER_PACIFIC_ISLANDER'],
  [/\b(asian|indian|desi|korean|chinese|japanese|filipino|vietnamese|bangladeshi|pakistani|nepali|aapi|thai)\b/, 'ASIAN'],
]

/** Answers that say "more than one" without naming the categories. */
const MIXED_PATTERN = /\b(two or more|multiracial|multi[ -]?racial|biracial|bi[ -]?racial|mixed)\b/

export interface EthnicityResult {
  /** The enum value to store, or null for a blank answer. */
  value: Ethinicity | null
  /** True when nothing in the answer was recognised and it fell back to OTHER. */
  unrecognised: boolean
}

/**
 * Reads a free-text race/ethnicity answer onto the enum.
 *
 * Naming two or more categories gives TWO_OR_MORE rather than whichever was
 * matched first — "African American and White" is not a White volunteer. An
 * answer with nothing recognisable in it gives OTHER and is reported, because
 * in the first export those were four people who typed the *city they live in*
 * and one who wrote "Non hispanic", none of which is an ethnicity. The words
 * are kept on `ethinicityRaw` regardless, so a wrong guess here is visible and
 * fixable without re-importing.
 */
export function mapEthnicity(raw: string): EthnicityResult {
  const text = raw.toLowerCase().trim()
  if (!text) return { value: null, unrecognised: false }

  // "non-Hispanic" is a statement that a category does *not* apply, and it
  // appears as a qualifier ("Black/African American, non-Hispanic") as well as
  // an answer on its own. Left in, it reads as Hispanic and turns a
  // single-category answer into TWO_OR_MORE.
  let working = text.replace(/\bnon[- ]?hispanic\b/g, ' ')

  // Each match is cut out before the next pattern runs, so a phrase can only
  // count once: "American Indian" is Native, and must not also be read as
  // "Indian" and come back as two categories.
  const found = new Set<Ethinicity | 'NATIVE'>()
  for (const [pattern, category] of ETHNICITY_PATTERNS) {
    if (!pattern.test(working)) continue
    found.add(category)
    working = working.replace(pattern, ' ')
  }

  if (found.size > 1) return { value: 'TWO_OR_MORE', unrecognised: false }
  if (MIXED_PATTERN.test(text)) return { value: 'TWO_OR_MORE', unrecognised: false }

  if (found.size === 1) {
    const only = [...found][0]!
    // A category the enum can't name, alone: OTHER, with the words preserved.
    if (only === 'NATIVE') return { value: 'OTHER', unrecognised: false }
    return { value: only, unrecognised: false }
  }

  return { value: 'OTHER', unrecognised: true }
}

// --- Free text: languages --------------------------------------------------

/**
 * Language names the enum can name. Matched as substrings of each fragment, so
 * "Chinese (Mandarin)" and "intermediate spanish" both land.
 */
const LANGUAGE_PATTERNS: [RegExp, Language][] = [
  [/spanish|espa[nñ]ol/, 'SPANISH'],
  [/french|fran[cç]ais/, 'FRENCH'],
  [/german|deutsch/, 'GERMAN'],
  [/chinese|mandarin|cantonese/, 'CHINESE'],
  [/japanese/, 'JAPANESE'],
  [/hindi/, 'HINDI'],
  [/arabic/, 'ARABIC'],
  [/russian/, 'RUSSIAN'],
  [/portuguese/, 'PORTUGUESE'],
  [/italian/, 'ITALIAN'],
  [/korean/, 'KOREAN'],
  [/dutch/, 'DUTCH'],
  [/swedish/, 'SWEDISH'],
  [/norwegian/, 'NORWEGIAN'],
  [/danish/, 'DANISH'],
  [/finnish/, 'FINNISH'],
  [/polish/, 'POLISH'],
  [/turkish/, 'TURKISH'],
  [/greek/, 'GREEK'],
  [/hebrew/, 'HEBREW'],
  [/vietnamese/, 'VIETNAMESE'],
  [/thai/, 'THAI'],
  [/indonesian/, 'INDONESIAN'],
  [/malay(?!alam)/, 'MALAY'],
  [/filipino|tagalog/, 'FILIPINO'],
  [/english/, 'ENGLISH'],
]

/** "I don't speak one" said in the language box. Not an unmapped language. */
const NO_LANGUAGE_PATTERN = /^(n\/?a|none|no|not applicable|nil|-)$/i

/**
 * Languages that are real and named, but that `Language` has no member for.
 *
 * Recognising them by name — rather than treating every unmatched fragment as
 * a language — is what separates "this volunteer speaks Telugu and the enum
 * can't say so" from the prose people write in this box ("am working on getting
 * better"). The first sets OTHER and is worth an admin's attention; the second
 * is noise.
 *
 * Every entry here is a language someone in the volunteer body actually speaks.
 * Adding one to `Language` and removing it from this list is the upgrade path.
 */
const OTHER_LANGUAGE_PATTERNS: [RegExp, string][] = [
  [/telugu|telegu/, 'Telugu'],
  [/tamil/, 'Tamil'],
  [/malayalam|malaylam/, 'Malayalam'],
  [/gujarati/, 'Gujarati'],
  [/marathi/, 'Marathi'],
  [/punjabi/, 'Punjabi'],
  [/kannada/, 'Kannada'],
  [/bengali|bangla(?!desh)/, 'Bengali'],
  [/odia|oriya/, 'Odia'],
  [/nepali/, 'Nepali'],
  [/urdu/, 'Urdu'],
  [/farsi|persian|dari/, 'Farsi'],
  [/pashto/, 'Pashto'],
  [/amharic/, 'Amharic'],
  [/tigrinya/, 'Tigrinya'],
  [/somali/, 'Somali'],
  [/swahili/, 'Swahili'],
  [/yoruba|yourba/, 'Yoruba'],
  [/igbo/, 'Igbo'],
  [/twi|akan/, 'Twi'],
  [/afrikaans/, 'Afrikaans'],
  [/hmong/, 'Hmong'],
  [/khmer|cambodian/, 'Khmer'],
  [/lao/, 'Lao'],
  [/burmese/, 'Burmese'],
  [/creole|haitian/, 'Haitian Creole'],
  [/\basl\b|sign language/, 'American Sign Language'],
]

export interface LanguageResult {
  values: Language[]
  /** Languages named that the enum has no member for — these are why OTHER is set. */
  unmapped: string[]
  /** Fragments that named no language at all; prose, not data. */
  ignored: string[]
}

/**
 * Reads the free-text "what language(s)" answer onto the enum.
 *
 * Answers range from "Spanish" to "I'm not fluent but can speak Spanish about
 * 50 percent fluent and am working on getting better", so fragments are matched
 * by substring rather than equality, and anything naming no language is
 * dropped. A language the enum lacks (Telugu, Amharic, ASL, Yoruba, Farsi,
 * Bengali, Odia, Tamil, Malayalam, Gujarati, Urdu, Swahili, Afrikaans — twelve
 * volunteers speak Telugu alone) adds OTHER and is reported, so it can be read
 * back off `languagesRaw`.
 */
export function mapLanguages(raw: string): LanguageResult {
  const text = raw.trim()
  if (!text || NO_LANGUAGE_PATTERN.test(text)) return { values: [], unmapped: [], ignored: [] }

  const fragments = text.split(/[,;/&]|\band\b|\+|\n/).map(f => f.trim()).filter(Boolean)
  const values: Language[] = []
  const unmapped: string[] = []
  const ignored: string[] = []

  for (const fragment of fragments) {
    if (NO_LANGUAGE_PATTERN.test(fragment)) continue

    const lower = fragment.toLowerCase()
    const matched = LANGUAGE_PATTERNS.filter(([pattern]) => pattern.test(lower)).map(([, value]) => value)

    if (matched.length > 0) {
      for (const value of matched) {
        if (!values.includes(value)) values.push(value)
      }
      continue
    }

    const named = OTHER_LANGUAGE_PATTERNS.find(([pattern]) => pattern.test(lower))
    if (named) {
      if (!unmapped.includes(named[1])) unmapped.push(named[1])
      continue
    }

    ignored.push(fragment)
  }

  if (unmapped.length > 0 && !values.includes('OTHER')) values.push('OTHER')

  return { values, unmapped, ignored }
}

// --- Free text: emergency contact ------------------------------------------

export interface EmergencyContacts {
  name1: string | null
  phone1: string | null
  name2: string | null
  phone2: string | null
  /** True when there was text but no name and no phone could be read out of it. */
  unparsed: boolean
}

/** A US phone as people type it: `214-674-5129`, `(409) 454-2210`, `+1 2144542288`, `9133398853`. */
const PHONE_IN_TEXT = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.\-–]?\d{3}[\s.\-–]?\d{4}/

/** An answer that declines the question rather than failing to parse. */
const NO_CONTACT_PATTERN = /^(n\/?a|none|no one|nobody|unknown|i do not have one|i don't have one)$/i

/** Leading/trailing punctuation left behind once the phone is cut out of a line. */
function cleanName(text: string): string | null {
  const name = text
    .replace(/\s+/g, ' ')
    // Parentheses are not stripped as punctuation — "(mom)" is part of how
    // people write these, and taking the closing one off left "Konya Tyler (mom".
    // A bracket left dangling by the phone being cut out goes on the next line.
    .replace(/^[\s,:;.\-–—]+|[\s,:;.\-–—]+$/g, '')
    .replace(/\($/, '')
    .replace(/^\)/, '')
    .trim()
  if (!name || NO_CONTACT_PATTERN.test(name)) return null
  return name
}

interface Contact { name: string | null, phone: string | null }

function parseOneContact(line: string): Contact {
  const match = PHONE_IN_TEXT.exec(line)
  if (!match) return { name: cleanName(line), phone: null }

  const phone = normalizePhone(match[0])
  const name = cleanName(line.slice(0, match.index) + ' ' + line.slice(match.index + match[0].length))
  return { name, phone }
}

/**
 * Splits the single free-text emergency-contact box into the two name/phone
 * pairs the schema holds.
 *
 * This is a guess and is treated as one — the original text is kept on the
 * application row, because the formats have no rule to them:
 * `Amir Torabi, 256-249-8853`, `Hass Johnson (spouse) - 512-673-7401`,
 * `Kirsten Batson (mom) 214-674-5129`, a bare `9133398853`, a bare
 * `Harold morrel`, two contacts on two lines, or two numbers and an email on
 * one. A second contact is recognised by a line break, which is how the form
 * recorded one; two phone numbers on a single line are read as a second number
 * for the same person, not as a second person, since that is what they were.
 */
export function parseEmergencyContacts(raw: string): EmergencyContacts {
  const text = raw.trim()
  // Blank, or an explicit "I don't have one" — both are answered questions,
  // not parse failures, and flagging them would train admins to skim the
  // warnings they do need to read.
  if (!text || NO_CONTACT_PATTERN.test(text)) {
    return { name1: null, phone1: null, name2: null, phone2: null, unparsed: false }
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const first = parseOneContact(lines[0] ?? '')
  let second = lines.length > 1 ? parseOneContact(lines.slice(1).join(' ')) : { name: null, phone: null }

  // A name on one line and a number on the next is one contact typed across two
  // lines — much more common in this data than a genuine second contact, which
  // repeats the shape (name *and* number) on both lines.
  if (first.name && !first.phone && second.phone && !second.name) {
    first.phone = second.phone
    second = { name: null, phone: null }
  }

  const unparsed = !first.name && !first.phone && !second.name && !second.phone

  return {
    name1: first.name,
    phone1: first.phone,
    name2: second.name,
    phone2: second.phone,
    unparsed,
  }
}

// --- Row → parsed submission ------------------------------------------------

/** One CSV row, read. `null` fields were blank; they are not defaults. */
export interface ParsedSubmission {
  /** 1-based row number in the file, header excluded — for reporting. */
  rowNumber: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  submittedAt: Date | null

  gender: Gender | null
  ethinicity: Ethinicity | null
  ethinicityRaw: string | null
  languages: Language[]
  languagesRaw: string | null
  availabilities: Availability[]
  volunteerAreas: VolunteerArea[]
  certifications: Certification[]
  otherVolunteerAreaDescription: string | null
  otherCertificationDescription: string | null

  emergency: EmergencyContacts
  emergencyContactRaw: string | null

  volunteeredBefore: boolean | null
  attendedTraining: boolean | null
  trainingDate: Date | null
  preferredTrainingDate: string | null

  ageEligibility: boolean | null
  healthSafety: boolean | null
  backgroundCheckConsent: boolean | null
  ongoingEducationCommitment: boolean | null
  acceptanceDiscretion: boolean | null
  missionValues: boolean | null

  codeOfConductSignatureURL: string | null
  signatureURL: string | null
  submissionLink: string | null

  rawRow: Record<string, string>
  /** Everything questionable about this row, in the admin's words. */
  warnings: string[]
  /** Why the row can't be imported at all, if it can't. */
  errors: string[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function blankToNull(value: string): string | null {
  return value.trim() ? value.trim() : null
}

export function parseSubmission(
  record: Record<string, string>,
  columns: ColumnMap,
  rowNumber: number,
): ParsedSubmission {
  const warnings: string[] = []
  const errors: string[] = []
  const get = (field: ColumnKey) => cell(record, columns, field)

  const email = normalizeEmail(get('email'))
  if (!email) errors.push('No email address — there is nothing to key the volunteer on.')
  else if (!EMAIL_PATTERN.test(email)) errors.push(`"${email}" is not a usable email address.`)

  const submittedAtRaw = get('submittedAt')
  const submittedAt = parseMondayTimestamp(submittedAtRaw)
  if (submittedAtRaw && !submittedAt) {
    errors.push(`Could not read the submission date "${submittedAtRaw}".`)
  }
  else if (!submittedAtRaw) {
    errors.push('No submission date — it is half of the key that stops a re-import duplicating rows.')
  }

  const ethnicityRaw = get('ethnicity')
  const ethnicity = mapEthnicity(ethnicityRaw)
  if (ethnicity.unrecognised) {
    warnings.push(`Ethnicity "${ethnicityRaw}" matched no category; stored as OTHER with the original text.`)
  }

  const languagesRaw = get('languages')
  const languages = mapLanguages(languagesRaw)
  if (languages.unmapped.length > 0) {
    warnings.push(`No enum member for ${languages.unmapped.join(', ')}; stored as OTHER with the original text.`)
  }
  // Prose in the language box is only worth reporting when it was the whole
  // answer — otherwise it's the tail of a sentence that already yielded a
  // language, and flagging it would bury the warnings that matter.
  if (languages.ignored.length > 0 && languages.values.length === 0) {
    warnings.push(`No language recognised in "${languagesRaw}"; none recorded.`)
  }

  const areas = mapAreas(get('areas'))
  if (areas.unmatched.length > 0) {
    warnings.push(`Unrecognised volunteer area(s): ${areas.unmatched.map(a => `"${a}"`).join(', ')}.`)
  }

  const certifications = mapCertifications(get('certifications'))
  if (certifications.unmatched.length > 0) {
    warnings.push(`Unrecognised certification(s): ${certifications.unmatched.map(c => `"${c}"`).join(', ')}.`)
  }

  const availability = mapAvailability(get('availability'))
  if (availability.unmatched.length > 0) {
    warnings.push(`Unrecognised availability: ${availability.unmatched.map(a => `"${a}"`).join(', ')}.`)
  }

  const emergencyRaw = get('emergencyContact')
  const emergency = parseEmergencyContacts(emergencyRaw)
  if (emergency.unparsed) {
    warnings.push(`Could not read a name or number out of the emergency contact "${emergencyRaw}".`)
  }

  const trainingDateRaw = get('trainingDate')
  const trainingDate = parseIsoDateInOrgZone(trainingDateRaw)
  if (trainingDateRaw && !trainingDate) {
    warnings.push(`Could not read the training date "${trainingDateRaw}"; left empty.`)
  }

  return {
    rowNumber,
    email,
    firstName: blankToNull(get('firstName')),
    lastName: blankToNull(get('lastName')),
    phone: normalizePhone(get('phone')),
    submittedAt,

    gender: mapGender(get('gender')),
    ethinicity: ethnicity.value,
    ethinicityRaw: blankToNull(ethnicityRaw),
    languages: languages.values,
    languagesRaw: blankToNull(languagesRaw),
    availabilities: availability.values,
    volunteerAreas: areas.values,
    certifications: certifications.values,
    otherVolunteerAreaDescription: blankToNull(get('otherArea')),
    otherCertificationDescription: blankToNull(get('otherCertification')),

    emergency,
    emergencyContactRaw: blankToNull(emergencyRaw),

    volunteeredBefore: parseYesNo(get('volunteeredBefore')),
    attendedTraining: parseYesNo(get('attendedTraining')),
    trainingDate,
    preferredTrainingDate: blankToNull(get('preferredTrainingDate')),

    ageEligibility: parseYesNo(get('ageEligibility')),
    healthSafety: parseYesNo(get('healthSafety')),
    backgroundCheckConsent: parseYesNo(get('backgroundCheckConsent')),
    ongoingEducationCommitment: parseYesNo(get('ongoingEducationCommitment')),
    acceptanceDiscretion: parseYesNo(get('acceptanceDiscretion')),
    missionValues: parseYesNo(get('missionValues')),

    codeOfConductSignatureURL: blankToNull(get('codeOfConduct')),
    signatureURL: blankToNull(get('signature')),
    submissionLink: blankToNull(get('submissionLink')),

    rawRow: record,
    warnings,
    errors,
  }
}

// --- Grouping: submissions → one person ------------------------------------

/** The `Volunteer` column values an import would write for one person. */
export interface PlannedProfile {
  gender: Gender | null
  ethinicity: Ethinicity | null
  ethinicityRaw: string | null
  languagesRaw: string | null
  otherVolunteerAreaDescription: string | null
  otherCertificationDescription: string | null
  emergencyContactName1: string | null
  emergencyContactPhone1: string | null
  emergencyContactName2: string | null
  emergencyContactPhone2: string | null
  languages: Language[]
  availabilities: Availability[]
  volunteerAreas: VolunteerArea[]
  certifications: Certification[]
  approvalStatus: 'PENDING' | 'APPROVED'
}

export interface PlannedApplicant {
  email: string
  name: string | null
  phone: string | null
  profile: PlannedProfile
  /** Every submission from this address, newest first. All of them are stored. */
  submissions: ParsedSubmission[]
  warnings: string[]
}

export interface ImportPlan {
  applicants: PlannedApplicant[]
  /** Rows that can't be imported, with the reason. */
  rejected: ParsedSubmission[]
  /** Logical fields with no matching column in this file. */
  missingColumns: ColumnKey[]
  totalRows: number
}

/** The first non-null value, newest submission first. */
function latest<T>(submissions: ParsedSubmission[], pick: (s: ParsedSubmission) => T | null): T | null {
  for (const submission of submissions) {
    const value = pick(submission)
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

/** The values from the newest submission that answered this question at all. */
function latestSet<T>(submissions: ParsedSubmission[], pick: (s: ParsedSubmission) => T[]): T[] {
  for (const submission of submissions) {
    const values = pick(submission)
    if (values.length > 0) return values
  }
  return []
}

/**
 * Groups parsed rows by applicant and works out the profile each would get.
 *
 * One person, several submissions: the profile takes each field from the most
 * recent submission that *answered* it, rather than from the most recent
 * submission outright. The form gained questions over its life — gender,
 * availability and emergency contact did not exist for the first 63
 * submissions — so "newest row wins" would blank out a field someone filled in
 * later under an older row, and a plain union would resurrect answers they had
 * since changed. Every submission is still written as its own
 * `Volunteer_Application`; only the profile is collapsed.
 *
 * `approvalStatus` is APPROVED when any submission from that person reports
 * having attended a training session, and PENDING otherwise. That is a
 * self-reported field, so it grants access on the applicant's own word — the
 * alternative was staff re-clearing people who trained years ago, and a
 * rejection is one click in the approvals queue.
 */
export function planImport(records: Record<string, string>[], headers: string[]): ImportPlan {
  const columns = resolveColumns(headers)
  const missingColumns = (Object.keys(COLUMN_MATCHERS) as ColumnKey[]).filter(key => !columns[key])

  const parsed = records.map((record, index) => parseSubmission(record, columns, index + 1))
  const rejected = parsed.filter(p => p.errors.length > 0)
  const usable = parsed.filter(p => p.errors.length === 0)

  const byEmail = new Map<string, ParsedSubmission[]>()
  for (const submission of usable) {
    const group = byEmail.get(submission.email)
    if (group) group.push(submission)
    else byEmail.set(submission.email, [submission])
  }

  const applicants: PlannedApplicant[] = []

  for (const [email, group] of byEmail) {
    // Newest first — every `latest*` call below depends on this order.
    const submissions = [...group].sort(
      (a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    )

    const warnings: string[] = []
    if (submissions.length > 1) {
      warnings.push(`${submissions.length} submissions from this address; the profile uses the most recent answer to each question.`)
    }

    const first = latest(submissions, s => s.firstName)
    const last = latest(submissions, s => s.lastName)
    const name = [first, last].filter(Boolean).join(' ').trim() || null

    applicants.push({
      email,
      name,
      phone: latest(submissions, s => s.phone),
      submissions,
      warnings,
      profile: {
        gender: latest(submissions, s => s.gender),
        ethinicity: latest(submissions, s => s.ethinicity),
        ethinicityRaw: latest(submissions, s => s.ethinicityRaw),
        languagesRaw: latest(submissions, s => s.languagesRaw),
        otherVolunteerAreaDescription: latest(submissions, s => s.otherVolunteerAreaDescription),
        otherCertificationDescription: latest(submissions, s => s.otherCertificationDescription),
        emergencyContactName1: latest(submissions, s => s.emergency.name1),
        emergencyContactPhone1: latest(submissions, s => s.emergency.phone1),
        emergencyContactName2: latest(submissions, s => s.emergency.name2),
        emergencyContactPhone2: latest(submissions, s => s.emergency.phone2),
        languages: latestSet(submissions, s => s.languages),
        availabilities: latestSet(submissions, s => s.availabilities),
        volunteerAreas: latestSet(submissions, s => s.volunteerAreas),
        certifications: latestSet(submissions, s => s.certifications),
        approvalStatus: submissions.some(s => s.attendedTraining === true) ? 'APPROVED' : 'PENDING',
      },
    })
  }

  applicants.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))

  return { applicants, rejected, missingColumns, totalRows: records.length }
}

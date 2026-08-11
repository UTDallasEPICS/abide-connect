import * as z from 'zod'
import { Gender, Availability, Ethinicity, Language, VolunteerArea, Certification } from '#server/utils/generated/prisma/enums'
import type { InputMenuItem, AuthFormField } from '@nuxt/ui'

/**
 * Schema, step definitions and select options for the multi-step volunteer
 * application form (`app/pages/volunteer-application/`).
 *
 * The enum members are imported from the generated Prisma client rather than
 * redeclared, so the form's options and the database columns can't drift apart.
 * `*Items` arrays below turn each enum into `@nuxt/ui` menu items, keyed by the
 * raw enum value with a prettified label — the `id` must stay the raw value so
 * submissions are valid enum members.
 *
 * NOTE: `ethinicity` is misspelled consistently, matching the Prisma column.
 * Correcting it means a migration, not just a rename here.
 */
const volunteerApplicationSchema = z.object({
  languages: z.array(z.enum(Language), { message: "Please select at least one langauge." }),

  gender: z.enum(Gender, { message: "Please select your gender." }),

  ethinicity: z.enum(Ethinicity, { message: "Please select your ethinicity." }),

  availability: z.array(z.enum(Availability), { message: "Please select your avaliability." })
    .min(1),

  volunteerAreas: z.enum(VolunteerArea, { message: "Please select at least one area." })
    .array()
    .min(1)
    .default([]),

  otherVolunteerAreaDescription: z.string()
    .nullable()
    .optional(),

  certifications: z.enum(Certification)
    .array()
    .nullable()
    .default([]),

  otherCertificationDescription: z.string()
    .nullable()
    .optional(),

  emergencyContactName1: z.string({ message: "Please enter the name of your emergency contact."}),

  emergencyContactPhone1: z.string({ message: "Please enter the phone number of your emergency contact."}),

  emergencyContactName2: z.string().nullable().optional(),

  emergencyContactPhone2: z.string().nullable().optional(),

  ageEligibilityAcknowledgement: z.boolean({ message: 'You must confirm your eligibility' })
    .refine(v => v === true, { message: 'You must confirm your eligibility' }),

  healthSafetyAcknowledgement: z.boolean({ message: 'You must acknowledge the Health and Safety policy' })
    .refine(v => v === true, { message: 'You must acknowledge the Health and Safety policy' }),

  backgroundCheckConsent: z.boolean({ message: 'You must consent to the background check' })
    .refine(v => v === true, { message: 'You must consent to the background check' }),

  ongoingEducationCommitment: z.boolean({ message: 'You must acknowledge this commitment' })
    .refine(v => v === true, { message: 'You must acknowledge this commitment' }),

  acceptanceDiscretionAcknowledgement: z.boolean({ message: 'You must acknowledge the Health and Safety policy' })
    .refine(v => v === true, { message: 'You must acknowledge this statement' }),

  missionValuesAcknowledgement: z.boolean({ message: 'You must acknowledge the Health and Safety policy' })
    .refine(v => v === true, { message: 'You must acknowledge Abide\'s mission, vision, and values' }),

  codeOfConductNdaAcknowledgement: z.string({ message: 'You must acknowledge the Code of Conduct and NDA' }),

  volunteerHandbookAcknowledgement: z.string({ message: 'You must acknowledge the Volunteer Handbook' }),

})


export type VolunterApplicationSchema = z.output<typeof volunteerApplicationSchema>

/**
 * Per-step slices of the full schema, so each step validates only its own
 * fields and the user isn't shown errors for pages they haven't reached.
 *
 * Order matters — the form indexes into this array by step number:
 *   0. About you (demographics, availability, areas, certifications)
 *   1. Emergency contacts
 *   2. Legal acknowledgements
 *
 * `.pick()` strips anything not listed, so a field rendered by a step but
 * missing from its slice is silently dropped on submit rather than failing
 * validation. Adding a field to a step means adding it here too.
 */
export const volunteerApplicationStepSchemas = [

  volunteerApplicationSchema.pick({
    languages: true,
    gender: true,
    ethinicity: true,
    availability: true,
    volunteerAreas: true,
    otherVolunteerAreaDescription: true,
    certifications: true,
    otherCertificationDescription: true,
  }),

  volunteerApplicationSchema.pick({
    emergencyContactName1: true,
    emergencyContactPhone1: true,
    // Both step-2 forms render these, and `.pick()` strips anything it doesn't
    // list, so omitting them silently dropped the secondary contact on submit.
    emergencyContactName2: true,
    emergencyContactPhone2: true,
  }),


  volunteerApplicationSchema.pick({
    ageEligibilityAcknowledgement: true,
    healthSafetyAcknowledgement: true,
    backgroundCheckConsent: true,
    ongoingEducationCommitment: true,
    acceptanceDiscretionAcknowledgement: true,
    missionValuesAcknowledgement: true,
    codeOfConductNdaAcknowledgement: true,
    volunteerHandbookAcknowledgement: true,
  }),

] as const


/** `HEALTH_AND_SAFETY` → `Health and Safety` — minor words stay lowercase. */
function formatEnumLabel(value: string): string {
  const minorWords = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'to', 'in', 'on'])
  return value
    .toLowerCase()
    .split('_')
    .map((word, index) => {
      if (index !== 0 && minorWords.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export const languageItems: InputMenuItem[] = Object.values(Language).map(language => ({
  id: language,
  label: formatEnumLabel(language),
}))

export const genderItems: InputMenuItem[] = Object.values(Gender).map(gender => ({
  id: gender,
  label: formatEnumLabel(gender),
}))

export const ethinicityItems: InputMenuItem[] = Object.values(Ethinicity).map(e => ({
  id: e,
  label: formatEnumLabel(e),
}))

export const availabilityItems: InputMenuItem[] = Object.values(Availability).map(a => ({
  id: a,
  label: formatEnumLabel(a),
}))

export const volunteerAreaItems: InputMenuItem[] = [
  { id: 'CLINIC_SUPPORT', label: 'Clinic Support (Volunteers will not be seeing clients)' },
  { id: 'MOBILE_CLINIC_OUTREACH', label: 'Mobile Clinic Outreach' },
  { id: 'EVENT_SUPPORT', label: 'Event Support' },
  { id: 'COMMUNITY_OUTREACH', label: 'Community Outreach' },
  { id: 'ADMINISTRATIVE_TASKS', label: 'Administrative Tasks' },
  { id: 'OTHER', label: 'Other' },
]

export const certificationItems: InputMenuItem[] = [
  { id: 'MEDICAL_CODING', label: 'Medical Coding' },
  { id: 'DOULA_CERTIFICATION', label: 'Doula Certification' },
  { id: 'CDL', label: 'CDL (Commercial Driver\'s License)' },
  { id: 'CHILDBIRTH_EDUCATOR', label: 'Childbirth Educator' },
  { id: 'CERTIFIED_TEACHER_EDUCATOR', label: 'Certified Teacher / Educator' },
  { id: 'IBCLC', label: 'IBCLC' },
  { id: 'GRAPHIC_DESIGN', label: 'Graphic Design' },
  { id: 'OTHER', label: 'Other' },
]

export const volunteerApplicationSteps: AuthFormField[][] = [
  [
    {
      name: 'languages',
      label: 'Languages',
      type: 'select',
      placeholder: 'What languages do you speak?',
      required: true,
      items: languageItems,
      valueKey: 'id',
      multiple: true,
    },
    {
      name: 'gender',
      label: 'Gender',
      type: 'select',
      placeholder: 'What is your gender?',
      required: true,
      items: genderItems,
      valueKey: 'id',
    },
    {
      name: 'ethinicity',
      label: 'Ethinicity',
      type: 'select',
      placeholder: 'What is your ethinicity?',
      required: true,
      items: ethinicityItems,
      valueKey: 'id',
    },
    {
      name: 'availability',
      label: 'Availability',
      type: 'select',
      placeholder: 'What is your availability?',
      required: true,
      items: availabilityItems,
      valueKey: 'id',
      multiple: true,
    },
    {
      name: 'volunteerAreas',
      label: 'What area(s) would you like to assist with as a volunteer?',
      type: 'select',
      placeholder: 'Select all that apply',
      required: false,
      items: volunteerAreaItems,
      valueKey: 'id',
      multiple: true,
    },
    {
      name: 'otherVolunteerAreaDescription',
      label: 'If "Other", please describe the work you\'d like to volunteer for',
      type: 'textarea',
      placeholder: 'Describe the work you\'d like to volunteer for',
    },
    {
      name: 'certifications',
      label: 'Do you hold any certifications that could benefit our work?',
      type: 'select',
      placeholder: 'Select all that apply',
      items: certificationItems,
      valueKey: 'id',
      required: false,
      multiple: true,
    },
    {
      name: 'otherCertificationDescription',
      required: false,
      label: 'If "Other", do you have any specific ideas or services you would like to propose for collaboration?',
      type: 'textarea',
      placeholder: 'Describe your proposed collaboration',
    },
  ],

  [
    {
      name: 'emergencyContactName1',
      label: 'Primary Emergency Contact Name',
      type: 'text',
      placeholder: 'Full Name',
      required: true,
    },
    {
      name: 'emergencyContactPhone1',
      label: 'Primary Emergency Contact Phone Number',
      type: 'tel',
      placeholder: 'Phone Number',
      required: true,
    },
    {
      name: 'emergencyContactName2',
      label: 'Secondary Emergency Contact Name',
      type: 'text',
      placeholder: 'Full Name',
      required: false,
    },
    {
      name: 'emergencyContactPhone2',
      label: 'Secondary Emergency Contact Phone Number',
      type: 'tel',
      placeholder: 'Phone Number',
      required: false,
    },
  ],

  [
    {
      name: 'codeOfConductNdaAcknowledgement',
      label: 'Code of Conduct and Confidentiality/NDA Acknowledgement',
      placeholder: 'Enter your name',
      required: true,
    },
    {
      name: 'volunteerHandbookAcknowledgement',
      label: 'Volunteer Handbook Acknowledgement',
      description: 'I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the Volunteer Handbook.',
      placeholder: 'Enter your name',
      required: true,
    },
    {
      name: 'healthSafetyAcknowledgement',
      label: "Health and Safety Acknowledgement",
      description: 'As a volunteer with Abide Women\u2019s Health Services, I understand that I am expected to uphold all health and safety protocols to protect the well-being of clients, staff, and fellow volunteers. I agree to stay home if I am ill, practice proper hygiene, use personal protective equipment when required, and report any incidents, unsafe conditions, or health concerns promptly. I understand my responsibility to follow emergency procedures, respect client confidentiality, and maintain professional, nonjudgmental conduct at all times. I acknowledge that failure to comply with these guidelines may result in termination of my volunteer service, and I agree to stay informed of any policy updates provided by Abide.',
      type: 'checkbox',
      required: true,
    },
    {
      name: 'missionValuesAcknowledgement',
      label: 'I have read Abide\'s mission, vision, and values and understand that Abide is led and run by BIPOC and will always be centered around BIPOC.',
      description: "Our mission can be found at www.abidewomen.org/about",
      type: 'checkbox',
      required: true,
    },
    {
      name: 'ageEligibilityAcknowledgement',
      label: 'I am over 18 years of age. If I am not over 18, I can provide a parent/guardian consent.',
      type: 'checkbox',
      required: true,
    },
    {
      name: 'backgroundCheckConsent',
      label: 'I consent to a Criminal Background Check conducted by the Texas Department of Safety.',
      type: 'checkbox',
      required: true,
    },
    {
      name: 'ongoingEducationCommitment',
      label: 'I am committed to participating in ongoing supervision and continuing education training, working collaboratively with staff, and following all agency-approved guidelines.',
      type: 'checkbox',
      required: true,
    },
    {
      name: 'acceptanceDiscretionAcknowledgement',
      label: 'I understand and agree that Abide Women\u2019s Health Services may, at its discretion, choose not to accept an individual as a volunteer if it is believed that their participation may not be in the best interest of our clients or the program. In such instances, Abide Women\u2019s Health Services is not obligated to provide a specific reason.',
      type: 'checkbox',
      required: true,
    },
  ],

] as unknown as AuthFormField[][]
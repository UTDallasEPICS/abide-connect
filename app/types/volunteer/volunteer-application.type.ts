import * as z from 'zod'
import { Gender, Availability, Ethinicity, Language } from '#server/utils/generated/prisma/enums'
import type { InputMenuItem, AuthFormField } from '@nuxt/ui'

// TODO: move these into your Prisma schema as real enums (VolunteerArea, Certification)
// and import them from '#server/utils/generated/prisma/enums' like the others once generated.
const VolunteerArea = [
  'CLINIC_SUPPORT',
  'MOBILE_CLINIC_OUTREACH',
  'EVENT_SUPPORT',
  'COMMUNITY_OUTREACH',
  'ADMINISTRATIVE_TASKS',
  'OTHER',
] as const

const Certification = [
  'MEDICAL_CODING',
  'DOULA_CERTIFICATION',
  'CDL',
  'CHILDBIRTH_EDUCATOR',
  'CERTIFIED_TEACHER_EDUCATOR',
  'IBCLC',
  'GRAPHIC_DESIGN',
  'OTHER',
] as const

const yesNoItems: InputMenuItem[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
]

// =====================
// FULL APPLICATION SCHEMA
// =====================

// Unrefined base — kept separate from the exported schema because
// .superRefine() returns a ZodEffects, which doesn't support .pick().
// Step 1's schema needs the same OTHER-description check below, so both
// the full schema and step 1 apply it on top of this shared base.
const baseVolunteerApplicationSchema = z.object({

  languages: z.array(z.enum(Language), { message: "Please select at least one langauge." }),

  gender: z.enum(Gender, { message: "Please select your gender." }),

  ethinicity: z.enum(Ethinicity, { message: "Please select your ethinicity." }),

  availability: z.array(z.enum(Availability), { message: "Please select your avaliability." })
    .min(1),

  volunteerAreas: z.enum(VolunteerArea, { message: "Please select at least one area." })
    .array()
    .min(1),

  otherVolunteerAreaDescription: z.string()
    .nullable()
    .optional(),

  certifications: z.enum(Certification)
    .array()
    .nullable()
    .default([] ),

  otherCertificationDescription: z.string()
    .nullable()
    .optional(),

  emergencyContactName: z.string({ message: "Please enter the name of your emergency contact."}),

  emergencyContactPhone: z.string({ message: "Please enter the phone number of your emergency contact."}),

  ageEligibilityAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must confirm your eligibility',
      }),

  healthSafetyAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge the Health and Safety policy',
      }),

  backgroundCheckConsent:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must consent to the background check',
      }),

  ongoingEducationCommitment:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge this commitment',
      }),

  acceptanceDiscretionAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge this statement',
      }),

  missionValuesAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge Abide\'s mission, vision, and values',
      }),

  codeOfConductNdaAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge the Code of Conduct and NDA',
      }),

  volunteerHandbookAcknowledgement:
    z.enum(['yes', 'no'])
      .refine(v => v === 'yes', {
        message: 'You must acknowledge the Volunteer Handbook',
      }),

})

// Cross-field check: if "OTHER" is picked in volunteerAreas/certifications,
// the matching description field must be filled in. Both fields live in
// step 1, so this is reused by the full schema and by step 1's schema.
function applyOtherDescriptionChecks(
  data: Pick<
    z.infer<typeof baseVolunteerApplicationSchema>,
    | 'volunteerAreas'
    | 'otherVolunteerAreaDescription'
    | 'certifications'
    | 'otherCertificationDescription'
  >,
  ctx: z.RefinementCtx,
) {
  if (data.volunteerAreas?.includes('OTHER') && !data.otherVolunteerAreaDescription?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['otherVolunteerAreaDescription'],
      message: 'Please describe the work you\'d like to volunteer for',
    })
  }
  if (data.certifications?.includes('OTHER') && !data.otherCertificationDescription?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['otherCertificationDescription'],
      message: 'Please describe your proposed collaboration',
    })
  }
}

export const volunterApplicationSchema = baseVolunteerApplicationSchema.superRefine(applyOtherDescriptionChecks)

export type VolunterApplicationSchema = z.output<typeof volunterApplicationSchema>

// =====================
// STEP VALIDATION SCHEMAS
// =====================

export const volunteerApplicationStepSchemas = [

  baseVolunteerApplicationSchema.pick({
    languages: true,
    gender: true,
    ethinicity: true,
    availability: true,
    volunteerAreas: true,
    otherVolunteerAreaDescription: true,
    certifications: true,
    otherCertificationDescription: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
  }).superRefine(applyOtherDescriptionChecks),

  baseVolunteerApplicationSchema.pick({
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

// =====================
// LABELS / ITEMS
// =====================

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

const languageItems: InputMenuItem[] = Object.values(Language).map(language => ({
  id: language,
  label: formatEnumLabel(language),
}))

const genderItems: InputMenuItem[] = Object.values(Gender).map(gender => ({
  id: gender,
  label: formatEnumLabel(gender),
}))

const ethinicityItems: InputMenuItem[] = Object.values(Ethinicity).map(e => ({
  id: e,
  label: formatEnumLabel(e),
}))

const availabilityItems: InputMenuItem[] = Object.values(Availability).map(a => ({
  id: a,
  label: formatEnumLabel(a),
}))

const volunteerAreaItems: InputMenuItem[] = [
  { id: 'CLINIC_SUPPORT', label: 'Clinic Support (Volunteers will not be seeing clients)' },
  { id: 'MOBILE_CLINIC_OUTREACH', label: 'Mobile Clinic Outreach' },
  { id: 'EVENT_SUPPORT', label: 'Event Support' },
  { id: 'COMMUNITY_OUTREACH', label: 'Community Outreach' },
  { id: 'ADMINISTRATIVE_TASKS', label: 'Administrative Tasks' },
  { id: 'OTHER', label: 'Other' },
]

const certificationItems: InputMenuItem[] = [
  { id: 'MEDICAL_CODING', label: 'Medical Coding' },
  { id: 'DOULA_CERTIFICATION', label: 'Doula Certification' },
  { id: 'CDL', label: 'CDL (Commercial Driver\'s License)' },
  { id: 'CHILDBIRTH_EDUCATOR', label: 'Childbirth Educator' },
  { id: 'CERTIFIED_TEACHER_EDUCATOR', label: 'Certified Teacher / Educator' },
  { id: 'IBCLC', label: 'IBCLC' },
  { id: 'GRAPHIC_DESIGN', label: 'Graphic Design' },
  { id: 'OTHER', label: 'Other' },
]

// =====================
// FORM STEPS
// =====================

// Parallel to volunteerApplicationStepSchemas above — index i here must
// always correspond to index i there.
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
      required: true,
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
      multiple: true,
    },
    {
      name: 'otherCertificationDescription',
      label: 'If "Other", do you have any specific ideas or services you would like to propose for collaboration?',
      type: 'textarea',
      placeholder: 'Describe your proposed collaboration',
    },
  ],

  [
    {
      name: 'emergencyContactName',
      label: 'Emergency Contact Name',
      type: 'text',
      placeholder: 'Full name of your emergency contact',
      required: true,
    },
    {
      name: 'emergencyContactPhone',
      label: 'Emergency Contact Phone Number',
      type: 'tel',
      placeholder: 'Phone number of your emergency contact',
      required: true,
    },
  ],

  [
    {
      name: 'healthSafetyAcknowledgement',
      label: "Health and Safety Acknowledgement",
      description: 'As a volunteer with Abide Women\u2019s Health Services, I understand that I am expected to uphold all health and safety protocols to protect the well-being of clients, staff, and fellow volunteers. I agree to stay home if I am ill, practice proper hygiene, use personal protective equipment when required, and report any incidents, unsafe conditions, or health concerns promptly. I understand my responsibility to follow emergency procedures, respect client confidentiality, and maintain professional, nonjudgmental conduct at all times. I acknowledge that failure to comply with these guidelines may result in termination of my volunteer service, and I agree to stay informed of any policy updates provided by Abide.',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'ageEligibilityAcknowledgement',
      label: 'I am over 18 years of age. If I am not over 18, I can provide a parent/guardian consent.',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'missionValuesAcknowledgement',
      label: 'I have read Abide\'s mission, vision, and values and understand that Abide is led and run by BIPOC and will always be centered around BIPOC. Our mission can be found at www.abidewomen.org/about',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'backgroundCheckConsent',
      label: 'I consent to a Criminal Background Check conducted by the Texas Department of Safety.',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'ongoingEducationCommitment',
      label: 'I am committed to participating in ongoing supervision and continuing education training, working collaboratively with staff, and following all agency-approved guidelines.',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'acceptanceDiscretionAcknowledgement',
      label: 'I understand and agree that Abide Women\u2019s Health Services may, at its discretion, choose not to accept an individual as a volunteer if it is believed that their participation may not be in the best interest of our clients or the program. In such instances, Abide Women\u2019s Health Services is not obligated to provide a specific reason.',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'codeOfConductNdaAcknowledgement',
      label: 'Code of Conduct and Confidentiality/NDA Acknowledgement',
      type: 'select',
      placeholder: 'Select Yes or No',
      items: yesNoItems,
      valueKey: 'id',
      required: true,
    },
    {
      name: 'volunteerHandbookAcknowledgement',
      label: 'Volunteer Handbook Acknowledgement',
      description: 'I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the Volunteer Handbook.',
      placeholder: 'Enter your name',
      required: true,
    },
  ],

] as unknown as AuthFormField[][]
import * as z from "zod"
import type { AuthFormField } from "@nuxt/ui"

/* ------------------ SCHEMA ------------------ */
export const applicationSchema = z.object({
  hasVolunteered: z.string().optional(),
  attendedTraining: z.string().optional(),
  trainingDate: z.string().optional(),

  emergencyContact: z.string().optional(),

  // 🔥 FIX: convert YES/NO → boolean
  over18: z
    .union([z.boolean(), z.string()])
    .transform(val => val === true || val === "YES"),

  backgroundCheck: z.boolean().optional(),
  healthAcknowledgement: z.boolean().optional(),

  // optional checkboxes
  commitment: z.boolean().optional(),
  acceptance: z.boolean().optional(),
  missionAgreement: z.boolean().optional(),

  // other text fields
  nda: z.string().optional(),
  handbook: z.string().optional(),
  preferredTrainingDate: z.string().optional(),
})

export type ApplicationSchema = z.output<typeof applicationSchema>

/* ------------------ FIELDS ------------------ */
export const applicationFields: AuthFormField[] = ([
  {
    name: "firstName",
    label: "1. First Name",
    type: "text",
    required: true
  },
  {
    name: "lastName",
    label: "2. Last Name",
    type: "text",
    required: true
  },

  {
    name: "gender",
    label: "5. Gender",
    type: "text"
  },
  {
    name: "ethnicity",
    label: "6. Race/Ethnicity",
    type: "text"
  },

  {
    name: "hasVolunteered",
    label: "7. Have you volunteered with Abide before?",
    type: "select",
    items: [
      { id: "YES", label: "Yes" },
      { id: "NO", label: "No" }
    ],
    valueKey: "id"
  },
  {
    name: "attendedTraining",
    label: "8. Have you attended training?",
    type: "select",
    items: [
      { id: "YES", label: "Yes" },
      { id: "NO", label: "No" }
    ],
    valueKey: "id"
  },

  {
    name: "trainingDate",
    label: "9. Training Date",
    type: "text",
    placeholder: "MM/DD/YYYY"
  },

  {
    name: "otherLanguage",
    label: "10. Fluent in another language?",
    type: "select",
    items: [
      { id: "YES", label: "Yes" },
      { id: "NO", label: "No" }
    ],
    valueKey: "id"
  },

  {
    name: "languageDetails",
    label: "11. If yes, which language(s)?",
    type: "text"
  },

  {
    name: "volunteerAreas",
    label: "12. Areas you'd like to help with",
    type: "textarea"
  },

  {
    name: "otherWork",
    label: "13. If other, describe",
    type: "textarea"
  },

  {
    name: "certifications",
    label: "14. Certifications",
    type: "textarea"
  },

  {
    name: "collaborationIdeas",
    label: "15. Collaboration ideas",
    type: "textarea"
  },

  {
    name: "availability",
    label: "16. Availability",
    type: "textarea"
  },

  {
    name: "emergencyContact",
    label: "17. Emergency Contact Info",
    type: "textarea"
  },

  // 🔥 FIXED (still select, but now schema converts it)
  {
    name: "over18",
    label: "18. I am over 18",
    type: "select",
    items: [
      { id: "YES", label: "Yes" },
      { id: "NO", label: "No" }
    ],
    valueKey: "id"
  },

  {
    name: "healthAcknowledgement",
    label: "19. I agree to health & safety policies",
    type: "checkbox"
  },

  {
    name: "backgroundCheck",
    label: "20. I consent to a Criminal Background Check conducted by the Texas Department of Safety.",
    type: "checkbox"
  },

  {
    name: "commitment",
    label: "21. I am committed to participating in ongoing supervision...",
    type: "checkbox"
  },

  {
    name: "acceptance",
    label: "22. I understand and agree that Abide may choose not to accept...",
    type: "checkbox"
  },

  {
    name: "missionAgreement",
    label: "23. I have read Abide's mission...",
    type: "checkbox"
  },

  {
    name: "nda",
    label: "24. Code of Conduct and Confidentiality/NDA Acknowledgement",
    type: "text"
  },

  {
    name: "handbook",
    label: "25. Volunteer Handbook Acknowledgement",
    type: "text"
  },

  {
    name: "preferredTrainingDate",
    label: "26. Preferred training date",
    type: "text"
  }

] as unknown) as AuthFormField[]
import * as z from "zod"
import { Gender, Availability, Ethinicity, Language } from '~~/server/utils/prisma/enums'
import type { InputMenuItem, AuthFormField } from "@nuxt/ui"

export const signUpSchema = z.object({
    name: z.string().optional(),
    email: z.email('Invalid email'),
    password: z.string().min(8, "Must be at least 8 characters"),
    phone: z.e164('Invalid phone number').optional().nullable(),
    languages: z.array(z.enum(Language)).nullable(),
    gender: z.enum(Gender).nullable(),
    ethinicity: z.enum(Ethinicity).nullable(),
    availability: z.enum(Availability).array().nullable()
})

export type SignUpSchema = z.output<typeof signUpSchema>

function formatEnumLabel(value: string): string {
  const minorWords = new Set(["and", "or", "of", "the", "a", "an", "to", "in", "on"])
  const words = value
    .toString()
    .toLowerCase()
    .split("_")
    .map((word, index) => {
      if (index !== 0 && minorWords.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
  return words.join(" ")
}

const languageItems: InputMenuItem[] = Object.keys(Language).map((language) => ({
  id: language,
  label: formatEnumLabel(language),
}))
const genderItems: InputMenuItem[] = Object.keys(Gender).map((gender) => ({
  id: gender,
  label: formatEnumLabel(gender),
}))
const ethinicityItems: InputMenuItem[] = Object.keys(Ethinicity).map((ethinicity) => ({
  id: ethinicity,
  label: formatEnumLabel(ethinicity),
}))
const availabilityItems: InputMenuItem[] = Object.keys(Availability).map((availability) => ({
  id: availability,
  label: formatEnumLabel(availability),
}))

export const signUpFields: AuthFormField[] = ([{
  name: 'name',
  type: 'text',
  label: 'Name',
  placeholder: 'Enter your full name',
  required: false
},{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
},{
  name: 'phone',
  label: 'Phone',
  type: 'text',
  placeholder: 'Enter your US phone number',
  required: false
},{
  name: 'languages',
  label: 'Languages',
  type: 'select',
  placeholder: 'What languages do you speak?',
  required: true,
  items: languageItems,
  multiple: true        
}, {
  name: "gender",
  label: 'Gender',
  type: 'select',
  placeholder: "What is your gender?",
  items: genderItems,
  required: true
},{
  name: "ethinicity",
  label: 'Ethinicity',
  type: 'select',
  placeholder: "What is your ethinicity?",
  items: ethinicityItems,
  required: true
},{
  name: "availability",
  label: 'Availability',
  type: 'select',
  placeholder: "What is your availability?",
  items: availabilityItems,
  required: true,
  multiple: true
},] as unknown) as AuthFormField[]




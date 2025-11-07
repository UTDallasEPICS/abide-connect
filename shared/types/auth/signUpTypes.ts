import * as z from "zod"
import { Language, Ethinicity, Gender, Availability } from "@prisma/client"
import type { InputMenuItem } from "@nuxt/ui"
import type { AuthFormField } from "@nuxt/ui"

export const signUpSchema = z.object({
    name: z.string().optional(),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, "Must be at least 8 characters"),
    phone: z.string().regex(/^\+1\d{10}$/, "Invalid US phone number").optional(),
    languages: z.array(z.enum(Language)),
    gender: z.enum(Gender),
    ethinicity: z.enum(Ethinicity),
    availability: z.enum(Availability).array()
})

export type SignUpSchema = z.output<typeof signUpSchema>

const languageItems: InputMenuItem[] = Object.keys(Language).map((language) => ({
  id: language,
  label:
      language.toString().charAt(0).toUpperCase() +
      language.toString().slice(1).toLowerCase(),
}))
const genderItems: InputMenuItem[] = Object.keys(Gender).map((gender) => ({
  id: gender,
  label:
      gender.toString().charAt(0).toUpperCase() + gender.toString().slice(1).toLowerCase()
}))
const ethinicityItems: InputMenuItem[] = Object.keys(Ethinicity).map((ethinicity) => ({
  id: ethinicity,
  label:
      ethinicity.toString().charAt(0).toUpperCase() + ethinicity.toString().slice(1).toLowerCase()
}))
const availabilityItems: InputMenuItem[] = Object.keys(Availability).map((availability) => ({
  id: availability,
  label:
      availability.toString().charAt(0).toUpperCase() + availability.toString().slice(1).toLowerCase()
}))

export const signUpFields: AuthFormField[] = [{
  name: 'name',
  type: 'text',
  label: 'Name',
  placeholder: 'Enter your full name',
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
},]




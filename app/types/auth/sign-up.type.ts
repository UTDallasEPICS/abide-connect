import * as z from "zod"
import { Gender, Availability, Ethinicity, Language } from '~~/server/utils/generated/prisma/enums'
import type { InputMenuItem, AuthFormField } from "@nuxt/ui"

export const signUpSchema = z.object({
    email: z.email('Invalid email').optional(),
    password: z.string().min(8, "Must be at least 8 characters").optional(),
    phone: z.e164('Invalid phone number').optional().nullable(),
    languages: z.array(z.enum(Language)).nullable().optional(),
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

const languageItems: InputMenuItem[] = Object.values(Language).map((language) => ({
  id: language,
  label: formatEnumLabel(language),
}))


export const signUpFields: AuthFormField[] = ([{
  
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
  valueKey: 'id',
  items: languageItems,
  multiple: true        
},] as unknown) as AuthFormField[]




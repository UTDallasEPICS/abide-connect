import * as z from 'zod'
import type {  AuthFormField } from '@nuxt/ui'

export const signUpSchema = z.object({
  name: z.string().optional(),
  email: z.email('Invalid email'),
  phone: z.preprocess(val => {
    if (typeof val !== 'string' || !val) return val
    const digits = val.replace(/\D/g, '')
    return digits.length === 10 ? `+1${digits}` : `+${digits}`
  },
    z.e164('Invalid phone number')).optional().nullable(),
})

export type SignUpSchema = z.output<typeof signUpSchema>

export const signUpFields: AuthFormField[] = ([
  {
    name: 'name',
    type: 'text',
    label: 'Name',
    placeholder: 'Enter your full name',
    required: false,
  }, 
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
  }, 
  {
    name: 'phone',
    label: 'Phone',
    type: 'text',
    placeholder: 'Enter your US phone number',
    required: false,
  }, 
] as unknown) as AuthFormField[]

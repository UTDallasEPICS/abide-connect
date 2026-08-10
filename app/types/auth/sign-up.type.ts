import * as z from 'zod'
import type {  AuthFormField } from '@nuxt/ui'

/**
 * Validation and field definitions for the sign-up form.
 *
 * Only email is required — name and phone are optional, so an account can be
 * created from an email address alone and filled in later from /settings.
 *
 * Phone is normalised to E.164 before validation rather than being validated
 * as typed: users enter `(214) 555-0100` or `214-555-0100`, and a bare 10-digit
 * number is assumed to be US (`+1`). Anything longer is treated as already
 * carrying a country code. That US default is the one assumption to revisit if
 * Abide ever takes international volunteers.
 */
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

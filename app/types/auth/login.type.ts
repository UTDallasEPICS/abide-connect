import * as z from 'zod'
import type { AuthFormField } from '@nuxt/ui'

export const requestOtpSchema = z.object({
  email: z.email('Invalid email address'),
})

export type RequestOtpSchema = z.output<typeof requestOtpSchema>

export const requestOtpFields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
  },
]

export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers'),
})

export type VerifyOtpSchema = z.output<typeof verifyOtpSchema>

export const verifyOtpFields: AuthFormField[] = [
  {
    name: 'otp',
    type: 'text',
    label: 'Verification Code',
    placeholder: 'Enter the 6-digit code',
    required: true,
  },
]

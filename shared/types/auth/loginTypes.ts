import * as z from "zod"
import type { AuthFormField } from "@nuxt/ui"

export const loginSchema = z.object({
    email: z.email('Invalid email'),
    password: z.string().min(8, "Must be at least 8 characters")
})

export type LoginSchema = z.output<typeof loginSchema>

export const loginFields: AuthFormField[] = [{
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
  }, {
    name: 'remember',
    label: 'Remember me',
    type: 'checkbox'
  }]
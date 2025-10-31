import * as z from "zod"
import { Language } from "@prisma/client"
import type { AuthFormField } from "@nuxt/ui"

export const signUpFormSchema = z.object({
    name: z.string().optional(),
    email: z.email('Invalid email'),
    password: z.string().min(8, "Must be at least 8 characters"),
    phone: z.e164().optional(),
    language: z.enum(Language).array()
})

export type SignUpFormSchema = z.output<typeof signUpFormSchema>

export const loginFormSchema = z.object({
    email: z.email('Invalid email'),
    password: z.string('Password is incorrect').min(8, "Must be at least 8 characters")
})

export const loginFormFields: AuthFormField[] = [{
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

 export const providers = [{
    label: 'Google',
    icon: 'i-simple-icons-google',
    onClick: () => {}
  }, {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    onClick: () => {}
  }]
  


export type LoginFormSchema = z.output<typeof loginFormSchema>
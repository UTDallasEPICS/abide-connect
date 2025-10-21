import * as z from "zod"
import { Language } from "@prisma/client"

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

export type LoginFormSchema = z.output<typeof loginFormSchema>
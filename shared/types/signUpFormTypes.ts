import * as z from "zod"
import { languageEnum } from "~/../shared/enums/languageEnum"

export const signUpFormSchema = z.object({
    name: z.string().optional(),
    email: z.email('Invalid email'),
    password: z.string('Password is incorrect').min(8, "Must be at least 8 characters"),
    phone: z.string().check(z.length(10)).optional(),
    language: z.enum(languageEnum).array()
})

export type SignUpFormSchema = z.output<typeof signUpFormSchema>
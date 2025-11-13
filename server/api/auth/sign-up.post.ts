import {auth} from "~/../lib/auth"
import prisma from "~/../lib/prisma"
import { Language, Availability, Gender, Ethinicity } from "@prisma/client"
import { APIError } from "better-auth/api"

export default defineEventHandler(async (event) => {
    try {
        const {name, email, password, phone, languages, gender, ethinicity, availability} = await readBody(event)
        // Sign up user with better-auth
        const data = await auth.api.signUpEmail({body: {name, email, password}})

        // Create user and volunteer records in transaction
        await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    name: name as string | undefined,
                    contactEmail: email as string,
                    phone: phone as string | undefined,
                },
            })

            await tx.volunteer.update({
                where: { id: data.user.id },
                data: {
                    phone: phone as string,
                    userId: createdUser.id,
                    languages: {
                        create: languages?.map((language: Language) => ({
                                language: language,
                            })) || [],
                        },
                    availabilities: {
                        create: availability?.map((time: Availability) => ({
                                availability: time,
                            })) || [],
                        },
                    gender: gender as Gender,
                    ethinicity: ethinicity as Ethinicity,
                },
            });
        });

        return { success: true };
    } catch (error: any) {
        console.log(error);
        throw createError({
            statusCode: error.statusCode,
            statusMessage: error.body?.message || "An unexpected error occurred",
        });
    }
});

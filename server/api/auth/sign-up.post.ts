import {auth} from "~~/server/utils/auth"
import prisma from "~~/server/utils/prisma"
import type { Language, Availability } from '~~/server/utils/generated/prisma/client'

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
                    name: name as string | undefined,
                    phone: phone as string | undefined,
                    userId: createdUser.id,
                    languages: {
                        create: languages.map((language: Language) => ({
                                language: language as string,
                            })) || [],
                        },
                    availabilities: {
                        create: availability.map((time: Availability) => ({
                                availability: time as string,
                            })) || [],
                        },
                    gender: gender.id,
                    ethinicity: ethinicity.id,
                },
            });
        });

        return { success: true };
    } catch (error: unknown) {
        console.log(error);
        throw createError({
            statusCode: (error as { statusCode: number }).statusCode,
            statusMessage: (error as { body: { message: string} }).body?.message || "An unexpected error occurred",
        });
    }
});

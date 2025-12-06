import { auth } from "~~/server/utils/auth";
import prisma from "~~/server/utils/prisma";
import type { Language, Availability } from "~~/server/utils/generated/prisma/client";
import type { H3Event } from "h3";
import { appendHeader, setHeader } from "h3";

const forwardAuthHeaders = (event: H3Event, headers?: Headers) => {
    if (!headers) {
        return;
    }
    headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
            appendHeader(event, "set-cookie", value);
        } else {
            setHeader(event, key, value);
        }
    });
};

export default defineEventHandler(async (event) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            languages = [],
            gender,
            ethinicity,
            availability = [],
        } = await readBody(event);
        const selectedLanguages = languages as Language[];
        const selectedAvailability = availability as Availability[];
        // Sign up user with better-auth
        const { response, headers } = await auth.api.signUpEmail({
            body: { name, email, password },
            headers: event.headers,
            returnHeaders: true,
        });
        forwardAuthHeaders(event, headers);

        // Create user and volunteer records in transaction
        await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    name: name as string | undefined,
                    contactEmail: email as string,
                    phone: phone as string | undefined,
                },
            });

            await tx.volunteer.update({
                where: { id: response.user.id },
                data: {
                    name: name as string | undefined,
                    phone: phone as string | undefined,
                    userId: createdUser.id,
                    languages: {
                        create: selectedLanguages.map((language) => ({
                            language,
                        })),
                    },
                    availabilities: {
                        create: selectedAvailability.map((time) => ({
                            availability: time,
                        })),
                    },
                    gender: gender.id,
                    ethinicity: ethinicity.id,
                },
            });
        });

        return { success: true, user: response.user };
    } catch (error: unknown) {
        console.log(error);
        throw createError({
            statusCode: (error as { statusCode: number }).statusCode,
            statusMessage: (error as { body: { message: string} }).body?.message || "An unexpected error occurred",
        });
    }
});

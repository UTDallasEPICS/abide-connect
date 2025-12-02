import { auth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
    try {
        const { email, password } = await readBody(event);

        await auth.api.signInEmail({ body: { email, password }, headers: event.headers });
        
        return { success: true };
    } catch (error: unknown) {
        console.log(error);
        throw createError({
            statusCode: (error as { statusCode: number }).statusCode,
            statusMessage: (error as { body: { message: string} }).body?.message || "An unexpected error occurred",
        });
    }
});

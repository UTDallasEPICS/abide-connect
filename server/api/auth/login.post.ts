import { auth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
    try {
        const { email, password } = await readBody(event);

        await auth.api.signInEmail({ body: { email, password }, headers: event.headers });
        
        return { success: true };
    } catch (error: any) {
        console.log(error);
        throw createError({
            statusCode: error.statusCode,
            statusMessage: error.body?.message || "An unexpected error occurred",
        });
    }
});

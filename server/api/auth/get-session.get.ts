import { auth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
    const session = await auth.api.getSession({ headers: event.headers });
    if (!session?.user) {
        await sendRedirect(event, '/auth/login', 302);
    }
    return session;
});
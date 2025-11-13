import { auth } from "~/../lib/auth";

export default defineEventHandler(async (event) => {
    const session = await auth.api.getSession({ headers: event.headers });
    return session;
});
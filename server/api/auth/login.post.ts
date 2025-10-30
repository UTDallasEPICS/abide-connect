import { auth } from "~/../lib/auth";

export default defineEventHandler(async (event) => {
    const { email, password } = await readBody(event);
    await auth.api.signInEmail({ body: { email, password }, headers: event.headers });
    return { success: true };
});

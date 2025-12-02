import { auth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });
  event.context.session = session;
  if (event.path.startsWith("/volunteer")) {
    if (!session?.session) {
      await sendRedirect(event, "/auth/login", 302);
    }
  }
});
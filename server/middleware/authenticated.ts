import { auth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });
  event.context.session = session;
  if (event.path.startsWith("/volunteer") || event.path.startsWith("/api/volunteer")) {
    if (!session?.session) {
      return sendRedirect(event, "/auth/login", 302);
    }
  }
});
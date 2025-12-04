import { auth } from "~~/server/utils/auth";
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
        const { email, password } = await readBody(event);

        const { response, headers } = await auth.api.signInEmail({
            body: { email, password },
            headers: event.headers,
            returnHeaders: true,
        });
        forwardAuthHeaders(event, headers);

        return { success: true, ...response };
    } catch (error: unknown) {
        console.log(error);
        throw createError({
            statusCode: (error as { statusCode: number }).statusCode,
            statusMessage: (error as { body: { message: string} }).body?.message || "An unexpected error occurred",
        });
    }
});

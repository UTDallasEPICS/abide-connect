import { auth } from '#server/utils/auth'
import type { H3Event } from 'h3'
import { appendHeader, setHeader } from 'h3'

/**
 * Signs an existing user in with an emailed OTP — the second half of the login
 * flow that `request-otp.post.ts` starts.
 *
 * Distinct from `sign-up-verify.post.ts`: that one creates the account first,
 * this one assumes it already exists (the emailOTP plugin runs with
 * `disableSignUp: true`, so an unknown address fails here rather than
 * registering).
 */

// Copies response headers from better-auth onto the H3 event.
// This is how session cookies get sent back to the browser.
const forwardAuthHeaders = (event: H3Event, headers?: Headers) => {
    if (!headers) return
    headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
            appendHeader(event, 'set-cookie', value)
        }
        else {
            setHeader(event, key, value)
        }
    })
}
export default defineEventHandler(async (event) => {
    try {
        // Read both the email and the OTP code the user typed in.
        const { email, otp } = await readBody(event)
        const { response, headers } = await auth.api.signInEmailOTP({
            body: { email, otp },
            headers: event.headers,
            returnHeaders: true,
        })

        forwardAuthHeaders(event, headers)

        return { success: true, ...response }
    }
    catch (error: unknown) {
        console.log(error)
        throw createError({
            statusCode: (error as { statusCode: number }).statusCode ?? 500,
            statusMessage:
                (error as { body: { message: string } }).body?.message
                ?? 'Invalid or expired code',
        })
    }
})

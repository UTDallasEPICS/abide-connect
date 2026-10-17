import { createHash, timingSafeEqual } from 'node:crypto'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { generateRandomString } from 'better-auth/crypto'
import * as z from 'zod'
import { NATIVE_HANDOFF_VALUE } from '#shared/utils/nativeApp'
import { activeRoles } from './userRoles'

/**
 * Hands a Google sign-in completed in the system browser over to the native
 * app's WebView.
 *
 * Google refuses OAuth inside an embedded WebView (`disallowed_useragent`), so
 * in the app the staff sign-in runs in the system browser instead (Safari View
 * Controller / Chrome Custom Tab). That browser ends up holding the session
 * cookie, and its cookie jar is not the WebView's — so the session has to be
 * carried across, and the only road back into the app is a custom-scheme
 * redirect, which any other installed app can register too.
 *
 * Hence the PKCE shape (RFC 8252 §8.1): the app keeps a random verifier and
 * sends only its SHA-256 challenge out through the browser. The browser,
 * once signed in, swaps the challenge for a short-lived single-use token and
 * redirects to the app with it. Redeeming that token needs the verifier,
 * which never left the app, so an app that intercepts the redirect gets
 * nothing it can use.
 *
 * better-auth's own `oneTimeToken` plugin is close but not usable here: its
 * `/one-time-token/verify` would hand the session to whoever holds the token,
 * with no verifier, and it is always mounted once the plugin is.
 *
 * Redeeming attaches the WebView to the *same* session row the browser made,
 * rather than minting a second one, so the admin session ceiling in
 * `sessionPolicy.ts` still counts from the real sign-in.
 */

const TOKEN_TTL_MS = 3 * 60 * 1000
const IDENTIFIER_PREFIX = 'native-handoff:'

function sha256(value: string, encoding: 'hex' | 'base64url') {
  return createHash('sha256').update(value).digest(encoding)
}

// Stored hashed, so a read of the verification table doesn't yield a token
// that could be redeemed (it would still need the verifier, but belt and braces).
const identifierFor = (token: string) => IDENTIFIER_PREFIX + sha256(token, 'hex')

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const nativeHandoff = () => ({
  id: 'native-handoff',
  endpoints: {
    // Called by the system browser right after Google returns.
    createNativeHandoff: createAuthEndpoint('/native/handoff', {
      method: 'POST',
      body: z.object({ challenge: z.string().regex(NATIVE_HANDOFF_VALUE) }),
      use: [sessionMiddleware],
    }, async (ctx) => {
      const token = generateRandomString(32)
      await ctx.context.internalAdapter.createVerificationValue({
        identifier: identifierFor(token),
        value: JSON.stringify({
          sessionToken: ctx.context.session.session.token,
          challenge: ctx.body.challenge,
        }),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      })
      return ctx.json({ token })
    }),

    // Called by the app's WebView with the token from the redirect.
    redeemNativeHandoff: createAuthEndpoint('/native/redeem', {
      method: 'POST',
      body: z.object({ token: z.string().min(1), verifier: z.string().regex(NATIVE_HANDOFF_VALUE) }),
    }, async (ctx) => {
      const identifier = identifierFor(ctx.body.token)
      const row = await ctx.context.internalAdapter.findVerificationValue(identifier)
      if (!row) {
        throw ctx.error('BAD_REQUEST', { message: 'Invalid sign-in link' })
      }
      // Single use, whatever happens next — a wrong verifier burns the token
      // rather than leaving it open to further guesses.
      await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier)
      if (row.expiresAt < new Date()) {
        throw ctx.error('BAD_REQUEST', { message: 'Sign-in link expired' })
      }

      const { sessionToken, challenge } = JSON.parse(row.value) as { sessionToken: string, challenge: string }
      if (!safeEqual(sha256(ctx.body.verifier, 'base64url'), challenge)) {
        throw ctx.error('BAD_REQUEST', { message: 'Invalid sign-in link' })
      }

      const session = await ctx.context.internalAdapter.findSession(sessionToken)
      if (!session || session.session.expiresAt < new Date()) {
        throw ctx.error('BAD_REQUEST', { message: 'Session expired' })
      }
      await setSessionCookie(ctx, session)

      // Same reason as verify-otp.post.ts: the caller picks a landing page
      // from these, and asking separately would race the cookie being set.
      return ctx.json({ roles: await activeRoles(session.user.id) })
    }),
  },
}) satisfies BetterAuthPlugin

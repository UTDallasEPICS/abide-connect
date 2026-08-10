import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed "cancel my sign-up" links for emails.
 *
 * A guest who signed up with just a name and an email has no account and so no
 * way to reach their RSVP again — the confirmation and reminder emails are the
 * only handle they have on it. Rather than trusting an event id and an email
 * address in a query string (which anyone could guess and use to cancel someone
 * else's place), each link carries a token that this module signs with
 * `BETTER_AUTH_SECRET` and later verifies.
 *
 * The token is stateless on purpose: no extra column, no table, nothing to
 * clean up, and a token stays valid exactly as long as the sign-up it names
 * exists — cancelling and signing up again mints a new guest row with a new id,
 * which silently retires the old link.
 */

/**
 * What a verified token authorises the bearer to cancel: either a signed-in
 * user's `RSVP` (keyed the way that table is) or a `GuestRSVP` by its own id.
 */
export type RsvpCancelClaim
  = | { type: 'user', userId: string, eventId: string }
    | { type: 'guest', guestRsvpId: string }

/** Compact on-the-wire shape — short keys keep the emailed URL manageable. */
type TokenPayload
  = | { t: 'u', u: string, e: string }
    | { t: 'g', g: string }

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) {
    // Signing with a fallback would mean links that verify anywhere, which is
    // worse than no cancel link at all — callers treat a throw as "omit it".
    throw new Error('BETTER_AUTH_SECRET is required to sign RSVP cancel links')
  }
  return value
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

/**
 * Mints a token for one sign-up. Throws if the app has no signing secret, so
 * callers building an email should treat that as "send it without the link".
 */
export function signRsvpCancelToken(claim: RsvpCancelClaim): string {
  const payload: TokenPayload = claim.type === 'user'
    ? { t: 'u', u: claim.userId, e: claim.eventId }
    : { t: 'g', g: claim.guestRsvpId }

  const encoded = base64url(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

/**
 * Verifies a token and returns what it authorises, or null if it's malformed,
 * truncated by a mail client, or not signed by us.
 *
 * The signature is compared in constant time — the comparison is against a
 * value an attacker supplies and can iterate on, which is the case
 * `timingSafeEqual` exists for.
 */
export function verifyRsvpCancelToken(token: string | undefined | null): RsvpCancelClaim | null {
  if (!token) return null

  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  let expected: string
  try {
    expected = sign(encoded)
  }
  catch {
    return null
  }

  const provided = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload

    if (payload.t === 'u' && typeof payload.u === 'string' && typeof payload.e === 'string') {
      return { type: 'user', userId: payload.u, eventId: payload.e }
    }
    if (payload.t === 'g' && typeof payload.g === 'string') {
      return { type: 'guest', guestRsvpId: payload.g }
    }
    return null
  }
  catch {
    return null
  }
}

/**
 * The page a cancel link points at.
 *
 * Deliberately a page and not the DELETE endpoint: mail clients, link scanners
 * and corporate security gateways fetch every URL in a message, so a link that
 * cancels on GET would cancel sign-ups nobody asked to cancel. The page asks
 * for a click before it posts anything.
 */
export function rsvpCancelPath(token: string): string {
  return `/rsvp/cancel?token=${encodeURIComponent(token)}`
}

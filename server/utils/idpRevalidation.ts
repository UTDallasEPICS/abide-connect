import { createError } from 'h3'
import prisma from './prisma'

/**
 * Keeps an admin's Abide Connect session tied to their Google Workspace account
 * still being active.
 *
 * The gap this closes: a session is a row in our own `session` table and has
 * nothing to do with Google once sign-in is finished. Offboarding someone from
 * Workspace revokes their Google grant, but their Abide session goes on
 * authenticating by itself. Because `auth.ts` grants ADMIN to every new Google
 * sign-in, "still signed in" and "still staff" only stay in step if something
 * deliberately checks — this module is that check.
 *
 * `requireRole` calls it for admin-level requests only. Volunteers and ordinary
 * users aren't re-checked: they have no elevated access to strip, and many of
 * them signed in by email OTP and have no Google grant to check in the first
 * place. Nor is a session that didn't come from Google in the first place — an
 * admin holding both sign-in methods is checked on their Google sessions and
 * bounded by the admin session cap on their OTP ones.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** How long a confirmed-live grant is trusted before Google is asked again. */
const REVALIDATE_INTERVAL_MS = 10 * 60 * 1000

/**
 * How long an admin keeps working while probes come back inconclusive.
 *
 * A Google outage and a revoked grant can both leave us without a clear answer,
 * and locking every admin out of the dashboard because Google had a bad five
 * minutes is worse than letting a just-offboarded admin carry on a little
 * longer. So an inconclusive probe fails open until this window has elapsed and
 * fails closed after it. The absolute session cap in `auth.ts` sits underneath
 * as the backstop.
 */
const UNKNOWN_GRACE_MS = 30 * 60 * 1000

/** How often to retry while inconclusive — far tighter than the alive interval. */
const UNKNOWN_RETRY_MS = 60 * 1000

/** Google answers quickly; a hung probe must not hold an admin request open. */
const PROBE_TIMEOUT_MS = 4000

type ProbeOutcome = 'alive' | 'revoked' | 'unknown'

interface GrantState {
  /** When the grant was last confirmed alive. 0 if it never has been. */
  aliveAt: number
  /** When the current run of inconclusive probes began, or null if none is. */
  unknownSince: number | null
  /** When Google was last actually asked, used to throttle retries. */
  lastProbeAt: number
}

/**
 * Per-process, which is all it needs to be. The map only suppresses repeat
 * probes, so a second ECS task simply does its own — nothing here is
 * authoritative, the database and Google are.
 */
const grantStates = new Map<string, GrantState>()

/**
 * De-duplicates concurrent probes for one user. The admin reports pages fire
 * several endpoints in parallel, so without this a single dashboard load past
 * the cache window would open a fistful of simultaneous Google calls.
 */
const inFlightProbes = new Map<string, Promise<ProbeOutcome>>()

/**
 * Asks Google whether a refresh token still represents a live grant, by
 * performing the refresh and reading the error code rather than the tokens.
 *
 * Doing this by hand rather than through `auth.api.getAccessToken` is
 * deliberate. That helper only contacts Google when the *stored access token*
 * has expired, so it happily returns a cached token for an account that was
 * disabled minutes ago; and it collapses every failure into one opaque
 * `FAILED_TO_GET_ACCESS_TOKEN`, which cannot be told apart from a network blip.
 * The raw endpoint answers the question directly.
 *
 * The minted access token is discarded on purpose — this is a liveness check,
 * not a token refresh, and writing it back would duplicate better-auth's own
 * storage and encryption handling. Google does not rotate refresh tokens on
 * use, so the stored one stays valid.
 */
async function probeGoogleGrant(refreshToken: string): Promise<ProbeOutcome> {
  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.OAUTH_CLIENT_ID as string,
        client_secret: process.env.OAUTH_CLIENT_SECRET as string,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  }
  catch (error) {
    console.warn('[idp] Google token probe could not be completed:', error)
    return 'unknown'
  }

  // The freshly minted access token is of no interest, but the body still has
  // to be released or the connection is held open.
  if (response.ok) {
    await response.body?.cancel().catch(() => {})
    return 'alive'
  }

  const body = await response.json().catch(() => null) as { error?: string } | null
  const errorCode = body?.error

  // `invalid_grant` is the one answer that says the *grant* is gone: the
  // Workspace account was suspended or deleted, or the user revoked our access
  // in their Google security settings. Everything else — `invalid_client` (our
  // own credentials are wrong), `unauthorized_client`, a 5xx — is a statement
  // about us or about Google, not about them, and must never lock anyone out.
  if (errorCode === 'invalid_grant') return 'revoked'

  console.warn('[idp] Inconclusive Google token probe:', response.status, errorCode ?? '(no error code)')
  return 'unknown'
}

function probeOnce(userId: string, refreshToken: string): Promise<ProbeOutcome> {
  const existing = inFlightProbes.get(userId)
  if (existing) return existing

  const probe = probeGoogleGrant(refreshToken).finally(() => inFlightProbes.delete(userId))
  inFlightProbes.set(userId, probe)
  return probe
}

function markAlive(userId: string, now: number) {
  grantStates.set(userId, { aliveAt: now, unknownSince: null, lastProbeAt: now })
}

/**
 * Drops every session belonging to the user. Their next request has no session
 * at all, so `app/middleware/auth.global.ts` bounces them to the login page
 * rather than leaving an admin shell on screen that 401s on every call.
 *
 * Roles are left alone. A suspended Google account cannot complete OAuth, so it
 * cannot get back in; and if the person is later reinstated, the ADMIN grant in
 * `auth.ts` applies again on their next sign-in anyway.
 */
async function revokeSessions(userId: string, outcome: ProbeOutcome) {
  const { count } = await prisma.session.deleteMany({ where: { userId } })
  const reason = outcome === 'revoked'
    ? 'their Google grant was revoked'
    : `their Google grant could not be verified for over ${UNKNOWN_GRACE_MS / 60000} minutes`
  console.warn(`[idp] Revoked ${count} session(s) for user ${userId} — ${reason}`)
  grantStates.delete(userId)
}

/**
 * Throws a 401 (after dropping the user's sessions) if the Google account
 * behind an admin session is no longer live. Returns normally when the grant is
 * good, when there is nothing to check against, or when a failure is still
 * inside the grace window.
 *
 * `sessionCreatedAt` is the acting session's — see the ownership check below.
 */
export async function revalidateGoogleGrant(
  userId: string,
  sessionCreatedAt: Date,
): Promise<void> {
  // Escape hatch for local development and for a fast rollback in production
  // without a redeploy of the auth config.
  if (process.env.IDP_REVALIDATION === 'off') return

  // Without client credentials there is no probe to make. Returning here rather
  // than reporting 'unknown' matters: an environment missing these would
  // otherwise lock every Google admin out once the grace window expired.
  if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) return

  const now = Date.now()
  const state = grantStates.get(userId)

  if (state) {
    if (now - state.aliveAt < REVALIDATE_INTERVAL_MS) return

    // Inconclusive and still in grace: let them through, but only re-ask Google
    // at the retry interval so an outage doesn't turn into a probe storm.
    if (state.unknownSince !== null
      && now - state.unknownSince < UNKNOWN_GRACE_MS
      && now - state.lastProbeAt < UNKNOWN_RETRY_MS) {
      return
    }
  }

  // Newest first. A user can accumulate more than one Google account row, and
  // an unordered `findFirst` would probe an arbitrary one — reporting a long-
  // dead token as the state of a live grant.
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'google' },
    select: { refreshToken: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  // Nothing to revalidate against: an email-OTP sign-in has no Google account,
  // and an account predating `accessType: 'offline'` may have no stored refresh
  // token. Neither can be checked, so neither is locked out here — the absolute
  // session cap in `auth.ts` is what bounds those.
  if (!account?.refreshToken) {
    markAlive(userId, now)
    return
  }

  // The grant has to be the one this session actually rests on. Signing in
  // through Google writes the account row as the session is created, so a
  // session created *after* the row was last touched cannot have come from it.
  // In practice that's an admin who signed in by email OTP while an old Google
  // link still hangs off their account: probing that link answers a question
  // about a grant they aren't using, and `revokeSessions` below deletes *every*
  // session — so a refresh token that expired months ago would throw them back
  // to the login page seconds after a perfectly good sign-in.
  //
  // Only this direction is sound. A row touched *after* the session proves
  // nothing either way, since better-auth rewrites it whenever calendar sync
  // refreshes the access token, so those sessions are still checked.
  //
  // Both timestamps are re-wrapped rather than trusted: an unreadable one gives
  // NaN, every comparison against it is false, and the probe runs as before.
  if (new Date(sessionCreatedAt).getTime() > new Date(account.updatedAt).getTime()) {
    return
  }

  const outcome = await probeOnce(userId, account.refreshToken)

  if (outcome === 'alive') {
    markAlive(userId, now)
    return
  }

  if (outcome === 'unknown') {
    const unknownSince = state?.unknownSince ?? now
    grantStates.set(userId, {
      aliveAt: state?.aliveAt ?? 0,
      unknownSince,
      lastProbeAt: now,
    })
    if (now - unknownSince < UNKNOWN_GRACE_MS) return
  }

  await revokeSessions(userId, outcome)
  throw createError({ statusCode: 401, message: 'Unauthorized' })
}

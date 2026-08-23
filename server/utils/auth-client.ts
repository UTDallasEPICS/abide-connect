import { createAuthClient } from 'better-auth/vue'

/**
 * Browser-side better-auth client for components and pages (`signIn`,
 * `signOut`, `useSession`, the email-OTP helpers…).
 *
 * Despite living under `server/`, this is the *client* half of the pair — it
 * talks over HTTP to the handler mounted at `/api/auth/*`. It's here so both
 * roots can reach it through the `#server` alias. No `baseURL` is passed, so it
 * resolves against the current origin and needs no per-environment config.
 */
export const authClient = createAuthClient()

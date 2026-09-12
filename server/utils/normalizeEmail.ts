/**
 * Canonical form of an email address for storage and lookup: trimmed and
 * lower-cased.
 *
 * This is not cosmetic. Better Auth's `findUserByEmail` lower-cases the address
 * before querying, and `signInEmailOTP` lower-cases it again when building the
 * `sign-in-otp-<email>` verification identifier. SQLite's `=` is case-sensitive
 * (the `users.email` column has no `COLLATE NOCASE`), so anything stored or
 * keyed with different capitalisation is simply invisible to those lookups —
 * a user created as `Casey@Example.com` can never sign in, and the failure
 * surfaces as "Invalid OTP" because `disableSignUp` turns "no such user" into
 * that same error.
 *
 * So every path that writes `User.email` or builds an OTP identifier must run
 * the address through here, or it silently diverges from what Better Auth will
 * look for later.
 */
export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

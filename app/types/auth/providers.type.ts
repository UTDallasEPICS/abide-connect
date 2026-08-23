/**
 * Social sign-in buttons rendered by `UAuthForm` on the sign-up page.
 *
 * Presentation only — every `onClick` is an empty stub, so neither button does
 * anything today. Real Google sign-in goes through `authClient.signIn.social()`
 * on the login page; Apple is not configured as a provider in
 * `server/utils/auth.ts` at all, so wiring its handler up would need that first.
 */
export const authProviders = [{
  label: 'Google',
  icon: 'i-simple-icons-google',
  onClick: () => {},
}, {
  label: 'Apple',
  icon: 'i-simple-icons-apple',
  onClick: () => {},
}]

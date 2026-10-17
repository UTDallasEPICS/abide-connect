/**
 * The URL scheme the native app registers, used to hand a Google sign-in from
 * the system browser back to the app (see server/utils/nativeHandoff.ts).
 *
 * Reverse-DNS of the app id, as RFC 8252 asks, so it can't collide with another
 * app's scheme by accident. It must match `APP_ID` in capacitor.config.ts and
 * the scheme registered in the iOS Info.plist and Android manifest.
 */
export const NATIVE_APP_SCHEME = 'org.abidewomen.connect'

/** Where the system browser sends the user once their sign-in is ready to hand over. */
export const NATIVE_AUTH_CALLBACK = `${NATIVE_APP_SCHEME}://auth/callback`

/**
 * PKCE-style challenge and verifier are both base64url SHA-256 sized values:
 * 43 characters, no padding.
 */
export const NATIVE_HANDOFF_VALUE = /^[\w-]{43}$/

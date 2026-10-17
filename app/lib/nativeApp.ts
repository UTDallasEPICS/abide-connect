import { Capacitor } from '@capacitor/core'

/**
 * Helpers for the pages when they're running inside the Capacitor shell (see
 * capacitor.config.ts). The shell loads the live site, so these run in the
 * same bundle a browser gets — every caller has to work on the web too, where
 * `isNativeApp()` is simply false.
 */

/** True inside the iOS/Android app, false in any browser (installed PWA included). */
export function isNativeApp(): boolean {
  return import.meta.client && Capacitor.isNativePlatform()
}

const VERIFIER_KEY = 'abide.nativeHandoffVerifier'

function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Starts a native Google sign-in: makes a fresh verifier, keeps it on this
 * device, and returns the challenge to send out through the system browser.
 * See server/utils/nativeHandoff.ts for why.
 *
 * localStorage rather than sessionStorage: Android may kill the app while the
 * user is in the browser, and the handoff has to survive the restart.
 */
export async function beginNativeHandoff(): Promise<string> {
  const verifier = toBase64url(crypto.getRandomValues(new Uint8Array(32)))
  localStorage.setItem(VERIFIER_KEY, verifier)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return toBase64url(new Uint8Array(digest))
}

/** The verifier from `beginNativeHandoff`, removed as it's read — it is single use. */
export function takeNativeVerifier(): string | null {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  localStorage.removeItem(VERIFIER_KEY)
  return verifier
}

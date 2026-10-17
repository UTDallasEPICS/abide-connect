/**
 * iPadOS 13+ reports a desktop Safari user agent, so touch points rather than
 * the UA string are what separate it from a real Mac.
 */
export function isMobileDevice() {
  const ua = navigator.userAgent
  if (/Android|iP(hone|ad|od)/i.test(ua)) {
    return true
  }
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

/**
 * On mobile, ask Google for the account chooser explicitly.
 *
 * Google only shows it when the choice is ambiguous; a phone signed into a
 * single account skips straight through, which on a staff member's personal
 * phone means signing in as the wrong (personal) account with no visible way
 * to switch. Desktop is left alone — the chooser already appears there often
 * enough, and multiple profiles are the norm.
 *
 * `consent` stays in the list: it's what makes Google re-issue a refresh
 * token, which Calendar sync depends on (see `socialProviders.google` in
 * `server/utils/auth.ts`). `prompt` is a space-delimited set, so asking for
 * the chooser must not drop it.
 */
export function forceAccountPicker(url: string) {
  if (!isMobileDevice()) {
    return url
  }
  const target = new URL(url, window.location.origin)
  target.searchParams.set('prompt', 'select_account consent')
  return target.toString()
}

import { writeFileSync } from 'node:fs'

/**
 * Native iOS/Android shell around the deployed web app.
 *
 * The shell does not bundle a build of the app. Abide Connect is server
 * rendered and every page talks to Nitro routes on its own origin with a
 * cookie session, so a static copy inside the app would need a second origin,
 * cross-site cookies and a CORS policy for the whole API. Instead the WebView
 * loads `CAPACITOR_SERVER_URL` directly: the app is first-party to the server,
 * cookies behave exactly as in a browser, and a deploy updates the app's
 * pages without a store release.
 *
 * What that does NOT cover is the native plugins (`@capacitor/app`,
 * `@capacitor/browser`). Their JS ships with the site but their native half
 * ships with the binary, so bumping one of them is a store release, and the
 * site has to keep working against the binaries already installed.
 *
 * `CAPACITOR_SERVER_URL` is read whenever the CLI loads this file (`cap sync`,
 * `cap run`, …) and baked into the native projects' copied config, so set it
 * before syncing for each environment:
 *
 *   CAPACITOR_SERVER_URL=https://stage.example.org pnpm cap sync
 *
 * Unset, it points at a local `pnpm dev` on localhost, which is right for the
 * iOS simulator. The Android emulator sees the host machine as 10.0.2.2, so
 * sync with `CAPACITOR_SERVER_URL=http://10.0.2.2:3000` there.
 */
const APP_ID = 'org.abidewomen.connect'

const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// The fallback page below has no other way to learn where "home" is: it is
// served from the app bundle, not from the server, and is shown precisely
// when the server could not be reached.
writeFileSync(
  new URL('./capacitor/www/server-url.js', import.meta.url),
  `window.ABIDE_SERVER_URL = ${JSON.stringify(serverUrl)}\n`,
)

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: APP_ID,
  appName: 'Abide Connect',
  // Only the offline fallback lives here; see above.
  webDir: 'capacitor/www',
  server: {
    url: serverUrl,
    // Plain http is only ever the local dev server.
    cleartext: serverUrl.startsWith('http://'),
    // Shown in place of the site when the first load fails (no signal, server
    // down) instead of the WebView's own error screen.
    errorPath: 'index.html',
  },
  ios: {
    // Lets the page draw under the status bar and home indicator; the nav bars
    // pad themselves with the safe-area insets (see `--safe-top` in main.css).
    contentInset: 'never',
  },
}

// The Capacitor CLI `require()`s this file and uses the result as the config
// as-is, with no `.default` unwrapping. Exporting under `module.exports` makes
// Node's require-of-ESM return the object itself. (It's JavaScript rather than
// TypeScript because the CLI compiles a .ts config to CommonJS, which Node then
// refuses to run inside a `"type": "module"` package.)
export { config as 'module.exports' }

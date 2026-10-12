/**
 * Native runtime configuration.
 *
 * A native app has no page origin, so every API call needs an absolute base
 * URL — there is no server rendering the app that could make `/api/...`
 * same-origin. Nuxt's `runtimeConfig`/`useRuntimeConfig` is a Nuxt-server
 * concept and does not exist in the NativeScript bundle, so the value lives
 * here as a plain constant rather than being read from `process.env`
 * (`@nativescript/webpack` only inlines env vars that exist in `.env`, and
 * referencing an undefined one would leave a `process.env.X` that throws at
 * runtime; a fresh clone has no `.env`).
 *
 * The stage backend is the same host the PWA talks to (see
 * docs/native-migration/README.md §3). Switch this when pointing at
 * production; a per-environment build define can replace it later.
 */
export const API_BASE_URL = 'https://abide-connect-stage.npts.tech'

/** App display name, mirroring `nuxt.config.ts` `native.appName`. */
export const APP_NAME = 'Abide Connect'

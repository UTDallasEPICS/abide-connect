// Generates the `.nuxt-native/` bootstrap from a minimal, native-only page
// instead of the real `app/pages` tree.
//
// Why this exists: the native build compiles every page reachable from the
// generated route manifest (nuxt-native's `useNativeRouter` imports it), so
// while the real frontend is still being migrated from HTML/Nuxt-UI to
// NativeScript views, `nuxt-native build` fails on those unmigrated pages.
// This lets the Android toolchain (webpack + Gradle + SDK + JDK) be verified
// end-to-end — APK builds, installs and launches — independent of migration
// progress. Point a real build back at `app/pages` by running the normal
// `nuxt-native build` / `dev` commands, which regenerate `.nuxt-native/`
// themselves.
//
// Usage:
//   node scripts/native-smoke-generate.mjs [pagesDir]
//   (defaults to `app/native-smoke/pages`)
import { generateEntry } from 'nuxt-native/cli/lib/generate-entry.mjs'

const pagesDir = process.argv[2] ?? 'app/native-smoke/pages'
const { routes } = generateEntry({ pagesDir })

console.log(
  `[native-smoke] generated .nuxt-native/ from ${pagesDir} ` +
  `(${routes.length} route(s): ${routes.map((r) => r.path).join(', ')})`
)

// Generates the `.nuxt-native/` bootstrap from the *migrated* subset of
// `app/pages`, instead of the whole tree.
//
// Why this exists: nuxt-native's generated route manifest imports every page it
// finds, and webpack compiles everything reachable from those imports. While the
// frontend is still mid-migration, the not-yet-migrated pages (HTML, `@nuxt/ui`,
// `#server`/`#shared` aliases, Nuxt auto-imports) fail to compile and take the
// whole native build down with them — even though the native entry only needs
// the pages that are actually done.
//
// So this runs nuxt-native's own `generateEntry()` over the real `app/pages`
// (which also writes `app.js`, the auto-imports, and copies `app.css`), then
// *replaces* the two page-dependent outputs it produced — `route-manifest.mjs`
// and `root-frame.vue` — with versions limited to the allowlist in
// `scripts/native-pages.json`.
//
// Add a page to that list once it's been migrated. When every page is on the
// list (or the file is deleted), the filter becomes a no-op and this script is
// equivalent to `nuxt-native build`'s own generation step.
//
// Usage:
//   node scripts/native-generate.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { generateEntry } from 'nuxt-native/cli/lib/generate-entry.mjs'

const projectRoot = process.cwd()
const pagesDir = 'app/pages'
const allowlistPath = resolve(projectRoot, 'scripts/native-pages.json')

/** @returns {Set<string> | null} relative page paths, or null for "all pages". */
function readAllowlist() {
  if (!existsSync(allowlistPath)) return null

  const parsed = JSON.parse(readFileSync(allowlistPath, 'utf8'))
  if (!Array.isArray(parsed) || parsed.length === 0) return null

  return new Set(parsed.map(entry => entry.replace(/^\/+/, '').replace(/\\/g, '/')))
}

function renderManifest(routes) {
  const entries = routes.map(route => [
    '  {',
    `    name: ${JSON.stringify(route.name)},`,
    `    path: ${JSON.stringify(route.path)},`,
    `    params: ${JSON.stringify(route.params)},`,
    `    component: () => import(${JSON.stringify(route.file)})`,
    '  }',
  ].join('\n'))

  return `export const routes = [\n${entries.join(',\n')}\n]\n`
}

function renderRootFrame(initial) {
  return `<template>
  <Frame>
    <Initial />
  </Frame>
</template>

<script setup>
import Initial from ${JSON.stringify(initial.file)}
</script>
`
}

function main() {
  const allowlist = readAllowlist()

  // generateEntry writes the manifest root-frame for *all* pages; we overwrite
  // both below. The other outputs (app.js, auto-imports, app.css) don't depend
  // on the page set, so they're correct as generated.
  const { routes, outDir } = generateEntry({ projectRoot, pagesDir })
  const pagesRoot = resolve(projectRoot, pagesDir)

  let selected = routes
  if (allowlist) {
    selected = routes.filter(route => allowlist.has(relative(pagesRoot, route.file).replace(/\\/g, '/')))

    const matched = new Set(selected.map(route => relative(pagesRoot, route.file).replace(/\\/g, '/')))
    const missing = [...allowlist].filter(entry => !matched.has(entry))
    if (missing.length > 0) {
      console.warn(`[native] allowlist entries not found under ${pagesDir}/: ${missing.join(', ')}`)
    }
  }

  if (selected.length === 0) {
    throw new Error(`[native] No pages selected — check ${allowlistPath}`)
  }

  const initial = selected.find(route => route.name === 'index') ?? selected[0]
  writeFileSync(resolve(outDir, 'route-manifest.mjs'), renderManifest(selected))
  writeFileSync(resolve(outDir, 'root-frame.vue'), renderRootFrame(initial))

  const scope = allowlist ? `${selected.length} allowlisted` : `all ${selected.length}`
  console.log(
    `[native] generated .nuxt-native/ with ${scope} page(s): ` +
    selected.map(route => route.path).join(', '),
  )
}

main()

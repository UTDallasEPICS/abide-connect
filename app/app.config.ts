/**
 * Runtime overrides for @nuxt/ui component slots — app-wide defaults so
 * individual usages don't repeat the same `:ui` prop.
 *
 * Distinct from the `ui` key in `nuxt.config.ts`: that one holds build-time
 * config (theme colours), this one holds per-component styling and is
 * hot-reloadable.
 */
export default defineAppConfig({
  ui: {
    formField: {
      slots: {
        description: 'text-xs font-normal text-gray-500',
      }
    },
    checkbox: {
      slots: {
        description: 'text-xs font-normal text-gray-500',
      }
    }
  }
})
/**
 * One tile on the admin dashboard grid (`app/pages/admin/index.vue`).
 *
 * `icon` is an Iconify name (e.g. `i-lucide-users`); `iconBg` and `bg` are
 * Tailwind class strings applied to the icon badge and the tile itself, so
 * they must be literal classes Tailwind can see at build time, not values
 * assembled at runtime.
 */
export type AdminFeature = {
  id: string
  label: string
  to: string
  description?: string
  icon: string
  iconBg: string
  bg: string
}

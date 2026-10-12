<script setup lang="ts">
/**
 * Fixed bottom tab bar (native rewrite of the web `NavBottom`).
 *
 * Rendered by `AppShell` on `variant="default"` pages. Each tab is a route the
 * router pushes by path through `useNativeNavigate`, so the tab bar never
 * bypasses the auth guard.
 *
 * The web version painted icon fonts (`:text="navItem.icon"`); a native
 * `Label` shows glyph text, not a font icon, so this uses short text labels
 * for the MVP. Real icons (a native icon font or SVG) are Phase 5 polish.
 */
import { computed } from 'vue'
import { useNativeRouter } from 'nuxt-native/runtime/composables/useNativeRouter.js'
import { useSafeArea } from 'nuxt-native/runtime/composables/useSafeArea.js'
import { colors, fontSizes, spacing } from 'nuxt-native/runtime/theme.js'
import { useUserRoles } from '~/composables/useUserRoles'
import { useNativeNavigate } from '~/composables/useNativeNavigate'

interface Tab {
  key: string
  label: string
  path: string
}

const { isAdmin } = useUserRoles()
const { to, exists, routes } = useNativeNavigate()
const { current } = useNativeRouter()
const insets = useSafeArea()

const tabs = computed<Tab[]>(() => [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'events', label: 'Events', path: '/events' },
  { key: 'clinic', label: 'Clinic', path: '/mobileClinic' },
  { key: 'profile', label: 'Profile', path: isAdmin.value ? '/admin' : '/volunteer' },
])

/** Path of the page currently on top of the backstack, if it's a known route. */
const activePath = computed(() => {
  const names = current.value
  const topName = names[names.length - 1]
  if (!topName) return ''
  return routes.find(route => route.name === topName)?.path ?? ''
})

function isActive(tab: Tab): boolean {
  const path = activePath.value
  if (!path) return false
  return path === tab.path || path.startsWith(`${tab.path}/`)
}

function isAvailable(tab: Tab): boolean {
  return exists(tab.path)
}

function go(tab: Tab): void {
  to(tab.path)
}

const barStyle = computed(() => ({
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  paddingBottom: insets.value.bottom,
}))
</script>

<template>
  <GridLayout
    columns="*, *, *, *"
    rows="auto"
    :style="barStyle"
  >
    <StackLayout
      v-for="(tab, index) in tabs"
      :key="tab.key"
      :col="index"
      :style="{
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        opacity: isAvailable(tab) ? 1 : 0.4,
      }"
      @tap="go(tab)"
    >
      <Label
        :text="tab.label"
        :style="{
          fontSize: fontSizes.xs,
          textAlignment: 'center',
          fontWeight: isActive(tab) ? '700' : '400',
          color: isActive(tab) ? colors.primary : colors.textMuted,
        }"
      />
    </StackLayout>
  </GridLayout>
</template>

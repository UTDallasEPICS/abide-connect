<script setup lang="ts">
/**
 * The native app shell — the replacement for `app/layouts/*`.
 *
 * Nuxt Native has no layout engine and no `<NuxtLayout>`: each page becomes a
 * native `<Page>` pushed onto the frame backstack, and nothing applies an
 * outer layout for you. So a page opts into the chrome by wrapping itself:
 *
 *     <AppShell title="Abide Connect">…page content…</AppShell>
 *
 * `variant="default"` gives the app bar plus the bottom tab bar (the tab
 * destinations). `variant="secondary"` is the detour chrome: a back control
 * and no bottom nav, matching the old `secondary` layout.
 *
 * The `<ActionBar>` is a real native widget, so it can only contain a
 * `NavigationButton` (left) and `ActionItem`s (right) — arbitrary layout
 * inside it is not supported. Page actions are declared with `useNavActions`
 * and rendered here as `ActionItem`s.
 */
import { computed } from 'vue'
import { useSafeArea } from 'nuxt-native/runtime/composables/useSafeArea.js'
import NavBottom from '~/components/nav/Bottom.vue'
import { useNavActionsState } from '~/composables/useNavActions'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
import { APP_NAME } from '~/lib/config'

const props = withDefaults(defineProps<{
  title?: string
  variant?: 'default' | 'secondary'
  backText?: string
  scrollable?: boolean
  /** Force the app bar off (a full-bleed screen). */
  hideActionBar?: boolean
}>(), {
  variant: 'default',
  backText: 'Back',
  scrollable: true,
})

const insets = useSafeArea()
const { back } = useNativeNavigate()
const actions = useNavActionsState()

const showActionBar = computed(() => !props.hideActionBar)
const showBottomNav = computed(() => props.variant === 'default')
const showBack = computed(() => props.variant === 'secondary')
const barTitle = computed(() => props.title ?? (props.variant === 'default' ? APP_NAME : ''))

/**
 * The app bar already clears the status bar, so content only needs the top
 * inset when the bar is hidden. Bottom inset is handled by the nav bar when
 * it's present, otherwise by the content itself.
 */
const contentStyle = computed(() => ({
  paddingTop: showActionBar.value ? 0 : insets.value.top,
  paddingBottom: showBottomNav.value ? 0 : insets.value.bottom,
  paddingLeft: insets.value.left,
  paddingRight: insets.value.right,
}))

function goBack(): void {
  back()
}
</script>

<template>
  <Page>
    <ActionBar v-if="showActionBar" :title="barTitle">
      <NavigationButton
        v-if="showBack"
        :text="backText"
        @tap="goBack"
      />
      <ActionItem
        v-for="action in actions"
        :key="action.key"
        :text="action.label"
        @tap="action.onSelect"
      />
    </ActionBar>

    <GridLayout rows="*, auto" columns="*">
      <ScrollView v-if="scrollable" row="0" orientation="vertical">
        <GridLayout :style="contentStyle">
          <slot />
        </GridLayout>
      </ScrollView>
      <GridLayout v-else row="0" :style="contentStyle">
        <slot />
      </GridLayout>

      <NavBottom v-if="showBottomNav" row="1" />
    </GridLayout>
  </Page>
</template>

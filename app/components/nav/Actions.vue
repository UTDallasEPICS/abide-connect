<script setup lang="ts">
/**
 * Renders whatever the current page registered through `useNavActions`, in
 * both headers, ahead of the bar's own controls (notifications, settings).
 *
 * Labels collapse to the icon under `sm` so an edit/save pair doesn't crowd
 * out the bell on a phone; the label stays on as the accessible name.
 */
const actions = useNavActionsState()
</script>

<template>
  <UButton
    v-for="action in actions"
    :key="action.key"
    :icon="action.icon"
    :color="action.color ?? 'neutral'"
    :variant="action.variant ?? 'ghost'"
    :disabled="action.disabled"
    :aria-label="action.label"
    @click="action.onSelect"
  >
    <span class="hidden sm:inline">{{ action.label }}</span>
  </UButton>
</template>

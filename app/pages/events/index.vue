<template>
  <DefaultLayout title="Events">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText variant="h2" text="Events" :style="{ marginBottom: spacing.sm }" />
      <NText variant="caption" text="Native · Phase 4 (stub)" :style="{ marginBottom: spacing.xl }" />
      <NCard>
        <NText variant="h3" text="Events screen" :style="{ marginBottom: spacing.sm }" />
        <NText variant="body" text="This is a native placeholder. Full events list UI will be ported." :style="{ marginBottom: spacing.md }" />
        <NButton text="Go back home" @tap="goHome" />
      </NCard>
    </StackLayout>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing, colors, fontSizes } from 'nuxt-native/runtime/theme.js'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
const { to } = useNativeNavigate()
function goHome() { to('index') }
</script>

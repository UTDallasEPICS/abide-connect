<template>
  <DefaultLayout title="All Events">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText variant="h2" text="All Events" :style="{ marginBottom: spacing.sm }" />
      <NText variant="caption" text="Native · Phase 4 (stub)" :style="{ marginBottom: spacing.xl }" />
      <NCard>
        <NText variant="body" text="Events list will be ported to NativeScript primitives (ListView/GridLayout)." :style="{ marginBottom: spacing.md }" />
        <NButton text="Back" @tap="goBack" />
      </NCard>
    </StackLayout>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
const { to } = useNativeNavigate()
function goBack() { to('events') }
</script>

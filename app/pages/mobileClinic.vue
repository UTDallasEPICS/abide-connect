<template>
  <DefaultLayout title="Mobile Clinic">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText variant="h2" text="Mobile Clinic" :style="{ marginBottom: spacing.sm }" />
      <NText variant="caption" text="Native · Phase 4 (stub)" :style="{ marginBottom: spacing.xl }" />
      <NCard>
        <NText variant="body" text="Map + clinic events will be ported here (map is a blocker in web; needs native mapping)." />
      </NCard>
    </StackLayout>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
</script>

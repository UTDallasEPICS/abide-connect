<template>
  <DefaultLayout title="Mobile Clinic">
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h2" text="Mobile Clinic" :style="{ marginBottom: spacing.sm }" />
        <NText variant="body" text="Find upcoming mobile clinic dates and locations." :style="{ marginBottom: spacing.md }" />
        <NCard>
          <NText variant="body" text="Clinic schedule information coming soon." />
        </NCard>
      </StackLayout>
    </ScrollView>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
</script>

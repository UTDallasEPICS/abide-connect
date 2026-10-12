<script setup lang="ts">
/**
 * Secondary layout for flows (back button, no bottom nav)
 * Migrated for Nuxt Native
 */
</script>

<template>
  <GridLayout rows="auto, *" columns="*" class="page">
    <GridLayout row="0" columns="*" class="action-bar">
      <NavSecondaryTop />
    </GridLayout>
    <ScrollView row="1">
      <StackLayout>
        <slot />
      </StackLayout>
    </ScrollView>
  </GridLayout>
</template>

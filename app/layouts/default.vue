<script setup lang="ts">
/**
 * Default app shell: top bar, page, and mobile bottom nav.
 * Migrated for Nuxt Native (NativeScript) - uses layout containers.
 */
</script>

<template>
  <GridLayout rows="auto, *, auto" columns="*" class="page">
    <GridLayout row="0" columns="*" class="action-bar">
      <NavTop />
    </GridLayout>
    <ScrollView row="1">
      <StackLayout>
        <slot />
      </StackLayout>
    </ScrollView>
    <GridLayout row="2" columns="*" class="bottom-bar">
      <NavBottom />
    </GridLayout>
  </GridLayout>
</template>

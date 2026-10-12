<script setup lang="ts">
/**
 * Renders page-registered nav actions
 */
const actions = useNavActionsState()
</script>

<template>
  <StackLayout orientation="horizontal">
    <Button
      v-for="action in actions"
      :key="action.key"
      :text="action.label"
      :isEnabled="!action.disabled"
      @tap="action.onSelect"
    />
  </StackLayout>
</template>

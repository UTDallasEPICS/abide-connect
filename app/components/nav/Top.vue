<script setup lang="ts">
/**
 * Top bar shown by the `default` layout - migrated for NativeScript
 */
const route = useRoute()
const router = useRouter()

const showSettings = computed(() => route.path === '/volunteer' || route.path === '/admin')
const showBack = computed(() => !!route.meta.backTo)

const onSettingsClick = () => navigateTo('/settings')
</script>

<template>
  <GridLayout columns="auto, *, auto" rows="auto" class="action-bar-content">
    <NavBackButton v-if="showBack" col="0" />
    <StackLayout v-else col="0" orientation="horizontal">
      <Image src="~/public/images/abide_logo.svg" class="logo" />
    </StackLayout>
    <StackLayout col="2" orientation="horizontal">
      <NavActions />
      <NavNotificationMenu />
      <Button
        v-if="showSettings"
        text="Settings"
        @tap="onSettingsClick"
      />
    </StackLayout>
  </GridLayout>
</template>

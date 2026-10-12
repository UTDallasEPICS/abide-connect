<script setup lang="ts">
/**
 * Fixed bottom tab bar - migrated for NativeScript
 */
const { isAdmin } = useUserRoles()
const router = useRouter()

const profileLink = computed(() => (isAdmin.value ? '/admin' : '/volunteer'))

const nav = computed(() => [
  { id: 1, icon: 'home', to: '/' },
  { id: 2, icon: 'calendar', to: '/events' },
  { id: 3, icon: 'hospital', to: '/mobileClinic' },
  { id: 4, icon: 'user', to: profileLink.value },
])

function navigate(to: string) {
  navigateTo(to)
}
</script>

<template>
  <GridLayout columns="*, *, *, *" rows="auto" class="bottom-nav">
    <Button
      v-for="(navItem, index) in nav"
      :key="navItem.id"
      :col="index"
      :text="navItem.icon"
      @tap="navigate(navItem.to)"
      class="bottom-nav-item"
    />
  </GridLayout>
</template>

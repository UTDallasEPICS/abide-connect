<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
const items: NavigationMenuItem[] = [{
    icon: "i-lucide-house",
    to: "/home"       
}, {
    icon: "i-lucide-house",
    to: "/home"       
}, {
    icon: "i-lucide-hospital",
    to: "/"       
}, {
    icon: "i-lucide-house",
    to: "/home"       
}, {
    icon: "i-lucide-house",
    to: "/home"       
}]
</script>

<template>
    <UFooter>
        <UNavigationMenu class="sticky top-0 z-50 h-12 backdrop-blur p-0 m-2" :items="items" variant="link"/>
    </UFooter>

</template>
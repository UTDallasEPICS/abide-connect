<script setup lang="ts">
const nav = ref([
    {
        id: 1,
        icon: "i-lucide-house",
        to: "/home",
    },
    {
        id: 2,
        icon: "i-lucide-calendar-days",
        to: "/home",
    },
    {
        id: 3,
        icon: "i-lucide-square-user-round",
        to: "/auth/login",
    },
    {
        id: 4,
        icon: "i-lucide-hospital",
        to: "/home",
    },
    {
        id: 5,
        icon: "i-lucide-hand-heart",
        to: "/home",
    },
]);
</script>

<template>
    <UFooter class="fixed bottom-0 left-0 right-0 h-12 border-t bg-[#F2EBE3]/90">
        <UButton
            v-for="navItem in nav"
            :key="navItem.id"
            :icon="navItem.icon"
            :to="navItem.to"
            color="neutral"
            variant="ghost"
            class=" mx-7 justify-center"
        />
    </UFooter>
</template>

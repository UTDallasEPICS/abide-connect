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
        to: "/auth/sign-up",
    },
    {
        id: 4,
        icon: "i-lucide-hospital",
        to: "/mobileClinic",
    },
    {
        id: 5,
        icon: "i-lucide-hand-heart",
        to: "/home",
    },
]);
</script>
<template>
<UFooter class="fixed bottom-0 left-0 right-0 flex justify-around items-center h-12 z-100 bg-white">
    <template #default>
        <UButton v-for="navItem in nav"
                :key="navItem.id"
                :icon="navItem.icon"
                :to="navItem.to"
                color="neutral"
                variant="ghost"
                class="w-full h-full mx-7"
                />
    </template>
</UFooter>

</template>
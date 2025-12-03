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
        to: "/events",
    },{
        id: 3,
        icon: "i-lucide-hospital",
        to: "/mobileClinic",
    },
    {
        id: 4,
        icon: "i-lucide-square-user-round",
        to: "/volunteer",
    },
    
    
]);
</script>
<template>
<UFooter class="fixed bottom-0 left-0 right-0 z-60 flex **justify-between** items-center **px-4** h-12 border-t border-gray-200 bg-white">
    <template #default>
        <UButton
v-for="navItem in nav"
                :key="navItem.id"
                :icon="navItem.icon"
                :to="navItem.to"
                color="neutral"
                variant="ghost"
                class="**flex-1** **min-w-0** h-full mx-auto lg:mx-14"
                />
    </template>
</UFooter>

</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const getPageTitle = () => {
    return route.name || 'Default'
}
</script>

<template>
    <UHeader :ui="{ toggle: 'hidden' }" class="fixed top-0 z-50 h-12 w-full bg-white backdrop-blur ">
        <!-- Left Settings -->
        <template #left>
            <div class="">
                <UButton    
                    color="neutral"
                    variant="ghost"
                    aria-label="Settings">
                    <UIcon name="i-lucide-settings" class="w-7 h-7" />
                </UButton>
            </div>
        </template>
        <!-- Center Logo -->
        <template #default>
            <div class="flex items-center justify-center flex-1">
                <h1 class="text-xl font-semibold text-transform: capitalize">{{ getPageTitle() }}</h1>
            </div>
        </template>

        <!-- Right Inbox -->
        <template #right>
            <div class="w-10 flex items-center justify-end">
                <UButton
                    color="neutral"
                    variant="ghost"
                    aria-label="Inbox" >
                    <UIcon name="i-lucide-inbox" class="w-7 h-7" />
                </UButton>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>
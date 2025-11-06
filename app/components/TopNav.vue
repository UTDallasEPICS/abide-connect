<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

const getPageTitle = () => {
    return route.name || 'Default'
}

const onInboxClick = async (_e?: MouseEvent) => {
  await navigateTo('/inbox') 
}

</script>

<template>
    <UHeader :ui="{ toggle: 'hidden' }" class="fixed top-0 z-50 h-12 w-full bg-white backdrop-blur border-b">
        <!-- Left Settings -->
        <template #left>
            <div class="">
                <slot name="left">
                    <UButton    
                        color="neutral"
                        variant="ghost"
                        aria-label="Settings">
                        <UIcon name="i-heroicons-cog-6-tooth" class="w-7 h-7 text-teal-900" />
                    </UButton>
                </slot>
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
                <slot name="right">
                    <UButton
                        color="neutral"
                        variant="ghost"
                        aria-label="Inbox" 
                        @click="onInboxClick">
                        <UIcon name="i-heroicons-inbox" class="w-7 h-7  text-teal-900" />
                    </UButton>
                </slot>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>
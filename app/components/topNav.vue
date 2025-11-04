<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const router = useRouter()

const getPageTitle = () => {
    return route.name || 'Default'
}

const goToInbox = () => {
    router.push('/inbox')
}

</script>

<template>
    <UHeader :ui="{ toggle: 'hidden' }" class="sticky top-0 z-50 h-12 bg-white/90 backdrop-blur border-b">
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
                        @click="goToInbox">
                        <UIcon name="i-heroicons-inbox" class="w-7 h-7  text-teal-900" />
                    </UButton>
                </slot>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>
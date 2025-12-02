<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute();

const onInboxClick = async (_e?: MouseEvent) => {
  await navigateTo('/inbox') 
}
const onSettingsClick = async (_e?: MouseEvent) => {
    await navigateTo('/settings')
}
</script>

<template>
    <UHeader 
        :ui="{ toggle: 'hidden' }" 
        class="fixed top-0 z-50 h-12 w-full bg-white ">
        <!-- Left Settings -->
        <template #left>
            <div class="">
                    <UButton
                        color="neutral"
                        variant="ghost"
                        aria-label="Settings"
                        @click="onSettingsClick">
                        <UIcon name="i-heroicons-cog-6-tooth" class="w-7 h-7 text-teal-900" />
                    </UButton>

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
                        <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-7 h-7  text-teal-900" />
                    </UButton>
                </slot>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>
<script setup lang="ts">
definePageMeta({
  layout: 'secondary',
})
import { ref } from 'vue'

// type for the select
type NotificationType = 'General Events' | 'Volunteer Events' | 'Both'

const notificationEnabled = ref(true)
const notificationType = ref<NotificationType>('General Events')


const notificationOptions = [
    { label: 'General Events', value: 'general' },
    { label: 'Volunteer Events', value: 'volunteer' },
    { label: 'Both', value: 'both'},
]
</script>

<template>
    <div class="flex flex-col w-screen h-screen bg-white items-stretch">
         <!-- top nav bar with back button -->
        <main class="flex-1 px-5 pt-20 pb-24">
            <h2 class="text-xl font-semibold mb-6 text-brand7">
                Event Notifications 
            </h2>
 
            <section class="space-y-5">

                <div class="w-full rounded-3xl border border-gray-2-400 bg-slate-100 px-4 py-4 flex items-center justify-between">
                    <span class="text-sm font-semibold text-brand4">Enable Notifications</span>

                    <USwitch 
                        v-model="notificationEnabled" 
                        color="brand7"
                    />
                </div>
                <!-- notification type -->
                <div 
                    v-if="notificationEnabled"
                    class="w-full rounded-3xl border border-gray-2-400 bg-white px-4 py-3 flex items-center justify-between">
                    <span class="text-sm font-semibold text-brand4">Notification Type</span>
                    <USelect 
                        v-model="notificationType"
                        :items="notificationOptions"
                        size="sm"
                        class="w-40"
                        color="brand6"
                    />
                </div>

                
            </section>
        </main>
    </div>
</template>
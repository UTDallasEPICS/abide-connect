<script setup lang="ts">
import TopNav from '~/components/topNav.vue';
import { useRouter } from 'vue-router';
import { ref, computed } from 'vue'

// type for API 
type Notification = {
  id: string   
  title: string
  content: string
  createdAt: string
  isRead: boolean
}

// notifications
const notifications = ref<Notification[]>([
  {
    id: '1',
    title: 'Notification 1',
    content: 'This is a single-paragraph, extra-long message intended to test truncation, line-clamping, and overflow behaviors in your accordion header preview; it includes numbers (1234567890), punctuation (.,;:!?—), mixed casing, and a few repeat phrases to extend length: please arrive early, bring identification, confirm your insurance, hydrate beforehand, and contact us if you have any questions or need to reschedule; we appreciate your patience as we finalize your appointment details and look forward to seeing you soon at Abide Women’s Health for your upcoming visit on Monday, November 17, 2025 at 10:00 AM; ',
    createdAt: '2025-10-27T10:30:00Z',
    isRead: false
  },
  {
    id: '2',
    title: 'Notification 2',
    content: 'Message 2',
    createdAt: '2025-10-26T14:15:00Z',
    isRead:false
  },
  {
    id: '3',
    title: 'Notification 3',
    content: 'Message 3',
    createdAt: '2025-10-25T09:00:00Z',
    isRead: false
  }
])

const preview = (text: string, max=44) =>
  text.length > max ? text.slice(0,max).trim() + '...' : text



// map to uaccordion items
const accordionItems = computed(() => 
  notifications.value.map(n => ({
    id: n.id,
    label: n.title,
    content: n.content,
    time: formatTime(n.createdAt),
    isRead: n.isRead,
    preview: preview(n.content)
  }))
)

const markAsRead = (id: string) => {
    const notification = notifications.value.find(n => n.id == id) 
    if (notification && !notification.isRead) {
        notification.isRead = true
    }
}


const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


const router = useRouter()
const goBack = async () => {
  await navigateTo('/home', { replace: true }) 
}

</script>

<template>
    <!-- phone screen -->
    <div class="min-h-screen bg-gray-100 flex justify-center py-6">
        <div class="w-[375px] bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col max-h-[812px] overflow-y-auto">
            <!-- Top Nav Bar -->
             <TopNav>
                <template #right>
                    <UButton 
                        color="neutral"
                        variant="ghost"
                        @click="goBack">
                        <UIcon name="i-heroicons-arrow-left" class="w-7 h-7 text-teal-900"/>
                    </UButton>
                </template>
             </TopNav>

             <!-- Notifications accordion -->
             <div class="px-2 mt-4">
                <UAccordion
                    type="multiple"
                    :items="accordionItems"
                    :ui="{
                        item: 'border-none py-0 px-2',
                        content: 'border-none py-0 px-3 p-0',
                        header: 'border-none py-0 px-3 p-0'
                    }"
                    >

                    <!-- Header -->
                    <template #default="{ item, open }">
                        <div 
                        @click="markAsRead(item.id)"
                        class=" bg-white w-full">
                            <div class="flex items-start gap-3">
                                <UIcon name="i-heroicons-bell" 
                                :class="!item.isRead ? 'w-5 h-5 text-teal-700 flex-shrink-0' : 'w-5 h-5 text-bold flex-shrink-0'"/>
                                <div class="flex-1 min-w-0 flex items-start justify-between gap-35">
                                <h3 :class="!item.isRead ? 'text-[17px] font-extrabold text-[#3a696e] leading-tight flex-1 truncate' : 'text-[17px] font-semibold text-[#3a696e] leading-tight flex-1 truncate' ">                               
                                {{ item.label }}
                                </h3>
                                
                                <span class="text-[13px] text-[#a4123f] whitespace-nowrap flex-shrink-0" >
                                    {{ item.time }}
                                </span>
                                </div>
                            </div>
                            <p 
                                v-show="!open"
                                :class="!item.isRead ? 'mt-1 py-3 px-2 font-bold text-[13px] text-gray-600 leading-snug' : 'mt-1 py-2 px-2 text-[13px] text-gray-600 leading-snug'">
                                {{ item.preview }}
                            </p>
                        </div>
                    </template>
                    <!-- body message-->
                     <template #content="{ item }">
                        <div   
                            class="rounded-xl border-gray-200 bg-white overflow-hidden">
                            <div 
                            class="py-1 px-2 font-semibold text-[13px] text-gray-600 leading-relaxed">
                                {{ item.content }}
                            </div>
                        </div>
                     </template>
                </UAccordion>
             </div>
        </div>
    </div>
</template>


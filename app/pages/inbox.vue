<script setup lang="ts">
import TopNav from '~/components/TopNav.vue';
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


// map to uaccordion items
const accordionItems = computed(() => 
  notifications.value.map(n => ({
    id: n.id,
    label: n.title,
    content: n.content,
    time: formatTime(n.createdAt),
    isRead: n.isRead,
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
    <div class="flex flex-col w-screen h-screen bg-white items-stretch">
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
             <div class="flex-1 w-full mx-auto mt-15">
                <UAccordion
                    type="multiple"
                    class="bg-white w-full px-5 mb-10"
                    :items="accordionItems"
                    :ui="{
                        item: 'border-none pr-2 mt-5',
                        header: 'pr-5',
                        trigger: 'block w-full text-left p-0',
                        trailingIcon: 'hidden pointer-events-none'
                    }"
                    >

                    <!-- Header -->
                    <template #default="{ item, open }">
                        <div 
                        @click="markAsRead(item.id)"
                        class="w-full">
                            <div class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 w-full">
                              <UIcon name="i-heroicons-bell" class="w-5 h-5 text-[#3a696e]" />
                                <h3 class="min-w-0 line-clamp-1 truncate leading-tight"
                                :class="!item.isRead ? 'text-[20px] font-extrabold text-[#3a696e]' : 'text-[20px] font-semibold text-[#3a696e]' ">                               
                                {{ item.label }}
                                </h3>
                                
                                <span class="whitespace-nowrap text-[13px] text-[#a4123f] leading-tight" >
                                    {{ item.time }}
                                </span>
                                <UIcon
                                  name="i-heroicons-chevron-down-20-solid"
                                  class="w-5 h-5 transition-transform duration-200"
                                  :class="open ? 'rotate-180' : ''"
                                />
                            </div>
                            <p 
                                v-show="!open"
                                class="pl-7 mt-5"
                                :class="!item.isRead ? 'font-bold text-[13px] text-gray-600 leading-relaxed line-clamp-1' : 'font-semibold text-[13px] text-gray-600 leading-relaxed line-clamp-1'">
                                {{ item.content }}
                            </p>
                        </div>
                    </template>
                    <!-- body message-->
                     <template #content="{ item, open }">
                        <div 
                          class="mt-5 pl-7"
                          :class="open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'" >
                            <div class="overflow-hidden"> 
                              <div 
                              class="font-semibold text-[13px] text-gray-600 leading-relaxed ">
                                  {{ item.content }}
                              </div>
                            </div>
                        </div> 
                     </template>
                </UAccordion>
             </div>
        </div>
</template>


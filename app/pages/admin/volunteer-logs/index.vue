<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const activeTab = ref('pending')
const router = useRouter()

function goToLog(id: string) {
    router.push(`/admin/volunteer-logs/${id}`)
}

const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' }
]

type LogStatus = 'pending' | 'approved' | 'rejected'

interface VolunteerLog {
    id: string
    name: string
    event: string
    date: string
    hours: number
    status: LogStatus
}

// placeholder data for logs
const logs = ref<VolunteerLog[]>([
    { id: '1', name: 'John', event: 'Event 1', date: 'Feb 1, 2026', hours: 4, status: 'pending' },
    { id: '2', name: 'Sofia', event: 'Event 2', date: 'Jan 10, 2026', hours: 3, status: 'pending' },
    { id: '3', name: 'Emily', event: 'Event 3', date: 'Mar 3, 2025', hours: 2, status: 'approved' },
    { id: '4', name: 'Josh', event: 'Event 4', date: 'Apr 4, 2025', hours: 5, status: 'rejected' }
])

const filteredLogs = computed(() => 
    logs.value.filter(log => log.status === activeTab.value)
)

</script>

<template>
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20">

        <!-- page content -->
         <div class="px-6 pt-20">
            <h1 class="text-3xl font-bold">
                Volunteer Log <span class="text-teal-600">Approvals</span>
            </h1>

            <!-- tabs-->
             <div class="flex gap-3 mt-6">
                <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    @click="activeTab =tab.id"
                    class="px-4 py-2 rounded-full border"
                    :class="activeTab === tab.id
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'"
                        >
                    {{  tab.label }}
                </button>
             </div>
            <USeparator class="mt-8"/>
             <!-- logs -->
             <div class="mt-8 space-y-4 hover">
                <div 
                    v-for="log in filteredLogs"
                    :key="log.id"
                    class="bg-white rounded-xl shadow-sm p-5 flex justify-between items-centered"
                    @click="goToLog(log.id)"
                    >
                    <div>
                        <h2 class="text-lg font-semibold">
                            {{  log.name }}

                        </h2>
                        <p class="text-sm text-gray-500 flex gap-3">
                            <span>{{  log.event }}</span>
                            <span>{{ log.date }}</span>
                        </p>
                    </div>
                    
                    <div class="text-right">
                        <p class="text-xl font-bold text-teal-600">
                            {{  log.hours }} hrs
                        </p>
                    </div>
                    <div class="flex gap-2"
                        v-if="log.status === 'pending'">
                        <button class="px-3 py-1 rounded-full bg-teal-400"
                        @click="log.status = 'approved'">
                            Approve
                        </button>
                        <button class="px-3 py-1 rounded-full bg-rose-400"
                        @click="log.status = 'rejected'">
                            Reject
                        </button>
                    </div>
                </div>
            </div>
         </div>
    </div>
</template>
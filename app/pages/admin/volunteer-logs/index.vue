<script setup lang="ts">
const activeTab = ref('pending')
const router = useRouter()


const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' }
]

function setStatus(id: string, status: LogStatus) {
  const log = logs.value.find((l) => l.id === id)
  if (log) log.status = status
}
function approve(id: string) {
  setStatus(id, 'approved')
}

type LogStatus = 'pending' | 'approved' | 'rejected'

interface VolunteerLog {
    id: string
    name: string
    event: string
    date: string
    hours: number
    status: LogStatus
    notes?: string
    rejectReason?: string
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

const accordionItems = computed(() =>
  filteredLogs.value.map((log) => ({
    id: log.id,
    label: log.name,
    event: log.event,
    date: log.date,
    hours: log.hours,
    status: log.status,
    notes: log.notes ?? '',
    rejectReason: log.rejectReason ?? ''
  }))
)



// local UI state for inline reject
const rejectingId = ref<string | null>(null)
const rejectDraft = ref<Record<string, string>>({})

function startReject(id: string) {
  rejectingId.value = id
  const log = logs.value.find(l => l.id === id)
  // prefill if previously rejected
  rejectDraft.value[id] = log?.rejectReason ?? ''
}

function cancelReject() {
  rejectingId.value = null
}

function confirmReject(id: string) {
  const reason = (rejectDraft.value[id] ?? '').trim()
  if (!reason) return

  const log = logs.value.find(l => l.id === id)
  if (!log) return

  log.rejectReason = reason
  setStatus(id, 'rejected')
  rejectingId.value = null
}


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
             <div class="mt-8">
                <UAccordion
                    type="multiple"
                    class="bg-slate-50 w-full"
                    :items="accordionItems"
                    :ui="{
                        item: 'border-none mt-4',
                        header: 'px-0',
                        trigger: 'block w-full text-left p-0',
                        trailingIcon: 'hidden pointer-events-none'
                    }"
                    >
                    <!-- Header (matches inbox pattern) -->
                    <template #default="{ item, open }">
                        <div class="bg-white rounded-xl p-5">
                            <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 w-full">
                                <div class="min-w-0">
                                <h2 class="text-lg font-semibold truncate">{{ item.label }}</h2>
                                <p class="text-sm text-gray-500 flex gap-3">
                                    <span class="truncate">{{ item.event }}</span>
                                    <span class="whitespace-nowrap">{{ item.date }}</span>
                                </p>
                                </div>

                                <p class="text-xl font-bold text-teal-600 whitespace-nowrap">
                                {{ item.hours }} hrs
                                </p>

                                <span
                                class="text-gray-400 transition-transform duration-200"
                                :class="open ? 'rotate-180' : ''"
                                >
                                ▾
                                </span>
                            </div>
                        </div>
                        </template>
                            <!-- Expanded content -->
                            <template #content="{ item }">
                                <div class="bg-white rounded-xl shadow-sm px-5 pb-5 mt-1 ">
                                <div class="rounded-lg bg-white p-4 text-sm text-gray-700 space-y-2">
                                    <p><span class="font-medium">Event:</span> {{ item.event }}</p>
                                    <p><span class="font-medium">Date:</span> {{ item.date }}</p>
                                    <p><span class="font-medium">Hours:</span> {{ item.hours }}</p>
                                    <p><span class="font-medium">Status:</span> {{ item.status }}</p>
                                    <p v-if="item.notes"><span class="font-medium">Notes:</span> {{ item.notes }}</p>
                                    <p v-if="item.rejectReason"><span class="font-medium">Rejection Reason:</span> {{ item.rejectReason }}</p>
                                </div>

                                <div v-if="item.status === 'pending'" class="space-y-3">
                                    <!-- Normal buttons -->
                                    <div v-if="rejectingId !== item.id" class="flex gap-2">
                                        <button
                                        class="px-4 py-2 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                                        @click.stop="approve(item.id)"
                                        >
                                        Approve
                                        </button>

                                        <button
                                        class="px-4 py-2 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                                        @click.stop="startReject(item.id)"
                                        >
                                        Reject
                                        </button>
                                    </div>
                                    <!-- Inline reject reason (only for this log) -->
                                    <div v-else class="mt-3 space-y-2">
                                        <label class="text-sm font-medium text-gray-700">
                                        Rejection reason <span class="text-rose-600">*</span>
                                        </label>

                                        <textarea
                                        v-model="rejectDraft[item.id]"
                                        rows="3"
                                        class="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                                        @click.stop
                                        />

                                        <div class="flex gap-2">
                                        <button
                                            class="px-4 py-2 rounded-lg border"
                                            @click.stop="cancelReject"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            class="px-4 py-2 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                                            :disabled="!(rejectDraft[item.id] || '').trim()"
                                            @click.stop="confirmReject(item.id)"
                                        >
                                            Confirm Reject
                                        </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                </UAccordion>
            </div>
         </div>
    </div>
</template>
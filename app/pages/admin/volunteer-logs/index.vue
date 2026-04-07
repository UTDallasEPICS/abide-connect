<script setup lang="ts">
const activeTab = ref('PENDING')


const tabs = [
    { id: 'PENDING', label: 'Pending' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' }
]

function setStatus(id: string, status: LogStatus) {
  const log = logs.value.find((l) => l.id === id)
  if (log) log.status = status
}

type LogStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type ActionType = 'approve' | 'reject'


interface VolunteerLog {
    id: string
    name: string
    event: string
    date: string
    hours: number
    status: LogStatus
    comment?: string
}

// placeholder data for logs
const logs = ref<VolunteerLog[]>([
    { id: '1', name: 'John', event: 'Event 1', date: 'Feb 1, 2026', hours: 4, status: 'PENDING' },
    { id: '2', name: 'Sofia', event: 'Event 2', date: 'Jan 10, 2026', hours: 3, status: 'PENDING' },
    { id: '3', name: 'Emily', event: 'Event 3', date: 'Mar 3, 2025', hours: 2, status: 'APPROVED' },
    { id: '4', name: 'Josh', event: 'Event 4', date: 'Apr 4, 2025', hours: 5, status: 'REJECTED' }
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
    comment: log.comment ?? ''
  }))
)



// local UI state for inline reject
// unified action state
const actioningId = ref<string | null>(null)
const actionType = ref<ActionType | null>(null)
const commentDraft = ref<Record<string, string>>({})

function startAction(id: string, type: ActionType) {
  actioningId.value = id
  actionType.value = type
  const log = logs.value.find((l: VolunteerLog) => l.id === id)
  commentDraft.value[id] = log?.comment ?? ''
}

function cancelAction() {
  actioningId.value = null
  actionType.value = null
}

function confirmAction(id: string) {
  if (!actionType.value) return

  const log = logs.value.find((l: VolunteerLog) => l.id === id)
  if (!log) return

  // comment is optional for approve, required for reject
  if (actionType.value === 'reject') {
    const reason = (commentDraft.value[id] ?? '').trim()
    if (!reason) return
    log.comment = reason
  } else {
    log.comment = (commentDraft.value[id] ?? '').trim() || undefined
  }

  setStatus(id, actionType.value === 'approve' ? 'APPROVED' : 'REJECTED')
  actioningId.value = null
  actionType.value = null
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
                    class="px-4 py-2 rounded-full border"
                    :class="activeTab === tab.id
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'"
                    @click="activeTab =tab.id"
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
                                    <p v-if="item.comment"><span class="font-medium">Comment:</span> {{ item.comment }}</p>
                                </div>

                                <div v-if="item.status === 'PENDING'" class="space-y-3">
                                    <!-- Normal buttons -->
                                    <div v-if="actioningId !== item.id" class="flex gap-2">
                                        <button
                                        class="px-4 py-2 rounded-full bg-teal-600 text-white hover:bg-teal-700"
                                        @click.stop="startAction(item.id, 'approve')"
                                        >
                                        Approve
                                        </button>

                                        <button
                                        class="px-4 py-2 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                                        @click.stop="startAction(item.id, 'reject')"
                                        >
                                        Reject
                                        </button>
                                    </div>
                                    <!-- Inline reject reason (only for this log) -->
                                    <div v-else class="mt-3 space-y-2">
                                        <label class="text-sm font-medium text-gray-700">
                                        {{ actionType === 'reject' ? 'Rejection reason' : 'Comment (optional)' }}
                                        <span v-if="actionType === 'reject'" class="text-rose-600">*</span>
                                        </label>

                                        <textarea
                                        v-model="commentDraft[item.id]"
                                        rows="3"
                                        class="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                                        :class="actionType === 'reject' ? 'focus:ring-rose-300' : 'focus:ring-teal-300'"
                                        @click.stop
                                        />

                                        <div class="flex gap-2">
                                        <button
                                            class="px-4 py-2 rounded-lg border"
                                            @click.stop="cancelAction"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            class="px-4 py-2 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                                            :class="actionType === 'reject' ? 'bg-rose-600' : 'bg-teal-600'"
                                            :disabled="actionType === 'reject' && !(commentDraft[item.id] || '').trim()"
                                            @click.stop="confirmAction(item.id)"
                                        >
                                            {{ actionType === 'reject' ? 'Confirm Reject' : 'Confirm Approve' }}
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
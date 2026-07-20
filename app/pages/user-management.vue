<script setup lang="ts">
import SectionButton from '~/components/buttons/SectionButton.vue';
import UserAvatar from '~/components/UserAvatar.vue';
definePageMeta({
  layout: 'secondary',
  backText: 'Management'
})
const filters = [
  { label: 'ALL (100)', value: 'users' },
  { label: 'VOLUNTEERS', value: 'volunteers' },
  { label: 'ADMINS', value: 'admins' }
]
const selected = ref('users')
const search = ref('')

interface User {
  id: string
  name: string
  email: string
  roles: ('USER' | 'ADMIN' | 'VOLUNTEER')[]
  hours: number
  avatarUrl?: string | null
}

const users: User[] = [
  { id: '123', name: 'Omar Sabry', email: 'omar.sabry@gmail.com', roles: ['USER', 'ADMIN'], hours: 50, avatarUrl: undefined },
  { id: '124', name: 'Sara Ahmed', email: 'sara.ahmed@gmail.com', roles: ['VOLUNTEER', 'USER'], hours: 32, avatarUrl: undefined },
  { id: '125', name: 'Youssef Kamal', email: 'y.kamal@gmail.com', roles: ['USER'], hours: 12, avatarUrl: undefined },
  { id: '126', name: 'Nour Hassan', email: 'nour.hassan@gmail.com', roles: ['VOLUNTEER', 'ADMIN', 'USER'], hours: 88, avatarUrl: undefined },
]

const roleStyles: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  VOLUNTEER: 'bg-amber-100 text-amber-700',
  USER: 'bg-gray-200 text-gray-600',
}

// Fixed display order so badges don't jump around row to row
const roleOrder: Record<string, number> = {
  ADMIN: 0,
  VOLUNTEER: 1,
  USER: 2,
}

function sortedRoles(roles: User['roles']) {
  return [...roles].sort((a, b) => roleOrder[a] - roleOrder[b])
}

// Pagination
const pageSize = 10
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(users.length / pageSize)))

const paginatedUsers = computed(() => {
  const start = (page.value - 1) * pageSize
  return users.slice(start, start + pageSize)
})

function prevPage() {
  if (page.value > 1) page.value--
}

function nextPage() {
  if (page.value < totalPages.value) page.value++
}
</script>

<template>
  <div class="w-full max-w-(--ui-container) mx-auto mt-19 min-h-[calc(100vh-4.75rem)] flex flex-col">
    <!-- This margin aligns the page content with the back button -->
    <div class="mx-10">
      <!-- Title -->
      <h1 class="text-2xl font-normal">
        <span class="font-light text-gray-500">Member</span>
        <br>
        <span class="text-teal-700 font-bold">Management</span>
      </h1>
      <!-- Search bar -->
      <UInput
        v-model="search"
        placeholder="Search members..."
        class="w-full my-5 font-normal"
        icon="i-lucide-search"
      />
      <!-- User role selector -->
      <div class="w-full flex gap-2">
        <SectionButton
          v-for="filter in filters"
          :key="filter.value"
          :label="filter.label"
          :selected="selected === filter.value"
          @click="selected = filter.value"
        />
      </div>
    </div>

    <!-- Full-bleed gray background for the user list -->
    <div class="w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-gray-50 flex-1 min-h-0 mt-7 rounded-4xl">
      <!-- Inner content stays aligned with the rest of the page -->
      <div class="w-full max-w-(--ui-container) mx-auto px-10 pt-5 pb-10 h-full flex flex-col">
        <div class="w-full flex-1 min-h-0 rounded-lg border border-gray-300 divide-y divide-gray-300 overflow-y-auto bg-white">
          <!-- Users -->
          <div
            v-for="user in paginatedUsers"
            :key="user.id"
            class="p-3 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <!-- User profile picture -->
              <div class="w-10 h-10 shrink-0">
                <UserAvatar :name="user.name" :src="user.avatarUrl" />
              </div>

              <!-- User name and roles -->
              <div>
                <p class="font-semibold">{{ user.name }}</p>
                <p class="font-normal text-gray-400 text-sm">{{ user.email }}</p>
                <div class="flex gap-1 mt-2">
                  <div
                    v-for="role in sortedRoles(user.roles)"
                    :key="role"
                    class="font-semibold text-xs rounded-full py-1 px-3"
                    :class="roleStyles[role]"
                  >
                    {{ role }}
                  </div>
                  <div class="font-normal text-xs text-gray-400 py-1 px-3">
                    {{ user.hours }} hours
                  </div>
                </div>
              </div>
            </div>

            <!-- Edit user -->
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              class="text-gray-400"
              @click="navigateTo(`/admin/users/${user.id}/edit`)"
            />
          </div>

          <!-- Empty state -->
          <div
            v-if="users.length === 0"
            class="flex flex-col items-center justify-center text-center py-16 px-6"
          >
            <p class="text-sm text-gray-400 mt-1">No users found.</p>
          </div>
        </div>

        <!-- Page counter -->
        <div v-if="users.length > 0" class="w-full flex items-center justify-center gap-4 pt-4">
          <UButton
            icon="i-lucide-chevron-left"
            variant="ghost"
            color="neutral"
            :disabled="page === 1"
            @click="prevPage"
          />
          <span class="text-sm font-semibold text-gray-600 min-w-6 text-center">{{ page }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            variant="ghost"
            color="neutral"
            :disabled="page === totalPages"
            @click="nextPage"
          />
        </div>
      </div>
    </div>
  </div>
</template>
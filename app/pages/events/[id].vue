<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css'
import { useColorMode } from '#imports'
import {
  canRegisterAsAttendee,
  canSignUpAsVolunteer,
  eventTypeFromFlags,
  eventTypeLabel,
  type EventViewer,
  type VolunteerStatus,
} from '#shared/utils/eventType'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const route = useRoute()
const eventId = route.params.id as string

const { data: event, error, refresh } = await useFetch(`/api/events/${eventId}`)

const notFound = ref(false)

if (error.value) {
  console.error('Failed to load event:', error.value)
  notFound.value = true
}

const isEditMode = ref(false)
const editForm = ref<any>({})

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: roles } = await useFetch<string[]>('/api/user/roles', {
  headers,
  default: () => [],
})
const { data: myVolunteer } = await useFetch<{ approvalStatus?: string } | null>(
  '/api/volunteer/me',
  { headers, default: () => null },
)
const isAdmin = computed(() => roles.value?.includes('admin') ?? false)

const viewer = computed<EventViewer>(() => ({
  isAdmin: isAdmin.value,
  volunteerStatus: (myVolunteer.value?.approvalStatus as VolunteerStatus) ?? 'NONE',
}))

const eventType = computed(() => eventTypeFromFlags(event.value ?? {}))
const hasEnded = computed(() =>
  !!event.value?.endTime && new Date(event.value.endTime) < new Date(),
)
// Volunteering needs a volunteer profile, but no staff approval — one tap and
// you're on the list.
const canVolunteer = computed(() => canSignUpAsVolunteer(eventType.value, viewer.value))
const canAttend = computed(() => canRegisterAsAttendee(eventType.value))

// The current user's own sign-up, so we show their status instead of
// offering the button again.
const { data: myRsvp, refresh: refreshMyRsvp } = await useFetch<{ isVolunteer: boolean } | null>(
  `/api/events/${eventId}/my-rsvp`,
  { headers, default: () => null },
)
const isSignedUpToVolunteer = computed(() => myRsvp.value?.isVolunteer === true)
const isRegisteredToAttend = computed(() => myRsvp.value?.isVolunteer === false)

const showRsvpModal = ref(false)
const rsvpIsVolunteer = ref(false)
const rsvpStatsRef = ref<any>(null)
const signUpPending = ref(false)
const signUpError = ref('')

function openRsvpModal(isVolunteer: boolean) {
  rsvpIsVolunteer.value = isVolunteer
  showRsvpModal.value = true
}

async function onRsvpSuccess() {
  showRsvpModal.value = false
  await Promise.all([refreshMyRsvp(), rsvpStatsRef.value?.refresh()])
}

function signUpErrorMessage(err: unknown, fallback: string) {
  return (err as { data?: { message?: string } })?.data?.message || fallback
}

/** One-tap volunteer sign-up for the logged-in volunteer. */
async function signUpAsVolunteer() {
  signUpPending.value = true
  signUpError.value = ''
  try {
    await $fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: { isVolunteer: true },
    })
    await Promise.all([refreshMyRsvp(), rsvpStatsRef.value?.refresh()])
  }
  catch (err) {
    signUpError.value = signUpErrorMessage(err, 'Could not sign you up. Please try again.')
  }
  finally {
    signUpPending.value = false
  }
}

async function cancelSignUp() {
  signUpPending.value = true
  signUpError.value = ''
  try {
    await $fetch(`/api/events/${eventId}/rsvp`, { method: 'DELETE', body: {} })
    await Promise.all([refreshMyRsvp(), rsvpStatsRef.value?.refresh()])
  }
  catch (err) {
    signUpError.value = signUpErrorMessage(err, 'Could not cancel your sign-up. Please try again.')
  }
  finally {
    signUpPending.value = false
  }
}

const filesToUpload = ref<File[]>([])

function enterEditMode() {
  editForm.value = {
    ...event.value,
    eventType: eventType.value,
    startTime: event.value?.startTime ? formatForInput(event.value.startTime) : '',
    endTime: event.value?.endTime ? formatForInput(event.value.endTime) : '',
  }
  isEditMode.value = true
}

function cancelEdit() {
  isEditMode.value = false
  filesToUpload.value = []
}

function formatForInput(isoString: string) {
  return new Date(isoString).toISOString().slice(0, 16)
}

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveChanges() {
  try {
    await $fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: {
        title: editForm.value.title,
        shortDesc: editForm.value.shortDesc,
        description: editForm.value.description,
        location: editForm.value.location?.address || editForm.value.location,
        startTime: new Date(editForm.value.startTime).toISOString(),
        endTime: new Date(editForm.value.endTime).toISOString(),
        eventType: editForm.value.eventType,
      },
    })

    for (const file of filesToUpload.value) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await $fetch(`/api/events/${eventId}/images/upload`, {
          method: 'POST',
          body: formData,
        })
      }
      catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }

    filesToUpload.value = []
    isEditMode.value = false
    await refresh()
  }
  catch (error) {
    console.error('Error updating event:', error)
  }
}

const formattedDate = computed(() => {
  if (!event.value) return ''
  const start = new Date(event.value.startTime)
  const end = new Date(event.value.endTime)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} • ${startTime} - ${endTime}`
})

const carouselItems = computed(() => {
  const assets = event.value?.eventAssets || []
  if (assets.length > 0) {
    return assets.map((a: any) => `/api/events/${a.imageUrl}`)
  }
  return [
    'https://picsum.photos/640/640?random=1',
    'https://picsum.photos/640/640?random=2',
    'https://picsum.photos/640/640?random=3',
  ]
})

const mapStyle = '/mapstyles.json'
const center = computed(() => {
  if (!event.value?.location) return [0, 0]
  return [event.value.location.longitude, event.value.location.latitude]
})
const zoom = 15

const backNavigate = computed(() => isAdmin.value ? '/events/manage' : '/events')

const brandColor = computed(() => isDark.value ? 'brand8' : 'brand4')
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center min-h-screen"
    >
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
        <p class="text-gray-600 dark:text-gray-300">
          Loading event...
        </p>
      </div>
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="notFound"
      class="flex items-center justify-center min-h-screen dark:bg-gray-900"
    >
      <div class="text-center">
        <UIcon
          name="i-lucide-calendar-x"
          class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4"
        />
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Event Not Found
        </h2>
        <p class="text-gray-600 dark:text-gray-300 mb-4">
          The event you're looking for doesn't exist.
        </p>
        <UButton
          icon="i-lucide-arrow-left"
          :color="brandColor"
          @click="navigateTo('/eventManagement')"
        >
          Back to Events
        </UButton>
      </div>
    </div>

    <!-- Event Details -->
    <div v-else-if="event">
      <!-- Sticky Header -->
      <div class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10 mt-16 border-b border-transparent dark:border-gray-700">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            :class="isDark ? 'text-brand8' : 'text-brand4'"
            @click="navigateTo(backNavigate)"
          />

          <div
            v-if="isAdmin"
            class="flex gap-2"
          >
            <UButton
              v-if="!isEditMode"
              icon="i-lucide-pencil"
              :color="brandColor"
              variant="soft"
              @click="enterEditMode"
            >
              Edit Event
            </UButton>

            <template v-else>
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelEdit"
              >
                Cancel
              </UButton>
              <UButton
                icon="i-lucide-check"
                :color="brandColor"
                @click="async () => { await saveChanges() }"
              >
                Save Changes
              </UButton>
            </template>
          </div>
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Title -->
        <div class="mb-6">
          <h1
            v-if="!isEditMode"
            class="text-3xl font-hornbill font-bold mb-2 text-center text-brand4 dark:text-brand8"
          >
            {{ event.title }}
          </h1>
          <UInput
            v-else
            v-model="editForm.title"
            size="xl"
            placeholder="Event Title"
          />
        </div>

        <!-- Short Description -->
        <div
          v-if="event.shortDesc || isEditMode"
          class="bg-brand6 dark:bg-gray-800 rounded-2xl p-3 mb-6 border border-transparent dark:border-gray-700"
        >
          <p
            v-if="!isEditMode"
            class="text-md text-gray-700 dark:text-gray-300 italic"
          >
            {{ event.shortDesc }}
          </p>
          <UInput
            v-else
            v-model="editForm.shortDesc"
            placeholder="Short Description"
            size="lg"
          />
        </div>

        <!-- Carousel (view mode) -->
        <div
          v-if="!isEditMode"
          class="mb-8"
        >
          <UCarousel
            v-slot="{ item }"
            dots
            :items="carouselItems"
            class="h-80 max-w-xs mx-auto"
          >
            <img
              :src="item"
              class="h-80 w-auto rounded-lg mx-auto object-cover"
            >
          </UCarousel>
        </div>

        <!-- Image management (edit mode) -->
        <div
          v-else
          class="mb-8"
        >
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Event Images</label>
          <EventImageUpload
            :existing-assets="event.eventAssets"
            :event-id="eventId"
            @files-changed="onFilesChanged"
          />
        </div>

        <!-- Date & Location -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700">
          <div class="flex items-start gap-4 mb-4">
            <div class="bg-brand6 dark:bg-gray-700 p-3 rounded-xl">
              <UIcon
                name="i-lucide-calendar"
                class="w-6 h-6 text-brand4 dark:text-brand8"
              />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Date & Time
              </p>
              <p
                v-if="!isEditMode"
                class="text-gray-900 dark:text-white font-medium"
              >
                {{ formattedDate }}
              </p>
              <div
                v-else
                class="grid grid-rows-2 gap-2"
              >
                <div>
                  <label class="text-xs text-gray-500 dark:text-gray-400">Start</label>
                  <UInput
                    v-model="editForm.startTime"
                    type="datetime-local"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 dark:text-gray-400">End</label>
                  <UInput
                    v-model="editForm.endTime"
                    type="datetime-local"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="bg-brand6 dark:bg-gray-700 p-3 rounded-xl">
              <UIcon
                name="i-lucide-map-pin"
                class="w-6 h-6 text-brand4 dark:text-brand8"
              />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Location
              </p>
              <p
                v-if="!isEditMode"
                class="text-gray-900 dark:text-white font-medium"
              >
                {{ event.location.address }}
              </p>
              <UInput
                v-else
                v-model="editForm.location.address"
                placeholder="Event Location"
              />
            </div>
          </div>
        </div>

        <div
          v-if="!isEditMode"
          id="map"
          class="h-60 relative overflow-hidden justify-center items-center mb-6"
        >
          <MapInteractive
            :style="mapStyle"
            :center="center"
            :zoom="zoom"
          />
        </div>

        <!-- Description -->
        <div class="dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700 shadow-md">
          <h2 class="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            About This Event
          </h2>
          <p
            v-if="!isEditMode"
            class="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line"
          >
            {{ event.description }}
          </p>
          <UTextarea
            v-else
            v-model="editForm.description"
            placeholder="Full event description"
            :rows="6"
          />
        </div>

        <div
          v-if="event.mobileClinicId"
          class="mt-4 mb-4"
        >
          <p class="text-gray-600 dark:text-gray-300 font-poppins">
            This event is part of our Mobile Clinic program. Please
            visit the clinic for health services and support.
          </p>
        </div>

        <!-- Event Settings (admin edit mode) -->
        <div
          v-if="isAdmin && isEditMode"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6 border border-transparent dark:border-gray-700"
        >
          <h2 class="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Event Settings
          </h2>

          <div class="space-y-4">
            <EventTypeSelector
              v-model="editForm.eventType"
              :color="brandColor"
            />

            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div class="flex items-center gap-3">
                <UIcon
                  name="i-lucide-ticket"
                  class="w-5 h-5 text-brand4 dark:text-brand8"
                />
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    Mobile Clinic
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Will this event have a mobile clinic?
                  </p>
                </div>
              </div>
              <label
                v-if="isEditMode"
                class="flex items-center gap-2 cursor-pointer"
              >
                <UCheckbox
                  v-model="editForm.mobileClinic"
                  :color="brandColor"
                />
              </label>
              <label
                v-else
                class="flex items-center gap-2"
              >
                <UCheckbox
                  :model-value="Boolean(event.mobileClinicId)"
                  :color="brandColor"
                  disabled
                />
              </label>
            </div>
          </div>
        </div>

        <!-- Training approvals (staff only, once the training has finished) -->
        <EventTrainingApprovals
          v-if="event.isTraining && isAdmin && !isEditMode && hasEnded"
          :event-id="eventId"
        />
        <div
          v-else-if="event.isTraining && isAdmin && !isEditMode"
          class="dark:bg-gray-800 rounded-2xl shadow-md p-6 mb-6 border border-transparent dark:border-gray-700 flex items-center gap-3"
        >
          <UIcon
            name="i-lucide-clock"
            class="w-5 h-5 text-brand4 dark:text-brand8 shrink-0"
          />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Volunteer approvals open once this training has finished, so you can
            approve the people who actually attended.
          </p>
        </div>

        <!-- RSVP Stats -->
        <EventRSVPStats
          v-if="isAdmin && !isEditMode"
          ref="rsvpStatsRef"
          :event-id="eventId"
          :admin="isAdmin"
        />

        <!-- Action Buttons -->
        <div
          v-if="!isEditMode"
          class="space-y-3"
        >
          <p
            v-if="eventType === 'VOLUNTEERS' || eventType === 'TRAINING'"
            class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <UIcon
              name="i-lucide-lock"
              class="w-4 h-4"
            />
            {{ eventTypeLabel(eventType) }} — only visible to volunteers
          </p>

          <!-- Already signed up: no approval step, so just confirm it -->
          <div
            v-if="isSignedUpToVolunteer"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand6 dark:bg-gray-800 px-4 py-3"
          >
            <span class="flex items-center gap-2 text-sm font-medium text-brand4 dark:text-brand8">
              <UIcon
                name="i-lucide-check-circle-2"
                class="w-5 h-5"
              />
              You're signed up to volunteer
            </span>
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              :loading="signUpPending"
              @click="cancelSignUp"
            >
              Cancel sign-up
            </UButton>
          </div>

          <div class="flex gap-4">
            <UButton
              v-if="canVolunteer && !isSignedUpToVolunteer"
              :color="brandColor"
              size="xl"
              block
              icon="i-lucide-heart-handshake"
              :loading="signUpPending"
              @click="signUpAsVolunteer"
            >
              Sign Up as Volunteer
            </UButton>
            <UButton
              v-if="canAttend && !isRegisteredToAttend"
              :color="brandColor"
              variant="outline"
              size="xl"
              block
              icon="i-lucide-ticket"
              @click="openRsvpModal(false)"
            >
              Register to Attend
            </UButton>
          </div>

          <div
            v-if="isRegisteredToAttend"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand6 dark:bg-gray-800 px-4 py-3"
          >
            <span class="flex items-center gap-2 text-sm font-medium text-brand4 dark:text-brand8">
              <UIcon
                name="i-lucide-check-circle-2"
                class="w-5 h-5"
              />
              You're registered to attend
            </span>
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              :loading="signUpPending"
              @click="cancelSignUp"
            >
              Cancel registration
            </UButton>
          </div>

          <p
            v-if="signUpError"
            class="text-sm text-red-500 text-center"
          >
            {{ signUpError }}
          </p>
        </div>

        <!-- RSVP Modal -->
        <Teleport to="body">
          <div
            v-if="showRsvpModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            @click.self="showRsvpModal = false"
          >
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-black/30 max-w-md w-full border border-transparent dark:border-gray-700">
              <EventRSVPModal
                :event-id="eventId"
                :is-volunteer="rsvpIsVolunteer"
                @success="onRsvpSuccess"
                @close="showRsvpModal = false"
              />
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>
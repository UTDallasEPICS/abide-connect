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

/**
 * Event detail page, doubling as the inline editor for admins.
 *
 * What renders depends on the viewer, assembled from four fetches (roles, own
 * profile, volunteer profile, existing RSVP):
 *   - admins get edit controls, the registration list and, for trainings, the
 *     volunteer approval panel;
 *   - approved volunteers get one-tap volunteer sign-up;
 *   - pending volunteers get sign-up on training events only;
 *   - other signed-in users get one-tap attendee registration, which records
 *     the name, phone and email on their account;
 *   - signed-out visitors can read the page but are sent to sign in or create
 *     an account, and come back here afterwards via `?redirect=`.
 *
 * The `canSignUpAsVolunteer` / `canRegisterAsAttendee` helpers are the same
 * ones the API enforces with, so the buttons shown match what the server will
 * accept. A viewer who shouldn't see the event at all gets a 404 from
 * `/api/events/[id]` rather than a 403, so `notFound` covers both cases.
 */

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
const saveError = ref('')

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: roles } = await useFetch<string[]>('/api/user/roles', {
  headers,
  default: () => [],
})
const { data: myVolunteer } = await useFetch<{ approvalStatus?: string } | null>(
  '/api/volunteer/me',
  { headers, default: () => null },
)
// The contact details a registration is made with. Returns null when logged
// out rather than 401ing, so it's safe to fetch unconditionally.
const { data: me } = await useFetch<{ name: string | null, email: string, phone: string | null } | null>(
  '/api/user/me',
  { headers, default: () => null },
)
// Phone is optional at sign-up, so an account can register without one — worth
// prompting for, since it's how staff reach an attendee on the day.
const missingPhone = computed(() => !me.value?.phone)

/** The contact line staff will see against this registration. */
const registeredAs = computed(() => {
  if (!me.value) return ''
  const name = me.value.name?.trim() || me.value.email
  return [name, me.value.email, me.value.phone].filter(Boolean).join(' · ')
})
const isAdmin = computed(() => roles.value?.includes('admin') ?? false)
// `/api/user/roles` returns [] when there's no session, and every signed-in
// user holds at least `user`.
const isSignedIn = computed(() => (roles.value?.length ?? 0) > 0)

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

interface EventTimeSlot {
  id: string
  startTime: string
  endTime: string
  capacity: number
  role: string | null
  note: string | null
  color: string | null
  signupCount: number
  spotsRemaining: number
  isFull: boolean
  viewerSignedUp: boolean
  /** Staff only. */
  signups?: { volunteerId: string, name: string, email: string }[]
}

const {
  data: timeSlotData,
  error: timeSlotError,
  refresh: refreshTimeSlots,
} = await useFetch<{ slots: EventTimeSlot[] }>(
  `/api/events/${eventId}/time-slots`,
  { headers, default: () => ({ slots: [] }) },
)

const timeSlots = computed(() => timeSlotData.value?.slots ?? [])

// Once an event has blocks, claiming a shift *is* how you volunteer for it —
// the one-tap sign-up is hidden so the two can't disagree.
const hasTimeSlots = computed(() => timeSlots.value.length > 0)

// Blocks are volunteer shifts, so they only belong on events volunteers sign
// up for. Kept visible while blocks still exist even if the admin switches the
// type, so they can be removed deliberately rather than silently discarded.
const acceptsTimeBlocks = computed(() =>
  editForm.value.eventType === 'VOLUNTEERS'
  || editForm.value.eventType === 'VOLUNTEERS_AND_ATTENDEES',
)

const rsvpStatsRef = ref<any>(null)
const signUpPending = ref(false)
const signUpError = ref('')

// Where an unregistered visitor is sent to attend, and what brings them back
// here once they have an account.
const loginLink = computed(() => ({
  path: '/auth/login',
  query: { redirect: route.fullPath },
}))

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

/**
 * One-tap attendee registration. No form: the sign-up is keyed to the account,
 * so staff read the name, phone and email straight off the profile — which is
 * also why there's no way to register without one.
 */
async function registerToAttend() {
  signUpPending.value = true
  signUpError.value = ''
  try {
    await $fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      body: { isVolunteer: false },
    })
    await Promise.all([refreshMyRsvp(), rsvpStatsRef.value?.refresh()])
  }
  catch (err) {
    signUpError.value = signUpErrorMessage(err, 'Could not register you. Please try again.')
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

/**
 * After a block is claimed, dropped, or a volunteer is removed: the counts
 * change, and so does the RSVP (claiming a first block adds one, dropping the
 * last removes it), so the stats panel has to be refreshed too.
 */
async function onTimeSlotsChanged() {
  await Promise.all([
    refreshTimeSlots(),
    refreshMyRsvp(),
    rsvpStatsRef.value?.refresh(),
  ])
}

const filesToUpload = ref<File[]>([])

function enterEditMode() {
  editForm.value = {
    ...event.value,
    eventType: eventType.value,
    startTime: event.value?.startTime ? formatForInput(event.value.startTime) : '',
    endTime: event.value?.endTime ? formatForInput(event.value.endTime) : '',
    // Each existing block keeps its id so the save updates it in place. A
    // block that lost its id would be treated as new, and the row it replaced
    // would be deleted — taking every sign-up on it.
    timeSlots: timeSlots.value.map(slot => ({
      id: slot.id,
      startTime: formatForInput(slot.startTime),
      endTime: formatForInput(slot.endTime),
      capacity: slot.capacity,
      // Loaded back in, not defaulted: the save sends whatever is in the form,
      // so a block whose role didn't make it into the editor would come back
      // blank the next time an admin saved an unrelated change.
      role: slot.role,
      note: slot.note,
      color: slot.color,
      signupCount: slot.signupCount,
    })),
  }
  isEditMode.value = true
}

function cancelEdit() {
  isEditMode.value = false
  filesToUpload.value = []
}

function formatForInput(isoString: string) {
  // datetime-local expects LOCAL wall-clock time, so build it from local
  // components rather than toISOString() (which is UTC and would show a shifted time).
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveChanges() {
  try {
    // Omitted entirely rather than sent empty when the block list didn't load:
    // an empty array means "delete them all", so a failed fetch would wipe
    // every shift the moment someone saved an unrelated change.
    const timeSlotPayload = timeSlotError.value
      ? {}
      : {
          timeSlots: (editForm.value.timeSlots ?? []).map((slot: {
            id: string | null
            startTime: string
            endTime: string
            capacity: number
            role?: string | null
            note?: string | null
            color?: string | null
          }) => ({
            id: slot.id,
            startTime: new Date(slot.startTime).toISOString(),
            endTime: new Date(slot.endTime).toISOString(),
            capacity: Number(slot.capacity),
            role: slot.role ?? null,
            note: slot.note ?? null,
            color: slot.color ?? null,
          })),
        }

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
        ...timeSlotPayload,
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
    saveError.value = ''
    await Promise.all([refresh(), refreshTimeSlots()])
  }
  catch (error) {
    console.error('Error updating event:', error)
    // Stay in edit mode and say what happened. The server rejects a save that
    // would strand a block outside the event window, and that rejection is
    // useless if the form closes as though it succeeded.
    saveError.value = (error as { data?: { message?: string } })?.data?.message
      || 'Could not save your changes. Please try again.'
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

        <p
          v-if="saveError"
          class="max-w-4xl mx-auto px-4 pb-3 text-sm text-red-600 dark:text-red-400"
        >
          {{ saveError }}
        </p>
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

            <EventTimeSlotEditor
              v-if="acceptsTimeBlocks || (editForm.timeSlots?.length ?? 0) > 0"
              v-model="editForm.timeSlots"
              :event-start="editForm.startTime"
              :event-end="editForm.endTime"
              :color="brandColor"
            />

            <p
              v-if="!acceptsTimeBlocks && (editForm.timeSlots?.length ?? 0) > 0"
              class="text-xs text-amber-700 dark:text-amber-400"
            >
              This event type doesn't use time blocks. Remove the blocks above
              before saving, or switch back to an event type that volunteers
              sign up for.
            </p>

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

        <!-- Time blocks: replaces one-tap volunteering on events that have them -->
        <EventTimeSlotList
          v-if="!isEditMode && hasTimeSlots"
          :event-id="eventId"
          :slots="timeSlots"
          :can-volunteer="canVolunteer"
          :is-admin="isAdmin"
          :volunteer-status="viewer.volunteerStatus"
          :is-signed-in="isSignedIn"
          :color="brandColor"
          @changed="onTimeSlotsChanged"
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

          <!-- Already signed up: no approval step, so just confirm it.
               Hidden on events with blocks — the block list is the source of
               truth there, and cancelling here would leave shifts claimed. -->
          <div
            v-if="isSignedUpToVolunteer && !hasTimeSlots"
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
              v-if="canVolunteer && !isSignedUpToVolunteer && !hasTimeSlots"
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
              v-if="canAttend && isSignedIn && !isRegisteredToAttend"
              :color="brandColor"
              variant="outline"
              size="xl"
              block
              icon="i-lucide-ticket"
              :loading="signUpPending"
              @click="registerToAttend"
            >
              Register to Attend
            </UButton>
            <!-- Attending requires an account: we register people by their
                 profile, so there's nothing to submit until they have one. -->
            <UButton
              v-else-if="canAttend && !isSignedIn"
              :color="brandColor"
              variant="outline"
              size="xl"
              block
              icon="i-lucide-log-in"
              :to="loginLink"
            >
              Sign In to Register
            </UButton>
          </div>

          <p
            v-if="canAttend && !isSignedIn"
            class="text-center text-sm text-gray-500 dark:text-gray-400"
          >
            You'll need an account to attend.
            <ULink
              :to="{ path: '/auth/sign-up', query: { redirect: route.fullPath } }"
              class="text-primary font-medium"
            >
              Create one
            </ULink>
            — we'll bring you back here.
          </p>

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
            <!-- Staff work the door from these, so show what they'll see. -->
            <p class="w-full text-sm text-gray-600 dark:text-gray-400">
              Registered as {{ registeredAs }}.
              <ULink
                to="/settings"
                class="text-primary font-medium"
              >
                {{ missingPhone ? 'Add a phone number' : 'Update your details' }}
              </ULink>
            </p>
          </div>

          <p
            v-if="signUpError"
            class="text-sm text-red-500 text-center"
          >
            {{ signUpError }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
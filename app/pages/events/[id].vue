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

definePageMeta({
  // Puts the back arrow in `NavTop`. The target is a fallback only, used when
  // there is no history to pop — an emailed or shared link opened cold.
  backTo: '/events',
})

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
type TimeSlotDraft = {
  id: string | null
  startTime: string
  endTime: string
  capacity: number
  signupCount?: number
}
type EditForm = {
  title?: string
  shortDesc?: string
  description?: string
  location?: { address?: string }
  startTime?: string
  endTime?: string
  eventType?: string
  timeSlots?: TimeSlotDraft[]
  mobileClinic?: string
  [key: string]: unknown
}
const editForm = ref<EditForm>({})
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
/**
 * The contact line staff will see against this registration. Phone is
 * deliberately left out of the on-page display — the "Add a phone number"
 * prompt below covers that without showing the number itself.
 */
const registeredAsDisplay = computed(() => {
  if (!me.value) return ''
  const name = me.value.name?.trim() || me.value.email
  return [name, me.value.email].filter(Boolean).join(' · ')
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
  note: string | null
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
// Lightweight volunteer/attendee counts for the sidebar chip display.
// NOTE: guessed endpoint — point this at whatever route actually serves
// aggregate RSVP counts on your backend.
const { data: rsvpData, refresh: refreshRsvpCounts } = await useFetch<RSVPData>(
  `/api/events/${eventId}/rsvp`,
  {
    headers,
    key: `event-rsvp-counts-${eventId}`,
  },
)
const rsvpCounts = computed(() => ({
  volunteers: rsvpData.value?.volunteerCount ?? 0,
  attendees: rsvpData.value?.attendeeCount ?? 0,
}))

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
    await Promise.all([refreshMyRsvp(), refreshRsvpCounts()])
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
    await Promise.all([refreshMyRsvp(), refreshRsvpCounts()])
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
    await Promise.all([refreshMyRsvp(), refreshRsvpCounts()])
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
    refreshRsvpCounts(),
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
          }) => ({
            id: slot.id,
            startTime: new Date(slot.startTime).toISOString(),
            endTime: new Date(slot.endTime).toISOString(),
            capacity: Number(slot.capacity),
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
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} • ${startTime} - ${endTime}`
})
// Video-ratio placeholders so the fallback matches the real event photos,
// which are always displayed at aspect-video in the carousel below.
const carouselItems = computed(() => {
  const assets = event.value?.eventAssets || []
  if (assets.length > 0) {
    return assets.map((a: { imageUrl: string }) => `/api/events/${a.imageUrl}`)
  }
  return [
    'https://picsum.photos/1280/720?random=1',
    'https://picsum.photos/1280/720?random=2',
    'https://picsum.photos/1280/720?random=3',
  ]
})
const mapStyle = '/mapstyles.json'
const center = computed(() => {
  if (!event.value?.location) return [0, 0]
  return [event.value.location.longitude, event.value.location.latitude]
})
const zoom = 15
const brandColor = computed(() => isDark.value ? 'brand8' : 'brand4')

// Shared "card" look — same background/shadow treatment used across the app
// (see the event-list card component), reused for framed sections
// (date/time box, registration-detail panels, volunteer/attendee counts,
// settings panel). No border anymore — shadow alone defines the edge. The
// map and the edit controls intentionally don't use this — the map stays
// plain-rounded, and the edit controls sit in normal flow with no card
// wrapper at all.
const cardClass = 'rounded-2xl bg-white shadow-sm dark:bg-gray-800'
</script>
<template>
  <div class="mt-20 min-h-screen bg-white dark:bg-gray-900 pb-24">
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
          to="/events"
        >
          Back to Events
        </UButton>
      </div>
    </div>
    <!-- Event Details -->
    <div v-else-if="event">
      <!-- Sticky admin action bar. Non-admins get nothing in it, so the whole
           strip is hidden rather than rendering as an empty band under the
           header. `top-19` parks it directly beneath the fixed `NavTop`. -->
      <div
        v-if="isAdmin"
        class="bg-white dark:bg-gray-800 shadow-sm sticky top-19 z-10 border-b border-transparent dark:border-gray-700"
      >
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-end">
          <div class="flex gap-2">
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
      <p
        v-if="saveError"
        class="mb-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ saveError }}
      </p>

      <!-- Hero: title/short-desc and the image+location column are laid
           out with CSS grid (see .event-hero below) rather than flex, so
           the image can share the title's top grid row on desktop — its
           top edge lines up with the title instead of sitting below it —
           while mobile keeps the natural title → image → content stack. -->
      <div class="event-hero grid gap-6 lg:gap-8 items-start">
        <!-- Title + short description -->
        <div class="hero-title mb-6 lg:mb-0">
          <h1
            v-if="!isEditMode"
            class="text-left text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white"
          >
            {{ event.title }}
          </h1>
          <UInput
            v-else
            v-model="editForm.title"
            size="xl"
            placeholder="Event Title"
            class="w-full text-4xl sm:text-5xl font-extrabold tracking-tight"
          />
          <div
            v-if="event.shortDesc || isEditMode"
            class="mt-2"
          >
            <p
              v-if="!isEditMode"
              class="text-left text-sm font-normal text-gray-500 dark:text-gray-400"
            >
              {{ event.shortDesc }}
            </p>
            <UInput
              v-else
              v-model="editForm.shortDesc"
              placeholder="Short Description"
              size="sm"
              class="w-full mt-2 text-sm font-normal"
            />
          </div>
        </div>

        <!-- Left (desktop): carousel, then Date & Time / Location, then
             Registrations directly under it. -->
        <div class="hero-image w-full shrink-0 space-y-4">
          <UCarousel
            v-if="!isEditMode"
            v-slot="{ item }"
            loop
            dots
            class="w-full overflow-hidden"
            :class="cardClass"
            :autoplay="{ delay: 6000 }"
            :items="carouselItems"
            :ui="{
              item: 'overflow-hidden',
              dots: 'bottom-3 gap-1.5',
              dot: 'w-2 h-2 bg-black/30 data-[state=active]:bg-white transition-colors shadow-lg',
            }"
          >
            <img
              :src="item"
              class="w-full aspect-video object-cover"
              alt=""
            >
          </UCarousel>

          <!-- Image management (edit mode) -->
          <div v-if="isEditMode">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Event Images</label>
            <EventImageUpload
              :existing-assets="event.eventAssets"
              :event-id="eventId"
              @files-changed="onFilesChanged"
            />
          </div>

          <!-- Date & Time / Location — same width as the carousel above it. -->
          <div
            class="p-4"
            :class="cardClass"
          >
            <div class="flex items-start gap-2 mb-3">
              <UIcon
                name="i-lucide-calendar"
                class="w-4 h-4 mt-0.5 text-gray-500 dark:text-gray-400 shrink-0"
              />
              <div
                v-if="!isEditMode"
                class="flex-1"
              >
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Date & Time
                </p>
                <p class="text-sm font-normal text-gray-900 dark:text-white">
                  {{ formattedDate }}
                </p>
              </div>
              <div
                v-else
                class="grid grid-rows-2 gap-2 flex-1"
              >
                <div>
                  <label class="text-xs text-gray-500 dark:text-gray-400">Start</label>
                  <UInput
                    v-model="editForm.startTime"
                    type="datetime-local"
                    size="sm"
                    class="w-full text-sm font-normal"
                  />
                </div>
                <div>
                  <label class="text-xs text-gray-500 dark:text-gray-400">End</label>
                  <UInput
                    v-model="editForm.endTime"
                    type="datetime-local"
                    size="sm"
                    class="w-full text-sm font-normal"
                  />
                </div>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <UIcon
                name="i-lucide-map-pin"
                class="w-4 h-4 mt-0.5 text-gray-500 dark:text-gray-400 shrink-0"
              />
              <div class="flex-1">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Location
                </p>
                <p
                  v-if="!isEditMode"
                  class="text-sm font-normal text-gray-900 dark:text-white"
                >
                  {{ event.location.address }}
                </p>
                <UInput
                  v-else
                  v-model="editForm.location.address"
                  placeholder="Event Location"
                  size="sm"
                  class="w-full mt-1 text-sm font-normal"
                />
              </div>
            </div>
          </div>

          <!-- Volunteers & Attendees — moved directly under Date & Time /
               Location, still a plain icon + number + label display. -->
          <div
            v-if="isAdmin && !isEditMode"
            class="p-4"
            :class="cardClass"
          >
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              Registrations
            </p>
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-heart-handshake"
                  class="w-4 h-4 text-brand4 dark:text-brand8 shrink-0"
                />
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ rsvpCounts?.volunteers ?? 0 }}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">Volunteers</span>
              </div>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-users"
                  class="w-4 h-4 text-brand4 dark:text-brand8 shrink-0"
                />
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ rsvpCounts?.attendees ?? 0 }}</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">Attendees</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right (desktop): description, map, registration actions, admin
             panels — everything here shares the column's width. -->
        <div class="hero-content min-w-0 space-y-6">
          <div>
            <h2 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Details
            </h2>
            <p
              v-if="!isEditMode"
              class="text-base font-normal text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line mb-4"
            >
              {{ event.description }}
            </p>
            <UTextarea
              v-else
              v-model="editForm.description"
              placeholder="Full event description"
              size="md"
              :rows="6"
              class="w-full mb-4 text-base font-normal leading-relaxed"
            />

            <div
              v-if="event.mobileClinicId && !isEditMode"
              class="mb-4"
            >
              <p class="text-sm text-gray-600 dark:text-gray-300">
                This event is part of our Mobile Clinic program. Please
                visit the clinic for health services and support.
              </p>
            </div>
          </div>

          <!-- Map — MapInteractive (MapLibre) injects its own absolutely
               positioned canvas + control elements that ignore a rounded
               class on a plain parent, so this wrapper forces a new
               stacking/clipping context (`isolate` + `overflow-hidden` on
               both layers) to actually clip the map to the rounded corners. -->
          <div
            v-if="!isEditMode"
            id="map"
            class="h-60 relative isolate overflow-hidden rounded-2xl"
          >
            <div class="absolute inset-0 overflow-hidden rounded-2xl">
              <MapInteractive
                :style="mapStyle"
                :center="center"
                :zoom="zoom"
              />
            </div>
          </div>

          <!-- Registration / volunteer actions -->
          <div
            v-if="!isEditMode"
            class="space-y-3"
          >
            <p
              v-if="eventType === 'VOLUNTEERS' || eventType === 'TRAINING'"
              class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
            >
              <UIcon
                name="i-lucide-lock"
                class="w-4 h-4"
              />
              {{ eventTypeLabel(eventType) }} — only visible to volunteers
            </p>
            <!-- Time blocks: replaces one-tap volunteering on events that
                 have them. Shown above the Register to Attend button since
                 claiming a shift is the primary action on these events. -->
            <EventTimeSlotList
              v-if="hasTimeSlots"
              :event-id="eventId"
              :slots="timeSlots"
              :can-volunteer="canVolunteer"
              :is-admin="isAdmin"
              :volunteer-status="viewer.volunteerStatus"
              :is-signed-in="isSignedIn"
              :color="brandColor"
              @changed="onTimeSlotsChanged"
            />
            <div class="flex flex-col gap-3">
              <UButton
                v-if="canVolunteer && !isSignedUpToVolunteer && !hasTimeSlots"
                color="neutral"
                size="lg"
                icon="i-lucide-heart-handshake"
                block
                class="rounded-full bg-rose-900 hover:bg-rose-800 text-white font-bold"
                :disabled="hasEnded"
                :loading="signUpPending"
                @click="signUpAsVolunteer"
              >
                Sign Up as Volunteer
              </UButton>
              <!-- Filled, full-width, softer corners and regular weight so
                   it reads a step down from the volunteer CTA. Disabled
                   rather than hidden once the event has passed, so it
                   doesn't look like the option vanished. -->
              <UButton
                v-if="canAttend && isSignedIn && !isRegisteredToAttend"
                :color="brandColor"
                size="lg"
                icon="i-lucide-ticket"
                block
                class="rounded-lg"
                :disabled="hasEnded"
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
                size="lg"
                icon="i-lucide-log-in"
                block
                class="rounded-lg"
                :disabled="hasEnded"
                :to="loginLink"
              >
                Sign In to Register
              </UButton>
            </div>
            <p
              v-if="hasEnded && (canVolunteer || canAttend)"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              This event has ended — registration is closed.
            </p>
            <p
              v-if="canAttend && !isSignedIn"
              class="text-sm text-gray-500 dark:text-gray-400"
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

            <!-- Already signed up to volunteer: a details frame pops up in
                 place of the button, instead of the button just vanishing. -->
            <div
              v-if="isSignedUpToVolunteer && !hasTimeSlots"
              class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              :class="cardClass"
            >
              <span class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
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

            <!-- Registered to attend: the detail frame that pops up under the
                 button once you sign up. Name and email only — no phone
                 number shown here, just a nudge to add one if it's missing. -->
            <div
              v-if="isRegisteredToAttend"
              class="space-y-2 px-4 py-3"
              :class="cardClass"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
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
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Registered as {{ registeredAsDisplay }}.
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
              class="text-sm text-red-500"
            >
              {{ signUpError }}
            </p>
          </div>

          <!-- Event Settings (admin edit mode) -->
          <div
            v-if="isAdmin && isEditMode"
            class="p-6"
            :class="cardClass"
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
            class="p-6 flex items-center gap-3"
            :class="cardClass"
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
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/*
 * Hero grid: mobile keeps the natural reading order (title, then image,
 * then content) stacked in a single column. Desktop switches to two
 * columns and puts "image" in both grid rows on the right so it spans the
 * full height of the title + content stack on the left — meaning the
 * image's top edge still lines up exactly with the title's top edge.
 */
.event-hero {
  grid-template-columns: 1fr;
  grid-template-areas:
    'title'
    'image'
    'content';
}
@media (min-width: 1024px) {
  .event-hero {
    grid-template-columns: 1fr 40%;
    grid-template-areas:
      'title image'
      'content image';
  }
}
.hero-title {
  grid-area: title;
}
.hero-image {
  grid-area: image;
}
.hero-content {
  grid-area: content;
}
/* Fallback in case MapLibre's canvas/controls render outside the normal
   box model (they sometimes use position: absolute against the nearest
   positioned ancestor, which our wrapper above provides via `relative`). */
#map :deep(.maplibregl-map),
#map :deep(.maplibregl-canvas) {
  border-radius: inherit;
}

</style>


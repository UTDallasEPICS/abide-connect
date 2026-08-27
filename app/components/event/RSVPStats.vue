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
  layout: 'secondary',
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

/**
 * Volunteer/attendee counts for the sidebar chip display. This hits the same
 * admin-only `/rsvp` endpoint the expandable Registrations panel uses (see
 * EventRegistrations.vue) rather than a separate stats route — there wasn't
 * one, which is why the counters always rendered 0 before. Non-admins get a
 * failed fetch here (the route 403s), which is fine: the chip block itself
 * is only ever shown to admins.
 */
interface EventRegistration {
  id: string
  name: string
  email: string
  phone: string
  isVolunteer: boolean
  isGuest: boolean
}
interface RSVPData {
  volunteerCount: number
  attendeeCount: number
  volunteers: EventRegistration[]
  attendees: EventRegistration[]
}
const { data: rsvpData, refresh: refreshRsvpCounts } = await useFetch<RSVPData>(
  `/api/events/${eventId}/rsvp`,
  { headers },
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
  <div class="dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700 shadow-md">
    <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
      Registrations
    </h2>

    <div class="flex gap-4">
      <!-- Volunteer count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 dark:bg-brand6/20 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80 dark:hover:bg-brand6/30' : 'cursor-default'"
          type="button"
          @click="admin && (showVolunteers = !showVolunteers)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-heart-handshake"
              class="w-5 h-5 text-brand4 dark:text-brand8"
            />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4 dark:text-brand8">
                {{ rsvpData?.volunteerCount ?? 0 }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Volunteers
              </p>
            </div>
          </div>
          <UIcon
            v-if="admin"
            :name="showVolunteers ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-gray-400 dark:text-gray-500"
          />
        </button>

        <!-- Volunteer list -->
        <div
          v-if="admin && showVolunteers"
          class="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          <div
            v-if="rsvpData?.volunteers?.length === 0"
            class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            No volunteers yet
          </div>
          <div
            v-for="volunteer in rsvpData?.volunteers"
            :key="volunteer.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ volunteer.name }}
              <UBadge
                v-if="volunteer.isGuest"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                guest
              </UBadge>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ contactLine(volunteer) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Attendee count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 dark:bg-brand6/20 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80 dark:hover:bg-brand6/30' : 'cursor-default'"
          type="button"
          @click="admin && (showAttendees = !showAttendees)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-ticket"
              class="w-5 h-5 text-brand4 dark:text-brand8"
            />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4 dark:text-brand8">
                {{ rsvpData?.attendeeCount ?? 0 }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Attendees
              </p>
            </div>
          </div>
          <UIcon
            v-if="admin"
            :name="showAttendees ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-gray-400 dark:text-gray-500"
          />
        </button>

        <!-- Attendee list -->
        <div
          v-if="admin && showAttendees"
          class="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          <div
            v-if="rsvpData?.attendees?.length === 0"
            class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            No attendees yet
          </div>
          <div
            v-for="attendee in rsvpData?.attendees"
            :key="attendee.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ attendee.name }}
              <UBadge
                v-if="attendee.isGuest"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                guest
              </UBadge>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ contactLine(attendee) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

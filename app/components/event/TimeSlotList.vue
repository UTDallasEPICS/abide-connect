<script setup lang="ts">
import { computed, ref } from 'vue'
import type { VolunteerStatus } from '#shared/utils/eventType'
import { formatSlotRange } from '#shared/utils/timeSlot'

/**
 * The time blocks on an event, as volunteers and staff see them.
 *
 * Volunteers claim or drop individual blocks; staff additionally see who's in
 * each one and can take someone off. Blocks may overlap, so a volunteer can
 * hold several as long as they don't overlap each other — the server rejects
 * an overlapping claim with a 409, surfaced against the block they clicked.
 */

interface SlotSignup {
  volunteerId: string
  name: string
  email: string
}

interface Slot {
  id: string
  startTime: string
  endTime: string
  capacity: number
  role: string | null
  note: string | null
  signupCount: number
  spotsRemaining: number
  isFull: boolean
  viewerSignedUp: boolean
  /** Staff only. */
  signups?: SlotSignup[]
}

const props = withDefaults(defineProps<{
  eventId: string
  slots: Slot[]
  /** Whether the viewer is an approved volunteer who may claim blocks. */
  canVolunteer?: boolean
  isAdmin?: boolean
  /** Drives the explanation shown when the viewer can't sign up. */
  volunteerStatus?: VolunteerStatus
  isSignedIn?: boolean
  color?: string
}>(), {
  canVolunteer: false,
  isAdmin: false,
  volunteerStatus: 'NONE',
  isSignedIn: false,
  color: 'primary',
})

const emit = defineEmits<{ changed: [] }>()

/**
 * Why the sign-up buttons aren't there, for a viewer who can't claim a block.
 *
 * Volunteering needs `approvalStatus === 'APPROVED'`, which staff grant after a
 * training event. Without this the blocks render with no controls and no
 * explanation, which reads as the page being broken.
 *
 * Only reachable on events open to both volunteers and attendees — a
 * volunteers-only event already 404s for anyone unapproved.
 */
const signUpNotice = computed<{ text: string, to?: string, linkLabel?: string } | null>(() => {
  if (props.canVolunteer) return null

  if (!props.isSignedIn) {
    return {
      text: 'Sign in with your volunteer account to claim a shift.',
      to: '/auth/login',
      linkLabel: 'Sign in',
    }
  }

  if (props.volunteerStatus === 'NONE') {
    return {
      text: 'Helping out at this event needs a volunteer profile.',
      to: '/volunteer-application',
      linkLabel: 'Apply to volunteer',
    }
  }

  // PENDING and REJECTED alike: a rejection isn't a ban, and the way forward
  // for both is attending a training event and being approved there.
  return {
    text: 'You can claim shifts once staff have approved you, which happens at a training event.',
    to: '/events',
    linkLabel: 'See training events',
  }
})

const pendingSlotId = ref<string | null>(null)
const errorSlotId = ref<string | null>(null)
const errorMessage = ref('')
/** `${slotId}:${volunteerId}` currently awaiting removal confirmation. */
const pendingRemoval = ref<string | null>(null)

function errorText(err: unknown, fallback: string) {
  return (err as { data?: { message?: string } })?.data?.message || fallback
}

function range(slot: Slot) {
  return formatSlotRange(new Date(slot.startTime), new Date(slot.endTime))
}

function hasPassed(slot: Slot) {
  return new Date(slot.endTime).getTime() <= Date.now()
}

async function act(slot: Slot, run: () => Promise<unknown>, fallback: string) {
  pendingSlotId.value = slot.id
  errorSlotId.value = null
  errorMessage.value = ''

  try {
    await run()
    emit('changed')
  }
  catch (err) {
    errorSlotId.value = slot.id
    errorMessage.value = errorText(err, fallback)
  }
  finally {
    pendingSlotId.value = null
  }
}

function signUp(slot: Slot) {
  return act(
    slot,
    () => $fetch(`/api/events/${props.eventId}/time-slots/${slot.id}/signup`, { method: 'POST' }),
    'Could not sign you up for this time block.',
  )
}

function cancel(slot: Slot) {
  return act(
    slot,
    () => $fetch(`/api/events/${props.eventId}/time-slots/${slot.id}/signup`, { method: 'DELETE' }),
    'Could not cancel your sign-up.',
  )
}

function removeVolunteer(slot: Slot, volunteerId: string) {
  pendingRemoval.value = null

  return act(
    slot,
    () => $fetch(
      `/api/events/${props.eventId}/time-slots/${slot.id}/signups/${volunteerId}`,
      { method: 'DELETE' },
    ),
    'Could not remove that volunteer.',
  )
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700">
    <h2 class="text-2xl font-semibold mb-1 text-gray-900 dark:text-white">
      Volunteer Time Blocks
    </h2>
    <p
      v-if="canVolunteer"
      class="text-sm text-gray-500 dark:text-gray-400 mb-4"
    >
      Sign up for the shifts you can cover. You can take more than one, as long
      as they don't overlap.
    </p>
    <p
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 mb-4"
    >
      The shifts volunteers are covering at this event.
    </p>

    <!-- Says why there are no buttons, rather than leaving the viewer to guess -->
    <div
      v-if="signUpNotice"
      class="mb-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <UIcon
        name="i-lucide-info"
        class="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
      />
      <span class="text-sm text-gray-600 dark:text-gray-300">
        {{ signUpNotice.text }}
      </span>
      <ULink
        v-if="signUpNotice.to"
        :to="signUpNotice.to"
        class="text-sm font-medium text-brand4 dark:text-brand8 underline"
      >
        {{ signUpNotice.linkLabel }}
      </ULink>
    </div>

    <div class="space-y-3">
      <div
        v-for="slot in slots"
        :key="slot.id"
        class="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ range(slot) }}
            </p>
            <!-- What the shift actually is. Blocks predating roles, and ones
                 staff left blank, simply don't show a line here. -->
            <p
              v-if="slot.role"
              class="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {{ slot.role }}
            </p>
            <p
              v-if="slot.note"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              {{ slot.note }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              <span v-if="slot.spotsRemaining < 0">
                {{ slot.signupCount }} signed up — over capacity ({{ slot.capacity }} spots)
              </span>
              <span v-else-if="slot.isFull">
                Full — {{ slot.signupCount }} of {{ slot.capacity }} spots taken
              </span>
              <span v-else>
                {{ slot.spotsRemaining }} of {{ slot.capacity }} spot{{ slot.capacity === 1 ? '' : 's' }} left
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="slot.viewerSignedUp"
              class="flex items-center gap-1 text-sm font-medium text-brand4 dark:text-brand8"
            >
              <UIcon
                name="i-lucide-check-circle-2"
                class="w-4 h-4"
              />
              You're on this shift
            </span>

            <span
              v-else-if="hasPassed(slot)"
              class="text-sm text-gray-400 dark:text-gray-500"
            >
              Finished
            </span>

            <UButton
              v-if="canVolunteer && slot.viewerSignedUp"
              size="sm"
              variant="ghost"
              color="neutral"
              :loading="pendingSlotId === slot.id"
              @click="cancel(slot)"
            >
              Cancel
            </UButton>

            <UButton
              v-else-if="canVolunteer && !hasPassed(slot)"
              size="sm"
              :color="color"
              :disabled="slot.isFull"
              :loading="pendingSlotId === slot.id"
              @click="signUp(slot)"
            >
              {{ slot.isFull ? 'Full' : 'Sign up' }}
            </UButton>
          </div>
        </div>

        <p
          v-if="errorSlotId === slot.id"
          class="mt-2 text-sm text-red-600 dark:text-red-400"
        >
          {{ errorMessage }}
        </p>

        <!-- Roster: staff only, since it carries names and emails. -->
        <div
          v-if="isAdmin && slot.signups"
          class="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3"
        >
          <p
            v-if="slot.signups.length === 0"
            class="text-sm text-gray-400 dark:text-gray-500"
          >
            Nobody signed up yet.
          </p>

          <ul
            v-else
            class="space-y-2"
          >
            <li
              v-for="signup in slot.signups"
              :key="signup.volunteerId"
              class="text-sm"
            >
              <div
                v-if="pendingRemoval === `${slot.id}:${signup.volunteerId}`"
                class="space-y-2"
              >
                <p class="text-amber-700 dark:text-amber-400">
                  Remove {{ signup.name || signup.email || 'this volunteer' }} from the
                  {{ range(slot) }} block? They will not be notified
                  automatically — you'll need to contact them.
                </p>
                <div class="flex justify-end gap-2">
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="pendingRemoval = null"
                  >
                    Keep
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    @click="removeVolunteer(slot, signup.volunteerId)"
                  >
                    Remove
                  </UButton>
                </div>
              </div>

              <div
                v-else
                class="flex items-center justify-between gap-3"
              >
                <span class="text-gray-700 dark:text-gray-300">
                  {{ signup.name || '(no name)' }}
                  <span class="text-gray-400 dark:text-gray-500">{{ signup.email }}</span>
                </span>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  @click="pendingRemoval = `${slot.id}:${signup.volunteerId}`"
                >
                  Remove
                </UButton>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

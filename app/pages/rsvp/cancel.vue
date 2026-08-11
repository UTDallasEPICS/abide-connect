<script setup lang="ts">
/**
 * Landing page for the "can't make it? cancel my spot" link in event emails.
 *
 * Reached from an inbox, so it has to stand on its own: no layout chrome (the
 * secondary header's back button goes nowhere when the page was opened from
 * mail), and no session — a guest who signed up with just a name and email has
 * no account, and the signed token in the URL is the only thing authorising the
 * cancellation.
 *
 * The cancel is behind a button rather than done on load because mail clients
 * and link scanners fetch URLs on their own; see `server/api/rsvp/cancel.post.ts`.
 */
definePageMeta({
  layout: false,
})

type CancelPreview = {
  status: 'active' | 'gone'
  name?: string | null
  isVolunteer?: boolean
  event?: {
    id: string
    title: string
    when: string
    location: string | null
  }
}

const route = useRoute()
const token = computed(() => (route.query.token as string | undefined) ?? '')

const { data: preview, error, status: loadStatus } = await useFetch<CancelPreview>('/api/rsvp/cancel', {
  query: { token },
})

const cancelling = ref(false)
const cancelled = ref(false)
const cancelError = ref<string | null>(null)

/** The sign-up is gone once it's been cancelled here, or was already gone. */
const isGone = computed(() => cancelled.value || preview.value?.status === 'gone')

async function confirmCancel() {
  cancelling.value = true
  cancelError.value = null

  try {
    const result = await $fetch<{ status: 'cancelled' | 'gone' }>('/api/rsvp/cancel', {
      method: 'POST',
      body: { token: token.value },
    })
    cancelled.value = result.status === 'cancelled'
    // A sign-up that vanished between the page load and the click is the same
    // outcome from here — they're not on the list either way.
    if (result.status === 'gone') cancelled.value = true
  }
  catch {
    cancelError.value = 'We couldn\'t cancel your sign-up. Please try again, or contact Abide staff.'
  }
  finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 px-5 py-16 dark:bg-gray-900">
    <div class="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 class="text-center text-2xl font-bold text-brand4 dark:text-brand8">
        Abide Connect
      </h1>

      <UCard>
        <!-- Bad or expired link ------------------------------------------ -->
        <div
          v-if="error"
          class="flex flex-col gap-3 text-center"
        >
          <h2 class="text-lg font-semibold">
            This link doesn't work
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            It may have already been used, or the sign-up it was for is no longer active.
            You can always manage your spot from the event page.
          </p>
          <UButton
            to="/events"
            label="Browse events"
            color="brand4"
            block
          />
        </div>

        <div
          v-else-if="loadStatus === 'pending'"
          class="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          Loading your sign-up…
        </div>

        <!-- Done, or never signed up ------------------------------------- -->
        <div
          v-else-if="isGone"
          class="flex flex-col gap-3 text-center"
        >
          <h2 class="text-lg font-semibold">
            {{ cancelled ? 'Your spot has been cancelled' : 'You\'re not signed up for this event' }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ cancelled
              ? 'Thanks for letting us know — we won\'t be expecting you. You\'re welcome to sign up again if your plans change.'
              : 'This sign-up has already been cancelled, so there\'s nothing left to do.' }}
          </p>
          <UButton
            :to="preview?.event ? `/events/${preview.event.id}` : '/events'"
            :label="preview?.event ? 'View event' : 'Browse events'"
            color="brand4"
            variant="soft"
            block
          />
        </div>

        <!-- Confirm ------------------------------------------------------ -->
        <div
          v-else
          class="flex flex-col gap-4"
        >
          <div class="flex flex-col gap-1 text-center">
            <h2 class="text-lg font-semibold">
              Cancel your spot?
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ preview?.name ? `${preview.name}, you're` : 'You\'re' }}
              {{ preview?.isVolunteer ? 'volunteering at' : 'attending' }} this event.
            </p>
          </div>

          <div class="flex flex-col gap-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <p class="font-semibold">
              {{ preview?.event?.title }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ preview?.event?.when }}
            </p>
            <p
              v-if="preview?.event?.location"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              {{ preview.event.location }}
            </p>
          </div>

          <p
            v-if="cancelError"
            class="text-sm text-red-600 dark:text-red-400"
          >
            {{ cancelError }}
          </p>

          <div class="flex flex-col gap-2">
            <UButton
              label="Yes, cancel my spot"
              color="error"
              :loading="cancelling"
              block
              @click="confirmCancel"
            />
            <UButton
              :to="preview?.event ? `/events/${preview.event.id}` : '/events'"
              label="No, keep my spot"
              color="neutral"
              variant="ghost"
              block
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { authClient } from '#server/utils/auth-client'
import {
  languageItems,
  genderItems,
  ethinicityItems,
  availabilityItems,
  volunteerAreaItems,
  certificationItems,
} from '~/types/volunteer/volunteer-application.type'

definePageMeta({
  layout: 'secondary',
  // This page shows personal details and can delete the account, so it must
  // not render for signed-out visitors. `auth` is opt-in per page (see
  // app/middleware/auth.ts); auth.global.ts only guards role-prefixed routes.
  middleware: 'auth',
})

const toast = useToast()
const colorMode = useColorMode()

// The session cookie has to be forwarded explicitly or these come back empty
// during SSR.
const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

type Me = {
  id: string
  name: string | null
  email: string
  phone: string | null
  pushEnabled: boolean
  pushScope: 'GENERAL' | 'VOLUNTEER' | 'BOTH'
}

type VolunteerProfile = {
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  gender: string | null
  ethinicity: string | null
  languages: string[]
  availability: string[]
  volunteerAreas: string[]
  certifications: string[]
  otherVolunteerAreaDescription: string | null
  otherCertificationDescription: string | null
  emergencyContactName1: string | null
  emergencyContactPhone1: string | null
  emergencyContactName2: string | null
  emergencyContactPhone2: string | null
}

const { data: user } = await useFetch<Me>('/api/user/me', { headers })
const { data: roles } = await useFetch<string[]>('/api/user/roles', { headers, default: () => [] })
const { data: volunteer } = await useFetch<VolunteerProfile | null>('/api/volunteer/me', {
  headers,
  default: () => null,
})

// Volunteer-only settings stay hidden for plain users; both checks matter,
// since the role and the application record are written separately.
const isVolunteer = computed(() => roles.value.includes('volunteer') && volunteer.value !== null)

/* ------------------------------------------------------------------ profile */

const profileForm = reactive({
  name: user.value?.name ?? '',
  phone: user.value?.phone ?? '',
})
const savingProfile = ref(false)

async function saveProfile() {
  savingProfile.value = true
  try {
    const updated = await $fetch<Me>('/api/user/me', {
      method: 'PATCH',
      body: { name: profileForm.name, phone: profileForm.phone },
    })
    user.value = updated
    profileForm.name = updated.name ?? ''
    profileForm.phone = updated.phone ?? ''
    toast.add({ title: 'Profile updated', color: 'success', icon: 'i-lucide-check' })
  }
  catch (error) {
    toast.add({
      title: 'Could not save profile',
      description: errorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
  finally {
    savingProfile.value = false
  }
}

/* --------------------------------------------------------------- appearance */

const themeItems = [
  { label: 'Match system', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

// `preference` is what the user picked ('system' included); `colorMode.value`
// is the resolved light/dark. Binding to preference is what makes "match
// system" stick across reloads.
const themePreference = computed({
  get: () => colorMode.preference,
  set: (value: string) => { colorMode.preference = value },
})

/* ------------------------------------------------------- push notifications */

const { support, permission, isSubscribed, isBusy: pushBusy, subscribe, unsubscribe, refresh: refreshPush }
  = usePushNotifications()

const pushEnabled = ref(user.value?.pushEnabled ?? false)
const pushScope = ref<Me['pushScope']>(user.value?.pushScope ?? 'BOTH')
const sendingTest = ref(false)

const pushScopeItems = [
  { label: 'General events', value: 'GENERAL' },
  { label: 'Volunteer events', value: 'VOLUNTEER' },
  { label: 'Both', value: 'BOTH' },
]

const pushUnavailableReason = computed(() => {
  switch (support.value) {
    case 'not-configured':
      return 'Push notifications aren\'t configured on this server yet.'
    case 'requires-install':
      return 'To get notifications on iPhone or iPad, add Abide Connect to your Home Screen first, then open it from there.'
    case 'unsupported':
      return 'This browser doesn\'t support push notifications.'
    default:
      return null
  }
})

const pushBlocked = computed(() => permission.value === 'denied')

async function savePushPreferences(patch: Partial<Pick<Me, 'pushEnabled' | 'pushScope'>>) {
  const updated = await $fetch<Me>('/api/user/me', { method: 'PATCH', body: patch })
  user.value = updated
  pushEnabled.value = updated.pushEnabled
  pushScope.value = updated.pushScope
}

async function onPushToggle(value: boolean) {
  try {
    if (value) {
      // Register the device first — if the user dismisses the browser prompt
      // there's nothing to enable, so don't record the preference.
      const granted = await subscribe()
      if (!granted) {
        pushEnabled.value = false
        await refreshPush()
        toast.add({
          title: 'Notifications not enabled',
          description: pushBlocked.value
            ? 'Notifications are blocked for this site. Turn them back on in your browser settings.'
            : 'Permission was not granted.',
          color: 'warning',
          icon: 'i-lucide-bell-off',
        })
        return
      }
      await savePushPreferences({ pushEnabled: true })
      toast.add({ title: 'Notifications on', color: 'success', icon: 'i-lucide-bell' })
    }
    else {
      await unsubscribe()
      await savePushPreferences({ pushEnabled: false })
      toast.add({ title: 'Notifications off', color: 'neutral', icon: 'i-lucide-bell-off' })
    }
  }
  catch (error) {
    pushEnabled.value = !value
    toast.add({
      title: 'Could not update notifications',
      description: errorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onPushScopeChange(value: Me['pushScope']) {
  try {
    await savePushPreferences({ pushScope: value })
    toast.add({ title: 'Notification preference saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (error) {
    pushScope.value = user.value?.pushScope ?? 'BOTH'
    toast.add({ title: 'Could not save preference', description: errorMessage(error), color: 'error' })
  }
}

async function sendTestNotification() {
  sendingTest.value = true
  try {
    await $fetch('/api/push/test', { method: 'POST' })
    toast.add({ title: 'Test notification sent', color: 'success', icon: 'i-lucide-send' })
  }
  catch (error) {
    toast.add({ title: 'Test failed', description: errorMessage(error), color: 'error' })
  }
  finally {
    sendingTest.value = false
  }
}

/* ---------------------------------------------------- volunteer application */

const volunteerForm = reactive({
  gender: volunteer.value?.gender ?? undefined,
  ethinicity: volunteer.value?.ethinicity ?? undefined,
  languages: volunteer.value?.languages ?? [],
  availability: volunteer.value?.availability ?? [],
  volunteerAreas: volunteer.value?.volunteerAreas ?? [],
  certifications: volunteer.value?.certifications ?? [],
  otherVolunteerAreaDescription: volunteer.value?.otherVolunteerAreaDescription ?? '',
  otherCertificationDescription: volunteer.value?.otherCertificationDescription ?? '',
  emergencyContactName1: volunteer.value?.emergencyContactName1 ?? '',
  emergencyContactPhone1: volunteer.value?.emergencyContactPhone1 ?? '',
  emergencyContactName2: volunteer.value?.emergencyContactName2 ?? '',
  emergencyContactPhone2: volunteer.value?.emergencyContactPhone2 ?? '',
})
const savingVolunteer = ref(false)

const approvalBadge = computed(() => {
  switch (volunteer.value?.approvalStatus) {
    case 'APPROVED': return { label: 'Approved', color: 'success' as const }
    case 'REJECTED': return { label: 'Not approved', color: 'error' as const }
    default: return { label: 'Pending review', color: 'warning' as const }
  }
})

async function saveVolunteer() {
  savingVolunteer.value = true
  try {
    await $fetch('/api/volunteer/me', { method: 'PATCH', body: { ...volunteerForm } })
    toast.add({ title: 'Volunteer details updated', color: 'success', icon: 'i-lucide-check' })
  }
  catch (error) {
    toast.add({
      title: 'Could not save volunteer details',
      description: errorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
  finally {
    savingVolunteer.value = false
  }
}

/* ------------------------------------------------------------------ account */

const deleteModalOpen = ref(false)
const deleting = ref(false)

async function deleteAccount() {
  deleting.value = true
  try {
    await $fetch('/api/user/me', { method: 'DELETE' })
    // The session rows are gone, so signOut may 401 — the cookie is inert
    // either way and the hard navigation below clears client state.
    await authClient.signOut().catch(() => {})
    await navigateTo('/auth/login', { external: true })
  }
  catch (error) {
    deleting.value = false
    deleteModalOpen.value = false
    toast.add({
      title: 'Could not delete account',
      description: errorMessage(error),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function signOut() {
  await authClient.signOut().catch(() => {})
  await navigateTo('/auth/login', { external: true })
}

/** Pulls the human-readable message out of an $fetch error. */
function errorMessage(error: unknown): string {
  return (error as { statusMessage?: string }).statusMessage
    ?? (error as { data?: { statusMessage?: string } }).data?.statusMessage
    ?? (error as { message?: string }).message
    ?? 'Please try again.'
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <main class="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 pt-16 pb-28">
      <h1 class="text-2xl font-bold text-brand4 dark:text-brand8">
        Settings
      </h1>

      <!-- Profile ------------------------------------------------------- -->
      <SettingsSection
        title="Your details"
        description="How Abide staff get in touch with you."
      >
        <UFormField label="Name">
          <UInput
            v-model="profileForm.name"
            placeholder="Full name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Phone number"
          description="Optional."
        >
          <UInput
            v-model="profileForm.phone"
            type="tel"
            placeholder="(555) 123-4567"
            autocomplete="tel"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Email"
          description="Your email is how you sign in, so it can't be changed here. Contact Abide staff if you need it updated."
        >
          <UInput
            :model-value="user?.email ?? ''"
            disabled
            class="w-full"
          />
        </UFormField>

        <UButton
          label="Save details"
          color="brand4"
          :loading="savingProfile"
          @click="saveProfile"
        />
      </SettingsSection>

      <!-- Appearance ---------------------------------------------------- -->
      <SettingsSection
        title="Appearance"
        description="Applies to this device."
      >
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm font-semibold">Theme</span>
          <USelect
            v-model="themePreference"
            :items="themeItems"
            value-key="value"
            class="w-44"
          />
        </div>
      </SettingsSection>

      <!-- Notifications ------------------------------------------------- -->
      <SettingsSection
        title="Event notifications"
        description="Push notifications about upcoming events, sent to this device."
      >
        <UAlert
          v-if="pushUnavailableReason"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :description="pushUnavailableReason"
        />

        <template v-else>
          <UAlert
            v-if="pushBlocked"
            color="warning"
            variant="subtle"
            icon="i-lucide-bell-off"
            description="Notifications are blocked for this site in your browser settings. You'll need to allow them there before turning this on."
          />

          <div class="flex items-center justify-between gap-4">
            <span class="text-sm font-semibold">Enable notifications</span>
            <USwitch
              v-model="pushEnabled"
              color="brand4"
              :disabled="pushBusy || pushBlocked"
              @update:model-value="onPushToggle"
            />
          </div>

          <div
            v-if="pushEnabled"
            class="flex items-center justify-between gap-4"
          >
            <span class="text-sm font-semibold">Notify me about</span>
            <USelect
              v-model="pushScope"
              :items="pushScopeItems"
              value-key="value"
              class="w-44"
              @update:model-value="onPushScopeChange"
            />
          </div>

          <UButton
            v-if="pushEnabled && isSubscribed"
            label="Send a test notification"
            icon="i-lucide-send"
            color="neutral"
            variant="subtle"
            size="sm"
            :loading="sendingTest"
            @click="sendTestNotification"
          />
        </template>
      </SettingsSection>

      <!-- Volunteer application ----------------------------------------- -->
      <SettingsSection
        v-if="isVolunteer"
        title="Volunteer application"
        description="Update what you told us when you applied."
      >
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">Application status</span>
          <UBadge
            :color="approvalBadge.color"
            variant="subtle"
            :label="approvalBadge.label"
          />
        </div>

        <UFormField label="Languages">
          <USelect
            v-model="volunteerForm.languages"
            :items="languageItems"
            value-key="id"
            multiple
            placeholder="What languages do you speak?"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Gender">
          <USelect
            v-model="volunteerForm.gender"
            :items="genderItems"
            value-key="id"
            placeholder="What is your gender?"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Ethinicity">
          <USelect
            v-model="volunteerForm.ethinicity"
            :items="ethinicityItems"
            value-key="id"
            placeholder="What is your ethinicity?"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Availability">
          <USelect
            v-model="volunteerForm.availability"
            :items="availabilityItems"
            value-key="id"
            multiple
            placeholder="When are you available?"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Areas you'd like to help with">
          <USelect
            v-model="volunteerForm.volunteerAreas"
            :items="volunteerAreaItems"
            value-key="id"
            multiple
            placeholder="Select all that apply"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="volunteerForm.volunteerAreas.includes('OTHER')"
          label="Describe the work you'd like to volunteer for"
        >
          <UTextarea
            v-model="volunteerForm.otherVolunteerAreaDescription"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Certifications">
          <USelect
            v-model="volunteerForm.certifications"
            :items="certificationItems"
            value-key="id"
            multiple
            placeholder="Select all that apply"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="volunteerForm.certifications.includes('OTHER')"
          label="Ideas or services you'd like to propose"
        >
          <UTextarea
            v-model="volunteerForm.otherCertificationDescription"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <USeparator />

        <h3 class="text-sm font-semibold text-brand4 dark:text-brand8">
          Emergency contacts
        </h3>

        <UFormField label="Primary contact name">
          <UInput
            v-model="volunteerForm.emergencyContactName1"
            placeholder="Full name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Primary contact phone">
          <UInput
            v-model="volunteerForm.emergencyContactPhone1"
            type="tel"
            placeholder="Phone number"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Secondary contact name"
          description="Optional."
        >
          <UInput
            v-model="volunteerForm.emergencyContactName2"
            placeholder="Full name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Secondary contact phone"
          description="Optional."
        >
          <UInput
            v-model="volunteerForm.emergencyContactPhone2"
            type="tel"
            placeholder="Phone number"
            class="w-full"
          />
        </UFormField>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-lock"
          title="Agreements are locked"
          description="The Code of Conduct, NDA, handbook and background check agreements you signed when applying can't be changed here. Contact Abide staff if something needs to be revisited."
        />

        <UButton
          label="Save volunteer details"
          color="brand4"
          :loading="savingVolunteer"
          @click="saveVolunteer"
        />
      </SettingsSection>

      <!-- Account ------------------------------------------------------- -->
      <SettingsSection title="Account">
        <UButton
          label="Sign out"
          icon="i-lucide-log-out"
          color="neutral"
          variant="subtle"
          @click="signOut"
        />
      </SettingsSection>

      <SettingsSection
        danger
        title="Delete account"
        description="Permanently removes your account and everything attached to it. This can't be undone."
      >
        <UButton
          label="Delete my account"
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          @click="deleteModalOpen = true"
        />
      </SettingsSection>
    </main>

    <UModal
      v-model:open="deleteModalOpen"
      title="Delete your account?"
      description="This is permanent and cannot be undone."
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>Deleting your account will permanently remove:</p>
          <ul class="list-disc space-y-1 pl-5 text-gray-600 dark:text-gray-400">
            <li>your profile and sign-in access</li>
            <li>your event sign-ups and RSVPs</li>
            <li v-if="isVolunteer">
              your volunteer application and logged hours
            </li>
          </ul>
          <p class="font-semibold">
            You will not be able to recover any of it.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            :disabled="deleting"
            @click="deleteModalOpen = false"
          />
          <UButton
            label="Yes, delete my account"
            color="error"
            :loading="deleting"
            @click="deleteAccount"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

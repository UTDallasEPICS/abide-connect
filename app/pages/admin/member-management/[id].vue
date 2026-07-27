<script setup lang="ts">
import UserAvatar from '~/components/UserAvatar.vue';
import DetailSection from '~/components/user/DetailSection.vue';
import DetailField from '~/components/user/DetailField.vue';
import SectionButton from '~/components/buttons/SectionButton.vue';
import RoleModal from '~/components/modals/RoleModal.vue';
import ConfirmModal from '~/components/modals/ConfirmModal.vue';

import type { UserData } from "~/types/user/user-data";

definePageMeta({
  layout: 'secondary',
  backText: 'Management'
});

type Section = 'GENERAL' | 'HOUR_LOG' | 'RSVPS';

const sections: { key: Section; label: string }[] = [
  { key: 'GENERAL', label: 'GENERAL' },
  { key: 'HOUR_LOG', label: 'HOUR LOG' },
  { key: 'RSVPS', label: 'RSVPS' },
];

const activeSection = ref<Section>('GENERAL');

const route = useRoute();
const userId = route.params.id as string;

// Manually forward the cookie header so the server route sees the session on SSR requests
const headers = useRequestHeaders(['cookie']);

const { data: userData, error, refresh } = await useFetch<UserData>( `/api/user/${userId}`, { headers });

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusMessage ?? 'Failed to load user',
  });
}

const formattedCreatedAt = computed(() => {
  if (!userData.value) return '';
  return new Date(userData.value.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const allRoles = ['User', 'Volunteer', 'Admin', 'Staff'];

const rolesAvailableToAdd = computed(() =>
  allRoles.filter((role) => !userData.value?.roles.includes(role))
);

const isAddRoleModalOpen = ref(false);
const isRemoveRoleModalOpen = ref(false);
const isDeleteModalOpen = ref(false);

function handleAddRole(role: string) {
  if (userData.value && !userData.value.roles.includes(role)) {
    userData.value.roles.push(role);
  }
}

function handleRemoveRole(role: string) {
  if (userData.value) {
    userData.value.roles = userData.value.roles.filter((r) => r !== role);
  }
}

function handleDelete() {
  // TODO: call delete API
}


</script>

<template>
  <div
    v-if="userData"
    class="w-full max-w-(--ui-container) mx-auto mt-19 min-h-[calc(100vh-4.75rem)] flex flex-col"
  >
    <div class="mx-10">
      <!-- User Name and Pfp -->
      <div class="flex gap-4">
        <div class="w-25 h-25">
          <UserAvatar :name="userData.name" :src="userData.imageUrl" />
        </div>
        <div class="h-25 flex flex-col justify-center">
          <p class="font-semibold text-2xl">{{ userData.name }}</p>
          <p class="font-normal text-gray-400">{{ userData.email }}</p>
        </div>
      </div>

      <!-- Section switcher -->
      <div class="w-full my-5 rounded-2xl flex items-center gap-2">
        <SectionButton
          v-for="section in sections"
          :key="section.key"
          :label="section.label"
          :selected="activeSection === section.key"
          size="md"
          @click="activeSection = section.key"
        />
      </div>

      <!-- Action buttons -->
      <div class="w-full mb-5 p-2 bg-gray-100 rounded-xl flex items-center">
        <UButton
          label="Add Role"
          icon="i-lucide-user-plus"
          color="neutral"
          variant="ghost"
          class="rounded-full font-semibold px-3"
          @click="isAddRoleModalOpen = true"
        />
        <UButton
          label="Remove Role"
          icon="i-lucide-user-minus"
          color="neutral"
          variant="ghost"
          class="rounded-full font-semibold px-3"
          @click="isRemoveRoleModalOpen = true"
        />
        <UButton
          label="Delete"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          class="rounded-full font-semibold px-3"
          @click="isDeleteModalOpen = true"
        />
      </div>

      <!-- General section -->
      <div v-if="activeSection === 'GENERAL'">
        <DetailSection title="Details">
          <DetailField label="Primary Email" :value="userData.email" />
          <DetailField label="Phone Number" :value="userData.phoneNumber" />
          <DetailField label="Roles" :value="userData.roles" />
          <DetailField label="Created At" :value="formattedCreatedAt" />
          <DetailField label="User ID" :value="userData.id" />
        </DetailSection>

        <DetailSection v-if="userData.emergencyContact" title="Emergency Contact">
          <DetailField label="Emergency Contact Name 1" :value="userData.emergencyContact.emergencyContactName1" />
          <DetailField label="Emergency Contact Phone 1" :value="userData.emergencyContact.emergencyContactPhone1" />
          <DetailField label="Emergency Contact Name 2" :value="userData.emergencyContact.emergencyContactName2" />
          <DetailField label="Emergency Contact Phone 2" :value="userData.emergencyContact.emergencyContactPhone2" />
        </DetailSection>

        <DetailSection v-if="userData.volunteer" title="Volunteer Data">
          <DetailField label="Gender" :value="userData.volunteer.gender" />
          <DetailField label="Ethnicity" :value="userData.volunteer.ethnicity" />
          <DetailField label="Languages" :value="userData.volunteer.languages" />
          <DetailField label="Availabilities" :value="userData.volunteer.availabilities" />
          <DetailField label="Volunteer Areas" :value="userData.volunteer.volunteerAreas" />
          <DetailField label="Certifications" :value="userData.volunteer.certifications" />
          <DetailField label="Other Volunteer Area" :value="userData.volunteer.otherVolunteerArea" />
          <DetailField label="Other Certification" :value="userData.volunteer.otherCertification" />
        </DetailSection>
      </div>

      <!-- Hour Log section -->
      <div v-else-if="activeSection === 'HOUR_LOG'">
        <DetailSection title="Hour Log">
          <p class="font-normal text-gray-400">No hours logged yet.</p>
        </DetailSection>
      </div>

      <!-- RSVPs section -->
      <div v-else-if="activeSection === 'RSVPS'">
        <DetailSection title="RSVPs">
          <p class="font-normal text-gray-400">No RSVPs yet.</p>
        </DetailSection>
      </div>
    </div>

    <RoleModal
      v-model:open="isAddRoleModalOpen"
      title="Add Role"
      description="Select a role to assign to this user."
      :roles="rolesAvailableToAdd"
      confirm-label="Add"
      @confirm="handleAddRole"
    />

    <RoleModal
      v-model:open="isRemoveRoleModalOpen"
      title="Remove Role"
      description="Select a role to remove from this user."
      :roles="userData.roles"
      confirm-label="Remove"
      @confirm="handleRemoveRole"
    />

    <ConfirmModal
      v-model:open="isDeleteModalOpen"
      title="Delete this account?"
      description="Are you sure you want to delete this account? This action cannot be undone."
      confirm-label="Delete"
      @confirm="handleDelete"
    />
  </div>
</template>
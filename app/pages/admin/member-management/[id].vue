<script setup lang="ts">
import UserAvatar from '~/components/UserAvatar.vue';
import SectionButton from '~/components/buttons/SectionButton.vue';
import RoleModal from '~/components/modals/RoleModal.vue';
import ConfirmModal from '~/components/modals/ConfirmModal.vue';
import SaveChangesModal from '~/components/modals/SaveChangesModal.vue';
import GeneralSection, { type GeneralDraft } from '~/components/user/GeneralSection.vue';
import HourLogSection, { type HourLogDraft } from '~/components/user/HourLogSection.vue';
import RsvpsSection, { type RsvpDraft } from '~/components/user/RsvpsSection.vue';

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

const headers = useRequestHeaders(['cookie']);

const { data: userData, error, refresh } = await useFetch<UserData>(`/api/user/${userId}`, { headers });

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 500,
    statusMessage: error.value.statusMessage ?? 'Failed to load user',
  });
}

function toDateInputValue(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

const isEditMode = ref(false);

const generalDraft = reactive<GeneralDraft>({
  phoneNumber: '',
  adminNote: '',
  isActive: false,
  gender: '',
  ethinicity: '',
  languages: [],
  availabilities: [],
  volunteerAreas: [],
  certifications: [],
  otherVolunteerArea: '',
  otherCertification: '',
  emergencyContactName1: '',
  emergencyContactPhone1: '',
  emergencyContactName2: '',
  emergencyContactPhone2: '',
});

const hourLogDrafts = reactive<Record<number, HourLogDraft>>({});
const rsvpDrafts = reactive<Record<string, RsvpDraft>>({});

function populateDrafts() {
  if (!userData.value) return;

  generalDraft.phoneNumber = userData.value.phoneNumber ?? '';
  generalDraft.adminNote = userData.value.adminNote ?? '';
  generalDraft.isActive = userData.value.isActive ?? false;
  generalDraft.gender = userData.value.volunteer?.gender ?? '';
  generalDraft.ethinicity = userData.value.volunteer?.ethnicity ?? '';
  generalDraft.languages = [...(userData.value.volunteer?.languages ?? [])];
  generalDraft.availabilities = [...(userData.value.volunteer?.availabilities ?? [])];
  generalDraft.volunteerAreas = [...(userData.value.volunteer?.volunteerAreas ?? [])];
  generalDraft.certifications = [...(userData.value.volunteer?.certifications ?? [])];
  generalDraft.otherVolunteerArea = userData.value.volunteer?.otherVolunteerArea ?? '';
  generalDraft.otherCertification = userData.value.volunteer?.otherCertification ?? '';
  generalDraft.emergencyContactName1 = userData.value.emergencyContact?.emergencyContactName1 ?? '';
  generalDraft.emergencyContactPhone1 = userData.value.emergencyContact?.emergencyContactPhone1 ?? '';
  generalDraft.emergencyContactName2 = userData.value.emergencyContact?.emergencyContactName2 ?? '';
  generalDraft.emergencyContactPhone2 = userData.value.emergencyContact?.emergencyContactPhone2 ?? '';

  for (const key of Object.keys(hourLogDrafts)) delete hourLogDrafts[Number(key)];
  for (const log of userData.value.hourLogs) {
    hourLogDrafts[log.id] = {
      hours: log.hours,
      date: toDateInputValue(log.date),
      approvalStatus: log.approvalStatus,
      comment: log.comment ?? '',
    };
  }

  for (const key of Object.keys(rsvpDrafts)) delete rsvpDrafts[key];
  for (const rsvp of userData.value.rsvps) {
    rsvpDrafts[rsvp.eventId] = { isVolunteer: rsvp.isVolunteer };
  }
}

function toggleEditMode() {
  if (isEditMode.value) {
    isEditMode.value = false;
  } else {
    populateDrafts();
    isEditMode.value = true;
  }
}

const isConfirmSaveAllOpen = ref(false);

function requestSaveAll() {
  isConfirmSaveAllOpen.value = true;
}

async function confirmSaveAll() {
  await Promise.all([
    $fetch('/api/user/update', {
      method: 'POST',
      body: {
        userId,
        ...generalDraft,
      },
    }),
    ...Object.entries(hourLogDrafts).map(([id, draft]) =>
      $fetch(`/api/hour-log/${id}`, { method: 'PATCH', body: draft })
    ),
    ...Object.entries(rsvpDrafts).map(([eventId, draft]) =>
      $fetch(`/api/rsvp/${userId}/${eventId}`, { method: 'PATCH', body: draft })
    ),
  ]);

  isConfirmSaveAllOpen.value = false;
  isEditMode.value = false;
  await refresh();
}

async function deleteHourLog(log: NonNullable<typeof userData.value>['hourLogs'][number]) {
  await $fetch(`/api/hour-log/${log.id}`, { method: 'DELETE' });
  await refresh();
}

async function deleteRsvp(rsvp: NonNullable<typeof userData.value>['rsvps'][number]) {
  await $fetch(`/api/rsvp/${userId}/${rsvp.eventId}`, { method: 'DELETE' });
  await refresh();
}

const MANAGEABLE_ROLES = ['User', 'Volunteer'];

const rolesAvailableToAdd = computed(() =>
  MANAGEABLE_ROLES.filter((role) => !userData.value?.roles.includes(role))
);

const rolesAvailableToRemove = computed(() =>
  (userData.value?.roles ?? []).filter((role) => MANAGEABLE_ROLES.includes(role))
);

const isAddRoleModalOpen = ref(false);
const isRemoveRoleModalOpen = ref(false);
const isDeleteModalOpen = ref(false);

async function handleAddRole(role: string) {
  await $fetch('/api/role/add', {
    method: 'POST',
    body: { userId, role: role.toUpperCase() },
  });
  await refresh();
}

async function handleRemoveRole(role: string) {
  await $fetch('/api/role/remove', {
    method: 'POST',
    body: { userId, role: role.toUpperCase() },
  });
  await refresh();
}

async function handleDelete() {
  await $fetch('/api/user/delete', {
    method: 'POST',
    body: { userId },
  });
  await navigateTo('/admin/member-management');
}
</script>

<template>
  <div
    v-if="userData"
    class="w-full max-w-(--ui-container) mx-auto mt-19 min-h-[calc(100vh-4.75rem)] flex flex-col"
  >
    <div class="mx-10">
      <div class="flex gap-4">
        <div class="lg:w-25 lg:h-25 w-15 h-15">
          <UserAvatar :name="userData.name" :src="userData.imageUrl" />
        </div>
        <div class="lg:h-25 h-15 flex flex-col justify-center">
          <p class="font-semibold lg:text-2xl text-xl">{{ userData.name }}</p>
          <p class="font-normal lg:text-base text-sm text-gray-400 ">{{ userData.email }}</p>
        </div>
      </div>

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

      <div class="w-full mb-5 p-2 bg-gray-100 rounded-xl flex items-center flex-wrap">
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
          label="Edit"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          class="rounded-full font-semibold px-3"
          @click="toggleEditMode"
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

      <GeneralSection
        v-if="activeSection === 'GENERAL'"
        :user-data="userData"
        :is-edit-mode="isEditMode"
        v-model="generalDraft"
      />

      <HourLogSection
        v-else-if="activeSection === 'HOUR_LOG'"
        :hour-logs="userData.hourLogs"
        :is-edit-mode="isEditMode"
        v-model="hourLogDrafts"
        @delete="deleteHourLog"
      />

      <RsvpsSection
        v-else-if="activeSection === 'RSVPS'"
        :rsvps="userData.rsvps"
        :is-edit-mode="isEditMode"
        v-model="rsvpDrafts"
        @delete="deleteRsvp"
      />

      <div v-if="isEditMode" class="sticky bottom-4 mt-6 flex items-center gap-2 bg-white dark:bg-gray-900 py-2">
        <UButton label="Save Changes" color="primary" variant="solid" @click="requestSaveAll" />
        <UButton label="Cancel" color="neutral" variant="ghost" @click="toggleEditMode" />
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
      :roles="rolesAvailableToRemove"
      confirm-label="Remove"
      @confirm="handleRemoveRole"
    />
    <SaveChangesModal
      v-model:open="isConfirmSaveAllOpen"
      @confirm="confirmSaveAll"
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
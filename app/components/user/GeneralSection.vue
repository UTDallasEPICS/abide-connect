<script setup lang="ts">
import { formatLongDate } from '#shared/utils/eventTime'
import DetailSection from '~/components/user/DetailSection.vue'
import DetailField from '~/components/user/DetailField.vue'
import type { UserData } from '~/types/user/user-data'
import { genderItems, ethinicityItems, languageItems, availabilityItems, volunteerAreaItems, certificationItems } from '~/types/volunteer/volunteer-application.type'

/**
 * Profile and volunteer-details block on the admin member-detail page.
 *
 * One of three sibling sections (with `HourLogSection` and `RsvpsSection`) that
 * share a pattern: the page owns both the saved `userData` and a separate
 * mutable `draft`, and each section renders saved values when `isEditMode` is
 * false and binds the draft when it's true. Keeping the two apart is what lets
 * the page discard edits on cancel without refetching.
 *
 * The `*Items` option lists are the same ones the volunteer application form
 * uses, so admin edits and volunteer self-service can't drift apart.
 */
export interface GeneralDraft {
  phoneNumber: string
  adminNote: string
  isActive: boolean
  gender: string
  ethinicity: string
  languages: string[]
  availabilities: string[]
  volunteerAreas: string[]
  certifications: string[]
  otherVolunteerArea: string
  otherCertification: string
  emergencyContactName1: string
  emergencyContactPhone1: string
  emergencyContactName2: string
  emergencyContactPhone2: string
}

const props = defineProps<{
  userData: UserData
  isEditMode: boolean
}>()

// Two-way bound draft object — parent owns the source of truth,
// this component reads/writes it directly via v-model.
const draft = defineModel<GeneralDraft>({ required: true })

const formattedCreatedAt = computed(() => {
  if (!props.userData) return ''
  return formatLongDate(props.userData.createdAt)
})
</script>

<template>
  <div>
    <DetailSection title="Details">
      <DetailField
        v-model="draft.adminNote"
        label="Note"
        :value="userData.adminNote"
        :editable="isEditMode"
        autocomplete="off"
      />
      <DetailField
        v-model="draft.phoneNumber"
        label="Phone Number"
        :value="userData.phoneNumber"
        :editable="isEditMode"
        type="tel"
      />
      <DetailField
        label="Primary Email"
        :value="userData.email"
      />
      <DetailField
        label="Roles"
        :value="userData.roles"
      />
      <DetailField
        label="Created At"
        :value="formattedCreatedAt"
      />
      <DetailField
        label="User ID"
        :value="userData.id"
      />
    </DetailSection>

    <DetailSection
      v-if="userData.volunteer && userData.roles.includes('Volunteer')"
      title="Emergency Contact"
    >
      <DetailField
        v-model="draft.emergencyContactName1"
        label="Emergency Contact Name 1"
        :value="userData.emergencyContact?.emergencyContactName1"
        :editable="isEditMode"
        autocomplete="off"
      />
      <DetailField
        v-model="draft.emergencyContactPhone1"
        label="Emergency Contact Phone 1"
        :value="userData.emergencyContact?.emergencyContactPhone1"
        :editable="isEditMode"
        type="tel"
        autocomplete="off"
      />
      <DetailField
        v-model="draft.emergencyContactName2"
        label="Emergency Contact Name 2"
        :value="userData.emergencyContact?.emergencyContactName2"
        :editable="isEditMode"
        autocomplete="off"
      />
      <DetailField
        v-model="draft.emergencyContactPhone2"
        label="Emergency Contact Phone 2"
        :value="userData.emergencyContact?.emergencyContactPhone2"
        :editable="isEditMode"
        type="tel"
        autocomplete="off"
      />
    </DetailSection>

    <!-- Only shown while the Volunteer role is active -->
    <DetailSection
      v-if="userData.volunteer && userData.roles.includes('Volunteer')"
      title="Volunteer Data"
    >
      <DetailField
        v-model="draft.isActive"
        label="Active"
        :value="userData.volunteer.isActive"
        :editable="isEditMode"
        type="checkbox"
      />

      <DetailField
        v-model="draft.gender"
        label="Gender"
        :value="userData.volunteer.gender"
        :editable="isEditMode"
        type="select"
        :options="genderItems"
      />

      <DetailField
        v-model="draft.ethinicity"
        label="Ethnicity"
        :value="userData.volunteer.ethnicity"
        :editable="isEditMode"
        type="select"
        :options="ethinicityItems"
      />

      <DetailField
        v-model="draft.languages"
        label="Languages"
        :value="userData.volunteer.languages"
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="languageItems"
      />

      <DetailField
        v-model="draft.availabilities"
        label="Availabilities"
        :value="userData.volunteer.availabilities"
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="availabilityItems"
      />

      <DetailField
        v-model="draft.volunteerAreas"
        label="Volunteer Areas"
        :value="userData.volunteer.volunteerAreas"
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="volunteerAreaItems"
      />
      <DetailField
        v-model="draft.certifications"
        label="Certifications"
        :value="userData.volunteer.certifications"
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="certificationItems"
      />

      <DetailField
        v-model="draft.otherVolunteerArea"
        label="Other Volunteer Area"
        :value="userData.volunteer.otherVolunteerArea"
        :editable="isEditMode"
        autocomplete="off"
      />
      <DetailField
        v-model="draft.otherCertification"
        label="Other Certification"
        :value="userData.volunteer.otherCertification"
        :editable="isEditMode"
        autocomplete="off"
      />
    </DetailSection>
  </div>
</template>

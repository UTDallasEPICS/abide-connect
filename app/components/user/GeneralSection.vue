<script setup lang="ts">
import DetailSection from '~/components/user/DetailSection.vue';
import DetailField from '~/components/user/DetailField.vue';
import type { UserData } from '~/types/user/user-data';
import { genderItems, ethinicityItems, languageItems, availabilityItems, volunteerAreaItems, certificationItems } from '~/types/volunteer/volunteer-application.type';

export interface GeneralDraft {
  phoneNumber: string;
  adminNote: string;
  isActive: boolean;
  gender: string;
  ethinicity: string;
  languages: string[];
  availabilities: string[];
  volunteerAreas: string[];
  certifications: string[];
  otherVolunteerArea: string;
  otherCertification: string;
  emergencyContactName1: string;
  emergencyContactPhone1: string;
  emergencyContactName2: string;
  emergencyContactPhone2: string;
}

const props = defineProps<{
  userData: UserData;
  isEditMode: boolean;
}>();

// Two-way bound draft object — parent owns the source of truth,
// this component reads/writes it directly via v-model.
const draft = defineModel<GeneralDraft>({ required: true });

const formattedCreatedAt = computed(() => {
  if (!props.userData) return '';
  return new Date(props.userData.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});
</script>

<template>
  <div>
    <DetailSection title="Details">
      <DetailField
        label="Phone Number"
        :value="userData.phoneNumber"
        :editable="isEditMode"
        type="tel"
        v-model="draft.phoneNumber"
      />
      <DetailField label="Primary Email" :value="userData.email" />
      <DetailField label="Roles" :value="userData.roles" />
      <DetailField label="Created At" :value="formattedCreatedAt" />
      <DetailField label="User ID" :value="userData.id" />
      <DetailField
        label="Active"
        :value="userData.isActive"
        :editable="isEditMode"
        type="checkbox"
        v-model="draft.isActive"
      />
      <DetailField
        label="Note"
        :value="userData.adminNote"
        :editable="isEditMode"
        autocomplete="off"
        v-model="draft.adminNote"
      />
    </DetailSection>

    <DetailSection v-if="userData.emergencyContact || isEditMode" title="Emergency Contact">
      <DetailField
        label="Emergency Contact Name 1"
        :value="userData.emergencyContact?.emergencyContactName1"
        :editable="isEditMode"
        autocomplete="off"
        v-model="draft.emergencyContactName1"
      />
      <DetailField
        label="Emergency Contact Phone 1"
        :value="userData.emergencyContact?.emergencyContactPhone1"
        :editable="isEditMode"
        type="tel"
        autocomplete="off"
        v-model="draft.emergencyContactPhone1"
      />
      <DetailField
        label="Emergency Contact Name 2"
        :value="userData.emergencyContact?.emergencyContactName2"
        :editable="isEditMode"
        autocomplete="off"
        v-model="draft.emergencyContactName2"
      />
      <DetailField
        label="Emergency Contact Phone 2"
        :value="userData.emergencyContact?.emergencyContactPhone2"
        :editable="isEditMode"
        type="tel"
        autocomplete="off"
        v-model="draft.emergencyContactPhone2"
      />
    </DetailSection>

    <!-- Only shown while the Volunteer role is active -->
    <DetailSection v-if="userData.volunteer && userData.roles.includes('Volunteer')" title="Volunteer Data">
      <DetailField
        label="Gender"
        :value="userData.volunteer.gender"
        :editable="isEditMode"
        type="select"
        :options="genderItems"
        v-model="draft.gender"
      />

      <DetailField
        label="Ethnicity"
        :value="userData.volunteer.ethnicity"
        :editable="isEditMode"
        type="select"
        :options="ethinicityItems"
        v-model="draft.ethinicity"
      />

      <DetailField 
        label="Languages"
        :value="userData.volunteer.languages" 
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="languageItems"
        v-model="draft.languages"
      />

      <DetailField 
        label="Availabilities" 
        :value="userData.volunteer.availabilities" 
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="availabilityItems"
        v-model="draft.availabilities"
       />

      <DetailField 
        label="Volunteer Areas" 
        :value="userData.volunteer.volunteerAreas" 
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="volunteerAreaItems"
        v-model="draft.volunteerAreas"
       />
      <DetailField 
        label="Certifications" 
        :value="userData.volunteer.certifications" 
        :editable="isEditMode"
        type="select"
        :multiple="true"
        :options="certificationItems"
        v-model="draft.certifications"
       />

      <DetailField
        label="Other Volunteer Area"
        :value="userData.volunteer.otherVolunteerArea"
        :editable="isEditMode"
        autocomplete="off"
        v-model="draft.otherVolunteerArea"
      />
      <DetailField
        label="Other Certification"
        :value="userData.volunteer.otherCertification"
        :editable="isEditMode"
        autocomplete="off"
        v-model="draft.otherCertification"
      />
    </DetailSection>
  </div>
</template>
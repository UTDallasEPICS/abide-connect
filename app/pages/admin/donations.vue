<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'secondary',
})

//Backend
interface DonationFund {
  id: string
  name: string
  link: string
  startDate: string
  endDate: string
  imageUrl: string | null
  updatedAt: string
}
const { data: fundsData, refresh } = await useAsyncData(
  'donations',
  () => $fetch<DonationFund[]>('/api/admin/donations')
)
const funds = computed(() => fundsData.value ?? [])

//Make dates pretty
function formatShort(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()+1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

//New Fund Modal States
const open = ref(false)
const fundName = ref('')
const startDate = ref('')
const endDate = ref('') 
const image = ref<File | null>(null)
const link = ref('')

//Editing Fund Modal States
const editOpen = ref(false)
const editFundName = ref('')
const editStartDate = ref('')
const editEndDate = ref('')
const editImage = ref<File | null>(null)
const editLink = ref('')
const editingFund = ref<typeof funds.value[0] | null>(null)
const editImagePrevies = ref('')


//New Fund Save
async function saveFund(close: () => void) {
  //create the new fund on the backend
  const newDonation = await $fetch<{ id: string }>('/api/admin/donations', {
  method: 'POST',
  body: {
    name: fundName.value,
    link: link.value,
    startDate: startDate.value,
    endDate: endDate.value,
  },
})
  //add the image if it has one
    if (image.value) {
        const formData = new FormData()
        formData.append('file', image.value)
        await $fetch(`/api/admin/donations/${newDonation.id}/image`, {
        method: 'POST',
        body: formData,
        })
    }
    await refresh()
    fundName.value = ''
    startDate.value = ''
    endDate.value = ''
    image.value = null
    link.value = ''
    close()
}


//Editing Fund Modal
async function openEdit(fund: DonationFund) {
  editingFund.value = fund
  editFundName.value = fund.name
  editStartDate.value = fund.startDate.split('T')[0] ?? ''
  editEndDate.value = fund.endDate.split('T')[0] ?? ''
  editLink.value = fund.link
  editImagePrevies.value = fund.imageUrl ?? ''
  editImage.value = null
  editOpen.value = true
 
}
//Editing Fund Save
async function saveEdit(close: () => void) {
  if (!editingFund.value) return
  await $fetch(`/api/admin/donations/${editingFund.value.id}`, {
    method: 'PUT',
    body: {
      name: editFundName.value,
      link: editLink.value,
      startDate: editStartDate.value,
      endDate: editEndDate.value,
      imageUrl: editingFund.value?.imageUrl,
    },
  })
  //add the image if it has one
  if (editImage.value) {
    const formData = new FormData()
    formData.append('file', editImage.value)
    await $fetch(`/api/admin/donations/${editingFund.value.id}/image`, {
      method: 'POST',
      body: formData,
    })
  }
  editImage.value = null
  editOpen.value = false
  await refresh()
  close()
}

//delete Fund
async function deleteFund(id: string) {
  await $fetch(`/api/admin/donations/${id}`, {
    method: 'DELETE',
  })
  await refresh()
  editOpen.value = false
}


</script>
<template>
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20">
        <!-- Header -->
        <div class="px-6 mt-20">
            <h1 class="text-3xl font-bold text-[#313131]">Donation Funds</h1>
        </div>

        <!--New Button-->
        <div class="px-6 mt-4 justify-end">
            <UModal v-model:open="open" title="New Fund" :ui="{footer: 'justify-end'}">
                <UButton
                color="brand4"
                class="grid place-items-center rounded-xl h-9 w-9 
                border border-gray-800/70
                hover:bg-gray-100/70 
                transition duration-200"
                :ui="{ base: 'flex items-center justify-center' }"
                >
                <UIcon name="i-heroicons-plus" class="w-5 h-5" />
                </UButton>
                <!--New Modal-->
                <template #body>
                    <div class="space-y-4">
                        <UFormField label="Fund Name">
                            <UInput v-model="fundName" placeholder = "Name" color="brand4"/>
                        </UFormField>
                        <UFormField label="Link">
                            <UInput v-model="link" placeholder="Link" color="brand4" class="w-full"/>
                        </UFormField>  
                        <UFormField label="Start Date">
                            <UInput v-model="startDate" placeholder="Start Date" type="date" color="brand4"/>
                        </UFormField> 
                        <UFormField label="End Date">
                            <UInput v-model="endDate" placeholder="End Date" type="date" color="brand4"/>
                        </UFormField> 
                        <UFormField label="Image">
                            <UFileUpload v-model="image" accept="image/*" placeholder="Upload image" color="brand4"/>
                        </UFormField>
                    </div>
                </template>

                <template #footer="{ close }">
                    <UButton label="Save" color="brand4" @click="saveFund(close)" />
                </template>
            </UModal>
        </div>

        <!--Funds Layout-->
        <div class="px-6 mt-8">
            <div class="grid grid-cols-2 gap-6">
                <div
                    v-for="fund in funds"
                    :key="fund.id"
                    class="rounded-xl shadow-lg overflow-hidden hover:scale-95 transition-all duration-300 cursor-pointer"
                    @click="openEdit(fund)">

                    <!-- Fund Image -->
                    <div class="h-35 relative overflow-hidden">
                        <img
                        :src="fund.imageUrl ? `/api/admin/donations/${fund.id}/image?t=${new Date(fund.updatedAt).getTime()}` : ''"
                        :alt="fund.name"
                        class="w-full h-full object-cover"
                        >
                    </div>
                    <!-- Fund  Content -->
                    <div class="p-2">
                        <h4 class="text-sm font_semibold text-brand4 mb-1.5"> {{ fund.name }}</h4>
                        <div class="space-y-2">
                        <!--Date Range-->
                            <div class="flex items-center text-gray-600 text-[12px]">
                                <svg class="w-4 h-4 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                <span>{{ formatShort(fund.startDate) }} - {{ formatShort(fund.endDate) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!--Edit Modal-->
        <UModal v-model:open="editOpen" title="Edit Fund" :ui="{footer: 'justify-end'}">
            <template #body>
                <div class="space-y-4">
                    <UFormField label="Fund Name">
                        <UInput v-model="editFundName" placeholder = "Name" color="brand4"/>
                    </UFormField>
                    <UFormField label="Link">
                        <UInput v-model="editLink" placeholder="Link" color="brand4" class="w-full"/>
                    </UFormField>  
                    <UFormField label="Start Date">
                        <UInput v-model="editStartDate" placeholder="Start Date" type="date" color="brand4"/>
                    </UFormField> 
                    <UFormField label="End Date">
                        <UInput v-model="editEndDate" placeholder="End Date" type="date" color="brand4"/>
                    </UFormField> 
                    <UFormField label="Image">
                        <UFileUpload v-model="editImage" accept="image/*" placeholder="Upload image" color="brand4"/>
                    </UFormField>
                </div>
            </template>
            <template #footer="{ close }">
                <UButton label="Delete" color="brand7" @click="editingFund && deleteFund(editingFund.id)" />
                <UButton label="Save" color="brand4" @click="saveEdit(close)" />
            </template>
        </UModal>
    </div>
</template>
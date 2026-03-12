<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'secondary',
})
const funds = ref([
{
    id: 1,
    name: "Prenatal Care",
    startDate: "1/1/26",
    endDate: "1/1/27",
    link: "https://www.example.com/prenatal-care",
    image: "/images/image1.jpeg"
},
{
    id: 2,
    name: "Postpartum Care",
    startDate: "1/1/26",
    endDate: "1/1/27",
    link: "https://www.example.com/postpartum-care",
    image: "/images/image1.jpeg"
},
{
    id: 3,
    name: "Childbirth Education",
    startDate: "1/1/26",
    endDate: "1/1/27",
    link: "https://www.example.com/childbirth-education",
    image: "/images/image1.jpeg"
},
{
    id: 4,
    name: "Mobile Clinic",
    startDate: "1/1/26",
    endDate: "1/1/27",
    link: "https://www.example.com/mobile-clinic",
    image: "/images/image1.jpeg"
}
])

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
function saveFund(close: () => void) {
  const imageUrl = image.value ? URL.createObjectURL(image.value) : '/images/image1.jpeg'
  funds.value.push({
    id: funds.value.length + 1,
    name: fundName.value,
    startDate: startDate.value,
    endDate: endDate.value,
    image: imageUrl,
    link: link.value
  })
  fundName.value = ''
  startDate.value = ''
  endDate.value = ''
  image.value = null
  link.value = ''
  close()
}

//Editing Fund Save

async function openEdit(fund: typeof funds.value[0]) {
  editingFund.value = fund
  editFundName.value = fund.name
  editStartDate.value = fund.startDate
  editEndDate.value = fund.endDate
  editLink.value = fund.link

  const response = await fetch(fund.image)
  const blob = await response.blob()
  editImage.value = new File([blob], "fund-image", { type: blob.type })

  editOpen.value = true
 
}
function saveEdit(close: () => void) {
  const target = funds.value.find(f => f.id === editingFund.value?.id)
  if (target) {
    target.name = editFundName.value
    target.startDate = editStartDate.value
    target.endDate = editEndDate.value
    target.link = editLink.value
    target.image = editImage.value ? URL.createObjectURL(editImage.value) : target.image
  }
  editOpen.value = false
  close()
}

function deleteFund(id: number) {
  funds.value = funds.value.filter(f => f.id !== id)
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
                <Ubutton
                class="grid place-items-center rounded-xl h-9 w-9 
                border border-gray-800/70
                hover:bg-gray-100/70 
                transition duration-200"
                >
                <UIcon name="i-heroicons-plus" class="w-5 h-5" />
                </Ubutton>
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
                        :src="fund.image"
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
                <UButton label="Delete" color="brand7" @click="deleteFund(editingFund?.id || 0); close()" />
                <UButton label="Save" color="brand4" @click="saveEdit(close)" />
            </template>
        </UModal>
    </div>
</template>
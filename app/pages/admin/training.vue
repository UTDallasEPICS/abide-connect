<script setup lang="ts">
import { ref, watchEffect } from 'vue'

type Volunteer = {
  id: number
  name: string
  email: string
  verified: boolean
}

const volunteers = ref<Volunteer[]>([])

const { data, refresh } = await useFetch('/api/admin/training')

watchEffect(() => {
  volunteers.value =
    data.value?.map((v: any) => ({
      id: v.id,
      name: v.name?.trim() || 'Unknown Volunteer',
      email: v.email,
      verified: v.status === 'APPROVED'
    })) || []
})

const newName = ref('')
const newEmail = ref('')

async function addVolunteer() {
  const newVolunteer = await $fetch('/api/admin/training', {
    method: 'POST',
    body: {
      name: newName.value,
      email: newEmail.value
    }
  })

  volunteers.value.push({
    id: newVolunteer.id,
    name: newVolunteer.name,
    email: newVolunteer.email,
    verified: false
  })

  newName.value = ''
  newEmail.value = ''
}

async function toggle(v: Volunteer) {
  const newStatus = v.verified ? 'APPROVED' : 'PENDING'

  await $fetch('/api/admin/training', {
    method: 'PATCH',
    body: {
      id: v.id,
      status: newStatus
    }
  })

  await refresh()
}

async function removePerson(id: number) {
  await $fetch(`/api/admin/training?id=${id}`, {
    method: 'DELETE'
  })

  await refresh()
}
</script>

<template>
  <div class="page">
    <h1>Volunteer Verification</h1>

    <!-- FORM -->
    <div class="add-form">
      <input v-model="newName" placeholder="Volunteer Name" />
      <input v-model="newEmail" placeholder="Email" />
      <button @click="addVolunteer">Add Volunteer</button>
    </div>

    <!-- CARDS -->
    <div 
      class="card" 
      v-for="v in volunteers" 
      :key="v.id"
      :class="{ verified: v.verified }"
    >
      <!-- LEFT -->
      <div class="left">
        <span class="name">{{ v.name }}</span>
        <small class="email">{{ v.email }}</small>

        <!-- STATUS ROW  -->
        <div class="status-row">
          <input 
            type="checkbox" 
            v-model="v.verified"
            @change="toggle(v)"
          />
          <small class="status">
            {{ v.verified ? 'Verified' : 'Pending' }}
          </small>
        </div>
      </div>

      <!-- RIGHT -->
      <div class="right">
        <button @click="removePerson(v.id)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 650px;
  margin: 120px auto 40px;
  padding: 0 16px;
  color: white;
}

/* FORM */
.add-form {
  display: flex;
  gap: 12px;
  margin: 0 auto 20px;
  max-width: 600px;
}

.add-form input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #2a3b55;
  background: #0f1b2d;
  color: white;
  font-size: 14px;
}

.add-form input:focus {
  outline: none;
  box-shadow: none;
  border-color: #3b82f6;
}

.add-form button {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
}

/* CARD */
.card {
  background: #0f1b2d;
  padding: 16px 18px;
  border-radius: 10px;
  margin-bottom: 12px;

  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card.verified {
  border-left: 6px solid #4ade80;
}

/* LEFT */
.left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name {
  font-weight: 600;
  font-size: 16px;
}

.email {
  font-size: 13px;
  opacity: 0.7;
}

/* STATUS ROW */
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status {
  font-size: 12px;
  opacity: 0.8;
}

/* RIGHT */
.right {
  display: flex;
  align-items: center;
}

/* checkbox */
.status-row input {
  transform: scale(1.3);
  cursor: pointer;
}

/* BUTTON */
button {
  background: #ef4444;
  border: none;
  color: white;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  opacity: 0.85;
}

/* MOBILE */
@media (max-width: 600px) {
  .add-form {
    flex-direction: column;
  }

  .card {
    flex-direction: row; 
  }
}
</style>
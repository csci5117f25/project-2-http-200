<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRecommenders, type Recommender } from '../stores/recommenders'
import Dialog from './ui/dialog.vue'
import DialogHeader from './ui/dialog-header.vue'
import DialogTitle from './ui/dialog-title.vue'
import DialogContent from './ui/dialog-content.vue'
import DialogFooter from './ui/dialog-footer.vue'
import Button from './ui/button.vue'
import Input from './ui/input.vue'

interface Props {
  recommender?: Recommender | null
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const recommenders = useRecommenders()

const name = ref('')
const email = ref('')
const affiliation = ref('')
const loading = ref(false)

// Watch for changes in recommender prop (for editing)
watch(() => props.recommender, (newRecommender) => {
  if (newRecommender) {
    name.value = newRecommender.name
    email.value = newRecommender.email
    affiliation.value = newRecommender.affiliation || ''
  } else {
    // Reset form for new recommender
    name.value = ''
    email.value = ''
    affiliation.value = ''
  }
}, { immediate: true })

const save = async () => {
  if (!name.value.trim() || !email.value.trim()) {
    alert('Please fill in name and email')
    return
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    alert('Please enter a valid email address')
    return
  }
  
  try {
    loading.value = true
    
    if (props.recommender?.id) {
      // Update existing recommender
      await recommenders.update(props.recommender.id, {
        name: name.value.trim(),
        email: email.value.trim(),
        affiliation: affiliation.value.trim() || undefined
      })
    } else {
      // Add new recommender
      await recommenders.add({
        name: name.value.trim(),
        email: email.value.trim(),
        affiliation: affiliation.value.trim() || undefined
      })
    }
    
    emit('close')
  } catch (error) {
    console.error('Failed to save recommender:', error)
    alert('Failed to save professor, please try again')
  } finally {
    loading.value = false
  }
}

const close = () => {
  emit('close')
}
</script>

<template>
  <Dialog :open="true" @update:open="(val) => !val && close()" class="max-w-md">
    <DialogHeader>
      <DialogTitle>{{ recommender ? 'Edit Professor' : 'Add Professor' }}</DialogTitle>
    </DialogHeader>
    
    <DialogContent class="space-y-4">
      <div class="space-y-2">
        <label for="name" class="text-sm font-semibold">Name *</label>
        <Input
          id="name"
          :value="name"
          @update:value="(val: string) => name = val"
          placeholder="Professor's full name"
          :disabled="loading"
        />
      </div>
      
      <div class="space-y-2">
        <label for="email" class="text-sm font-semibold">Email *</label>
        <Input
          id="email"
          :value="email"
          @update:value="(val: string) => email = val"
          type="email"
          placeholder="professor@university.edu"
          :disabled="loading"
        />
      </div>
      
      <div class="space-y-2">
        <label for="affiliation" class="text-sm font-semibold">Affiliation</label>
        <Input
          id="affiliation"
          :value="affiliation"
          @update:value="(val: string) => affiliation = val"
          placeholder="University/Institution (optional)"
          :disabled="loading"
        />
      </div>
    </DialogContent>
    
    <DialogFooter>
      <Button variant="outline" @click="close" :disabled="loading">
        Cancel
      </Button>
      <Button @click="save" :disabled="loading">
        {{ loading ? 'Saving...' : (recommender ? 'Update' : 'Add') }}
      </Button>
    </DialogFooter>
  </Dialog>
</template>

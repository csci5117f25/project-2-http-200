<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRecommenders, type Recommender } from '../stores/recommenders'

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
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ recommender ? 'Edit Professor' : 'Add Professor' }}</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="name">Name *</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Professor's full name"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div class="form-group">
          <label for="email">Email *</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="professor@university.edu"
            class="form-input"
            :disabled="loading"
          />
        </div>
        
        <div class="form-group">
          <label for="affiliation">Affiliation</label>
          <input
            id="affiliation"
            v-model="affiliation"
            type="text"
            placeholder="University/Institution (optional)"
            class="form-input"
            :disabled="loading"
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-cancel" @click="close" :disabled="loading">
          Cancel
        </button>
        <button class="btn-save" @click="save" :disabled="loading">
          {{ loading ? 'Saving...' : (recommender ? 'Update' : 'Add') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #ff6b6b;
}

.form-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel {
  padding: 10px 20px;
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.btn-save {
  padding: 10px 20px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #ff5252;
}

.btn-cancel:disabled,
.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

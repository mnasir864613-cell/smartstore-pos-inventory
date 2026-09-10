<script setup>
import Modal from './Modal.vue';
import { AlertTriangle } from 'lucide-vue-next';

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: {
    type: String,
    default: 'Are you sure you want to proceed?'
  },
  confirmText: {
    type: String,
    default: 'Delete'
  },
  confirmVariant: {
    type: String,
    default: 'danger'
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['confirm', 'close']);
</script>

<template>
  <Modal :isOpen="isOpen" :title="title" maxWidth="440px" @close="emit('close')">
    <div class="confirm-content">
      <div class="warning-icon-wrapper">
        <AlertTriangle :size="32" class="warning-icon" />
      </div>
      <p class="confirm-message">{{ message }}</p>
    </div>

    <template #footer>
      <button class="btn btn-secondary" :disabled="loading" @click="emit('close')">Cancel</button>
      <button :class="['btn', `btn-${confirmVariant}`]" :disabled="loading" @click="emit('confirm')">
        <span v-if="loading">Processing...</span>
        <span v-else>{{ confirmText }}</span>
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 0.5rem 0;
}
.warning-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.warning-icon {
  color: var(--danger);
}
.confirm-message {
  font-size: 0.9375rem;
  color: var(--text-main);
}
</style>

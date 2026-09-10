<script setup>
import { useToast } from '../../stores/toast.js';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-vue-next';

const { toasts, remove } = useToast();

const getIcon = (type) => {
  switch (type) {
    case 'success': return CheckCircle;
    case 'warning': return AlertTriangle;
    case 'error': return XCircle;
    default: return Info;
  }
};
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', `toast-${toast.type}`]"
    >
      <component :is="getIcon(toast.type)" :size="18" class="toast-icon" />
      <span class="toast-message">{{ toast.message }}</span>
      <button @click="remove(toast.id)" class="toast-close" aria-label="Close">
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-icon {
  flex-shrink: 0;
}
.toast-message {
  flex: 1;
  line-height: 1.35;
}
.toast-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.toast-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
</style>

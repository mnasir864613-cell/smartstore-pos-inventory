<script setup>
import { reactive, ref } from 'vue';
import Modal from '../common/Modal.vue';
import api, { getErrorMessage } from '../../api/client.js';
import { useToast } from '../../stores/toast.js';

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'created']);
const toast = useToast();

const form = reactive({
  name: '',
  phone: '',
  address: '',
  credit_balance: 0
});

const loading = ref(false);

const handleSave = async () => {
  if (!form.name.trim()) {
    toast.error('Customer name is required');
    return;
  }

  loading.value = true;
  try {
    const res = await api.post('/customers', {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      credit_balance: Number(form.credit_balance) || 0
    });
    toast.success('Customer registered successfully');
    emit('created', res.data);
    form.name = '';
    form.phone = '';
    form.address = '';
    form.credit_balance = 0;
    emit('close');
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Modal :isOpen="isOpen" title="Quick Register Customer" maxWidth="480px" @close="emit('close')">
    <form @submit.prevent="handleSave">
      <div class="form-group">
        <label class="form-label">Customer Name *</label>
        <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Bilal Ahmed" required />
      </div>

      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input v-model="form.phone" type="text" class="form-input" placeholder="e.g. 0300-1234567" />
      </div>

      <div class="form-group">
        <label class="form-label">Address / Notes</label>
        <input v-model="form.address" type="text" class="form-input" placeholder="e.g. Shop #4, Main Market" />
      </div>

      <div class="form-group">
        <label class="form-label">Initial Udhaar / Credit Balance (PKR)</label>
        <input v-model.number="form.credit_balance" type="number" step="any" min="0" class="form-input" />
      </div>
    </form>

    <template #footer>
      <button class="btn btn-secondary" :disabled="loading" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" :disabled="loading" @click="handleSave">
        <span v-if="loading">Saving...</span>
        <span v-else>Register Customer</span>
      </button>
    </template>
  </Modal>
</template>

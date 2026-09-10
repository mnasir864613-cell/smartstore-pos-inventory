<script setup>
import { ref, reactive, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import { Building2, Plus, Edit2, Trash2, RefreshCw } from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const suppliers = ref([]);
const loading = ref(true);

const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const modalLoading = ref(false);

const showDeleteModal = ref(false);
const deletingSupplier = ref(null);
const deleteLoading = ref(false);

const form = reactive({
  name: '',
  phone: '',
  address: ''
});

const loadSuppliers = async () => {
  loading.value = true;
  try {
    const res = await api.get('/suppliers');
    suppliers.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadSuppliers();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.name = '';
  form.phone = '';
  form.address = '';
  showModal.value = true;
};

const openEditModal = (supp) => {
  isEditing.value = true;
  editingId.value = supp.id;
  form.name = supp.name;
  form.phone = supp.phone || '';
  form.address = supp.address || '';
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.name.trim()) {
    toast.error('Supplier name is required');
    return;
  }

  modalLoading.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null
    };

    if (isEditing.value) {
      await api.put(`/suppliers/${editingId.value}`, payload);
      toast.success('Supplier updated successfully');
    } else {
      await api.post('/suppliers', payload);
      toast.success('Supplier created successfully');
    }

    showModal.value = false;
    loadSuppliers();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    modalLoading.value = false;
  }
};

const confirmDelete = (supp) => {
  deletingSupplier.value = supp;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!deletingSupplier.value) return;
  deleteLoading.value = true;
  try {
    await api.delete(`/suppliers/${deletingSupplier.value.id}`);
    toast.success('Supplier deleted successfully');
    showDeleteModal.value = false;
    loadSuppliers();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="suppliers-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Suppliers & Vendors</h1>
        <p class="page-sub">Manage vendor relationships, contacts, and purchase volume</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadSuppliers" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openCreateModal">
          <Plus :size="16" />
          <span>Add Supplier</span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading suppliers...</p>
      </div>

      <div v-else-if="suppliers.length === 0" class="table-empty">
        <Building2 :size="48" class="empty-icon" />
        <p>No suppliers registered yet.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Supplier Name</th>
            <th>Phone Contact</th>
            <th>Address</th>
            <th class="text-center">Orders Count</th>
            <th class="text-right">Total Purchased</th>
            <th v-if="isAdmin" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in suppliers" :key="s.id">
            <td class="font-semibold text-main">{{ s.name }}</td>
            <td class="font-mono text-sm">{{ s.phone || '-' }}</td>
            <td class="text-muted">{{ s.address || '-' }}</td>
            <td class="text-center">
              <span class="badge badge-neutral">{{ s.purchase_count || 0 }} orders</span>
            </td>
            <td class="text-right font-mono font-bold text-emerald">
              {{ formatPKR(s.total_purchased || 0) }}
            </td>
            <td v-if="isAdmin" class="text-right">
              <div class="action-btns">
                <button class="btn btn-ghost btn-sm" @click="openEditModal(s)" title="Edit">
                  <Edit2 :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm text-danger" @click="confirmDelete(s)" title="Delete">
                  <Trash2 :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Modal
      :isOpen="showModal"
      :title="isEditing ? 'Edit Supplier' : 'Register New Supplier'"
      maxWidth="480px"
      @close="showModal = false"
    >
      <form @submit.prevent="handleSave">
        <div class="form-group">
          <label class="form-label">Supplier / Business Name *</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Metro Wholesale Pakistan" required />
        </div>

        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input v-model="form.phone" type="text" class="form-input" placeholder="e.g. 0300-1234567" />
        </div>

        <div class="form-group">
          <label class="form-label">Warehouse Address / Office</label>
          <textarea v-model="form.address" class="form-textarea" rows="2" placeholder="e.g. Plot 45, Sector 12, Industrial Area"></textarea>
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="modalLoading" @click="showModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="modalLoading" @click="handleSave">
          <span v-if="modalLoading">Saving...</span>
          <span v-else>{{ isEditing ? 'Save Changes' : 'Register Supplier' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Delete Supplier"
      :message="`Are you sure you want to delete '${deletingSupplier?.name}'?`"
      confirmText="Delete Supplier"
      confirmVariant="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.suppliers-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}
.page-title { font-size: 1.5rem; }
.page-sub { font-size: 0.875rem; color: var(--text-muted); }
.header-actions { display: flex; align-items: center; gap: 0.75rem; }

.table-loading, .table-empty {
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-dim);
}
.empty-icon { opacity: 0.25; }

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-main { color: var(--text-main); }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-sm { font-size: 0.75rem; }
.text-emerald { color: var(--primary); }

.action-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}
</style>

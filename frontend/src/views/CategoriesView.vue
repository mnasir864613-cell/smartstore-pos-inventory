<script setup>
import { ref, reactive, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatDate } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import { Tags, Plus, Edit2, Trash2, RefreshCw } from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const categories = ref([]);
const loading = ref(true);

const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const modalLoading = ref(false);

const showDeleteModal = ref(false);
const deletingCategory = ref(null);
const deleteLoading = ref(false);

const form = reactive({
  name: '',
  description: ''
});

const loadCategories = async () => {
  loading.value = true;
  try {
    const res = await api.get('/categories');
    categories.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadCategories();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.name = '';
  form.description = '';
  showModal.value = true;
};

const openEditModal = (cat) => {
  isEditing.value = true;
  editingId.value = cat.id;
  form.name = cat.name;
  form.description = cat.description || '';
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.name.trim()) {
    toast.error('Category name is required');
    return;
  }

  modalLoading.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null
    };

    if (isEditing.value) {
      await api.put(`/categories/${editingId.value}`, payload);
      toast.success('Category updated successfully');
    } else {
      await api.post('/categories', payload);
      toast.success('Category created successfully');
    }

    showModal.value = false;
    loadCategories();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    modalLoading.value = false;
  }
};

const confirmDelete = (cat) => {
  deletingCategory.value = cat;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!deletingCategory.value) return;
  deleteLoading.value = true;
  try {
    await api.delete(`/categories/${deletingCategory.value.id}`);
    toast.success('Category deleted successfully');
    showDeleteModal.value = false;
    loadCategories();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="categories-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Product Categories</h1>
        <p class="page-sub">Organize catalog items into departments and classifications</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadCategories" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openCreateModal">
          <Plus :size="16" />
          <span>Add Category</span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading categories...</p>
      </div>

      <div v-else-if="categories.length === 0" class="table-empty">
        <Tags :size="48" class="empty-icon" />
        <p>No categories found. Click "Add Category" to create one.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Category Name</th>
            <th>Description</th>
            <th class="text-center">Products Count</th>
            <th>Created At</th>
            <th v-if="isAdmin" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id">
            <td class="font-semibold text-main">{{ cat.name }}</td>
            <td class="text-muted">{{ cat.description || '-' }}</td>
            <td class="text-center">
              <span class="badge badge-neutral">{{ cat.product_count || 0 }} items</span>
            </td>
            <td class="text-muted text-sm">{{ formatDate(cat.created_at) }}</td>
            <td v-if="isAdmin" class="text-right">
              <div class="action-btns">
                <button class="btn btn-ghost btn-sm" @click="openEditModal(cat)" title="Edit">
                  <Edit2 :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm text-danger" @click="confirmDelete(cat)" title="Delete">
                  <Trash2 :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <Modal
      :isOpen="showModal"
      :title="isEditing ? 'Edit Category' : 'Create New Category'"
      maxWidth="480px"
      @close="showModal = false"
    >
      <form @submit.prevent="handleSave">
        <div class="form-group">
          <label class="form-label">Category Name *</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Beverages, Dairy, Snacks" required />
        </div>

        <div class="form-group">
          <label class="form-label">Description (Optional)</label>
          <textarea v-model="form.description" class="form-textarea" rows="3" placeholder="Brief description of this product classification"></textarea>
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="modalLoading" @click="showModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="modalLoading" @click="handleSave">
          <span v-if="modalLoading">Saving...</span>
          <span v-else>{{ isEditing ? 'Save Changes' : 'Create Category' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Confirm Delete Modal -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Delete Category"
      :message="`Are you sure you want to delete category '${deletingCategory?.name}'?`"
      confirmText="Delete Category"
      confirmVariant="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.categories-page {
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
.page-title {
  font-size: 1.5rem;
}
.page-sub {
  font-size: 0.875rem;
  color: var(--text-muted);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.table-loading, .table-empty {
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-dim);
}
.empty-icon {
  opacity: 0.25;
}

.font-semibold { font-weight: 600; }
.text-main { color: var(--text-main); }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-sm { font-size: 0.75rem; }

.action-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}
</style>

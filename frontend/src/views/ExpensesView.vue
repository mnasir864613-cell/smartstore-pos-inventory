<script setup>
import { ref, reactive, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import { Wallet, Plus, Edit2, Trash2, RefreshCw } from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const expenses = ref([]);
const totalAmount = ref(0);
const loading = ref(true);

const filterCategory = ref('');
const fromDate = ref('');
const toDate = ref('');

// Add / Edit Modal
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const modalLoading = ref(false);

// Delete Modal
const showDeleteModal = ref(false);
const deletingExpense = ref(null);
const deleteLoading = ref(false);

const form = reactive({
  category: 'Utilities',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: ''
});

const loadExpenses = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterCategory.value) params.append('category', filterCategory.value);
    if (fromDate.value) params.append('from_date', fromDate.value);
    if (toDate.value) params.append('to_date', toDate.value);

    const res = await api.get(`/expenses?${params.toString()}`);
    expenses.value = res.data.expenses;
    totalAmount.value = res.data.total_amount;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadExpenses();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.category = 'Utilities';
  form.amount = '';
  form.expense_date = new Date().toISOString().split('T')[0];
  form.description = '';
  showModal.value = true;
};

const openEditModal = (exp) => {
  isEditing.value = true;
  editingId.value = exp.id;
  form.category = exp.category;
  form.amount = Number(exp.amount);
  form.expense_date = exp.expense_date ? exp.expense_date.split('T')[0] : '';
  form.description = exp.description || '';
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.category.trim()) {
    toast.error('Expense category is required');
    return;
  }
  if (!form.amount || Number(form.amount) <= 0) {
    toast.error('Expense amount must be greater than 0');
    return;
  }

  modalLoading.value = true;
  try {
    const payload = {
      category: form.category.trim(),
      amount: Number(form.amount),
      expense_date: form.expense_date,
      description: form.description.trim() || null
    };

    if (isEditing.value) {
      await api.put(`/expenses/${editingId.value}`, payload);
      toast.success('Expense record updated');
    } else {
      await api.post('/expenses', payload);
      toast.success('Expense recorded successfully');
    }

    showModal.value = false;
    loadExpenses();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    modalLoading.value = false;
  }
};

const confirmDelete = (exp) => {
  deletingExpense.value = exp;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!deletingExpense.value) return;
  deleteLoading.value = true;
  try {
    await api.delete(`/expenses/${deletingExpense.value.id}`);
    toast.success('Expense record deleted');
    showDeleteModal.value = false;
    loadExpenses();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="expenses-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Store Expenses</h1>
        <p class="page-sub">Track overheads, utilities, salaries, and operational costs</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadExpenses" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openCreateModal">
          <Plus :size="16" />
          <span>Add Expense</span>
        </button>
      </div>
    </div>

    <!-- Summary Banner & Filters -->
    <div class="card toolbar-card">
      <div class="filters-row">
        <select v-model="filterCategory" class="form-select filter-select" @change="loadExpenses">
          <option value="">All Categories</option>
          <option value="Utilities">Utilities (Electricity, Water, Gas)</option>
          <option value="Rent">Shop Rent</option>
          <option value="Salaries">Staff Salaries</option>
          <option value="Maintenance">Maintenance & Repairs</option>
          <option value="Packaging">Bags & Packaging Supplies</option>
          <option value="Miscellaneous">Miscellaneous</option>
        </select>

        <div class="date-group">
          <label class="text-xs text-muted">From:</label>
          <input v-model="fromDate" type="date" class="form-input date-input" @change="loadExpenses" />
        </div>

        <div class="date-group">
          <label class="text-xs text-muted">To:</label>
          <input v-model="toDate" type="date" class="form-input date-input" @change="loadExpenses" />
        </div>
      </div>

      <div class="total-expenses-pill">
        <span class="text-xs text-muted">Total Expenses:</span>
        <span class="expenses-sum font-mono font-bold">{{ formatPKR(totalAmount) }}</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading expenses...</p>
      </div>

      <div v-else-if="expenses.length === 0" class="table-empty">
        <Wallet :size="48" class="empty-icon" />
        <p>No expense entries found for the selected period.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Description</th>
            <th>Date</th>
            <th class="text-right">Amount</th>
            <th v-if="isAdmin" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exp in expenses" :key="exp.id">
            <td class="font-semibold text-main">
              <span class="badge badge-neutral">{{ exp.category }}</span>
            </td>
            <td class="text-muted">{{ exp.description || '-' }}</td>
            <td>{{ formatDate(exp.expense_date) }}</td>
            <td class="text-right font-mono font-bold text-danger">{{ formatPKR(exp.amount) }}</td>
            <td v-if="isAdmin" class="text-right">
              <div class="action-btns">
                <button class="btn btn-ghost btn-sm" @click="openEditModal(exp)" title="Edit">
                  <Edit2 :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm text-danger" @click="confirmDelete(exp)" title="Delete">
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
      :title="isEditing ? 'Edit Expense' : 'Record New Expense'"
      maxWidth="480px"
      @close="showModal = false"
    >
      <form @submit.prevent="handleSave">
        <div class="form-group">
          <label class="form-label">Category *</label>
          <select v-model="form.category" class="form-select" required>
            <option value="Utilities">Utilities (Electricity, Water, Gas)</option>
            <option value="Rent">Shop Rent</option>
            <option value="Salaries">Staff Salaries</option>
            <option value="Maintenance">Maintenance & Repairs</option>
            <option value="Packaging">Bags & Packaging Supplies</option>
            <option value="Transportation">Transportation / Delivery</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Amount (PKR) *</label>
          <input v-model.number="form.amount" type="number" step="any" min="1" class="form-input font-mono" placeholder="0.00" required />
        </div>

        <div class="form-group">
          <label class="form-label">Date *</label>
          <input v-model="form.expense_date" type="date" class="form-input" required />
        </div>

        <div class="form-group">
          <label class="form-label">Description / Bill Notes</label>
          <textarea v-model="form.description" class="form-textarea" rows="2" placeholder="e.g. K-Electric bill for warehouse AC"></textarea>
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="modalLoading" @click="showModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="modalLoading" @click="handleSave">
          <span v-if="modalLoading">Saving...</span>
          <span v-else>{{ isEditing ? 'Save Changes' : 'Record Expense' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Delete Expense"
      :message="`Are you sure you want to delete this expense record (${formatPKR(deletingExpense?.amount)})?`"
      confirmText="Delete Expense"
      confirmVariant="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.expenses-page {
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

.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.filter-select { width: auto; min-width: 170px; }
.date-group { display: flex; align-items: center; gap: 0.4rem; }
.date-input { width: auto; }

.total-expenses-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-md);
}
.expenses-sum {
  font-size: 1.15rem;
  color: var(--danger-text);
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
.empty-icon { opacity: 0.25; }

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-main { color: var(--text-main); }
.text-danger { color: var(--danger-text); }
.text-right { text-align: right; }
.text-xs { font-size: 0.6875rem; }

.action-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}
</style>

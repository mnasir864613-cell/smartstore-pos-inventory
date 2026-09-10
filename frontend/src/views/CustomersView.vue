<script setup>
import { ref, reactive, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Receipt,
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const customers = ref([]);
const loading = ref(true);
const search = ref('');
const filterHasCredit = ref(false);

// Add / Edit Modal
const showCustomerModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const modalLoading = ref(false);

// Repay Udhaar Modal
const showPaymentModal = ref(false);
const paymentTargetCustomer = ref(null);
const paymentAmount = ref('');
const paymentLoading = ref(false);

// Customer Profile & Sales Modal
const showProfileModal = ref(false);
const customerProfile = ref(null);
const profileLoading = ref(false);

// Delete Modal
const showDeleteModal = ref(false);
const deletingCustomer = ref(null);
const deleteLoading = ref(false);

const form = reactive({
  name: '',
  phone: '',
  address: '',
  credit_balance: 0
});

const loadCustomers = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value.trim()) params.append('search', search.value.trim());
    if (filterHasCredit.value) params.append('has_credit', 'true');

    const res = await api.get(`/customers?${params.toString()}`);
    customers.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadCustomers();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.name = '';
  form.phone = '';
  form.address = '';
  form.credit_balance = 0;
  showCustomerModal.value = true;
};

const openEditModal = (c) => {
  isEditing.value = true;
  editingId.value = c.id;
  form.name = c.name;
  form.phone = c.phone || '';
  form.address = c.address || '';
  form.credit_balance = Number(c.credit_balance) || 0;
  showCustomerModal.value = true;
};

const handleSaveCustomer = async () => {
  if (!form.name.trim()) {
    toast.error('Customer name is required');
    return;
  }

  modalLoading.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      credit_balance: Number(form.credit_balance) || 0
    };

    if (isEditing.value) {
      await api.put(`/customers/${editingId.value}`, payload);
      toast.success('Customer profile updated');
    } else {
      await api.post('/customers', payload);
      toast.success('Customer created successfully');
    }

    showCustomerModal.value = false;
    loadCustomers();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    modalLoading.value = false;
  }
};

const openPaymentModal = (c) => {
  paymentTargetCustomer.value = c;
  paymentAmount.value = Number(c.credit_balance) > 0 ? Number(c.credit_balance) : '';
  showPaymentModal.value = true;
};

const handlePayCredit = async () => {
  const amt = Number(paymentAmount.value);
  if (!amt || amt <= 0) {
    toast.error('Enter a valid repayment amount greater than 0');
    return;
  }

  paymentLoading.value = true;
  try {
    const res = await api.post(`/customers/${paymentTargetCustomer.value.id}/pay-credit`, {
      amount: amt
    });
    toast.success(`Repayment of ${formatPKR(amt)} recorded successfully!`);
    showPaymentModal.value = false;
    loadCustomers();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    paymentLoading.value = false;
  }
};

const openProfileModal = async (id) => {
  showProfileModal.value = true;
  profileLoading.value = true;
  try {
    const res = await api.get(`/customers/${id}`);
    customerProfile.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    profileLoading.value = false;
  }
};

const confirmDelete = (c) => {
  deletingCustomer.value = c;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!deletingCustomer.value) return;
  deleteLoading.value = true;
  try {
    await api.delete(`/customers/${deletingCustomer.value.id}`);
    toast.success('Customer deleted');
    showDeleteModal.value = false;
    loadCustomers();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="customers-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Customers & Udhaar (Khata)</h1>
        <p class="page-sub">Track customer ledgers, credit limits, and Udhaar repayments</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadCustomers" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button class="btn btn-primary btn-sm" @click="openCreateModal">
          <Plus :size="16" />
          <span>Add Customer</span>
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card toolbar-card">
      <div class="search-box">
        <Search :size="18" class="search-icon" />
        <input
          v-model="search"
          type="text"
          class="form-input search-input"
          placeholder="Search customer by name or phone..."
          @keyup.enter="loadCustomers"
        />
      </div>

      <div class="filters-row">
        <button
          :class="['filter-toggle-btn', { 'filter-active': filterHasCredit }]"
          @click="filterHasCredit = !filterHasCredit; loadCustomers()"
        >
          <AlertCircle :size="14" />
          <span>Only With Udhaar Balance</span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading customers ledger...</p>
      </div>

      <div v-else-if="customers.length === 0" class="table-empty">
        <Users :size="48" class="empty-icon" />
        <p>No customers found.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Phone Contact</th>
            <th>Address</th>
            <th class="text-center">Orders</th>
            <th class="text-right">Total Purchases</th>
            <th class="text-right">Udhaar Balance</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td class="font-semibold text-main">
              <a href="javascript:void(0)" class="customer-link" @click="openProfileModal(c.id)">
                {{ c.name }}
              </a>
            </td>
            <td class="font-mono text-sm">{{ c.phone || '-' }}</td>
            <td class="text-muted text-sm">{{ c.address || '-' }}</td>
            <td class="text-center font-mono">{{ c.total_sales_count || 0 }}</td>
            <td class="text-right font-mono">{{ formatPKR(c.total_sales_amount || 0) }}</td>
            <td class="text-right">
              <span
                :class="[
                  'badge',
                  Number(c.credit_balance) > 0 ? 'badge-danger font-mono font-bold' : 'badge-neutral'
                ]"
              >
                {{ formatPKR(c.credit_balance) }}
              </span>
            </td>
            <td class="text-right">
              <div class="action-btns">
                <button
                  v-if="Number(c.credit_balance) > 0"
                  class="btn btn-primary btn-sm pay-btn"
                  @click="openPaymentModal(c)"
                  title="Receive Udhaar Payment"
                >
                  <DollarSign :size="14" />
                  <span>Repay</span>
                </button>
                <button class="btn btn-ghost btn-sm" @click="openProfileModal(c.id)" title="View Profile">
                  <Eye :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm" @click="openEditModal(c)" title="Edit">
                  <Edit2 :size="16" />
                </button>
                <button v-if="isAdmin" class="btn btn-ghost btn-sm text-danger" @click="confirmDelete(c)" title="Delete">
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
      :isOpen="showCustomerModal"
      :title="isEditing ? 'Edit Customer' : 'Add New Customer'"
      maxWidth="480px"
      @close="showCustomerModal = false"
    >
      <form @submit.prevent="handleSaveCustomer">
        <div class="form-group">
          <label class="form-label">Customer Name *</label>
          <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Aslam Pervez" required />
        </div>

        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input v-model="form.phone" type="text" class="form-input" placeholder="e.g. 0312-3456789" />
        </div>

        <div class="form-group">
          <label class="form-label">Address / Details</label>
          <input v-model="form.address" type="text" class="form-input" placeholder="e.g. Shop #12, Market Square" />
        </div>

        <div class="form-group">
          <label class="form-label">Credit / Udhaar Balance (PKR)</label>
          <input v-model.number="form.credit_balance" type="number" step="any" min="0" class="form-input font-mono" />
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="modalLoading" @click="showCustomerModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="modalLoading" @click="handleSaveCustomer">
          <span v-if="modalLoading">Saving...</span>
          <span v-else>{{ isEditing ? 'Save Changes' : 'Create Customer' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Udhaar Payment Modal -->
    <Modal
      :isOpen="showPaymentModal"
      title="Record Udhaar Repayment"
      maxWidth="440px"
      @close="showPaymentModal = false"
    >
      <div v-if="paymentTargetCustomer" class="pay-modal-body">
        <div class="pay-info-banner">
          <span>Customer: <strong>{{ paymentTargetCustomer.name }}</strong></span>
          <span>Current Udhaar: <strong class="text-danger font-mono">{{ formatPKR(paymentTargetCustomer.credit_balance) }}</strong></span>
        </div>

        <div class="form-group" style="margin-top: 1rem;">
          <label class="form-label">Payment Amount (PKR) *</label>
          <input
            v-model.number="paymentAmount"
            type="number"
            step="any"
            min="1"
            class="form-input font-mono pay-input"
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary" :disabled="paymentLoading" @click="showPaymentModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="paymentLoading" @click="handlePayCredit">
          <span v-if="paymentLoading">Processing...</span>
          <span v-else>Confirm Payment</span>
        </button>
      </template>
    </Modal>

    <!-- Profile & Sales Modal -->
    <Modal
      :isOpen="showProfileModal"
      title="Customer Profile & Ledger"
      maxWidth="600px"
      @close="showProfileModal = false"
    >
      <div v-if="profileLoading || !customerProfile" class="table-loading"><div class="spinner"></div></div>
      <div v-else class="profile-modal-content">
        <div class="profile-header-grid">
          <div>
            <h3>{{ customerProfile.name }}</h3>
            <p class="font-mono text-sm">{{ customerProfile.phone || 'No phone' }}</p>
            <p class="text-sm text-dim">{{ customerProfile.address || 'No address' }}</p>
          </div>
          <div class="udhaar-highlight-box">
            <span class="text-xs text-muted">Outstanding Udhaar</span>
            <span class="udhaar-amount font-mono">{{ formatPKR(customerProfile.credit_balance) }}</span>
          </div>
        </div>

        <h4 style="margin: 1.25rem 0 0.5rem;">Recent Invoices & Transactions</h4>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Method</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in (customerProfile.recent_sales || [])" :key="s.id">
                <td class="font-mono">REC-{{ String(s.id).padStart(5, '0') }}</td>
                <td class="text-sm text-muted">{{ formatDateTime(s.sale_date) }}</td>
                <td>
                  <span :class="['badge', s.payment_method === 'cash' ? 'badge-success' : 'badge-warning']">
                    {{ s.payment_method }}
                  </span>
                </td>
                <td class="text-right font-mono font-bold">{{ formatPKR(s.total_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>

    <!-- Confirm Delete Modal -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Delete Customer"
      :message="`Are you sure you want to delete customer '${deletingCustomer?.name}'?`"
      confirmText="Delete Customer"
      confirmVariant="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.customers-page {
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
  padding: 1rem 1.25rem;
}
.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
}
.search-icon { position: absolute; left: 0.875rem; color: var(--text-dim); }
.search-input { padding-left: 2.5rem; }

.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: var(--bg-input);
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
}
.filter-active {
  background-color: var(--danger-bg) !important;
  color: var(--danger-text) !important;
  border-color: var(--danger) !important;
}

.customer-link {
  color: var(--text-main);
  text-decoration: none;
}
.customer-link:hover {
  color: var(--primary);
  text-decoration: underline;
}

.pay-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  gap: 0.25rem;
}

.pay-info-banner {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  background-color: rgba(15, 23, 42, 0.4);
  padding: 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
.pay-input {
  font-size: 1.15rem;
  font-weight: 800;
}

.profile-header-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(15, 23, 42, 0.4);
  padding: 1rem;
  border-radius: var(--radius-md);
}
.udhaar-highlight-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.udhaar-amount {
  font-size: 1.25rem;
  font-weight: 800;
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
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-sm { font-size: 0.75rem; }
.text-xs { font-size: 0.6875rem; }

.action-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}
</style>

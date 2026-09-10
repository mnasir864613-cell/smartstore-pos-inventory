<script setup>
import { ref, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDateTime } from '../utils/formatters.js';
import ReceiptModal from '../components/pos/ReceiptModal.vue';
import {
  Receipt,
  Eye,
  RefreshCw,
  Search,
  ShoppingCart
} from 'lucide-vue-next';

const toast = useToast();

const sales = ref([]);
const loading = ref(true);

const filterPaymentMethod = ref('');
const fromDate = ref('');
const toDate = ref('');

// Receipt Modal
const showReceiptModal = ref(false);
const selectedSale = ref(null);
const receiptLoading = ref(false);

const loadSales = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterPaymentMethod.value) params.append('payment_method', filterPaymentMethod.value);
    if (fromDate.value) params.append('from_date', fromDate.value);
    if (toDate.value) params.append('to_date', toDate.value);

    const res = await api.get(`/sales?${params.toString()}`);
    sales.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadSales();
});

const viewSaleReceipt = async (id) => {
  receiptLoading.value = true;
  try {
    const res = await api.get(`/sales/${id}`);
    selectedSale.value = res.data;
    showReceiptModal.value = true;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    receiptLoading.value = false;
  }
};
</script>

<template>
  <div class="sales-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Sales History & Invoices</h1>
        <p class="page-sub">View customer transactions, payment logs, and reprint receipts</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadSales" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <router-link to="/pos" class="btn btn-primary btn-sm">
          <ShoppingCart :size="16" />
          <span>New Sale (POS)</span>
        </router-link>
      </div>
    </div>

    <!-- Filters Toolbar -->
    <div class="card toolbar-card">
      <div class="filters-row">
        <select v-model="filterPaymentMethod" class="form-select filter-select" @change="loadSales">
          <option value="">All Payment Methods</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit (Udhaar)</option>
        </select>

        <div class="date-group">
          <label class="text-xs text-muted">From:</label>
          <input v-model="fromDate" type="date" class="form-input date-input" @change="loadSales" />
        </div>

        <div class="date-group">
          <label class="text-xs text-muted">To:</label>
          <input v-model="toDate" type="date" class="form-input date-input" @change="loadSales" />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading sales history...</p>
      </div>

      <div v-else-if="sales.length === 0" class="table-empty">
        <Receipt :size="48" class="empty-icon" />
        <p>No sales records found.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Receipt #</th>
            <th>Date & Time</th>
            <th>Customer</th>
            <th>Cashier</th>
            <th>Payment Method</th>
            <th class="text-center">Items</th>
            <th class="text-right">Subtotal</th>
            <th class="text-right">Total Amount</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sales" :key="s.id">
            <td class="font-mono font-semibold">REC-{{ String(s.id).padStart(5, '0') }}</td>
            <td class="text-sm text-muted">{{ formatDateTime(s.sale_date) }}</td>
            <td>
              <span class="font-semibold">{{ s.customer_name || 'Walk-in Customer' }}</span>
            </td>
            <td>{{ s.cashier_name || 'Cashier' }}</td>
            <td>
              <span :class="['badge', s.payment_method === 'cash' ? 'badge-success' : 'badge-warning']">
                {{ s.payment_method }}
              </span>
            </td>
            <td class="text-center">
              <span class="badge badge-neutral">{{ s.item_count || 1 }} items</span>
            </td>
            <td class="text-right font-mono text-muted">{{ formatPKR(s.subtotal || s.total_amount) }}</td>
            <td class="text-right font-mono font-bold text-emerald">{{ formatPKR(s.total_amount) }}</td>
            <td class="text-right">
              <button class="btn btn-ghost btn-sm" @click="viewSaleReceipt(s.id)" title="View Receipt">
                <Eye :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Receipt Modal -->
    <ReceiptModal
      :isOpen="showReceiptModal"
      :sale="selectedSale"
      @close="showReceiptModal = false"
    />
  </div>
</template>

<style scoped>
.sales-page {
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
  padding: 0.875rem 1.25rem;
}
.filters-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.filter-select {
  width: auto;
  min-width: 170px;
}
.date-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.date-input {
  width: auto;
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
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-sm { font-size: 0.75rem; }
.text-xs { font-size: 0.6875rem; }
.text-emerald { color: var(--primary); }
</style>

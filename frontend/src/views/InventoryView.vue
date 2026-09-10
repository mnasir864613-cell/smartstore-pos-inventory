<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import {
  Boxes,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  History,
  Sliders,
  RefreshCw,
  Search
} from 'lucide-vue-next';

const route = useRoute();
const { isAdmin } = useAuth();
const toast = useToast();

const currentTab = ref('stock'); // 'stock' | 'low-stock' | 'expiries' | 'movements'
const loading = ref(true);

const stockSummary = ref(null);
const stockProducts = ref([]);
const lowStockProducts = ref([]);
const expiryProducts = ref([]);
const movements = ref([]);

const searchStock = ref('');

// Stock Adjustment Modal
const showAdjustModal = ref(false);
const adjustLoading = ref(false);
const adjustForm = reactive({
  product_id: '',
  adjustment_type: 'add', // 'add' | 'subtract' | 'set'
  quantity: 1,
  note: ''
});

const loadTabContent = async () => {
  loading.value = true;
  try {
    if (currentTab.value === 'stock') {
      const res = await api.get('/inventory/stock');
      stockSummary.value = res.data.summary;
      stockProducts.value = res.data.products;
    } else if (currentTab.value === 'low-stock') {
      const res = await api.get('/inventory/low-stock');
      lowStockProducts.value = res.data;
    } else if (currentTab.value === 'expiries') {
      const res = await api.get('/inventory/expiries');
      expiryProducts.value = res.data;
    } else if (currentTab.value === 'movements') {
      const res = await api.get('/inventory/movements?limit=100');
      movements.value = res.data;
    }
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (route.query.tab) {
    currentTab.value = route.query.tab;
  }
  loadTabContent();
});

const selectTab = (tab) => {
  currentTab.value = tab;
  loadTabContent();
};

const filteredStockProducts = computed(() => {
  if (!searchStock.value.trim()) return stockProducts.value;
  const q = searchStock.value.toLowerCase().trim();
  return stockProducts.value.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
  );
});

const openAdjustModal = (product = null) => {
  adjustForm.product_id = product ? product.id : (stockProducts.value[0]?.id || '');
  adjustForm.adjustment_type = 'add';
  adjustForm.quantity = 1;
  adjustForm.note = '';
  showAdjustModal.value = true;
};

const handleAdjust = async () => {
  if (!adjustForm.product_id) {
    toast.error('Please select a product to adjust');
    return;
  }
  if (Number(adjustForm.quantity) < 0) {
    toast.error('Quantity must be a positive number');
    return;
  }

  adjustLoading.value = true;
  try {
    await api.post('/inventory/adjust', {
      product_id: Number(adjustForm.product_id),
      adjustment_type: adjustForm.adjustment_type,
      quantity: Number(adjustForm.quantity),
      note: adjustForm.note.trim() || null
    });
    toast.success('Stock adjusted successfully');
    showAdjustModal.value = false;
    loadTabContent();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    adjustLoading.value = false;
  }
};
</script>

<template>
  <div class="inventory-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Inventory Management</h1>
        <p class="page-sub">Stock valuations, audit trails, and warehouse balance control</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadTabContent" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openAdjustModal()">
          <Sliders :size="16" />
          <span>Adjust Stock</span>
        </button>
      </div>
    </div>

    <!-- Valuation KPI Summary Cards -->
    <div v-if="stockSummary" class="kpi-grid">
      <div class="card kpi-card">
        <div class="kpi-icon-wrapper bg-emerald">
          <Boxes :size="22" class="text-emerald" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Units in Stock</span>
          <span class="kpi-value">{{ stockSummary.total_units_in_stock }}</span>
          <span class="kpi-sub">{{ stockSummary.total_unique_products }} unique items</span>
        </div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-icon-wrapper bg-indigo">
          <DollarSign :size="22" class="text-indigo" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Cost Valuation</span>
          <span class="kpi-value">{{ formatPKR(stockSummary.total_inventory_cost) }}</span>
          <span class="kpi-sub">Total Purchase Investment</span>
        </div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-icon-wrapper bg-amber">
          <TrendingUp :size="22" class="text-amber" />
        </div>
        <div class="kpi-info">
          <span class="kpi-label">Retail Value</span>
          <span class="kpi-value text-emerald">{{ formatPKR(stockSummary.total_inventory_retail) }}</span>
          <span class="kpi-sub">Potential Profit: {{ formatPKR(stockSummary.potential_profit) }}</span>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="inventory-tabs">
      <button :class="['tab-btn', { 'tab-active': currentTab === 'stock' }]" @click="selectTab('stock')">
        <Boxes :size="16" />
        <span>Current Stock</span>
      </button>
      <button :class="['tab-btn', { 'tab-active': currentTab === 'low-stock' }]" @click="selectTab('low-stock')">
        <AlertTriangle :size="16" />
        <span>Low Stock Alerts</span>
      </button>
      <button :class="['tab-btn', { 'tab-active': currentTab === 'expiries' }]" @click="selectTab('expiries')">
        <Clock :size="16" />
        <span>Batch Expiry Tracker</span>
      </button>
      <button :class="['tab-btn', { 'tab-active': currentTab === 'movements' }]" @click="selectTab('movements')">
        <History :size="16" />
        <span>Stock Movements Audit</span>
      </button>
    </div>

    <!-- TAB 1: Current Stock Overview -->
    <div v-if="currentTab === 'stock'" class="tab-content">
      <div class="card search-card">
        <div class="search-box">
          <Search :size="18" class="search-icon" />
          <input
            v-model="searchStock"
            type="text"
            class="form-input search-input"
            placeholder="Search stock by product name, SKU, or barcode..."
          />
        </div>
      </div>

      <div class="table-container">
        <div v-if="loading" class="table-loading"><div class="spinner"></div></div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU / Barcode</th>
              <th class="text-center">Stock</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Unit Retail</th>
              <th class="text-right">Total Cost</th>
              <th class="text-right">Total Retail</th>
              <th>Status</th>
              <th v-if="isAdmin" class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredStockProducts" :key="p.id">
              <td class="font-semibold">{{ p.name }}</td>
              <td class="font-mono text-xs">{{ p.sku || p.barcode || '-' }}</td>
              <td class="text-center font-bold font-mono">{{ p.stock }} {{ p.unit || 'pcs' }}</td>
              <td class="text-right font-mono text-muted">{{ formatPKR(p.purchase_price) }}</td>
              <td class="text-right font-mono text-emerald">{{ formatPKR(p.sale_price) }}</td>
              <td class="text-right font-mono">{{ formatPKR(p.total_cost_value) }}</td>
              <td class="text-right font-mono font-bold">{{ formatPKR(p.total_retail_value) }}</td>
              <td>
                <span :class="['badge', p.stock_status === 'in_stock' ? 'badge-success' : (p.stock_status === 'low_stock' ? 'badge-warning' : 'badge-danger')]">
                  {{ p.stock_status }}
                </span>
              </td>
              <td v-if="isAdmin" class="text-right">
                <button class="btn btn-ghost btn-sm" @click="openAdjustModal(p)" title="Adjust">
                  <Sliders :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: Low Stock Alerts -->
    <div v-else-if="currentTab === 'low-stock'" class="tab-content">
      <div class="table-container">
        <div v-if="loading" class="table-loading"><div class="spinner"></div></div>
        <div v-else-if="lowStockProducts.length === 0" class="table-empty">
          <AlertTriangle :size="48" class="empty-icon text-emerald" />
          <p>Great news! All products are currently stocked above their minimum reorder levels.</p>
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Supplier</th>
              <th class="text-center">Current Stock</th>
              <th class="text-center">Min Threshold</th>
              <th class="text-center">Deficit Units</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in lowStockProducts" :key="p.id">
              <td class="font-semibold text-danger">{{ p.name }}</td>
              <td class="font-mono text-xs">{{ p.sku || '-' }}</td>
              <td>{{ p.category_name || '-' }}</td>
              <td>{{ p.supplier_name || '-' }}</td>
              <td class="text-center font-bold font-mono">{{ p.stock }}</td>
              <td class="text-center font-mono text-muted">{{ p.min_stock }}</td>
              <td class="text-center font-bold text-danger font-mono">{{ p.deficit > 0 ? p.deficit : 0 }}</td>
              <td class="text-right">
                <router-link to="/purchases" class="btn btn-primary btn-sm">Reorder</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: Batch Expiry Tracker -->
    <div v-else-if="currentTab === 'expiries'" class="tab-content">
      <div class="table-container">
        <div v-if="loading" class="table-loading"><div class="spinner"></div></div>
        <div v-else-if="expiryProducts.length === 0" class="table-empty">
          <Clock :size="48" class="empty-icon text-emerald" />
          <p>No products are currently near or past expiration date.</p>
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Batch #</th>
              <th class="text-center">Units in Stock</th>
              <th>Expiry Date</th>
              <th>Days Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in expiryProducts" :key="p.id">
              <td class="font-semibold">{{ p.name }}</td>
              <td class="font-mono text-xs">{{ p.sku || '-' }}</td>
              <td class="font-mono">{{ p.batch_number || 'N/A' }}</td>
              <td class="text-center font-mono font-bold">{{ p.stock }}</td>
              <td class="font-mono">{{ formatDate(p.expiry_date) }}</td>
              <td class="font-mono">
                <span :class="p.days_until_expiry < 0 ? 'text-danger font-bold' : 'text-warning'">
                  {{ p.days_until_expiry < 0 ? `${Math.abs(p.days_until_expiry)} days ago` : `${p.days_until_expiry} days left` }}
                </span>
              </td>
              <td>
                <span :class="['badge', p.status === 'expired' ? 'badge-danger' : 'badge-warning']">
                  {{ p.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: Stock Movements Audit -->
    <div v-else-if="currentTab === 'movements'" class="tab-content">
      <div class="table-container">
        <div v-if="loading" class="table-loading"><div class="spinner"></div></div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Movement ID</th>
              <th>Product</th>
              <th>Type</th>
              <th class="text-center">Quantity</th>
              <th>Reason / Reference</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id">
              <td class="font-mono text-xs">#{{ m.id }}</td>
              <td class="font-semibold">{{ m.product_name }}</td>
              <td>
                <span :class="['badge', m.type === 'in' ? 'badge-success' : (m.type === 'out' ? 'badge-danger' : 'badge-info')]">
                  {{ m.type }}
                </span>
              </td>
              <td class="text-center font-mono font-bold">
                <span :class="m.type === 'in' ? 'text-emerald' : 'text-danger'">
                  {{ m.type === 'in' ? '+' : '-' }}{{ m.quantity }}
                </span>
              </td>
              <td class="text-muted text-sm">{{ m.note || '-' }}</td>
              <td class="text-muted text-sm">{{ formatDateTime(m.moved_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Manual Stock Adjustment Modal (Admin only) -->
    <Modal
      :isOpen="showAdjustModal"
      title="Manual Stock Adjustment"
      maxWidth="500px"
      @close="showAdjustModal = false"
    >
      <form @submit.prevent="handleAdjust">
        <div class="form-group">
          <label class="form-label">Select Product *</label>
          <select v-model="adjustForm.product_id" class="form-select" required>
            <option v-for="p in stockProducts" :key="p.id" :value="p.id">
              {{ p.name }} (Current: {{ p.stock }} {{ p.unit || 'pcs' }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Adjustment Type *</label>
          <select v-model="adjustForm.adjustment_type" class="form-select">
            <option value="add">Add Units (+)</option>
            <option value="subtract">Subtract Units (Damage / Spoilage / Lost)</option>
            <option value="set">Set Exact Count (After physical audit)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input v-model.number="adjustForm.quantity" type="number" min="0" class="form-input font-mono" required />
        </div>

        <div class="form-group">
          <label class="form-label">Reason / Audit Note</label>
          <input v-model="adjustForm.note" type="text" class="form-input" placeholder="e.g. Broken packaging, shelf count correction" />
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="adjustLoading" @click="showAdjustModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="adjustLoading" @click="handleAdjust">
          <span v-if="adjustLoading">Updating...</span>
          <span v-else>Apply Adjustment</span>
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.inventory-page {
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

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}
.kpi-card {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.25rem;
}
.kpi-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.bg-emerald { background-color: var(--primary-bg); }
.text-emerald { color: var(--primary); }
.bg-indigo { background-color: var(--accent-bg); }
.text-indigo { color: var(--accent); }
.bg-amber { background-color: var(--warning-bg); }
.text-amber { color: var(--warning); }

.kpi-info {
  display: flex;
  flex-direction: column;
}
.kpi-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}
.kpi-value {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0.2rem 0;
}
.kpi-sub {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.inventory-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.25rem;
  overflow-x: auto;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}
.tab-btn:hover {
  color: var(--text-main);
}
.tab-active {
  color: var(--primary) !important;
  border-bottom-color: var(--primary) !important;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-card {
  padding: 0.75rem 1rem;
}
.search-box {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 0.875rem;
  color: var(--text-dim);
}
.search-input {
  padding-left: 2.5rem;
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
.empty-icon { opacity: 0.3; }

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-sm { font-size: 0.75rem; }
.text-xs { font-size: 0.6875rem; }
</style>

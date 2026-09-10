<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import { Truck, Plus, Trash2, Eye, RefreshCw, CheckCircle } from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const purchases = ref([]);
const suppliers = ref([]);
const products = ref([]);
const loading = ref(true);

// New Purchase Modal State
const showCreateModal = ref(false);
const createLoading = ref(false);

const purchaseForm = reactive({
  supplier_id: '',
  invoice_number: '',
  purchase_date: new Date().toISOString().split('T')[0],
  items: []
});

// View Details Modal
const showDetailsModal = ref(false);
const selectedPurchase = ref(null);
const detailsLoading = ref(false);

const loadPurchases = async () => {
  loading.value = true;
  try {
    const [purchRes, suppRes, prodRes] = await Promise.all([
      api.get('/purchases'),
      api.get('/suppliers'),
      api.get('/products')
    ]);
    purchases.value = purchRes.data;
    suppliers.value = suppRes.data;
    products.value = prodRes.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadPurchases();
});

const openNewPurchaseModal = () => {
  purchaseForm.supplier_id = suppliers.value[0]?.id || '';
  purchaseForm.invoice_number = `INV-PO-${Date.now().toString().slice(-6)}`;
  purchaseForm.purchase_date = new Date().toISOString().split('T')[0];
  purchaseForm.items = [
    {
      product_id: products.value[0]?.id || '',
      quantity: 10,
      unit_price: products.value[0]?.purchase_price || 0,
      batch_number: '',
      expiry_date: ''
    }
  ];
  showCreateModal.value = true;
};

const addItemRow = () => {
  purchaseForm.items.push({
    product_id: products.value[0]?.id || '',
    quantity: 1,
    unit_price: products.value[0]?.purchase_price || 0,
    batch_number: '',
    expiry_date: ''
  });
};

const removeItemRow = (idx) => {
  purchaseForm.items.splice(idx, 1);
};

const onProductSelected = (row) => {
  const prod = products.value.find((p) => p.id === Number(row.product_id));
  if (prod) {
    row.unit_price = Number(prod.purchase_price);
  }
};

const computedTotal = computed(() => {
  return purchaseForm.items.reduce((sum, it) => {
    return sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
  }, 0);
});

const handleSavePurchase = async () => {
  if (purchaseForm.items.length === 0) {
    toast.error('Add at least one item to the purchase order');
    return;
  }

  createLoading.value = true;
  try {
    const payload = {
      supplier_id: purchaseForm.supplier_id ? Number(purchaseForm.supplier_id) : null,
      invoice_number: purchaseForm.invoice_number.trim() || null,
      purchase_date: purchaseForm.purchase_date,
      items: purchaseForm.items.map((i) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        batch_number: i.batch_number?.trim() || null,
        expiry_date: i.expiry_date || null
      }))
    };

    await api.post('/purchases', payload);
    toast.success('Purchase created and inventory stock updated!');
    showCreateModal.value = false;
    loadPurchases();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    createLoading.value = false;
  }
};

const viewPurchaseDetails = async (id) => {
  detailsLoading.value = true;
  showDetailsModal.value = true;
  try {
    const res = await api.get(`/purchases/${id}`);
    selectedPurchase.value = res.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    detailsLoading.value = false;
  }
};
</script>

<template>
  <div class="purchases-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Purchases & Receiving</h1>
        <p class="page-sub">Create supplier purchase orders and receive stock into inventory</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadPurchases" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openNewPurchaseModal">
          <Plus :size="16" />
          <span>New Purchase (Stock In)</span>
        </button>
      </div>
    </div>

    <!-- Purchases History Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading purchases history...</p>
      </div>

      <div v-else-if="purchases.length === 0" class="table-empty">
        <Truck :size="48" class="empty-icon" />
        <p>No purchase records found. Record your first supplier shipment above.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Supplier</th>
            <th>Purchase Date</th>
            <th class="text-center">Items</th>
            <th class="text-center">Total Units</th>
            <th class="text-right">Total Amount</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in purchases" :key="p.id">
            <td class="font-mono font-semibold">{{ p.invoice_number || `PO-${p.id}` }}</td>
            <td>
              <div class="supplier-cell">
                <span class="font-semibold">{{ p.supplier_name || 'General Supplier' }}</span>
                <span v-if="p.supplier_phone" class="text-dim text-xs">{{ p.supplier_phone }}</span>
              </div>
            </td>
            <td>{{ formatDate(p.purchase_date) }}</td>
            <td class="text-center">
              <span class="badge badge-neutral">{{ p.item_count }} items</span>
            </td>
            <td class="text-center font-bold font-mono">{{ p.total_units }}</td>
            <td class="text-right font-mono font-bold text-emerald">{{ formatPKR(p.total_amount) }}</td>
            <td class="text-right">
              <button class="btn btn-ghost btn-sm" @click="viewPurchaseDetails(p.id)" title="View Receipt">
                <Eye :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Purchase Order Modal -->
    <Modal
      :isOpen="showCreateModal"
      title="Create Purchase Order (Stock In)"
      maxWidth="780px"
      @close="showCreateModal = false"
    >
      <form @submit.prevent="handleSavePurchase">
        <div class="header-inputs-grid">
          <div class="form-group">
            <label class="form-label">Select Supplier</label>
            <select v-model="purchaseForm.supplier_id" class="form-select">
              <option value="">Select Supplier</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Invoice / Reference #</label>
            <input v-model="purchaseForm.invoice_number" type="text" class="form-input font-mono" placeholder="INV-PO-001" />
          </div>

          <div class="form-group">
            <label class="form-label">Purchase Date</label>
            <input v-model="purchaseForm.purchase_date" type="date" class="form-input" required />
          </div>
        </div>

        <div class="items-editor-section">
          <div class="section-title-row">
            <h4>Purchase Order Line Items</h4>
            <button type="button" class="btn btn-secondary btn-sm" @click="addItemRow">
              <Plus :size="14" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div class="items-table-wrapper">
            <table class="items-entry-table">
              <thead>
                <tr>
                  <th style="width: 35%;">Product</th>
                  <th style="width: 15%;">Quantity</th>
                  <th style="width: 20%;">Cost Price (PKR)</th>
                  <th style="width: 20%;">Line Total</th>
                  <th style="width: 10%;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in purchaseForm.items" :key="idx">
                  <td>
                    <select v-model="row.product_id" class="form-select" @change="onProductSelected(row)" required>
                      <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} (Stock: {{ p.stock }})</option>
                    </select>
                  </td>
                  <td>
                    <input v-model.number="row.quantity" type="number" min="1" class="form-input font-mono" required />
                  </td>
                  <td>
                    <input v-model.number="row.unit_price" type="number" step="any" min="0" class="form-input font-mono" required />
                  </td>
                  <td class="font-mono font-bold text-emerald">
                    {{ formatPKR((Number(row.quantity) || 0) * (Number(row.unit_price) || 0)) }}
                  </td>
                  <td class="text-right">
                    <button type="button" class="btn btn-ghost btn-sm text-danger" @click="removeItemRow(idx)" :disabled="purchaseForm.items.length === 1">
                      <Trash2 :size="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="po-total-banner">
            <span>Total Purchase Amount:</span>
            <span class="po-grand-amount font-mono">{{ formatPKR(computedTotal) }}</span>
          </div>
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="createLoading" @click="showCreateModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="createLoading" @click="handleSavePurchase">
          <CheckCircle :size="16" />
          <span v-if="createLoading">Receiving Stock...</span>
          <span v-else>Receive & Update Stock</span>
        </button>
      </template>
    </Modal>

    <!-- Purchase Details Modal -->
    <Modal
      :isOpen="showDetailsModal"
      title="Purchase Receipt Details"
      maxWidth="680px"
      @close="showDetailsModal = false"
    >
      <div v-if="detailsLoading || !selectedPurchase" class="table-loading">
        <div class="spinner"></div>
      </div>
      <div v-else class="po-details-content">
        <div class="meta-banner">
          <div><strong>Invoice #:</strong> {{ selectedPurchase.invoice_number || `PO-${selectedPurchase.id}` }}</div>
          <div><strong>Supplier:</strong> {{ selectedPurchase.supplier_name || 'N/A' }}</div>
          <div><strong>Date:</strong> {{ formatDate(selectedPurchase.purchase_date) }}</div>
          <div><strong>Total:</strong> <span class="font-bold text-emerald">{{ formatPKR(selectedPurchase.total_amount) }}</span></div>
        </div>

        <div class="table-container" style="margin-top: 1rem;">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in (selectedPurchase.items || [])" :key="it.id">
                <td class="font-semibold">{{ it.product_name }}</td>
                <td class="font-mono text-xs">{{ it.product_sku || '-' }}</td>
                <td class="text-center font-bold font-mono">{{ it.quantity }}</td>
                <td class="text-right font-mono">{{ formatPKR(it.unit_price) }}</td>
                <td class="text-right font-mono font-bold">{{ formatPKR(it.quantity * it.unit_price) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.purchases-page {
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

.supplier-cell {
  display: flex;
  flex-direction: column;
}

.header-inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.items-editor-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.items-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.items-entry-table {
  width: 100%;
  border-collapse: collapse;
}
.items-entry-table th {
  background-color: rgba(15, 23, 42, 0.6);
  color: var(--text-muted);
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}
.items-entry-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
}
.items-entry-table tr:last-child td {
  border-bottom: none;
}

.po-total-banner {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  font-weight: 700;
  padding: 0.75rem;
  background-color: rgba(16, 185, 129, 0.1);
  border-radius: var(--radius-md);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.po-grand-amount {
  font-size: 1.25rem;
  color: var(--primary);
  font-weight: 800;
}

.meta-banner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  font-size: 0.875rem;
  background-color: rgba(15, 23, 42, 0.4);
  padding: 0.875rem;
  border-radius: var(--radius-md);
}

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-emerald { color: var(--primary); }
.text-xs { font-size: 0.6875rem; }
</style>

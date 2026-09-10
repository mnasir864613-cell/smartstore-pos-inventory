<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate } from '../utils/formatters.js';
import Modal from '../components/common/Modal.vue';
import ConfirmModal from '../components/common/ConfirmModal.vue';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  RefreshCw,
  AlertTriangle,
  Clock
} from 'lucide-vue-next';

const { isAdmin } = useAuth();
const toast = useToast();

const products = ref([]);
const categories = ref([]);
const suppliers = ref([]);
const loading = ref(true);

// Filters
const search = ref('');
const selectedCategory = ref('');
const filterLowStock = ref(false);
const filterExpiry = ref(''); // '' | 'expired' | 'near'

// Modal states
const showProductModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const modalLoading = ref(false);

const showDeleteModal = ref(false);
const deletingProduct = ref(null);
const deleteLoading = ref(false);

const form = reactive({
  name: '',
  category_id: '',
  supplier_id: '',
  sku: '',
  barcode: '',
  brand: '',
  unit: 'pcs',
  purchase_price: 0,
  sale_price: 0,
  stock: 0,
  min_stock: 5,
  expiry_date: '',
  batch_number: '',
  image_url: ''
});

const loadData = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value.trim()) params.append('search', search.value.trim());
    if (selectedCategory.value) params.append('category_id', selectedCategory.value);
    if (filterLowStock.value) params.append('low_stock', 'true');
    if (filterExpiry.value) params.append('expiry', filterExpiry.value);

    const [prodRes, catRes, suppRes] = await Promise.all([
      api.get(`/products?${params.toString()}`),
      api.get('/categories'),
      api.get('/suppliers')
    ]);

    products.value = prodRes.data;
    categories.value = catRes.data;
    suppliers.value = suppRes.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.name = '';
  form.category_id = '';
  form.supplier_id = '';
  form.sku = `SKU-${Date.now().toString().slice(-5)}`;
  form.barcode = '';
  form.brand = '';
  form.unit = 'pcs';
  form.purchase_price = 0;
  form.sale_price = 0;
  form.stock = 0;
  form.min_stock = 5;
  form.expiry_date = '';
  form.batch_number = '';
  form.image_url = '';
  showProductModal.value = true;
};

const openEditModal = (prod) => {
  isEditing.value = true;
  editingId.value = prod.id;
  form.name = prod.name;
  form.category_id = prod.category_id || '';
  form.supplier_id = prod.supplier_id || '';
  form.sku = prod.sku || '';
  form.barcode = prod.barcode || '';
  form.brand = prod.brand || '';
  form.unit = prod.unit || 'pcs';
  form.purchase_price = Number(prod.purchase_price);
  form.sale_price = Number(prod.sale_price);
  form.stock = Number(prod.stock);
  form.min_stock = Number(prod.min_stock);
  form.expiry_date = prod.expiry_date ? prod.expiry_date.split('T')[0] : '';
  form.batch_number = prod.batch_number || '';
  form.image_url = prod.image_url || '';
  showProductModal.value = true;
};

const handleSave = async () => {
  if (!form.name.trim()) {
    toast.error('Product name is required');
    return;
  }
  if (form.purchase_price < 0 || form.sale_price < 0) {
    toast.error('Prices must be non-negative numbers');
    return;
  }

  modalLoading.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      brand: form.brand.trim() || null,
      unit: form.unit.trim() || 'pcs',
      purchase_price: Number(form.purchase_price),
      sale_price: Number(form.sale_price),
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      expiry_date: form.expiry_date || null,
      batch_number: form.batch_number.trim() || null,
      image_url: form.image_url.trim() || null
    };

    if (isEditing.value) {
      await api.put(`/products/${editingId.value}`, payload);
      toast.success('Product updated successfully');
    } else {
      await api.post('/products', payload);
      toast.success('Product created successfully');
    }

    showProductModal.value = false;
    loadData();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    modalLoading.value = false;
  }
};

const confirmDelete = (prod) => {
  deletingProduct.value = prod;
  showDeleteModal.value = true;
};

const handleDelete = async () => {
  if (!deletingProduct.value) return;
  deleteLoading.value = true;
  try {
    await api.delete(`/products/${deletingProduct.value.id}`);
    toast.success('Product deleted successfully');
    showDeleteModal.value = false;
    loadData();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="products-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Product Catalog</h1>
        <p class="page-sub">Manage inventory items, SKUs, pricing, and stock thresholds</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadData" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button v-if="isAdmin" class="btn btn-primary btn-sm" @click="openCreateModal">
          <Plus :size="16" />
          <span>Add Product</span>
        </button>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="card toolbar-card">
      <div class="search-box">
        <Search :size="18" class="search-icon" />
        <input
          v-model="search"
          type="text"
          class="form-input search-input"
          placeholder="Search by name, SKU, barcode, or brand..."
          @keyup.enter="loadData"
        />
      </div>

      <div class="filters-row">
        <!-- Category Filter -->
        <select v-model="selectedCategory" class="form-select filter-select" @change="loadData">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>

        <!-- Low Stock Filter Toggle -->
        <button
          :class="['filter-toggle-btn', { 'filter-active': filterLowStock }]"
          @click="filterLowStock = !filterLowStock; loadData()"
        >
          <AlertTriangle :size="14" />
          <span>Low Stock</span>
        </button>

        <!-- Expiry Filter Toggle -->
        <select v-model="filterExpiry" class="form-select filter-select" @change="loadData">
          <option value="">All Expiries</option>
          <option value="expired">Expired Only</option>
          <option value="near">Expiring Soon (30d)</option>
        </select>
      </div>
    </div>

    <!-- Products Table -->
    <div class="table-container">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <p>Loading catalog items...</p>
      </div>

      <div v-else-if="products.length === 0" class="table-empty">
        <Package :size="48" class="empty-icon" />
        <p>No products found matching the criteria.</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU / Barcode</th>
            <th>Category</th>
            <th class="text-right">Cost Price</th>
            <th class="text-right">Sale Price</th>
            <th class="text-center">Stock</th>
            <th>Expiry Status</th>
            <th v-if="isAdmin" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="prod in products" :key="prod.id">
            <td>
              <div class="prod-cell">
                <span class="prod-cell-name">{{ prod.name }}</span>
                <span v-if="prod.brand" class="prod-cell-brand">{{ prod.brand }}</span>
              </div>
            </td>
            <td>
              <div class="sku-cell font-mono">
                <span>{{ prod.sku || '-' }}</span>
                <span v-if="prod.barcode" class="barcode-sub">{{ prod.barcode }}</span>
              </div>
            </td>
            <td>{{ prod.category_name || 'Uncategorized' }}</td>
            <td class="text-right font-mono text-muted">{{ formatPKR(prod.purchase_price) }}</td>
            <td class="text-right font-mono font-bold text-emerald">{{ formatPKR(prod.sale_price) }}</td>
            <td class="text-center">
              <span
                :class="[
                  'badge',
                  prod.stock <= 0 ? 'badge-danger' : (prod.stock <= prod.min_stock ? 'badge-warning' : 'badge-success')
                ]"
              >
                {{ prod.stock }} {{ prod.unit || 'pcs' }}
              </span>
            </td>
            <td>
              <span v-if="prod.expiry_status === 'expired'" class="badge badge-danger">
                Expired ({{ formatDate(prod.expiry_date) }})
              </span>
              <span v-else-if="prod.expiry_status === 'near_expiry'" class="badge badge-warning">
                Expiring ({{ formatDate(prod.expiry_date) }})
              </span>
              <span v-else-if="prod.expiry_date" class="text-muted text-xs">
                {{ formatDate(prod.expiry_date) }}
              </span>
              <span v-else class="text-dim text-xs">N/A</span>
            </td>
            <td v-if="isAdmin" class="text-right">
              <div class="action-btns">
                <button class="btn btn-ghost btn-sm" @click="openEditModal(prod)" title="Edit">
                  <Edit2 :size="16" />
                </button>
                <button class="btn btn-ghost btn-sm text-danger" @click="confirmDelete(prod)" title="Delete">
                  <Trash2 :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Product Create/Edit Modal -->
    <Modal
      :isOpen="showProductModal"
      :title="isEditing ? 'Edit Product' : 'Add New Product'"
      maxWidth="680px"
      @close="showProductModal = false"
    >
      <form @submit.prevent="handleSave">
        <div class="modal-form-grid">
          <div class="form-group col-span-2">
            <label class="form-label">Product Name *</label>
            <input v-model="form.name" type="text" class="form-input" placeholder="e.g. Guard Basmati Rice 5kg" required />
          </div>

          <div class="form-group">
            <label class="form-label">SKU (Stock Keeping Unit)</label>
            <input v-model="form.sku" type="text" class="form-input font-mono" placeholder="e.g. RICE-001" />
          </div>

          <div class="form-group">
            <label class="form-label">Barcode (Scan or Type)</label>
            <input v-model="form.barcode" type="text" class="form-input font-mono" placeholder="e.g. 8901234567890" />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select v-model="form.category_id" class="form-select">
              <option value="">Select Category</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Supplier</label>
            <select v-model="form.supplier_id" class="form-select">
              <option value="">Select Supplier</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Brand</label>
            <input v-model="form.brand" type="text" class="form-input" placeholder="e.g. Guard, Nestle" />
          </div>

          <div class="form-group">
            <label class="form-label">Unit of Measure</label>
            <input v-model="form.unit" type="text" class="form-input" placeholder="pcs, kg, bag, box, litre" />
          </div>

          <div class="form-group">
            <label class="form-label">Purchase Price (PKR) *</label>
            <input v-model.number="form.purchase_price" type="number" step="any" min="0" class="form-input font-mono" required />
          </div>

          <div class="form-group">
            <label class="form-label">Sale Price (PKR) *</label>
            <input v-model.number="form.sale_price" type="number" step="any" min="0" class="form-input font-mono" required />
          </div>

          <div class="form-group">
            <label class="form-label">Current Stock Quantity</label>
            <input v-model.number="form.stock" type="number" min="0" class="form-input font-mono" />
          </div>

          <div class="form-group">
            <label class="form-label">Minimum Stock Alert Threshold</label>
            <input v-model.number="form.min_stock" type="number" min="0" class="form-input font-mono" />
          </div>

          <div class="form-group">
            <label class="form-label">Expiry Date</label>
            <input v-model="form.expiry_date" type="date" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Batch Number</label>
            <input v-model="form.batch_number" type="text" class="form-input font-mono" placeholder="e.g. B2026-X" />
          </div>
        </div>
      </form>

      <template #footer>
        <button class="btn btn-secondary" :disabled="modalLoading" @click="showProductModal = false">Cancel</button>
        <button class="btn btn-primary" :disabled="modalLoading" @click="handleSave">
          <span v-if="modalLoading">Saving Product...</span>
          <span v-else>{{ isEditing ? 'Save Changes' : 'Create Product' }}</span>
        </button>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <ConfirmModal
      :isOpen="showDeleteModal"
      title="Delete Product"
      :message="`Are you sure you want to delete '${deletingProduct?.name}'? This action cannot be undone.`"
      confirmText="Delete Product"
      confirmVariant="danger"
      :loading="deleteLoading"
      @confirm="handleDelete"
      @close="showDeleteModal = false"
    />
  </div>
</template>

<style scoped>
.products-page {
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
.search-icon {
  position: absolute;
  left: 0.875rem;
  color: var(--text-dim);
}
.search-input {
  padding-left: 2.5rem;
}

.filters-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.filter-select {
  width: auto;
  min-width: 150px;
}

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
.filter-toggle-btn:hover {
  border-color: var(--warning);
  color: var(--warning);
}
.filter-active {
  background-color: var(--warning-bg) !important;
  color: var(--warning) !important;
  border-color: var(--warning) !important;
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

.prod-cell {
  display: flex;
  flex-direction: column;
}
.prod-cell-name {
  font-weight: 600;
  color: var(--text-main);
}
.prod-cell-brand {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.sku-cell {
  display: flex;
  flex-direction: column;
  font-size: 0.8125rem;
}
.barcode-sub {
  font-size: 0.6875rem;
  color: var(--text-dim);
}

.action-btns {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.modal-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
}
.col-span-2 {
  grid-column: span 2;
}

.font-mono { font-family: var(--font-mono); }
.font-bold { font-weight: 700; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-emerald { color: var(--primary); }
.text-xs { font-size: 0.75rem; }
</style>

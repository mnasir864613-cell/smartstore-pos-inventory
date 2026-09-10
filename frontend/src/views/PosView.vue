<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useToast } from '../stores/toast.js';
import { formatPKR } from '../utils/formatters.js';
import ReceiptModal from '../components/pos/ReceiptModal.vue';
import QuickCustomerModal from '../components/pos/QuickCustomerModal.vue';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  CreditCard,
  Banknote,
  CheckCircle,
  AlertCircle,
  RotateCcw
} from 'lucide-vue-next';

const toast = useToast();

// State
const products = ref([]);
const categories = ref([]);
const customers = ref([]);
const loadingProducts = ref(true);

const searchQuery = ref('');
const selectedCategory = ref('');
const searchInputRef = ref(null);

// Cart State
const cart = ref([]);
const selectedCustomerId = ref('');
const paymentMethod = ref('cash'); // 'cash' | 'credit'
const orderDiscount = ref(0);
const orderTax = ref(0);
const cashReceived = ref('');
const isSubmitting = ref(false);

// Modals
const showReceiptModal = ref(false);
const completedSaleData = ref(null);
const showQuickCustModal = ref(false);

// Fetch Initial Data
const loadInitialData = async () => {
  loadingProducts.value = true;
  try {
    const [prodRes, catRes, custRes] = await Promise.all([
      api.get('/products'),
      api.get('/categories'),
      api.get('/customers')
    ]);
    products.value = prodRes.data;
    categories.value = catRes.data;
    customers.value = custRes.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loadingProducts.value = false;
  }
};

onMounted(() => {
  loadInitialData();
  nextTick(() => {
    searchInputRef.value?.focus();
  });
});

// Filtered Products
const filteredProducts = computed(() => {
  let list = products.value;

  if (selectedCategory.value) {
    list = list.filter((p) => p.category_id === Number(selectedCategory.value));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    );
  }

  return list;
});

// Barcode Scan / Exact Match Auto-Add
const handleSearchEnter = () => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return;

  const exactMatch = products.value.find(
    (p) => p.barcode?.toLowerCase() === query || p.sku?.toLowerCase() === query
  );

  if (exactMatch) {
    addToCart(exactMatch);
    searchQuery.value = '';
  }
};

// Cart Operations
const addToCart = (product) => {
  if (product.stock <= 0) {
    toast.warning(`Product '${product.name}' is out of stock!`);
    return;
  }

  const existing = cart.value.find((item) => item.product_id === product.id);

  if (existing) {
    if (existing.quantity >= product.stock) {
      toast.warning(`Maximum available stock (${product.stock}) reached for '${product.name}'`);
      return;
    }
    existing.quantity += 1;
  } else {
    cart.value.push({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit_price: Number(product.sale_price),
      max_stock: product.stock,
      quantity: 1,
      discount: 0
    });
  }
};

const updateQuantity = (item, delta) => {
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(item);
  } else if (newQty > item.max_stock) {
    toast.warning(`Cannot exceed available stock of ${item.max_stock}`);
  } else {
    item.quantity = newQty;
  }
};

const removeFromCart = (item) => {
  const idx = cart.value.findIndex((i) => i.product_id === item.product_id);
  if (idx !== -1) {
    cart.value.splice(idx, 1);
  }
};

const clearCart = () => {
  cart.value = [];
  cashReceived.value = '';
  orderDiscount.value = 0;
  orderTax.value = 0;
};

// Calculations
const subtotal = computed(() => {
  return cart.value.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price - (Number(item.discount) || 0));
  }, 0);
});

const grandTotal = computed(() => {
  const total = subtotal.value - (Number(orderDiscount.value) || 0) + (Number(orderTax.value) || 0);
  return Math.max(0, total);
});

const changeDue = computed(() => {
  if (paymentMethod.value !== 'cash') return 0;
  const tendered = Number(cashReceived.value) || 0;
  return Math.max(0, tendered - grandTotal.value);
});

// Quick Cash Buttons
const setTendered = (amount) => {
  cashReceived.value = amount;
};

// Selected Customer info
const selectedCustomer = computed(() => {
  if (!selectedCustomerId.value) return null;
  return customers.value.find((c) => c.id === Number(selectedCustomerId.value));
});

// Customer Created via Modal
const onCustomerCreated = (newCust) => {
  customers.value.unshift(newCust);
  selectedCustomerId.value = newCust.id;
};

// Checkout Sale
const handleCheckout = async () => {
  if (cart.value.length === 0) {
    toast.error('Cart is empty. Please add products first.');
    return;
  }

  if (paymentMethod.value === 'credit' && !selectedCustomerId.value) {
    toast.error('Please select a customer for Credit (Udhaar) sales');
    return;
  }

  if (paymentMethod.value === 'cash' && cashReceived.value && Number(cashReceived.value) < grandTotal.value) {
    toast.warning('Tendered cash is less than the grand total.');
  }

  isSubmitting.value = true;
  try {
    const payload = {
      customer_id: selectedCustomerId.value ? Number(selectedCustomerId.value) : null,
      payment_method: paymentMethod.value,
      discount: Number(orderDiscount.value) || 0,
      tax: Number(orderTax.value) || 0,
      items: cart.value.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: Number(i.discount) || 0
      }))
    };

    const res = await api.post('/sales', payload);
    const saleResult = res.data.sale;

    completedSaleData.value = {
      ...saleResult,
      items: cart.value.map((c) => ({
        ...c,
        line_total: c.quantity * c.unit_price - c.discount
      }))
    };

    showReceiptModal.value = true;
    toast.success('Sale completed successfully!');

    // Refresh products stock and customers list
    loadInitialData();
    clearCart();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="pos-layout">
    <!-- LEFT: Products Catalog & Search -->
    <div class="pos-catalog-panel">
      <!-- Search & Barcode Bar -->
      <div class="pos-search-bar">
        <div class="search-input-wrapper">
          <Search :size="18" class="search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="pos-input"
            placeholder="Scan barcode or search product by name/SKU... (Enter to add)"
            @keyup.enter="handleSearchEnter"
          />
          <Barcode :size="20" class="barcode-icon" />
        </div>
      </div>

      <!-- Categories Pills Filter -->
      <div class="category-pills">
        <button
          :class="['pill-btn', { 'pill-active': selectedCategory === '' }]"
          @click="selectedCategory = ''"
        >
          All Items
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          :class="['pill-btn', { 'pill-active': selectedCategory === cat.id }]"
          @click="selectedCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>

      <!-- Products Grid -->
      <div v-if="loadingProducts" class="catalog-loading">
        <div class="spinner"></div>
        <p>Loading inventory...</p>
      </div>

      <div v-else-if="filteredProducts.length === 0" class="catalog-empty">
        <ShoppingCart :size="48" class="empty-icon" />
        <p>No products match your search.</p>
      </div>

      <div v-else class="products-grid">
        <div
          v-for="prod in filteredProducts"
          :key="prod.id"
          :class="['product-pos-card', { 'out-of-stock': prod.stock <= 0 }]"
          @click="addToCart(prod)"
        >
          <div class="prod-badge-row">
            <span v-if="prod.stock <= 0" class="badge badge-danger">Out of stock</span>
            <span v-else-if="prod.stock <= prod.min_stock" class="badge badge-warning">Low: {{ prod.stock }}</span>
            <span v-else class="badge badge-neutral">{{ prod.stock }} {{ prod.unit || 'pcs' }}</span>
          </div>

          <div class="prod-details">
            <h4 class="prod-name" :title="prod.name">{{ prod.name }}</h4>
            <span class="prod-sku font-mono">{{ prod.sku || prod.barcode || 'N/A' }}</span>
          </div>

          <div class="prod-footer">
            <span class="prod-price">{{ formatPKR(prod.sale_price) }}</span>
            <button class="add-btn" :disabled="prod.stock <= 0">
              <Plus :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Cart & Checkout Panel -->
    <div class="pos-cart-panel card">
      <!-- Cart Header -->
      <div class="cart-header">
        <div class="cart-title">
          <ShoppingCart :size="20" class="text-primary" />
          <h3>Current Order</h3>
          <span class="cart-badge">{{ cart.length }} items</span>
        </div>
        <button v-if="cart.length > 0" class="btn btn-ghost btn-sm text-danger" @click="clearCart" title="Reset cart">
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </div>

      <!-- Customer Selector -->
      <div class="customer-select-section">
        <div class="cust-row">
          <select v-model="selectedCustomerId" class="form-select">
            <option value="">Walk-in Customer (Anonymous)</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }} (Udhaar: {{ formatPKR(c.credit_balance) }})
            </option>
          </select>
          <button class="btn btn-secondary btn-sm" @click="showQuickCustModal = true" title="Quick Register Customer">
            <UserPlus :size="16" />
          </button>
        </div>

        <div v-if="selectedCustomer && Number(selectedCustomer.credit_balance) > 0" class="udhaar-alert">
          <AlertCircle :size="14" />
          <span>Has existing Udhaar: <strong>{{ formatPKR(selectedCustomer.credit_balance) }}</strong></span>
        </div>
      </div>

      <!-- Cart Items List -->
      <div class="cart-items-wrapper">
        <div v-if="cart.length === 0" class="cart-empty-state">
          <ShoppingCart :size="36" class="text-dim" />
          <p>Cart is empty. Click products or scan barcode to add.</p>
        </div>

        <div v-else class="cart-items-list">
          <div v-for="item in cart" :key="item.product_id" class="cart-item-row">
            <div class="item-info">
              <span class="item-title">{{ item.product_name }}</span>
              <span class="item-rate">{{ formatPKR(item.unit_price) }} each</span>
            </div>

            <div class="item-actions">
              <div class="qty-control">
                <button class="qty-btn" @click="updateQuantity(item, -1)">
                  <Minus :size="12" />
                </button>
                <span class="qty-display">{{ item.quantity }}</span>
                <button class="qty-btn" @click="updateQuantity(item, 1)">
                  <Plus :size="12" />
                </button>
              </div>

              <span class="item-total">{{ formatPKR(item.quantity * item.unit_price) }}</span>

              <button class="btn btn-ghost btn-sm remove-item-btn" @click="removeFromCart(item)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bill Totals Section -->
      <div class="cart-totals-section">
        <div class="total-line">
          <span>Subtotal:</span>
          <span class="font-mono">{{ formatPKR(subtotal) }}</span>
        </div>

        <div class="calc-inputs-grid">
          <div class="mini-form-group">
            <label>Discount (PKR):</label>
            <input v-model.number="orderDiscount" type="number" min="0" step="any" class="form-input mini-input" />
          </div>
          <div class="mini-form-group">
            <label>Tax (PKR):</label>
            <input v-model.number="orderTax" type="number" min="0" step="any" class="form-input mini-input" />
          </div>
        </div>

        <div class="grand-total-banner">
          <span class="grand-label">Grand Total:</span>
          <span class="grand-amount font-mono">{{ formatPKR(grandTotal) }}</span>
        </div>
      </div>

      <!-- Payment Method Selection -->
      <div class="payment-method-tabs">
        <button
          type="button"
          :class="['method-btn', { 'method-active': paymentMethod === 'cash' }]"
          @click="paymentMethod = 'cash'"
        >
          <Banknote :size="18" />
          <span>Cash</span>
        </button>
        <button
          type="button"
          :class="['method-btn', { 'method-active': paymentMethod === 'credit' }]"
          @click="paymentMethod = 'credit'"
        >
          <CreditCard :size="18" />
          <span>Credit (Udhaar)</span>
        </button>
      </div>

      <!-- Cash Tendered & Change (if Cash) -->
      <div v-if="paymentMethod === 'cash'" class="cash-tendered-box">
        <div class="tender-row">
          <label class="form-label">Cash Received (PKR):</label>
          <input
            v-model.number="cashReceived"
            type="number"
            class="form-input font-mono tender-input"
            placeholder="0.00"
          />
        </div>

        <div class="quick-cash-row">
          <button type="button" class="quick-cash-btn" @click="setTendered(grandTotal)">Exact</button>
          <button type="button" class="quick-cash-btn" @click="setTendered(Math.ceil(grandTotal / 500) * 500)">
            {{ formatPKR(Math.ceil(grandTotal / 500) * 500) }}
          </button>
          <button type="button" class="quick-cash-btn" @click="setTendered(Math.ceil(grandTotal / 1000) * 1000)">
            {{ formatPKR(Math.ceil(grandTotal / 1000) * 1000) }}
          </button>
        </div>

        <div v-if="Number(cashReceived) >= grandTotal" class="change-display">
          <span>Change to Return:</span>
          <span class="change-amount font-mono">{{ formatPKR(changeDue) }}</span>
        </div>
      </div>

      <!-- Checkout Button -->
      <button
        class="btn btn-primary btn-lg checkout-btn"
        :disabled="cart.length === 0 || isSubmitting"
        @click="handleCheckout"
      >
        <CheckCircle :size="20" />
        <span v-if="isSubmitting">Processing Sale...</span>
        <span v-else>Complete Sale • {{ formatPKR(grandTotal) }}</span>
      </button>
    </div>

    <!-- Modals -->
    <ReceiptModal
      :isOpen="showReceiptModal"
      :sale="completedSaleData"
      :customer="selectedCustomer"
      :cashReceived="Number(cashReceived) || 0"
      :changeDue="changeDue"
      @close="showReceiptModal = false"
    />

    <QuickCustomerModal
      :isOpen="showQuickCustModal"
      @close="showQuickCustModal = false"
      @created="onCustomerCreated"
    />
  </div>
</template>

<style scoped>
.pos-catalog-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  height: 100%;
}

.pos-search-bar {
  display: flex;
  align-items: center;
}
.search-input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 1rem;
  color: var(--text-dim);
}
.barcode-icon {
  position: absolute;
  right: 1rem;
  color: var(--primary);
}
.pos-input {
  width: 100%;
  padding: 0.875rem 2.75rem 0.875rem 2.75rem;
  font-size: 0.9375rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
.pos-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.category-pills {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}
.pill-btn {
  padding: 0.375rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
  background-color: var(--bg-surface);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--transition);
}
.pill-btn:hover {
  color: var(--text-main);
  border-color: var(--border-light);
}
.pill-active {
  background-color: var(--primary) !important;
  color: #fff !important;
  border-color: var(--primary) !important;
}

.catalog-loading, .catalog-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  gap: 0.75rem;
}
.empty-icon {
  opacity: 0.3;
}

.products-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.875rem;
  padding-right: 0.25rem;
}

.product-pos-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: var(--transition);
}
.product-pos-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.out-of-stock {
  opacity: 0.5;
  pointer-events: none;
  background-color: rgba(15, 23, 42, 0.4);
}

.prod-badge-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 0.5rem;
}
.prod-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.prod-name {
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.prod-sku {
  font-size: 0.6875rem;
  color: var(--text-dim);
}

.prod-footer {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 0.5rem;
}
.prod-price {
  font-size: 0.9375rem;
  font-weight: 800;
  color: var(--primary);
}
.add-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background-color: var(--primary-bg);
  color: var(--primary);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* RIGHT PANEL: CART */
.pos-cart-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}
.cart-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cart-title h3 {
  font-size: 1.05rem;
}
.cart-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  background-color: var(--border-color);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
}

.customer-select-section {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}
.cust-row {
  display: flex;
  gap: 0.5rem;
}
.udhaar-alert {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--warning);
  background-color: var(--warning-bg);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.cart-items-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}
.cart-empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.75rem;
  color: var(--text-dim);
  font-size: 0.8125rem;
  padding: 2rem;
}

.cart-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.cart-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background-color: rgba(15, 23, 42, 0.4);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.item-title {
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-rate {
  font-size: 0.6875rem;
  color: var(--text-dim);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.qty-control {
  display: flex;
  align-items: center;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}
.qty-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.qty-btn:hover {
  color: var(--text-main);
}
.qty-display {
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}
.item-total {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--font-mono);
  min-width: 70px;
  text-align: right;
}
.remove-item-btn {
  padding: 4px;
  color: var(--danger);
}

.cart-totals-section {
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.total-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--text-muted);
}
.calc-inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.mini-form-group label {
  font-size: 0.6875rem;
  color: var(--text-dim);
}
.mini-input {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.grand-total-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
}
.grand-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
}
.grand-amount {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary);
}

.payment-method-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.method-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background-color: rgba(15, 23, 42, 0.4);
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
}
.method-active {
  background-color: var(--bg-surface) !important;
  color: var(--text-main) !important;
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.cash-tendered-box {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.tender-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.tender-input {
  width: 130px;
  text-align: right;
  font-size: 0.875rem;
  padding: 0.35rem 0.5rem;
}
.quick-cash-row {
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
}
.quick-cash-btn {
  font-size: 0.6875rem;
  font-weight: 600;
  background-color: var(--border-color);
  color: var(--text-main);
  border: none;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.change-display {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--primary);
  font-weight: 600;
}
.change-amount {
  font-weight: 800;
}

.checkout-btn {
  width: 100%;
  margin-top: 0.75rem;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
</style>

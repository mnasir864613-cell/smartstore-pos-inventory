<script setup>
import { ref, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDateTime } from '../utils/formatters.js';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Package,
  AlertTriangle,
  Clock,
  Users,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(true);
const summary = ref(null);
const recent = ref({ recent_sales: [], recent_stock_movements: [] });

const fetchDashboardData = async () => {
  loading.value = true;
  try {
    const [sumRes, recRes] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/recent')
    ]);
    summary.value = sumRes.data;
    recent.value = recRes.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDashboardData();
});
</script>

<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Executive Dashboard</h1>
        <p class="page-sub">Real-time performance, POS sales metrics, and inventory alerts</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="fetchDashboardData" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <router-link to="/pos" class="btn btn-primary btn-sm">
          <ShoppingCart :size="16" />
          <span>POS Terminal</span>
        </router-link>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !summary" class="loading-state">
      <div class="spinner"></div>
      <p>Loading analytics from backend...</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="summary" class="dashboard-content">
      <!-- KPI Cards Grid -->
      <div class="kpi-grid">
        <!-- Today Sales -->
        <div class="card kpi-card">
          <div class="kpi-icon-wrapper bg-emerald">
            <DollarSign :size="22" class="text-emerald" />
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Today's Sales</span>
            <span class="kpi-value">{{ formatPKR(summary.today.sales_revenue) }}</span>
            <span class="kpi-sub">{{ summary.today.orders_count }} orders completed today</span>
          </div>
        </div>

        <!-- Today Net Profit -->
        <div class="card kpi-card">
          <div class="kpi-icon-wrapper bg-indigo">
            <TrendingUp :size="22" class="text-indigo" />
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Today's Net Profit</span>
            <span :class="['kpi-value', Number(summary.today.net_profit) >= 0 ? 'text-emerald' : 'text-danger']">
              {{ formatPKR(summary.today.net_profit) }}
            </span>
            <span class="kpi-sub">Gross: {{ formatPKR(summary.today.gross_profit) }}</span>
          </div>
        </div>

        <!-- Today Expenses -->
        <div class="card kpi-card">
          <div class="kpi-icon-wrapper bg-amber">
            <CreditCard :size="22" class="text-amber" />
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Today's Expenses</span>
            <span class="kpi-value">{{ formatPKR(summary.today.expenses) }}</span>
            <span class="kpi-sub">Total Shop Overhead</span>
          </div>
        </div>

        <!-- Outstanding Udhaar -->
        <div class="card kpi-card">
          <div class="kpi-icon-wrapper bg-rose">
            <Users :size="22" class="text-rose" />
          </div>
          <div class="kpi-info">
            <span class="kpi-label">Outstanding Udhaar</span>
            <span class="kpi-value text-rose">{{ formatPKR(summary.udhaar.total_outstanding_udhaar) }}</span>
            <span class="kpi-sub">{{ summary.udhaar.customers_with_udhaar }} customer(s) with balance</span>
          </div>
        </div>
      </div>

      <!-- Secondary Metrics Bar -->
      <div class="alert-grid">
        <div class="card alert-card">
          <div class="alert-header">
            <Package :size="18" class="text-muted" />
            <span class="alert-title">Catalog Inventory</span>
          </div>
          <div class="alert-body">
            <span class="alert-number">{{ summary.products.total_products }}</span>
            <span class="alert-text">Active Products registered</span>
          </div>
          <router-link to="/products" class="alert-link">
            <span>View Catalog</span>
            <ArrowUpRight :size="14" />
          </router-link>
        </div>

        <div class="card alert-card alert-warning-card">
          <div class="alert-header">
            <AlertTriangle :size="18" class="text-warning" />
            <span class="alert-title text-warning">Low Stock Warning</span>
          </div>
          <div class="alert-body">
            <span class="alert-number text-warning">{{ summary.products.low_stock_count }}</span>
            <span class="alert-text">Items below reorder point</span>
          </div>
          <router-link to="/inventory?tab=low-stock" class="alert-link">
            <span>Restock Items</span>
            <ArrowUpRight :size="14" />
          </router-link>
        </div>

        <div class="card alert-card alert-danger-card">
          <div class="alert-header">
            <Clock :size="18" class="text-danger" />
            <span class="alert-title text-danger">Expired Products</span>
          </div>
          <div class="alert-body">
            <span class="alert-number text-danger">{{ summary.products.expired_count }}</span>
            <span class="alert-text">{{ summary.products.near_expiry_count }} near expiry (30d)</span>
          </div>
          <router-link to="/inventory?tab=expiries" class="alert-link">
            <span>Inspect Batches</span>
            <ArrowUpRight :size="14" />
          </router-link>
        </div>
      </div>

      <!-- Tables Grid: Recent Sales & Stock Movements -->
      <div class="tables-grid">
        <!-- Recent Sales -->
        <div class="card table-card">
          <div class="card-header">
            <div>
              <h3>Recent POS Sales</h3>
              <p>Latest customer transactions</p>
            </div>
            <router-link to="/sales" class="btn btn-ghost btn-sm">View All</router-link>
          </div>

          <div v-if="recent.recent_sales?.length === 0" class="empty-feed">
            <p>No sales recorded yet today.</p>
          </div>

          <div v-else class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Time</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sale in recent.recent_sales" :key="sale.id">
                  <td class="font-mono">REC-{{ String(sale.id).padStart(5, '0') }}</td>
                  <td>{{ sale.customer_name || 'Walk-in' }}</td>
                  <td>
                    <span :class="['badge', sale.payment_method === 'cash' ? 'badge-success' : 'badge-warning']">
                      {{ sale.payment_method }}
                    </span>
                  </td>
                  <td class="text-muted">{{ formatDateTime(sale.sale_date) }}</td>
                  <td class="text-right font-semibold">{{ formatPKR(sale.total_amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Stock Movements Audit -->
        <div class="card table-card">
          <div class="card-header">
            <div>
              <h3>Stock Movements</h3>
              <p>Real-time audit of inventory ins & outs</p>
            </div>
            <router-link to="/inventory?tab=movements" class="btn btn-ghost btn-sm">View All</router-link>
          </div>

          <div v-if="recent.recent_stock_movements?.length === 0" class="empty-feed">
            <p>No stock movement logs found.</p>
          </div>

          <div v-else class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th class="text-center">Qty</th>
                  <th>Reason / Note</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="mov in recent.recent_stock_movements" :key="mov.id">
                  <td class="font-semibold">{{ mov.product_name }}</td>
                  <td>
                    <span :class="['badge', mov.type === 'in' ? 'badge-success' : (mov.type === 'out' ? 'badge-danger' : 'badge-info')]">
                      {{ mov.type }}
                    </span>
                  </td>
                  <td class="text-center font-mono font-bold">
                    <span :class="mov.type === 'in' ? 'text-emerald' : 'text-danger'">
                      {{ mov.type === 'in' ? '+' : '-' }}{{ mov.quantity }}
                    </span>
                  </td>
                  <td class="text-muted text-sm">{{ mov.note || '-' }}</td>
                  <td class="text-muted text-sm">{{ formatDateTime(mov.moved_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem;
  color: var(--text-muted);
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin-icon {
  animation: spin 1s linear infinite;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.5rem;
}
.kpi-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bg-emerald { background-color: var(--primary-bg); }
.text-emerald { color: var(--primary); }
.bg-indigo { background-color: var(--accent-bg); }
.text-indigo { color: var(--accent); }
.bg-amber { background-color: var(--warning-bg); }
.text-amber { color: var(--warning); }
.bg-rose { background-color: rgba(244, 63, 94, 0.15); }
.text-rose { color: #f43f5e; }

.kpi-info {
  display: flex;
  flex-direction: column;
}
.kpi-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.kpi-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0.2rem 0;
  letter-spacing: -0.02em;
}
.kpi-sub {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.alert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.alert-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem;
}
.alert-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.alert-title {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.alert-number {
  font-size: 1.85rem;
  font-weight: 800;
  line-height: 1;
}
.alert-text {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-left: 0.5rem;
}
.alert-link {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}
.alert-link:hover {
  text-decoration: underline;
}

.tables-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 1080px) {
  .tables-grid {
    grid-template-columns: 1fr;
  }
}

.table-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-header h3 {
  font-size: 1.05rem;
}
.card-header p {
  font-size: 0.75rem;
}

.empty-feed {
  padding: 2rem;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.875rem;
}
.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-sm { font-size: 0.75rem; }
</style>

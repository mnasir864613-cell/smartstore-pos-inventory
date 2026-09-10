<script setup>
import { ref, onMounted } from 'vue';
import api, { getErrorMessage } from '../api/client.js';
import { useToast } from '../stores/toast.js';
import { formatPKR, formatDate } from '../utils/formatters.js';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  Wallet,
  Truck,
  RefreshCw,
  Printer
} from 'lucide-vue-next';

const toast = useToast();
const loading = ref(true);

const summary = ref(null);
const stockSummary = ref(null);
const customersWithUdhaar = ref([]);

const loadReportsData = async () => {
  loading.value = true;
  try {
    const [sumRes, invRes, custRes] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/inventory/stock'),
      api.get('/customers?has_credit=true')
    ]);

    summary.value = sumRes.data;
    stockSummary.value = invRes.data.summary;
    customersWithUdhaar.value = custRes.data;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadReportsData();
});

const handlePrintReport = () => {
  window.print();
};
</script>

<template>
  <div class="reports-page">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">Financial & Operational Reports</h1>
        <p class="page-sub">Comprehensive audit of sales revenue, gross/net margins, inventory valuation, and customer credit</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" @click="loadReportsData" :disabled="loading">
          <RefreshCw :size="16" :class="{ 'spin-icon': loading }" />
          <span>Refresh</span>
        </button>
        <button class="btn btn-primary btn-sm" @click="handlePrintReport">
          <Printer :size="16" />
          <span>Print Report</span>
        </button>
      </div>
    </div>

    <div v-if="loading && !summary" class="loading-state">
      <div class="spinner"></div>
      <p>Generating business intelligence report...</p>
    </div>

    <div v-else-if="summary" class="report-document">
      <!-- Printable Report Header -->
      <div class="report-header-sheet">
        <h2>SmartStore Retail Analytics Report</h2>
        <p class="report-meta-line">Generated on {{ new Date().toLocaleString('en-PK') }} • Branch: Main Branch (ID: 1)</p>
      </div>

      <!-- Section 1: Today's Financial P&L Breakdown -->
      <div class="report-section card">
        <div class="section-title">
          <DollarSign :size="20" class="text-primary" />
          <h3>Today's Trading Profit & Loss (P&L)</h3>
        </div>

        <div class="pnl-breakdown-grid">
          <div class="pnl-item">
            <span class="pnl-label">Gross Sales Revenue</span>
            <span class="pnl-val text-emerald font-mono">{{ formatPKR(summary.today.sales_revenue) }}</span>
            <span class="pnl-sub">From {{ summary.today.orders_count }} POS receipts</span>
          </div>

          <div class="pnl-item">
            <span class="pnl-label">Cost of Goods Sold (COGS)</span>
            <span class="pnl-val text-muted font-mono">- {{ formatPKR(summary.today.cogs) }}</span>
            <span class="pnl-sub">Original inventory purchase cost</span>
          </div>

          <div class="pnl-item">
            <span class="pnl-label">Gross Profit Margin</span>
            <span class="pnl-val font-mono font-bold">{{ formatPKR(summary.today.gross_profit) }}</span>
            <span class="pnl-sub">Trading Margin</span>
          </div>

          <div class="pnl-item">
            <span class="pnl-label">Today's Operating Expenses</span>
            <span class="pnl-val text-danger font-mono">- {{ formatPKR(summary.today.expenses) }}</span>
            <span class="pnl-sub">Store overheads & bills</span>
          </div>

          <div class="pnl-item pnl-net">
            <span class="pnl-label">Today's Net Profit</span>
            <span :class="['pnl-val font-mono font-bold', Number(summary.today.net_profit) >= 0 ? 'text-emerald' : 'text-danger']">
              {{ formatPKR(summary.today.net_profit) }}
            </span>
            <span class="pnl-sub">Net earnings after expenses</span>
          </div>
        </div>
      </div>

      <!-- Section 2: Balance Sheet & Inventory Valuation -->
      <div class="report-grid-two">
        <div class="report-section card">
          <div class="section-title">
            <BarChart3 :size="20" class="text-indigo" />
            <h3>Warehouse Inventory Valuation</h3>
          </div>

          <table class="report-summary-table">
            <tbody>
              <tr>
                <td>Total Units in Warehouse:</td>
                <td class="text-right font-mono font-bold">{{ stockSummary?.total_units_in_stock || 0 }} units</td>
              </tr>
              <tr>
                <td>Total Inventory Purchase Cost:</td>
                <td class="text-right font-mono">{{ formatPKR(stockSummary?.total_inventory_cost) }}</td>
              </tr>
              <tr>
                <td>Total Retail Market Value:</td>
                <td class="text-right font-mono font-bold text-emerald">{{ formatPKR(stockSummary?.total_inventory_retail) }}</td>
              </tr>
              <tr class="highlight-row">
                <td>Projected Gross Inventory Profit:</td>
                <td class="text-right font-mono font-bold text-emerald">{{ formatPKR(stockSummary?.potential_profit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="report-section card">
          <div class="section-title">
            <Users :size="20" class="text-rose" />
            <h3>Outstanding Customer Udhaar (Khata)</h3>
          </div>

          <table class="report-summary-table">
            <tbody>
              <tr>
                <td>Customers with Unpaid Balance:</td>
                <td class="text-right font-mono font-bold text-danger">{{ summary.udhaar.customers_with_udhaar }}</td>
              </tr>
              <tr class="highlight-row">
                <td>Total Outstanding Credit Balance:</td>
                <td class="text-right font-mono font-bold text-danger">{{ formatPKR(summary.udhaar.total_outstanding_udhaar) }}</td>
              </tr>
              <tr>
                <td>Lifetime Customer Sales Volume:</td>
                <td class="text-right font-mono">{{ formatPKR(summary.sales_lifetime.total_sales_amount) }}</td>
              </tr>
              <tr>
                <td>Total Lifetime Purchase Spend:</td>
                <td class="text-right font-mono">{{ formatPKR(summary.purchases.total_purchases_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section 3: Customer Udhaar Aging Table -->
      <div class="report-section card">
        <div class="section-title">
          <AlertTriangle :size="20" class="text-warning" />
          <h3>Detailed Customer Credit Aging List</h3>
        </div>

        <div v-if="customersWithUdhaar.length === 0" class="empty-notice">
          <p>No customers currently hold an outstanding Udhaar balance.</p>
        </div>

        <div v-else class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Address</th>
                <th class="text-center">Total Invoices</th>
                <th class="text-right">Outstanding Udhaar</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in customersWithUdhaar" :key="c.id">
                <td class="font-semibold">{{ c.name }}</td>
                <td class="font-mono text-sm">{{ c.phone || '-' }}</td>
                <td class="text-sm text-muted">{{ c.address || '-' }}</td>
                <td class="text-center font-mono">{{ c.total_sales_count }}</td>
                <td class="text-right font-mono font-bold text-danger">{{ formatPKR(c.credit_balance) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-page {
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
.page-title { font-size: 1.5rem; }
.page-sub { font-size: 0.875rem; color: var(--text-muted); }
.header-actions { display: flex; align-items: center; gap: 0.75rem; }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-dim);
  gap: 1rem;
}

.report-document {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.report-header-sheet {
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 0.75rem;
}
.report-header-sheet h2 {
  font-size: 1.35rem;
  font-weight: 800;
}
.report-meta-line {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: 0.25rem;
}

.report-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.section-title h3 {
  font-size: 1.05rem;
}

.pnl-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  background-color: rgba(15, 23, 42, 0.4);
  padding: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}
.pnl-item {
  display: flex;
  flex-direction: column;
}
.pnl-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pnl-val {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0.25rem 0;
}
.pnl-sub {
  font-size: 0.6875rem;
  color: var(--text-dim);
}
.pnl-net {
  border-left: 2px solid var(--primary);
  padding-left: 1rem;
}

.report-grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 900px) {
  .report-grid-two {
    grid-template-columns: 1fr;
  }
}

.report-summary-table {
  width: 100%;
  border-collapse: collapse;
}
.report-summary-table td {
  padding: 0.625rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.875rem;
}
.highlight-row td {
  background-color: rgba(255, 255, 255, 0.02);
  border-top: 1px solid var(--border-color);
}

.empty-notice {
  padding: 1.5rem;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.875rem;
}

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.text-emerald { color: var(--primary); }
.text-danger { color: var(--danger-text); }
.text-indigo { color: var(--accent); }
.text-rose { color: #f43f5e; }
.text-muted { color: var(--text-muted); }

@media print {
  .no-print {
    display: none !important;
  }
  .reports-page {
    background: #fff !important;
    color: #000 !important;
  }
  .card {
    border: 1px solid #ddd !important;
    box-shadow: none !important;
    background: #fff !important;
    color: #000 !important;
  }
}
</style>

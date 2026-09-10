<script setup>
import { Printer, CheckCircle, X } from 'lucide-vue-next';
import { formatPKR, formatDateTime } from '../../utils/formatters.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  sale: {
    type: Object,
    default: () => ({})
  },
  customer: {
    type: Object,
    default: null
  },
  cashReceived: {
    type: Number,
    default: 0
  },
  changeDue: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['close']);

const printReceipt = () => {
  window.print();
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-container receipt-modal-container">
      <div class="modal-header no-print">
        <div class="success-banner">
          <CheckCircle :size="20" class="text-success" />
          <h3>Sale Completed Successfully</h3>
        </div>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body receipt-printable">
        <div class="receipt-header">
          <h2 class="store-name">SMARTSTORE POS</h2>
          <p class="store-sub">Main Branch, Super Highway</p>
          <p class="store-sub">Phone: 0300-1234567</p>
          <div class="receipt-divider"></div>
        </div>

        <div class="receipt-meta">
          <div><strong>Receipt #:</strong> {{ sale?.id ? `REC-${String(sale.id).padStart(5, '0')}` : 'REC-00001' }}</div>
          <div><strong>Date:</strong> {{ formatDateTime(sale?.sale_date || new Date()) }}</div>
          <div><strong>Customer:</strong> {{ customer?.name || sale?.customer_name || 'Walk-in Customer' }}</div>
          <div><strong>Payment:</strong> <span class="capitalize">{{ sale?.payment_method || 'cash' }}</span></div>
        </div>

        <div class="receipt-divider"></div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, idx) in (sale?.items || [])" :key="idx">
              <td>{{ it.product_name || `Product #${it.product_id}` }}</td>
              <td class="text-center">{{ it.quantity }}</td>
              <td class="text-right">{{ formatPKR(it.unit_price) }}</td>
              <td class="text-right">{{ formatPKR(it.line_total || (it.quantity * it.unit_price)) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-divider"></div>

        <div class="receipt-totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>{{ formatPKR(sale?.subtotal || sale?.total_amount) }}</span>
          </div>
          <div v-if="sale?.discount && Number(sale.discount) > 0" class="total-row text-danger">
            <span>Discount:</span>
            <span>- {{ formatPKR(sale.discount) }}</span>
          </div>
          <div v-if="sale?.tax && Number(sale.tax) > 0" class="total-row">
            <span>Tax:</span>
            <span>+ {{ formatPKR(sale.tax) }}</span>
          </div>
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>{{ formatPKR(sale?.total_amount) }}</span>
          </div>

          <div v-if="sale?.payment_method === 'cash' && cashReceived > 0" class="cash-details">
            <div class="total-row text-muted">
              <span>Cash Tendered:</span>
              <span>{{ formatPKR(cashReceived) }}</span>
            </div>
            <div class="total-row text-muted">
              <span>Change Returned:</span>
              <span>{{ formatPKR(changeDue) }}</span>
            </div>
          </div>

          <div v-if="sale?.payment_method === 'credit'" class="credit-notice">
            <span>* Added to Customer Udhaar balance</span>
          </div>
        </div>

        <div class="receipt-footer">
          <p>Thank you for shopping with us!</p>
          <p class="powered-by">Powered by SmartStore POS</p>
        </div>
      </div>

      <div class="modal-footer no-print">
        <button class="btn btn-secondary" @click="emit('close')">Close</button>
        <button class="btn btn-primary" @click="printReceipt">
          <Printer :size="16" />
          <span>Print Receipt</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.receipt-modal-container {
  max-width: 440px;
}
.success-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.text-success { color: var(--primary); }

.receipt-printable {
  background-color: #ffffff;
  color: #0f172a;
  padding: 1.5rem;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.receipt-header {
  text-align: center;
}
.store-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 0.25rem;
}
.store-sub {
  color: #64748b;
  font-size: 0.75rem;
}

.receipt-divider {
  border-bottom: 1px dashed #cbd5e1;
  margin: 0.75rem 0;
}

.receipt-meta {
  font-size: 0.75rem;
  line-height: 1.5;
  color: #334155;
}

.receipt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}
.receipt-table th {
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  padding: 0.35rem 0;
  color: #64748b;
}
.receipt-table td {
  padding: 0.35rem 0;
}
.text-center { text-align: center; }
.text-right { text-align: right; }

.receipt-totals {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}
.total-row {
  display: flex;
  justify-content: space-between;
}
.grand-total {
  font-size: 1rem;
  font-weight: 800;
  border-top: 1px solid #0f172a;
  padding-top: 0.35rem;
  margin-top: 0.25rem;
}
.cash-details {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dotted #cbd5e1;
  font-size: 0.75rem;
}
.credit-notice {
  font-size: 0.75rem;
  color: #b91c1c;
  font-weight: 600;
  text-align: center;
  margin-top: 0.35rem;
}

.receipt-footer {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.75rem;
  color: #64748b;
}
.powered-by {
  font-size: 0.65rem;
  margin-top: 0.25rem;
  color: #94a3b8;
}

@media print {
  .no-print {
    display: none !important;
  }
}
</style>

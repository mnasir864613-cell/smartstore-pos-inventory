<script setup>
import { ref, reactive } from 'vue';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import {
  Settings,
  Store,
  User,
  Shield,
  Save,
  CheckCircle,
  Database
} from 'lucide-vue-next';

const { user, isAdmin } = useAuth();
const toast = useToast();

const storeSettings = reactive({
  store_name: localStorage.getItem('smartstore_name') || 'SmartStore Supermarket',
  address: localStorage.getItem('smartstore_address') || 'Plot 12-B, Commercial Area, Karachi',
  phone: localStorage.getItem('smartstore_phone') || '0300-1234567',
  receipt_footer: localStorage.getItem('smartstore_footer') || 'Thank you for shopping with us! Returns accepted within 7 days with valid receipt.',
  currency: 'PKR',
  tax_rate: 0
});

const handleSaveSettings = () => {
  localStorage.setItem('smartstore_name', storeSettings.store_name);
  localStorage.setItem('smartstore_address', storeSettings.address);
  localStorage.setItem('smartstore_phone', storeSettings.phone);
  localStorage.setItem('smartstore_footer', storeSettings.receipt_footer);
  toast.success('Store settings saved successfully!');
};
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Store & Terminal Settings</h1>
        <p class="page-sub">Configure store branding, receipt footer details, and system defaults</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Store Profile Card -->
      <div class="card settings-card">
        <div class="card-title-row">
          <Store :size="20" class="text-primary" />
          <h3>Store Identity & Receipt Details</h3>
        </div>

        <form @submit.prevent="handleSaveSettings" class="settings-form">
          <div class="form-group">
            <label class="form-label">Store / Business Name</label>
            <input v-model="storeSettings.store_name" type="text" class="form-input" required />
          </div>

          <div class="form-group">
            <label class="form-label">Store Address</label>
            <input v-model="storeSettings.address" type="text" class="form-input" required />
          </div>

          <div class="form-group">
            <label class="form-label">Helpline / Phone Number</label>
            <input v-model="storeSettings.phone" type="text" class="form-input font-mono" required />
          </div>

          <div class="form-group">
            <label class="form-label">Receipt Footer Note</label>
            <textarea v-model="storeSettings.receipt_footer" class="form-textarea" rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Currency Symbol</label>
            <input v-model="storeSettings.currency" type="text" class="form-input font-mono" disabled />
          </div>

          <button type="submit" class="btn btn-primary">
            <Save :size="16" />
            <span>Save Settings</span>
          </button>
        </form>
      </div>

      <!-- Account & Multi-store Information Card -->
      <div class="card settings-card">
        <div class="card-title-row">
          <User :size="20" class="text-indigo" />
          <h3>Active Session Profile</h3>
        </div>

        <div class="profile-info-list">
          <div class="info-row">
            <span class="info-key">User Name:</span>
            <span class="info-val font-semibold">{{ user?.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Email Address:</span>
            <span class="info-val font-mono">{{ user?.email }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Role & Permissions:</span>
            <span class="info-val">
              <span :class="['badge', isAdmin ? 'badge-accent' : 'badge-success']">
                {{ user?.role }}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-key">Branch Tenant ID:</span>
            <span class="info-val font-mono">Store #{{ user?.store_id || 1 }}</span>
          </div>
        </div>

        <div class="multistore-banner">
          <div class="banner-title">
            <Database :size="18" class="text-primary" />
            <h4>Multi-Store Scale Ready</h4>
          </div>
          <p class="banner-text">
            SmartStore database schema and Express routing are configured with isolated `store_id` tenancy for effortless future multi-branch expansion.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
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

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-info-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.875rem;
}
.info-key { color: var(--text-muted); }
.info-val { color: var(--text-main); }

.multistore-banner {
  margin-top: 1.5rem;
  background-color: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: var(--radius-md);
  padding: 1rem;
}
.banner-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.banner-title h4 {
  font-size: 0.9375rem;
  color: var(--primary);
}
.banner-text {
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.font-mono { font-family: var(--font-mono); }
.font-semibold { font-weight: 600; }
.text-primary { color: var(--primary); }
.text-indigo { color: var(--accent); }
</style>

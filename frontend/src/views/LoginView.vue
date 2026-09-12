<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import { useToast } from '../stores/toast.js';
import { Store, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const { login } = useAuth();
const toast = useToast();

const form = reactive({
  email: '',
  password: ''
});

const loading = ref(false);
const errorMessage = ref('');

onMounted(() => {
  if (route.query.expired) {
    errorMessage.value = 'Your session has expired. Please sign in again.';
  }
});

const handleLogin = async () => {
  if (!form.email || !form.password) {
    errorMessage.value = 'Please enter both email and password.';
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const user = await login(form.email, form.password);
    toast.success(`Welcome back, ${user.name}!`);
    const redirectPath = route.query.redirect || '/dashboard';
    router.push(redirectPath);
  } catch (err) {
    if (err.response?.data?.message) {
      errorMessage.value = err.response.data.message;
    } else if (err.response?.data?.error) {
      errorMessage.value = err.response.data.error;
    } else if (err.message) {
      errorMessage.value = `Connection error: ${err.message}. Please check your connection and server status.`;
    } else {
      errorMessage.value = 'Invalid email or password. Please verify credentials.';
    }
  } finally {
    loading.value = false;
  }
};

// Demo quick-fill for fast testing
const fillCredentials = (role) => {
  if (role === 'admin') {
    form.email = 'admin@smartstore.com';
    form.password = 'Admin123!';
  } else {
    form.email = 'cashier@smartstore.com';
    form.password = 'Cashier123!';
  }
};
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="login-logo-wrapper">
          <Store :size="32" class="login-logo" />
        </div>
        <h1>SmartStore POS</h1>
        <p class="login-subtitle">Enterprise Retail & Inventory Management</p>
      </div>

      <!-- Error banner -->
      <div v-if="errorMessage" class="error-banner">
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <div class="input-icon-wrapper">
            <Mail :size="18" class="input-icon" />
            <input
              v-model="form.email"
              type="email"
              class="form-input with-icon"
              placeholder="name@store.com"
              required
              autocomplete="email"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Password</label>
          <div class="input-icon-wrapper">
            <Lock :size="18" class="input-icon" />
            <input
              v-model="form.password"
              type="password"
              class="form-input with-icon"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg submit-btn" :disabled="loading">
          <span v-if="loading">Authenticating...</span>
          <template v-else>
            <span>Sign In to Terminal</span>
            <ArrowRight :size="18" />
          </template>
        </button>
      </form>

      <!-- Quick Demo Access Section -->
      <div class="demo-section">
        <div class="demo-divider">
          <span>ONE-CLICK DEMO ACCOUNTS</span>
        </div>
        <div class="demo-buttons">
          <button type="button" class="btn btn-secondary btn-sm demo-btn" @click="fillCredentials('admin')">
            <ShieldCheck :size="16" class="text-accent" />
            <span>Admin Demo</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm demo-btn" @click="fillCredentials('cashier')">
            <UserCheck :size="16" class="text-primary" />
            <span>Cashier Demo</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%);
}

.login-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: var(--shadow-xl);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}
.login-logo-wrapper {
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #10b981, #059669);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
}
.login-logo {
  color: #ffffff;
}
.login-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.35rem;
}

.error-banner {
  background-color: var(--danger-bg);
  color: var(--danger-text);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1.25rem;
  text-align: center;
}

.input-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 0.875rem;
  color: var(--text-dim);
}
.with-icon {
  padding-left: 2.5rem;
}

.submit-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.demo-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}
.demo-divider {
  text-align: center;
  margin-bottom: 0.875rem;
}
.demo-divider span {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-dim);
}

.demo-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.demo-btn {
  font-size: 0.75rem;
  justify-content: center;
}
.text-accent { color: var(--accent); }
.text-primary { color: var(--primary); }
</style>

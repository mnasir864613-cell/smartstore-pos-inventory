<script setup>
import { useAuth } from '../../stores/auth.js';
import { Menu, LogOut, ShoppingCart, Shield, User } from 'lucide-vue-next';

defineProps({
  sidebarOpen: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['toggle-sidebar']);

const { user, userName, role, isAdmin, logout } = useAuth();
</script>

<template>
  <header class="navbar">
    <div class="navbar-left">
      <button class="btn btn-ghost btn-sm menu-toggle" @click="emit('toggle-sidebar')" aria-label="Toggle navigation">
        <Menu :size="20" />
      </button>

      <div class="branch-indicator">
        <span class="branch-label">Active Store:</span>
        <span class="branch-name">Main Branch (ID: {{ user?.store_id || 1 }})</span>
      </div>
    </div>

    <div class="navbar-right">
      <!-- Quick POS Button -->
      <router-link to="/pos" class="btn btn-primary btn-sm pos-quick-btn">
        <ShoppingCart :size="16" />
        <span>Open POS</span>
      </router-link>

      <!-- User Role Profile Pill -->
      <div class="user-pill">
        <div class="avatar-circle">
          <Shield v-if="isAdmin" :size="16" class="avatar-icon text-accent" />
          <User v-else :size="16" class="avatar-icon text-primary" />
        </div>
        <div class="user-meta">
          <span class="user-name">{{ userName }}</span>
          <span :class="['role-badge', isAdmin ? 'role-admin' : 'role-cashier']">
            {{ role }}
          </span>
        </div>
      </div>

      <!-- Logout Button -->
      <button class="btn btn-secondary btn-sm logout-btn" @click="logout" title="Sign out">
        <LogOut :size="16" />
        <span class="logout-text">Logout</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  height: 64px;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.menu-toggle {
  display: flex;
}

.branch-indicator {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  background-color: rgba(15, 23, 42, 0.4);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}
.branch-label {
  color: var(--text-dim);
}
.branch-name {
  color: var(--text-main);
  font-weight: 600;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pos-quick-btn {
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.25rem 0.625rem;
  background-color: rgba(15, 23, 42, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
}

.avatar-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
}
.text-accent { color: var(--accent); }
.text-primary { color: var(--primary); }

.user-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
}
.role-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.role-admin {
  background-color: var(--accent-bg);
  color: var(--accent-text);
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.role-cashier {
  background-color: var(--primary-bg);
  color: var(--primary-text);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.logout-btn {
  color: var(--danger-text);
}
.logout-btn:hover {
  background-color: var(--danger-bg);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--danger);
}

@media (max-width: 768px) {
  .branch-indicator {
    display: none;
  }
  .logout-text {
    display: none;
  }
  .user-name {
    display: none;
  }
}
</style>

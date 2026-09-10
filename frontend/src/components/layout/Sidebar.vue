<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../stores/auth.js';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Boxes,
  Truck,
  Building2,
  Receipt,
  Users,
  Wallet,
  BarChart3,
  Settings,
  Store
} from 'lucide-vue-next';

defineProps({
  isOpen: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['close']);

const route = useRoute();
const { isAdmin } = useAuth();

const menuItems = computed(() => {
  const items = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'POS / Billing', path: '/pos', icon: ShoppingCart, highlight: true },
    { label: 'Products', path: '/products', icon: Package },
    ...(isAdmin.value ? [{ label: 'Categories', path: '/categories', icon: Tags }] : []),
    { label: 'Inventory', path: '/inventory', icon: Boxes },
    ...(isAdmin.value ? [{ label: 'Purchases', path: '/purchases', icon: Truck }] : []),
    ...(isAdmin.value ? [{ label: 'Suppliers', path: '/suppliers', icon: Building2 }] : []),
    { label: 'Sales History', path: '/sales', icon: Receipt },
    { label: 'Customers / Udhaar', path: '/customers', icon: Users },
    ...(isAdmin.value ? [{ label: 'Expenses', path: '/expenses', icon: Wallet }] : []),
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    ...(isAdmin.value ? [{ label: 'Settings', path: '/settings', icon: Settings }] : [])
  ];
  return items;
});

const isActive = (path) => {
  if (path === '/dashboard') return route.path === '/dashboard';
  return route.path.startsWith(path);
};
</script>

<template>
  <aside :class="['sidebar', { 'sidebar-open': isOpen }]">
    <!-- Brand Header -->
    <div class="sidebar-brand">
      <div class="brand-icon-wrapper">
        <Store :size="24" class="brand-icon" />
      </div>
      <div class="brand-info">
        <span class="brand-title">SmartStore</span>
        <span class="brand-tag">POS & INVENTORY</span>
      </div>
    </div>

    <!-- Navigation Menu -->
    <nav class="sidebar-nav">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        :class="['nav-item', { 'nav-active': isActive(item.path), 'nav-highlight': item.highlight }]"
        @click="emit('close')"
      >
        <component :is="item.icon" :size="20" class="nav-icon" />
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.highlight" class="pos-badge">FAST</span>
      </router-link>
    </nav>

    <!-- Branch Footer -->
    <div class="sidebar-footer">
      <div class="store-badge">
        <span class="store-dot"></span>
        <span class="store-text">Main Store • Karachi</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: var(--transition);
  z-index: 100;
}

.sidebar-brand {
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  border-bottom: 1px solid var(--border-color);
}
.brand-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #10b981, #059669);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
.brand-icon {
  color: #ffffff;
}
.brand-info {
  display: flex;
  flex-direction: column;
}
.brand-title {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-main);
}
.brand-tag {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary);
}

.sidebar-nav {
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}
.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}
.nav-active {
  background-color: var(--primary-bg) !important;
  color: var(--primary) !important;
  font-weight: 700;
}
.nav-icon {
  flex-shrink: 0;
}
.nav-label {
  flex: 1;
}

.nav-highlight {
  border: 1px solid rgba(16, 185, 129, 0.3);
  background-color: rgba(16, 185, 129, 0.08);
}
.pos-badge {
  background-color: var(--primary);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-full);
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}
.store-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(15, 23, 42, 0.6);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}
.store-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--primary);
  box-shadow: 0 0 6px var(--primary);
}
.store-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
  }
  .sidebar-open {
    transform: translateX(0);
    box-shadow: var(--shadow-xl);
  }
}
</style>

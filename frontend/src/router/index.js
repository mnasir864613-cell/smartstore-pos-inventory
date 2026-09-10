import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../components/layout/MainLayout.vue';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import PosView from '../views/PosView.vue';
import ProductsView from '../views/ProductsView.vue';
import CategoriesView from '../views/CategoriesView.vue';
import InventoryView from '../views/InventoryView.vue';
import PurchasesView from '../views/PurchasesView.vue';
import SuppliersView from '../views/SuppliersView.vue';
import CustomersView from '../views/CustomersView.vue';
import SalesView from '../views/SalesView.vue';
import ExpensesView from '../views/ExpensesView.vue';
import ReportsView from '../views/ReportsView.vue';
import SettingsView from '../views/SettingsView.vue';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true }
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: DashboardView
      },
      {
        path: 'pos',
        name: 'pos',
        component: PosView
      },
      {
        path: 'products',
        name: 'products',
        component: ProductsView
      },
      {
        path: 'categories',
        name: 'categories',
        component: CategoriesView,
        meta: { roles: ['admin'] }
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: InventoryView
      },
      {
        path: 'purchases',
        name: 'purchases',
        component: PurchasesView,
        meta: { roles: ['admin'] }
      },
      {
        path: 'suppliers',
        name: 'suppliers',
        component: SuppliersView,
        meta: { roles: ['admin'] }
      },
      {
        path: 'sales',
        name: 'sales',
        component: SalesView
      },
      {
        path: 'customers',
        name: 'customers',
        component: CustomersView
      },
      {
        path: 'expenses',
        name: 'expenses',
        component: ExpensesView,
        meta: { roles: ['admin'] }
      },
      {
        path: 'reports',
        name: 'reports',
        component: ReportsView
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { roles: ['admin'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation Guards
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('smartstore_token');
  let user = null;
  try {
    const u = localStorage.getItem('smartstore_user');
    if (u) user = JSON.parse(u);
  } catch {
    user = null;
  }

  const isAuthenticated = !!token;

  if (to.meta.guestOnly && isAuthenticated) {
    return next('/dashboard');
  }

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (!isAuthenticated) {
      return next({ path: '/login', query: { redirect: to.fullPath } });
    }

    // Role verification
    if (to.meta.roles && Array.isArray(to.meta.roles)) {
      if (!user || !to.meta.roles.includes(user.role)) {
        return next('/dashboard');
      }
    }
  }

  next();
});

export default router;

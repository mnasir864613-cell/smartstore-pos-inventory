import { reactive, computed } from 'vue';
import api from '../api/client.js';

// Initial state from localStorage
const storedToken = localStorage.getItem('smartstore_token') || null;
let storedUser = null;
try {
  const u = localStorage.getItem('smartstore_user');
  if (u) storedUser = JSON.parse(u);
} catch {
  storedUser = null;
}

const state = reactive({
  token: storedToken,
  user: storedUser,
  loading: false
});

export const useAuth = () => {
  const isAuthenticated = computed(() => !!state.token);
  const user = computed(() => state.user);
  const role = computed(() => state.user?.role || 'cashier');
  const isAdmin = computed(() => state.user?.role === 'admin');
  const isCashier = computed(() => state.user?.role === 'cashier');
  const userName = computed(() => state.user?.name || 'User');
  const userEmail = computed(() => state.user?.email || '');

  const login = async (email, password) => {
    state.loading = true;
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      state.token = token;
      state.user = user;
      localStorage.setItem('smartstore_token', token);
      localStorage.setItem('smartstore_user', JSON.stringify(user));
      return user;
    } finally {
      state.loading = false;
    }
  };

  const logout = () => {
    state.token = null;
    state.user = null;
    localStorage.removeItem('smartstore_token');
    localStorage.removeItem('smartstore_user');
    window.location.href = '/login';
  };

  const fetchProfile = async () => {
    if (!state.token) return null;
    try {
      const res = await api.get('/auth/me');
      state.user = res.data.user;
      localStorage.setItem('smartstore_user', JSON.stringify(res.data.user));
      return res.data.user;
    } catch {
      logout();
      return null;
    }
  };

  return {
    state,
    isAuthenticated,
    user,
    role,
    isAdmin,
    isCashier,
    userName,
    userEmail,
    login,
    logout,
    fetchProfile
  };
};

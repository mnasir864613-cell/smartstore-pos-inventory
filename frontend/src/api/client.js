import axios from 'axios';

// Resolve and normalize baseURL so endpoints (/auth/login, /products, etc.) are always routed to /api
export const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) {
    return import.meta.env.PROD
      ? 'https://hydrolyse-uneven-polar-bear.abasthan.app/api'
      : '/api';
  }
  const clean = envUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/api')) {
    return clean;
  }
  return `${clean}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Request interceptor: automatically add Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartstore_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: catch 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if token is expired/invalid
      localStorage.removeItem('smartstore_token');
      localStorage.removeItem('smartstore_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to extract user-friendly error message
export const getErrorMessage = (err) => {
  if (err.response?.data?.message) {
    return err.response.data.message;
  }
  if (err.response?.data?.error) {
    return err.response.data.error;
  }
  if (err.message) {
    return err.message;
  }
  return 'An unexpected network error occurred';
};

export default api;

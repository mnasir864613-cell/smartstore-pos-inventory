import axios from 'axios';

// In development: VITE_API_BASE_URL defaults to '/api' (proxied by Vite to localhost:4000)
// In production (same-origin): VITE_API_BASE_URL='/api' (served by same server/nginx)
// In production (cross-origin): VITE_API_BASE_URL='https://api.yourdomain.com/api'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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

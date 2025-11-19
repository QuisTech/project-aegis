import axios from 'axios';
import { authService } from './auth';

// Use environment variable with fallback for local development
const API_BASE = process.env.REACT_APP_API_URL || 'https://project-aegis-btw0.onrender.com';

console.log('API Base URL:', API_BASE); // Debug log

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // Increased timeout for production
});

apiClient.interceptors.request.use(

  (config) => {
    const token = authService.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    login: (credentials) => apiClient.post('/api/auth/login', credentials),
  },
  getEvents: (params) => apiClient.get('/api/events', { params }),
  createEvent: (eventData) => apiClient.post('/api/events', eventData),
  getDashboard: () => apiClient.get('/api/dashboard'),
  getCorrelations: () => apiClient.get('/api/correlations'),
  healthCheck: () => apiClient.get('/api/health'),
};

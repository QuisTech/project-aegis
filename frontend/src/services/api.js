import axios from 'axios';
import { authService } from './auth';

// Use environment variable with fallback for local development
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

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
    login: (credentials) => apiClient.post('/auth/login', credentials),
  },
  getEvents: async (params) => {
    const response = await apiClient.get('/events', { params });
    return { data: response.data };
  },
  createEvent: (eventData) => apiClient.post('/events', eventData),
  getDashboard: () => apiClient.get('/dashboard'),
  getCorrelations: () => apiClient.get('/correlations'),
  healthCheck: () => apiClient.get('/health'),
};

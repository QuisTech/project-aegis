import axios from 'axios';
import { authService } from './auth';

const API_BASE = 'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
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

  // FIXED: Extract events array from backend response
  getEvents: async (params) => {
    const response = await apiClient.get('/events', { params });
    return { data: response.data.events };
  },
  
  createEvent: (eventData) => apiClient.post('/events', eventData),

  // FIXED: Direct response for dashboard
  getDashboard: () => apiClient.get('/dashboard'),

  getCorrelations: () => apiClient.get('/correlations'),
  healthCheck: () => apiClient.get('/health'),
};

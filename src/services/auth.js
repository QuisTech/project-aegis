import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('fusioncore_token');
    this.user = JSON.parse(localStorage.getItem('fusioncore_user') || 'null');

    if (this.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }
  }

  async login(username, password) {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password
      });

      if (response.data.success) {
        this.token = response.data.token;
        this.user = response.data.user;
        
        localStorage.setItem('fusioncore_token', this.token);
        localStorage.setItem('fusioncore_user', JSON.stringify(this.user));
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        
        return { success: true, user: this.user };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('fusioncore_token');
    localStorage.removeItem('fusioncore_user');
    delete axios.defaults.headers.common['Authorization'];
  }

  isAuthenticated() {
    return !!this.token;
  }

  getUser() {
    return this.user;
  }
}

export const authService = new AuthService();

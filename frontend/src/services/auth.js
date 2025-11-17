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

      if (response.data.token) {
        this.setAuth(response.data.token, response.data.user);
        return { success: true, user: response.data.user };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('fusioncore_token', token);
    localStorage.setItem('fusioncore_user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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

  hasRole(role) {
    return this.user && this.user.role === role;
  }

  hasAnyRole(roles) {
    return this.user && roles.includes(this.user.role);
  }

  getUser() {
    return this.user;
  }
}

export const authService = new AuthService();

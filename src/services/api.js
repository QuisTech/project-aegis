import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

export const api = {
  async getEvents() {
    try {
      const response = await axios.get(`${API_BASE}/events`);
      return response.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  },

  async createEvent(eventData) {
    try {
      const response = await axios.post(`${API_BASE}/events`, eventData);
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },

  async updateEvent(eventId, eventData) {
    try {
      const response = await axios.put(`${API_BASE}/events/${eventId}`, eventData);
      return response.data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(eventId) {
    try {
      const response = await axios.delete(`${API_BASE}/events/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  async getDashboard() {
    try {
      const response = await axios.get(`${API_BASE}/dashboard`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      throw error;
    }
  },

  async getCorrelations() {
    try {
      const response = await axios.get(`${API_BASE}/correlations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching correlations:', error);
      throw error;
    }
  }
};

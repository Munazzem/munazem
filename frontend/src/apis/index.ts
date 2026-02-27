import axios from 'axios';
import { useAuthStore } from '../context/useAuthStore';

// Base API instance
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach access token if available
api.interceptors.request.use(
  (config) => {
    // Extract the token from our Zustand store
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors (e.g. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Force logout and redirect 
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

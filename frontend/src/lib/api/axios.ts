import axios from 'axios';
import Cookies from 'js-cookie';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Global Axios Instance for Client-Side Fetching (CSR)
 * It automatically attaches the JWT token to every request if available.
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use((config) => {
    // Check if running on the client (browser) before accessing cookies
    if (typeof window !== 'undefined') {
        const token = Cookies.get('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Handle Global Errors (Like 401 Unauthorized)
apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                Cookies.remove('token');
                // Dynamically import to avoid circular dependency
                import('@/lib/store/auth.store').then(({ useAuthStore }) => {
                    useAuthStore.getState().logout();
                });
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

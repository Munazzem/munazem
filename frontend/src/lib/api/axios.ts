import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth.store';

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
        // Prevent showing toast from server side requests if applicable
        if (typeof window !== 'undefined') {
            const url: string = error.config?.url || '';
            const isLoginRequest = url.includes('/auth/login');

            if (error.response?.status === 401) {
                // If it is not the login request itself (which handles its own error UI)
                if (!isLoginRequest) {
                    useAuthStore.getState().logout();
                    
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
            } else if (error.response?.status === 403) {
                // Silently suppress 403s from superAdmin-only routes (/admin/*, /subscriptions)
                // to avoid confusing teachers/assistants from stale background queries.
                const isSuperAdminRoute = url.startsWith('/admin') || url === '/subscriptions';
                if (!isSuperAdminRoute && !error.config?.headers?.['x-skip-error-toast']) {
                    const errorMsg = error.response?.data?.message || 'ليس لديك الصلاحيات الكافية للوصول إلى هذا المسار';
                    toast.error(errorMsg);
                }
            } else if (!isLoginRequest && !error.config?.headers?.['x-skip-error-toast']) {
                // Determine error message safely (skip showing global toast for login which handles it locally)
                const errorMsg = error.response?.data?.message || 'تعذر الاتصال بالخادم، حاول مرة أخرى لاحقاً';
                toast.error(errorMsg);
            }
        }
        return Promise.reject(error);
    }
);

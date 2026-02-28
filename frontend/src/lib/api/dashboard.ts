import { apiClient } from './axios';
import type { DashboardData } from '@/types/dashboard.types';

/**
 * Fetches the overview statistics for the Dashboard home page.
 */
export const fetchDashboardStats = async (): Promise<DashboardData> => {
    // apiClient interceptor returns response.data directly → shape: { status, message, data }
    // 1. Fetch main dashboard summary stats
    const statsRes = await apiClient.get('/reports/dashboard');
    const statsData = (statsRes as any).data;

    // 2. Fetch today's recent activities (Daily Ledger)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ledgerRes = await apiClient.get(`/payments/ledger/daily?date=${today}`);
    const ledgerData = (ledgerRes as any).data;

    return {
        ...statsData,
        recentActivities: ledgerData?.transactions || [],
    };
};

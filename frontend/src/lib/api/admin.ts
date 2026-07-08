import { apiClient } from './axios';
import type {
    AdminStats,
    GrowthDataPoint,
    AdminTenant,
    TenantDetail,
    AdminErrorLog,
    Paginated,
    ServerHealth,
    ActivityLogEntry,
} from '@/types/admin.types';

export type {
    AdminStats,
    GrowthDataPoint,
    AdminTenant,
    TenantDetail,
    AdminErrorLog,
    Paginated,
    ServerHealth,
    ActivityLogEntry,
};

// ── API Functions ──────────────────────────────────────────────────

export const fetchAdminStats = async (): Promise<AdminStats> => {
    const res = await apiClient.get('/admin/stats');
    return (res as any).data;
};

export const fetchGrowthData = async (): Promise<GrowthDataPoint[]> => {
    const res = await apiClient.get('/admin/growth');
    return (res as any).data;
};

export const fetchTenants = async (params?: {
    page?: number; limit?: number; search?: string; status?: string;
}): Promise<Paginated<AdminTenant>> => {
    const q = new URLSearchParams();
    if (params?.page)   q.set('page',   String(params.page));
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const res = await apiClient.get(`/admin/tenants?${q.toString()}`);
    return (res as any).data;
};

export const fetchTenantDetail = async (id: string): Promise<TenantDetail> => {
    const res = await apiClient.get(`/admin/tenants/${id}`);
    return (res as any).data;
};

export const addSubscription = async (id: string, data: { planTier: string; durationMonths: number; paymentMethod?: string; promoCode?: string }): Promise<any> => {
    const res = await apiClient.post(`/admin/tenants/${id}/subscription`, data);
    return (res as any).data;
};

export const suspendTenant = async (id: string): Promise<void> => {
    await apiClient.post(`/admin/tenants/${id}/suspend`);
};

export const activateTenant = async (id: string): Promise<void> => {
    await apiClient.post(`/admin/tenants/${id}/activate`);
};

export const updateTenant = async (tenantId: string, payload: { name?: string; phone?: string; stage?: string; subject?: string; centerName?: string }) => {
    const res = await apiClient.patch(`/admin/tenants/${tenantId}`, payload);
    return (res as any).data;
};

export const fetchAdminErrors = async (params?: {
    page?: number; limit?: number; level?: string;
}): Promise<Paginated<AdminErrorLog>> => {
    const q = new URLSearchParams();
    if (params?.page)  q.set('page',  String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.level) q.set('level', params.level);
    const res = await apiClient.get(`/admin/errors?${q.toString()}`);
    return (res as any).data;
};

export const fetchAdminHealth = async (): Promise<ServerHealth> => {
    const res = await apiClient.get('/admin/health');
    return (res as any).data;
};

// ── Activity Feed ──────────────────────────────────────────────────

export const fetchActivityFeed = async (params?: {
    page?: number; limit?: number; event?: string; tenantId?: string;
}): Promise<Paginated<ActivityLogEntry>> => {
    const q = new URLSearchParams();
    if (params?.page)     q.set('page',     String(params.page));
    if (params?.limit)    q.set('limit',    String(params.limit));
    if (params?.event)    q.set('event',    params.event);
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    const res = await apiClient.get(`/admin/activity?${q.toString()}`);
    return (res as any).data;
};

// ── Platform Settings (Dynamic Pricing) ───────────────────────────

export const fetchPlatformSettings = async (): Promise<Record<string, number>> => {
    const res = await apiClient.get('/admin/platform-settings');
    return (res as any).data;
};

export const updatePlanPrices = async (prices: Record<string, number>): Promise<Record<string, number>> => {
    const res = await apiClient.patch('/admin/platform-settings/plan-prices', { prices });
    return (res as any).data;
};

// ── PROMO CODES ───────────────────────────────────────────────────────

export interface PromoCode {
    _id: string;
    code: string;
    discountPercentage: number;
    maxUses?: number;
    usedCount: number;
    expiresAt?: string;
    isActive: boolean;
    createdAt: string;
}

export const fetchPromoCodes = async (): Promise<PromoCode[]> => {
    const res = await apiClient.get('/admin/promo-codes');
    return (res as any).data;
};

export const createPromoCode = async (data: { code: string; discountPercentage: number; maxUses?: number; expiresAt?: string }): Promise<PromoCode> => {
    const res = await apiClient.post('/admin/promo-codes', data);
    return (res as any).data;
};

export const togglePromoCode = async (id: string): Promise<PromoCode> => {
    const res = await apiClient.patch(`/admin/promo-codes/${id}/toggle`);
    return (res as any).data;
};

export const deletePromoCode = async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/promo-codes/${id}`);
};

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────

export interface Announcement {
    _id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success';
    isActive: boolean;
    expiresAt?: string;
    createdAt: string;
}

export const fetchAnnouncements = async (): Promise<Announcement[]> => {
    const res = await apiClient.get('/admin/announcements');
    return (res as any).data;
};

export const fetchActiveAnnouncements = async (): Promise<Announcement[]> => {
    const res = await apiClient.get('/admin/announcements/active');
    return (res as any).data;
};

export const createAnnouncement = async (data: { title: string; content: string; type: 'info' | 'warning' | 'success'; expiresAt?: string }): Promise<Announcement> => {
    const res = await apiClient.post('/admin/announcements', data);
    return (res as any).data;
};

export const toggleAnnouncement = async (id: string): Promise<Announcement> => {
    const res = await apiClient.patch(`/admin/announcements/${id}/toggle`);
    return (res as any).data;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/announcements/${id}`);
};

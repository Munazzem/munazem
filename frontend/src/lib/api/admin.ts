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

export const suspendTenant = async (id: string): Promise<void> => {
    await apiClient.post(`/admin/tenants/${id}/suspend`);
};

export const activateTenant = async (id: string): Promise<void> => {
    await apiClient.post(`/admin/tenants/${id}/activate`);
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

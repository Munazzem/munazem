import { apiClient } from './axios';

// ── Types ──────────────────────────────────────────────────────────

export interface AdminStats {
    totalTeachers:         number;
    activeTeachers:        number;
    inactiveTeachers:      number;
    totalStudents:         number;
    activeSubscriptions:   number;
    expiredSubscriptions:  number;
    newTeachersThisMonth:  number;
    monthlyRevenue:        number;
    recentErrorsThisMonth: number;
}

export interface GrowthDataPoint {
    label: string;
    count: number;
}

export interface AdminTenant {
    _id:          string;
    name:         string;
    email?:       string;
    phone:        string;
    stage?:       string;
    isActive:     boolean;
    centerName?:  string;
    createdAt:    string;
    studentCount: number;
    subscription: {
        planTier:       string;
        status:         string;
        endDate:        string;
        durationMonths: number;
    } | null;
}

export interface TenantDetail {
    teacher:           AdminTenant;
    studentCount:      number;
    groupCount:        number;
    sessionsThisMonth: number;
    subscription:      AdminTenant['subscription'];
}

export interface AdminErrorLog {
    _id:        string;
    level:      'warn' | 'error' | 'critical';
    message:    string;
    path:       string;
    method:     string;
    statusCode: number;
    requestId?: string;
    userId?:    string;
    teacherId?: string;
    stack?:     string;
    createdAt:  string;
}

export interface Paginated<T> {
    data:       T[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

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

export interface ServerHealth {
    status:      string;
    uptime:      number;
    uptimeHuman: string;
    memory: {
        heapUsedMB:  number;
        heapTotalMB: number;
        rssMB:       number;
        heapPct:     number;
    };
    errors: {
        lastHour: number;
        last24h:  number;
    };
    timestamp: string;
}

export const fetchAdminHealth = async (): Promise<ServerHealth> => {
    const res = await apiClient.get('/admin/health');
    return (res as any).data;
};

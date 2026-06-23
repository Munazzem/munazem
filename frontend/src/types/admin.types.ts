// ── Shared ─────────────────────────────────────────────────────────

export interface Paginated<T> {
    data:       T[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Stats & Growth ──────────────────────────────────────────────────

export interface AdminStats {
    totalTeachers:         number;
    activeTeachers:        number;
    inactiveTeachers:      number;
    totalStudents:         number;
    activeSubscriptions:   number;
    expiredSubscriptions:  number;
    newTeachersThisMonth:  number;
    monthlyRevenue:        number;
    mrr:                   number;
    churnRate:             number;
    recentErrorsThisMonth: number;
    topTeachers: Array<{
        _id: string;
        name: string;
        phone: string;
        studentCount: number;
    }>;
    expiringSoon: Array<{
        _id: string;
        planTier: string;
        endDate: string;
        teacher: { _id: string; name: string; phone: string };
    }>;
}

export interface GrowthDataPoint {
    label: string;
    count: number;
}

// ── Tenants ─────────────────────────────────────────────────────────

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

// ── Error Logs ──────────────────────────────────────────────────────

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

// ── Server Health ───────────────────────────────────────────────────

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

// ── Activity Feed ───────────────────────────────────────────────────

export interface ActivityLogEntry {
    _id:          string;
    event:        string;
    tenantId:     string;
    userId:       string;
    targetId?:    string;
    meta?:        Record<string, unknown>;
    teacherName?: string | null;
    createdAt:    string;
}

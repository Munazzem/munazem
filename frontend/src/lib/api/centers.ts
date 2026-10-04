import { apiClient, API_BASE_URL } from './axios';
import Cookies from 'js-cookie';
import type {
    ICenter,
    ICenterTeacher,
    ICenterPackage,
    ICenterGroup,
    ICenterEnrollment,
    ICenterAttendanceRecord,
    ICenterFinancialSummary,
    ITeacherFinancialReport,
    ICenterTransaction,
    IDailyTallyReport,
    IMonthlyTallyReport,
    CreateCenterDTO,
    CreateBranchDTO,
    CreateTeacherDTO,
    CreatePackageDTO,
    CreateGroupDTO,
    CreateSupervisorDTO,
    EnrollStudentDTO,
    RecordAttendanceDTO,
    RecordPaymentDTO,
    ICenterStudent,
    CreateCenterStudentDTO,
    BulkCreateCenterStudentDTO,
    CenterCheckInResponse,
    DailyCheckInsResult,
} from '@/types/center.types';

// ── Centers & Branches ────────────────────────────────────────────────────────

export interface OnboardCenterDTO {
    centerName: string;
    ownerName: string;
    phone: string;
    password: string;
    email?: string;
    address?: string;
    centerPhone?: string;
    planTier?: string;
}

export const onboardCenter = async (data: OnboardCenterDTO): Promise<any> => {
    const res = await apiClient.post('/centers/onboard', data);
    return (res as any).data;
};

export const fetchMyCenters = async (): Promise<ICenter[]> => {
    const res = await apiClient.get('/centers/my');
    return (res as any).data;
};

export const createCenter = async (data: CreateCenterDTO): Promise<ICenter> => {
    const res = await apiClient.post('/centers', data);
    return (res as any).data;
};

export const createBranch = async (data: CreateBranchDTO): Promise<ICenter> => {
    const res = await apiClient.post('/centers/branches', data);
    return (res as any).data;
};

export const updateCenter = async (id: string, data: Partial<CreateCenterDTO>): Promise<ICenter> => {
    const res = await apiClient.put(`/centers/${id}`, data);
    return (res as any).data;
};

// ── Center Teachers ───────────────────────────────────────────────────────────

export const fetchCenterTeachers = async (params: { search?: string; subject?: string; isActive?: boolean } = {}): Promise<ICenterTeacher[]> => {
    const res = await apiClient.get('/centers/teachers', { params });
    return (res as any).data;
};

export const createCenterTeacher = async (data: CreateTeacherDTO): Promise<ICenterTeacher> => {
    const res = await apiClient.post('/centers/teachers', data);
    return (res as any).data;
};

export const updateCenterTeacher = async (id: string, data: Partial<CreateTeacherDTO & { isActive: boolean }>): Promise<ICenterTeacher> => {
    const res = await apiClient.put(`/centers/teachers/${id}`, data);
    return (res as any).data;
};

export const deleteCenterTeacher = async (id: string): Promise<void> => {
    await apiClient.delete(`/centers/teachers/${id}`);
};

// ── Center Packages ───────────────────────────────────────────────────────────

export const fetchCenterPackages = async (params: { gradeLevel?: string; isActive?: boolean } = {}): Promise<ICenterPackage[]> => {
    const res = await apiClient.get('/centers/packages', { params });
    return (res as any).data;
};

export const fetchCenterPackageById = async (id: string): Promise<ICenterPackage> => {
    const res = await apiClient.get(`/centers/packages/${id}`);
    return (res as any).data;
};

export const createCenterPackage = async (data: CreatePackageDTO): Promise<ICenterPackage> => {
    const res = await apiClient.post('/centers/packages', data);
    return (res as any).data;
};

export const updateCenterPackage = async (id: string, data: Partial<CreatePackageDTO & { isActive: boolean }>): Promise<ICenterPackage> => {
    const res = await apiClient.put(`/centers/packages/${id}`, data);
    return (res as any).data;
};

export const deleteCenterPackage = async (id: string): Promise<void> => {
    await apiClient.delete(`/centers/packages/${id}`);
};

// ── Center Groups ─────────────────────────────────────────────────────────────

export const fetchCenterGroups = async (params: { centerTeacherId?: string; gradeLevel?: string; groupType?: string; isActive?: boolean } = {}): Promise<ICenterGroup[]> => {
    const res = await apiClient.get('/centers/groups', { params });
    return (res as any).data;
};

export const fetchCenterGroupById = async (id: string): Promise<ICenterGroup> => {
    const res = await apiClient.get(`/centers/groups/${id}`);
    return (res as any).data;
};

export const createCenterGroup = async (data: CreateGroupDTO): Promise<ICenterGroup> => {
    const res = await apiClient.post('/centers/groups', data);
    return (res as any).data;
};

export const updateCenterGroup = async (id: string, data: Partial<CreateGroupDTO & { isActive: boolean }>): Promise<ICenterGroup> => {
    const res = await apiClient.put(`/centers/groups/${id}`, data);
    return (res as any).data;
};

export const deleteCenterGroup = async (id: string): Promise<void> => {
    await apiClient.delete(`/centers/groups/${id}`);
};

// ── Center Supervisors ────────────────────────────────────────────────────────

export const fetchCenterSupervisors = async (): Promise<any[]> => {
    const res = await apiClient.get('/centers/supervisors');
    return (res as any).data;
};

export const createCenterSupervisor = async (data: CreateSupervisorDTO): Promise<any> => {
    const res = await apiClient.post('/centers/supervisors', data);
    return (res as any).data;
};

export const updateCenterSupervisor = async (id: string, data: any): Promise<any> => {
    const res = await apiClient.put(`/centers/supervisors/${id}`, data);
    return (res as any).data;
};

export const deleteCenterSupervisor = async (id: string): Promise<void> => {
    await apiClient.delete(`/centers/supervisors/${id}`);
};

// ── Center Enrollments ────────────────────────────────────────────────────────

export const fetchCenterEnrollments = async (params: { type?: string; packageId?: string; isActive?: boolean } = {}): Promise<ICenterEnrollment[]> => {
    const res = await apiClient.get('/centers/enrollments', { params });
    return (res as any).data;
};

export const fetchStudentEnrollment = async (studentId: string): Promise<ICenterEnrollment> => {
    const res = await apiClient.get(`/centers/enrollments/student/${studentId}`);
    return (res as any).data;
};

export const enrollStudent = async (data: EnrollStudentDTO): Promise<ICenterEnrollment> => {
    const res = await apiClient.post('/centers/enrollments', data);
    return (res as any).data;
};

export const updateEnrollment = async (id: string, data: any): Promise<ICenterEnrollment> => {
    const res = await apiClient.put(`/centers/enrollments/${id}`, data);
    return (res as any).data;
};

// ── Center Students ───────────────────────────────────────────────────────────

export interface FetchCenterStudentsParams {
    search?: string;
    gradeLevel?: string;
    stage?: 'ALL' | 'SECONDARY' | 'PREPARATORY' | 'PRIMARY' | 'OTHER';
    isActive?: boolean;
    page?: number;
    limit?: number;
    includeCounts?: boolean | 'true' | 'false';
}

export interface FetchCenterStudentsResponse {
    data: ICenterStudent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stageCounts?: {
        total: number;
        secondary: number;
        preparatory: number;
        primary: number;
    };
}

export const fetchCenterStudents = async (params: FetchCenterStudentsParams = {}): Promise<FetchCenterStudentsResponse> => {
    const res = await apiClient.get('/centers/students', { params });
    return (res as any).data;
};

export const fetchCenterStudentById = async (id: string): Promise<ICenterStudent> => {
    const res = await apiClient.get(`/centers/students/${id}`);
    return (res as any).data;
};

export const createCenterStudent = async (data: CreateCenterStudentDTO): Promise<ICenterStudent> => {
    const res = await apiClient.post('/centers/students', data);
    return (res as any).data;
};

export const bulkCreateCenterStudents = async (data: BulkCreateCenterStudentDTO): Promise<{ count: number; students: ICenterStudent[] }> => {
    const res = await apiClient.post('/centers/students/bulk', data);
    return (res as any).data;
};

export const updateCenterStudent = async (id: string, data: Partial<CreateCenterStudentDTO & { isActive: boolean }>): Promise<ICenterStudent> => {
    const res = await apiClient.put(`/centers/students/${id}`, data);
    return (res as any).data;
};

export const deleteCenterStudent = async (id: string): Promise<void> => {
    await apiClient.delete(`/centers/students/${id}`);
};

// ── Quick Attendance ──────────────────────────────────────────────────────────

export const recordCenterAttendance = async (data: RecordAttendanceDTO): Promise<ICenterAttendanceRecord> => {
    const res = await apiClient.post('/centers/attendance', data);
    return (res as any).data;
};

export const bulkRecordCenterAttendance = async (data: { groupId: string; date: string; records: any[] }): Promise<{ success: boolean; count: number }> => {
    const res = await apiClient.post('/centers/attendance/bulk', data);
    return (res as any).data;
};

export const fetchGroupAttendance = async (groupId: string, date: string): Promise<ICenterAttendanceRecord[]> => {
    const res = await apiClient.get(`/centers/attendance/group/${groupId}`, { params: { date } });
    return (res as any).data;
};

export const fetchStudentAttendanceHistory = async (studentId: string, params: { groupId?: string; startDate?: string; endDate?: string } = {}): Promise<ICenterAttendanceRecord[]> => {
    const res = await apiClient.get(`/centers/attendance/student/${studentId}`, { params });
    return (res as any).data;
};

// ── Gate / Reception Check-In ─────────────────────────────────────────────────

export interface CheckInStudentDTO {
    studentIdOrCode: string;
    date?: string;
    groupIds?: string[];
    source?: 'QR_SCAN' | 'BARCODE' | 'MANUAL';
    notes?: string;
}

export const checkInStudent = async (data: CheckInStudentDTO): Promise<CenterCheckInResponse> => {
    const res = await apiClient.post('/centers/attendance/check-in', data);
    return (res as any).data;
};

export const updateCheckInGroups = async (data: {
    studentId: string;
    date?: string;
    groupIds: string[];
}): Promise<any> => {
    const res = await apiClient.put('/centers/attendance/check-in/groups', data);
    return (res as any).data;
};

export const fetchDailyCheckIns = async (params: {
    date?: string;
    search?: string;
} = {}): Promise<DailyCheckInsResult> => {
    const res = await apiClient.get('/centers/attendance/check-ins', { params });
    return (res as any).data;
};

// ── Financials & Reports ──────────────────────────────────────────────────────

export const recordCenterPayment = async (data: RecordPaymentDTO): Promise<any> => {
    const res = await apiClient.post('/centers/financials/payment', data);
    return (res as any).data;
};

export const fetchCenterFinancialSummary = async (startDate?: string, endDate?: string): Promise<ICenterFinancialSummary> => {
    const res = await apiClient.get('/centers/financials/summary', { params: { startDate, endDate } });
    return (res as any).data;
};

export const fetchTeacherFinancialReport = async (teacherId: string, startDate?: string, endDate?: string): Promise<ITeacherFinancialReport> => {
    const res = await apiClient.get(`/centers/financials/teacher/${teacherId}`, { params: { startDate, endDate } });
    return (res as any).data;
};

export const fetchCenterDailyTally = async (date?: string): Promise<IDailyTallyReport> => {
    const res = await apiClient.get('/centers/financials/daily-tally', { params: { date } });
    return (res as any).data;
};

export const fetchCenterMonthlyTally = async (year?: number, month?: number): Promise<IMonthlyTallyReport> => {
    const res = await apiClient.get('/centers/financials/monthly-tally', { params: { year, month } });
    return (res as any).data;
};

export const fetchCenterTransactions = async (params: {
    startDate?: string;
    endDate?: string;
    date?: string;
    category?: string;
    centerTeacherId?: string;
    search?: string;
    page?: number;
    limit?: number;
} = {}): Promise<{ transactions: ICenterTransaction[]; total: number; page: number; limit: number; totalPages: number }> => {
    const res = await apiClient.get('/centers/financials/transactions', { params });
    return (res as any).data;
};

export interface IStudentFinancialReport {
    studentId: string;
    transactions: any[];
    totalPaid: number;
    totalRemaining: number;
    totalOriginal: number;
    transactionCount: number;
}

export const fetchStudentFinancialReport = async (studentId: string): Promise<IStudentFinancialReport> => {
    const res = await apiClient.get(`/centers/financials/student/${studentId}`);
    return (res as any).data;
};

// ── Comprehensive Reports ───────────────────────────────────────────────────

export interface CenterReportsOverview {
    revenue: {
        totalRevenue: number;
        packageRevenue: number;
        privateRevenue: number;
        combinedRevenue: number;
        totalDebt: number;
    };
    students: {
        total: number;
        active: number;
        secondary: number;
        preparatory: number;
        primary: number;
    };
    todayCheckIns: number;
    recentTransactions: any[];
}

export interface CenterTeacherReportItem {
    teacher: {
        _id: string;
        name: string;
        subject: string;
        phone: string;
        commissionRate: number;
    };
    groupsCount: number;
    enrolledStudentsCount: number;
    revenue: number;
    attendanceCount: number;
}

export interface CenterGroupReportItem {
    group: {
        _id: string;
        name: string;
        teacher: string;
        subject: string;
        gradeLevel: string;
        groupType: string;
        capacity?: number;
        schedule?: { day: string; time: string }[];
        privateMonthlyPrice?: number | null;
    };
    enrolledCount: number;
    fillRate: number | null;
    revenue: number;
    attendance: {
        totalRecords: number;
        present: number;
        absent: number;
        attendanceRate: number;
    };
}

export const fetchCenterReportsOverview = async (startDate?: string, endDate?: string): Promise<CenterReportsOverview> => {
    const res = await apiClient.get('/centers/reports/overview', { params: { startDate, endDate } });
    return (res as any).data;
};

export const fetchCenterTeachersReport = async (startDate?: string, endDate?: string): Promise<CenterTeacherReportItem[]> => {
    const res = await apiClient.get('/centers/reports/teachers', { params: { startDate, endDate } });
    return (res as any).data;
};

export const fetchCenterGroupsReport = async (): Promise<CenterGroupReportItem[]> => {
    const res = await apiClient.get('/centers/reports/groups');
    return (res as any).data;
};

// ── Smart Cards ─────────────────────────────────────────────────────────────

export interface CenterCardStats {
    total: number;
    new: number;
    linked: number;
    disabled: number;
}

export interface ICenterCard {
    _id: string;
    cardNumber: string;
    cardToken: string;
    status: 'NEW' | 'LINKED' | 'DISABLED';
    centerId: string;
    centerStudentId?: {
        _id: string;
        name: string;
        studentCode?: string;
        phone?: string;
        parentPhone?: string;
        gradeLevel?: string;
    } | null;
    batchId?: string;
    qrCodeUrl?: string;
    assignedAt?: string;
    disabledAt?: string;
    disabledReason?: string;
    createdAt: string;
}

export interface CenterCardTemplate {
    frontImageUrl?: string;
    backImageUrl?: string;
    themePreset: 'dark' | 'emerald' | 'indigo' | 'gold' | 'minimal' | 'custom';
    showCenterLogo: boolean;
    showStudentPhoto: boolean;
    showStudentName?: boolean;
    showQrCode: boolean;
    showBarcode: boolean;
    showInstructions?: boolean;
    customPrimaryColor?: string;
    customTextColor?: string;
    showMonazemLogo?: boolean;
    monazemLogoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-top' | 'center-bottom';
    monazemLogoSide?: 'front' | 'back' | 'both';
    monazemLogoSize?: 'sm' | 'md' | 'lg';
    qrX?: number;
    qrY?: number;
    qrSize?: number;
    showQrBg?: boolean;
    showCardNumber?: boolean;
}

export interface ResolveCardResponse {
    isLinked: boolean;
    card: ICenterCard;
    student?: any;
    enrolledGroups?: any[];
}

export interface FetchCardsParams {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface FetchCardsResponse {
    cards: ICenterCard[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const generateCenterCards = async (count: number): Promise<{ count: number; batchId: string; sample: string[] }> => {
    const res = await apiClient.post('/centers/cards/generate', { count });
    return (res as any).data;
};

export const fetchCenterCardsStats = async (): Promise<CenterCardStats> => {
    const res = await apiClient.get('/centers/cards/stats');
    return (res as any).data;
};

export const fetchCenterCards = async (params: FetchCardsParams = {}): Promise<FetchCardsResponse> => {
    const res = await apiClient.get('/centers/cards', { params });
    return (res as any).data;
};

export const resolveCenterCard = async (scanInput: string): Promise<ResolveCardResponse> => {
    let clean = scanInput.trim();
    if (clean.includes('/card/')) {
        clean = clean.split('/card/').pop()?.split(/[?#]/)[0]?.trim() || clean;
    }
    const res = await apiClient.get('/centers/cards/resolve', {
        params: { scanInput: clean }
    });
    return (res as any).data;
};

export const linkCenterCard = async (cardNumber: string, centerStudentId: string): Promise<any> => {
    const res = await apiClient.post('/centers/cards/link', { cardNumber, centerStudentId });
    return (res as any).data;
};

export const createStudentAndLinkCard = async (data: {
    cardNumber: string;
    name: string;
    phone?: string;
    parentPhone: string;
    gradeLevel: string;
    studentType?: string;
    packageId?: string;
    groupIds?: string[];
}): Promise<any> => {
    const res = await apiClient.post('/centers/cards/create-and-link', data);
    return (res as any).data;
};

export const unlinkCenterCard = async (cardNumber: string): Promise<any> => {
    const res = await apiClient.post('/centers/cards/unlink', { cardNumber });
    return (res as any).data;
};

export const disableCenterCard = async (cardNumber: string, reason?: string): Promise<any> => {
    const res = await apiClient.post('/centers/cards/disable', { cardNumber, reason });
    return (res as any).data;
};

export const fetchCenterCardTemplate = async (): Promise<CenterCardTemplate> => {
    const res = await apiClient.get('/centers/cards/template');
    return (res as any).data;
};

export const updateCenterCardTemplate = async (template: Partial<CenterCardTemplate>): Promise<CenterCardTemplate> => {
    const res = await apiClient.put('/centers/cards/template', template);
    return (res as any).data;
};

export const fetchBatchPrintCards = async (batchId: string): Promise<{ batchId: string; count: number; cards: ICenterCard[] }> => {
    const res = await apiClient.get(`/centers/cards/batch/${batchId}/print`);
    return (res as any).data;
};

export const getCenterCardBatchPrintUrl = (batchId: string, mode: 'dual_sided' | 'back_only' | 'front_only' = 'dual_sided'): string => {
    const token = Cookies.get('token') || '';
    return `${API_BASE_URL}/centers/cards/batch/${batchId}/print?mode=${mode}&token=${token}`;
};


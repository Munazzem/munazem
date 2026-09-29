import { apiClient } from './axios';
import type {
    ICenter,
    ICenterTeacher,
    ICenterPackage,
    ICenterGroup,
    ICenterEnrollment,
    ICenterAttendanceRecord,
    ICenterFinancialSummary,
    ITeacherFinancialReport,
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
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export interface FetchCenterStudentsResponse {
    data: ICenterStudent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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


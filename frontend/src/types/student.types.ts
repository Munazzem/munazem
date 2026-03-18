/**
 * Student Types
 * Defines the data structures related to Students and API Responses.
 */

// Basic Student Model
export interface Student {
    _id: string; // MongoDB ObjectId
    studentName: string;
    parentName: string;
    studentPhone: string;
    parentPhone: string;
    gradeLevel: string;
    groupId: string;
    barcode?: string;
    studentCode?: string;
    isActive: boolean;
    monthlySessionsQuota: number;
    excusedUntil?: string; // ISO Date string (compatibility)
    excusedSessionsCount?: number; // عدد حصص الاستئذان المتبقية
    usedSessionsThisMonth?: number;
    monthlySessions?: {
        sessionId: string;
        date: string;
        status: string;
    }[];
    manualRecordsCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Student with Group details (Often returned by populated endpoints)
export interface StudentWithGroup extends Omit<Student, 'groupId'> {
    groupDetails?: {
        _id: string;
        name: string;
    };
    groupId: string | { _id: string; name: string };
    hasActiveSubscription?: boolean;
    monthlySessionsQuota: number;
    usedSessionsThisMonth?: number;
    excusedUntil?: string;
    excusedSessionsCount?: number;
}

// Pagination Metadata
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// API Response for Paginated Students
export interface PaginatedStudentsResponse {
    data: StudentWithGroup[];
    pagination: PaginationMeta;
}

// Data Transfer Object for Creating a Student
export interface CreateStudentDTO {
    fullName: string; // The backend splits this into studentName and parentName
    studentPhone: string;
    parentPhone: string;
    gradeLevel: string;
    groupId: string;
    barcode?: string;
    excusedUntil?: string | null;
}

// Data Transfer Object for Updating a Student
export type UpdateStudentDTO = Partial<CreateStudentDTO> & { 
    isActive?: boolean;
    monthlySessionsQuota?: number;
    excusedUntil?: string | null;
    excusedSessionsCount?: number;
};

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
}

// Data Transfer Object for Updating a Student
export type UpdateStudentDTO = Partial<CreateStudentDTO> & { isActive?: boolean };

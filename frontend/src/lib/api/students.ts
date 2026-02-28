import { apiClient } from './axios';
import type { 
    PaginatedStudentsResponse, 
    StudentWithGroup, 
    CreateStudentDTO, 
    UpdateStudentDTO 
} from '@/types/student.types';

/**
 * Fetch a paginated list of students with optional filters.
 */
export const fetchStudents = async (params: {
    page?: number;
    limit?: number;
    groupId?: string;
    isActive?: boolean | string;
    search?: string;
}): Promise<PaginatedStudentsResponse> => {
    // Construct query string, ignoring undefined/empty values
    const query = new URLSearchParams();
    
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.groupId) query.append('groupId', params.groupId);
    if (params.isActive !== undefined && params.isActive !== '') {
        query.append('isActive', params.isActive.toString());
    }
    if (params.search) query.append('search', params.search);

    const res = await apiClient.get(`/students?${query.toString()}`);
    return res.data?.data || res.data;
};

/**
 * Fetch a single student by ID
 */
export const fetchStudentById = async (id: string): Promise<StudentWithGroup> => {
    const res = await apiClient.get(`/students/${id}`);
    return res.data?.data || res.data;
};

/**
 * Create a new student
 */
export const createStudent = async (data: CreateStudentDTO): Promise<StudentWithGroup> => {
    const res = await apiClient.post('/students', data);
    return res.data?.data || res.data;
};

/**
 * Update an existing student
 */
export const updateStudent = async (id: string, data: UpdateStudentDTO): Promise<StudentWithGroup> => {
    const res = await apiClient.put(`/students/${id}`, data);
    return res.data?.data || res.data;
};

/**
 * Delete a student
 */
export const deleteStudent = async (id: string): Promise<void> => {
    await apiClient.delete(`/students/${id}`);
};

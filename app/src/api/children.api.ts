import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { ApiResponse } from '../types/api.types';
import {
  SubjectEnrollment,
  AttendanceRecord,
  ExamRecord,
  FinancialRecord,
} from '../types/child.types';

export const ChildrenApi = {
  /**
   * Fetches full details for a child (enrolled subjects & teachers)
   */
  async getChildSubjects(studentId: string): Promise<SubjectEnrollment[]> {
    const response = await apiClient.get<ApiResponse<SubjectEnrollment[]>>(
      ENDPOINTS.STUDENT_DETAILS(studentId)
    );
    return response.data.data;
  },

  /**
   * Fetches digital Smart Card and QR code details for a child
   */
  async getChildCard(studentId: string): Promise<import('../types/child.types').StudentCardData> {
    const response = await apiClient.get<ApiResponse<import('../types/child.types').StudentCardData>>(
      ENDPOINTS.STUDENT_CARD(studentId)
    );
    return response.data.data;
  },

  /**
   * Fetches attendance history with optional subject/group filter
   */
  async getAttendance(
    studentId: string,
    params?: { subjectId?: string }
  ): Promise<AttendanceRecord[]> {
    const response = await apiClient.get<ApiResponse<AttendanceRecord[]>>(
      ENDPOINTS.STUDENT_ATTENDANCE(studentId),
      { params }
    );
    return response.data.data;
  },

  /**
   * Fetches exam results with optional subject filter
   */
  async getExams(
    studentId: string,
    params?: { subjectId?: string }
  ): Promise<ExamRecord[]> {
    const response = await apiClient.get<ApiResponse<ExamRecord[]>>(
      ENDPOINTS.STUDENT_EXAMS(studentId),
      { params }
    );
    return response.data.data;
  },

  /**
   * Fetches current cycle billing details & payment history
   */
  async getFinancial(
    studentId: string,
    params?: { subjectId?: string }
  ): Promise<FinancialRecord[]> {
    const response = await apiClient.get<ApiResponse<FinancialRecord[]>>(
      ENDPOINTS.STUDENT_FINANCIAL(studentId),
      { params }
    );
    return response.data.data;
  },
};

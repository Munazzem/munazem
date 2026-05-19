import { apiClient } from './axios';
import type {
    QuestionType,
    ExamStatus,
    ExamSource,
    Difficulty,
    IQuestion,
    IExam,
    IExamResult,
    ExamResultsSummary,
    PaginatedExamsResponse,
    CreateExamInput,
    UpdateExamInput,
    BatchResultInput,
} from '@/types/exam.types';

export type {
    QuestionType,
    ExamStatus,
    ExamSource,
    Difficulty,
    IQuestion,
    IExam,
    IExamResult,
    ExamResultsSummary,
    PaginatedExamsResponse,
    CreateExamInput,
    UpdateExamInput,
    BatchResultInput,
};

// ── API Functions ──────────────────────────────────────────────────

export const fetchExams = async (params?: {
    status?:     ExamStatus;
    gradeLevel?: string;
    page?:       number;
    limit?:      number;
}): Promise<PaginatedExamsResponse> => {
    const q = new URLSearchParams();
    if (params?.status)     q.set('status',     params.status);
    if (params?.gradeLevel) q.set('gradeLevel', params.gradeLevel);
    if (params?.page)       q.set('page',       String(params.page));
    if (params?.limit)      q.set('limit',      String(params.limit));
    const res = await apiClient.get(`/exams?${q.toString()}`);
    return (res as any).data ?? res;
};

export const fetchExamById = async (id: string): Promise<IExam> => {
    const res = await apiClient.get(`/exams/${id}`);
    return (res as any).data ?? res;
};

export const createExam = async (data: CreateExamInput): Promise<IExam> => {
    const res = await apiClient.post('/exams', data);
    return (res as any).data ?? res;
};

export const updateExam = async (id: string, data: UpdateExamInput): Promise<IExam> => {
    const res = await apiClient.put(`/exams/${id}`, data);
    return (res as any).data ?? res;
};

export const publishExam = async (id: string): Promise<IExam> => {
    const res = await apiClient.patch(`/exams/${id}/publish`);
    return (res as any).data ?? res;
};

export const deleteExam = async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/${id}`);
};

export const getExamResults = async (id: string): Promise<ExamResultsSummary> => {
    const res = await apiClient.get(`/exams/${id}/results`);
    return (res as any).data ?? res;
};

export const recordResult = async (examId: string, data: BatchResultInput): Promise<IExamResult> => {
    const res = await apiClient.post(`/exams/${examId}/results`, data);
    return (res as any).data ?? res;
};

export const batchRecordResults = async (
    examId: string,
    results: BatchResultInput[]
): Promise<{ total: number; inserted: number }> => {
    const res = await apiClient.post(`/exams/${examId}/results/batch`, { results });
    return (res as any).data ?? res;
};

export const generateExamFromPdf = async (formData: FormData): Promise<{ exam: IExam; message: string }> => {
    const res = await apiClient.post('/exams/ai/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res as any).data ?? res;
};

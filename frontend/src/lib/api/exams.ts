import { apiClient } from './axios';

// ── Types ──────────────────────────────────────────────────────────

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
export type ExamStatus   = 'DRAFT' | 'PUBLISHED' | 'COMPLETED';
export type ExamSource   = 'MANUAL' | 'AI_GENERATED';
export type Difficulty   = 'easy' | 'medium' | 'hard' | 'mixed';

export interface IQuestion {
    type:           QuestionType;
    text:           string;
    marks:          number;
    options?:       string[];
    correctAnswer?: string;
}

export interface IExam {
    _id:          string;
    teacherId:    string;
    title:        string;
    date:         string;
    totalMarks:   number;
    passingMarks: number;
    gradeLevel?:  string;
    groupIds?:    string[];
    questions:    IQuestion[];
    status:       ExamStatus;
    source:       ExamSource;
    createdAt:    string;
}

export interface IExamResult {
    _id:        string;
    examId:     string;
    studentId:  string | { _id: string; fullName: string };
    score:      number;
    percentage: number;
    grade:      string;
    passed:     boolean;
    createdAt:  string;
}

export interface ExamResultsSummary {
    exam:          Pick<IExam, '_id' | 'title' | 'date' | 'totalMarks'>;
    totalStudents: number;
    passingCount:  number;
    failingCount:  number;
    passRate:      string;
    results:       IExamResult[];
}

export interface PaginatedExamsResponse {
    data:       IExam[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreateExamInput {
    title:        string;
    date:         string;
    totalMarks:   number;
    passingMarks: number;
    gradeLevel?:  string;
    groupIds?:    string[];
    questions?:   IQuestion[];
    source?:      ExamSource;
}

export interface UpdateExamInput extends Partial<CreateExamInput> {}

export interface BatchResultInput {
    studentId: string;
    score:     number;
}

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

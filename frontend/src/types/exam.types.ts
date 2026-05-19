// ── Enums / Literal Types ───────────────────────────────────────────

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
export type ExamStatus   = 'DRAFT' | 'PUBLISHED' | 'COMPLETED';
export type ExamSource   = 'MANUAL' | 'AI_GENERATED';
export type Difficulty   = 'easy' | 'medium' | 'hard' | 'mixed';

// ── Core Entities ───────────────────────────────────────────────────

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

// ── Aggregates / Summaries ──────────────────────────────────────────

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

// ── DTOs ────────────────────────────────────────────────────────────

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

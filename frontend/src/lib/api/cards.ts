import { apiClient, API_BASE_URL } from './axios';
import Cookies from 'js-cookie';

// ── Types ────────────────────────────────────────────────────────────────────

export type CardStatus = 'NEW' | 'LINKED' | 'DISABLED';
export type CardDisabledReason = 'LOST' | 'DAMAGED' | 'MANUAL';

export interface StudentQuickSummary {
    studentId:             string;
    studentName:           string;
    studentCode:           string;
    gradeLevel:            string;
    groupId:               string;
    groupName:             string;
    remainingSessions:     number;
    totalDebt:             number;
    hasActiveSubscription: boolean;
    lastAttendanceDate:    string | null;
    lastAttendanceStatus:  string | null;
    lastPaymentDate:       string | null;
    lastPaymentAmount:     number | null;
    isActive:              boolean;
}

export interface CardResolveResult {
    source:     'card' | 'barcode' | 'studentCode';
    cardStatus: CardStatus | null;
    cardNumber: string | null;
    student:    StudentQuickSummary | null;
}

export interface BatchGenerateResult {
    batchId: string;
    count:   number;
    cards:   { cardNumber: string; cardToken: string }[];
}

export interface ICard {
    _id:            string;
    cardNumber:     string;
    cardToken:      string;
    teacherId:      string;
    studentId:      { _id: string; studentName: string; studentCode: string; gradeLevel: string } | null;
    status:         CardStatus;
    batchId:        string | null;
    linkedAt:       string | null;
    disabledAt:     string | null;
    disabledReason: string | null;
    createdAt:      string;
}

export interface CardStats {
    NEW:      number;
    LINKED:   number;
    DISABLED: number;
    total:    number;
}

// ── API Functions ────────────────────────────────────────────────────────────

/** Generate a batch of blank cards */
export const generateCardBatch = async (count: number): Promise<BatchGenerateResult> => {
    const res = await apiClient.post('/cards/generate', { count });
    return (res as any).data;
};

/** Resolve any QR scan input (URL, token, cardNumber, barcode, studentCode) */
export const resolveCard = async (scanInput: string): Promise<CardResolveResult> => {
    const encoded = encodeURIComponent(scanInput);
    const res = await apiClient.get(`/cards/resolve/${encoded}`);
    return (res as any).data;
};

/** Link a card to a student */
export const linkCard = async (cardNumber: string, studentId: string): Promise<ICard> => {
    const res = await apiClient.post('/cards/link', { cardNumber, studentId });
    return (res as any).data;
};

/** Unlink a card from its student */
export const unlinkCard = async (cardNumber: string): Promise<ICard> => {
    const res = await apiClient.post('/cards/unlink', { cardNumber });
    return (res as any).data;
};

/** Disable a card (LOST / DAMAGED / MANUAL) */
export const disableCard = async (cardNumber: string, reason: CardDisabledReason): Promise<ICard> => {
    const res = await apiClient.post('/cards/disable', { cardNumber, reason });
    return (res as any).data;
};

/** Replace a lost/damaged card with a new blank card */
export const replaceCard = async (oldCardNumber: string, newCardNumber: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/cards/replace', { oldCardNumber, newCardNumber });
    return (res as any).data;
};

/** List cards with optional filters */
export const getCards = async (params?: {
    status?: CardStatus;
    batchId?: string;
    page?: number;
    limit?: number;
}): Promise<{ data: ICard[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
    const query = new URLSearchParams();
    if (params?.status)  query.append('status', params.status);
    if (params?.batchId) query.append('batchId', params.batchId);
    if (params?.page)    query.append('page', String(params.page));
    if (params?.limit)   query.append('limit', String(params.limit));
    const res = await apiClient.get(`/cards?${query.toString()}`);
    return (res as any).data;
};

/** Get card statistics */
export const getCardStats = async (): Promise<CardStats> => {
    const res = await apiClient.get('/cards/stats');
    return (res as any).data;
};

/** Get parent portal data by card token (no auth) */
export const getStudentByCardToken = async (cardToken: string): Promise<StudentQuickSummary> => {
    // This hits the public parent endpoint
    const res = await apiClient.get(`/parent/card/${cardToken}`);
    return (res as any).data;
};

/** Get printable HTML URL for a batch */
export const getCardBatchPrintUrl = (batchId: string): string => {
    const token = Cookies.get('token') || '';
    return `${API_BASE_URL}/cards/batch/${batchId}/print?token=${token}`;
};

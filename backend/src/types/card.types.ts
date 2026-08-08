import type { Document, Types } from 'mongoose';

export type CardStatus = 'NEW' | 'LINKED' | 'DISABLED';
export type CardDisabledReason = 'LOST' | 'DAMAGED' | 'MANUAL';

// ── Mongoose Document Interface ───────────────────────────────────────────────
export interface ICard extends Document {
    cardNumber:     string;
    cardToken:      string;
    teacherId:      Types.ObjectId;
    studentId:      Types.ObjectId | null;
    status:         CardStatus;
    batchId:        string | null;
    linkedAt:       Date | null;
    linkedBy:       Types.ObjectId | null;
    disabledAt:     Date | null;
    disabledReason: string | null;
    disabledBy:     Types.ObjectId | null;
    createdAt:      Date;
    updatedAt:      Date;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────
export interface GenerateBatchDTO {
    count: number;  // 1–1000
}

export interface LinkCardDTO {
    cardNumber: string;
    studentId:  string;
}

export interface UnlinkCardDTO {
    cardNumber: string;
}

export interface DisableCardDTO {
    cardNumber: string;
    reason:     CardDisabledReason;
}

export interface ReplaceCardDTO {
    oldCardNumber: string;
    newCardNumber: string;
}

// ── Response shapes ───────────────────────────────────────────────────────────

/** Lightweight student snapshot shown after a QR scan */
export interface StudentQuickSummary {
    studentId:             string;
    studentName:           string;
    studentCode:           string;
    gradeLevel:            string;
    groupId:               string;
    groupName:             string;
    remainingSessions:     number;
    cycleCapacity:         number;
    cycleNumber:           number;
    totalDebt:             number;
    hasActiveSubscription: boolean;
    lastAttendanceDate:    string | null;
    lastAttendanceStatus:  string | null;
    lastPaymentDate:       string | null;
    lastPaymentAmount:     number | null;
    isActive:              boolean;
}

/** Result of resolveCard() */
export interface CardResolveResult {
    source:     'card' | 'barcode' | 'studentCode';
    cardStatus: CardStatus | null;  // null if resolved via barcode/studentCode
    cardNumber: string | null;
    student:    StudentQuickSummary;
}

/** Batch generation result */
export interface BatchGenerateResult {
    batchId:    string;
    count:      number;
    cards:      { cardNumber: string; cardToken: string }[];
}

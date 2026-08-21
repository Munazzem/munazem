import { AttendanceStatus } from '../common/enums/enum.service.js';

// ─── Session DTOs ────────────────────────────────────────────────
export interface CreateSessionDTO {
    groupId:   string;
    date:      string;   // ISO date string
    startTime: string;   // "10:00"
}

// ─── Attendance DTOs ─────────────────────────────────────────────
export interface RecordAttendanceDTO {
    studentId: string;
    sessionId: string;
    status:    AttendanceStatus;
    isGuest?:  boolean;
    notes?:    string;
}

// Batch record — for QR or manual bulk
export interface BatchAttendanceDTO {
    sessionId: string;
    records: {
        studentId: string;
        status:    AttendanceStatus;
        isGuest?:  boolean;
        notes?:    string;
    }[];
}

// Offline Outbox Sync Batch DTO
export interface SyncAttendanceRecordDTO {
    clientMutationId: string;
    studentId: string;
    status?: AttendanceStatus;
    isGuest?: boolean;
    scannedAt?: string;
    notes?: string;
}

export interface SyncBatchAttendanceDTO {
    sessionId: string;
    records: SyncAttendanceRecordDTO[];
}

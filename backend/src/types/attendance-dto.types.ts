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
    homeworkDone?: boolean;
    notes?:    string;
}

// Batch record — for QR or manual bulk
export interface BatchAttendanceDTO {
    sessionId: string;
    records: {
        studentId: string;
        status:    AttendanceStatus;
        isGuest?:  boolean;
        homeworkDone?: boolean;
        notes?:    string;
    }[];
}

// Offline Outbox Sync Batch DTO
// Either `studentId` (MongoDB ObjectId — resolved online or from local cache)
// OR `rawToken` (QR UUID / barcode / studentCode — resolved server-side at sync time).
// One of the two must be present per record.
export interface SyncAttendanceRecordDTO {
    clientMutationId: string;
    studentId?: string;  // MongoDB ObjectId — fast path
    rawToken?:  string;  // QR token / barcode / studentCode — deferred resolution
    status?:    AttendanceStatus;
    isGuest?:   boolean;
    homeworkDone?: boolean;
    scannedAt?: string;
    notes?:     string;
}

export interface SyncBatchAttendanceDTO {
    sessionId: string;
    records: SyncAttendanceRecordDTO[];
}

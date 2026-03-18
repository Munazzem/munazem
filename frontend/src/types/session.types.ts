export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface ISession {
    _id: string;
    groupId: string | { _id: string; name: string };
    teacherId: string;
    date: string;
    startTime: string;
    status: SessionStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ISessionWithGroup extends ISession {
    groupId: { _id: string; name: string };
}

export interface IAttendanceRecord {
    _id: string;
    studentId: {
        _id: string;
        studentName: string;
        studentPhone: string;
        studentCode: string;
    } | null;
    sessionId: string;
    status: AttendanceStatus;
    isGuest: boolean;
    scannedAt: string;
    scannedBy: string;
    notes?: string;
}

export interface IAttendanceSnapshotStudent {
    studentId: string;
    studentName: string;
    scannedAt?: string;
}

export interface IAttendanceSnapshot {
    _id: string;
    sessionId: string;
    groupId: string;
    teacherId: string;
    date: string;
    presentStudents: IAttendanceSnapshotStudent[];
    absentStudents: IAttendanceSnapshotStudent[];
    guestStudents: IAttendanceSnapshotStudent[];
    presentCount: number;
    absentCount: number;
    totalCount: number;
    createdAt: string;
}

export interface CreateSessionDTO {
    groupId: string;
    date: string;
    startTime: string;
}

export interface RecordAttendanceDTO {
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    isGuest?: boolean;
    notes?: string;
}

export interface PaginatedSessionsResponse {
    data: ISession[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

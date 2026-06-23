import { AttendanceStatus } from '../common/enums/enum.service.js';
export interface CreateSessionDTO {
    groupId: string;
    date: string;
    startTime: string;
}
export interface RecordAttendanceDTO {
    studentId: string;
    sessionId: string;
    status: AttendanceStatus;
    isGuest?: boolean;
    notes?: string;
}
export interface BatchAttendanceDTO {
    sessionId: string;
    records: {
        studentId: string;
        status: AttendanceStatus;
        isGuest?: boolean;
        notes?: string;
    }[];
}
//# sourceMappingURL=attendance-dto.types.d.ts.map
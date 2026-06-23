import type { RecordAttendanceDTO, BatchAttendanceDTO } from '../../types/attendance-dto.types.js';
import mongoose from 'mongoose';
export declare class AttendanceService {
    static recordAttendance(scannedBy: string, data: RecordAttendanceDTO, teacherId: string): Promise<mongoose.Document<unknown, {}, import("../../types/attendance.types.js").IAttendanceDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/attendance.types.js").IAttendanceDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static recordManualAttendance(scannedBy: string, studentId: string, teacherId: string): Promise<mongoose.Document<unknown, {}, import("../../types/attendance.types.js").IAttendanceDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/attendance.types.js").IAttendanceDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static batchRecordAttendance(scannedBy: string, data: BatchAttendanceDTO, teacherId: string): Promise<{
        inserted: number;
        total: number;
    }>;
    static getSessionAttendance(sessionId: string, teacherId: string, search?: string): Promise<(import("../../types/attendance.types.js").IAttendanceDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static completeSession(sessionId: string, teacherId: string, completedBy?: string): Promise<{
        session: (import("../../types/session.types.js").ISessionDocument & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
        snapshot: import("../../types/attendance-snapshot.types.js").IAttendanceSnapshotDocument & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        };
    }>;
    static getSnapshot(sessionId: string, teacherId: string): Promise<import("../../types/attendance-snapshot.types.js").IAttendanceSnapshotDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static updateAttendance(attendanceId: string, updatedBy: string, status: string, teacherId: string, notes?: string): Promise<(import("../../types/attendance.types.js").IAttendanceDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static getGroupHistory(groupId: string, teacherId: string, queryFilters?: any): Promise<{
        data: (import("../../types/attendance-snapshot.types.js").IAttendanceSnapshotDocument & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static generateWhatsAppLinks(sessionId: string, teacherId: string): Promise<{
        studentId: mongoose.Types.ObjectId;
        studentName: string;
        status: string;
        whatsappLink: string;
    }[]>;
}
//# sourceMappingURL=attendance.service.d.ts.map
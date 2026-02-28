import { Document, Types } from 'mongoose';
import { AttendanceStatus } from '../common/enums/enum.service.js';

export interface IAttendance {
    studentId:   Types.ObjectId;
    sessionId:   Types.ObjectId;
    status:      AttendanceStatus;
    isGuest:     boolean;           // طالب من مجموعة تانية
    scannedAt:   Date;
    scannedBy?:  Types.ObjectId;   // المساعد الذي سجّل (optional)
    notes?:      string;
    createdAt?:  Date;
    updatedAt?:  Date;
}

export interface IAttendanceDocument extends IAttendance, Document {}

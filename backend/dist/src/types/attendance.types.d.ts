import { Document, Types } from 'mongoose';
import { AttendanceStatus } from '../common/enums/enum.service.js';
export interface IAttendance {
    studentId: Types.ObjectId;
    sessionId?: Types.ObjectId;
    type: 'SESSION' | 'MANUAL';
    status: AttendanceStatus;
    isGuest: boolean;
    scannedAt: Date;
    scannedBy?: Types.ObjectId;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IAttendanceDocument extends IAttendance, Document {
}
//# sourceMappingURL=attendance.types.d.ts.map
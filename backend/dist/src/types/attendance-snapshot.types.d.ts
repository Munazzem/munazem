import { Document, Types } from 'mongoose';
export interface IStudentEntry {
    studentId: Types.ObjectId;
    studentName: string;
    scannedAt?: Date;
}
export interface IAttendanceSnapshot {
    sessionId: Types.ObjectId;
    groupId: Types.ObjectId;
    teacherId: Types.ObjectId;
    date: Date;
    presentStudents: IStudentEntry[];
    absentStudents: IStudentEntry[];
    guestStudents: IStudentEntry[];
    presentCount: number;
    absentCount: number;
    totalCount: number;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IAttendanceSnapshotDocument extends IAttendanceSnapshot, Document {
}
//# sourceMappingURL=attendance-snapshot.types.d.ts.map
import { Document, Types } from 'mongoose';

export interface IStudentEntry {
    studentId:   Types.ObjectId;
    studentName: string;            // embedded — no populate needed on read
    scannedAt?:  Date;              // only for present/late
}

export interface IAttendanceSnapshot {
    sessionId:       Types.ObjectId;    // unique — one snapshot per session
    groupId:         Types.ObjectId;
    teacherId:       Types.ObjectId;
    date:            Date;
    presentStudents: IStudentEntry[];
    absentStudents:  IStudentEntry[];
    guestStudents:   IStudentEntry[];
    presentCount:    number;
    absentCount:     number;
    totalCount:      number;
    createdAt?:      Date;
    updatedAt?:      Date;
}

export interface IAttendanceSnapshotDocument extends IAttendanceSnapshot, Document {}

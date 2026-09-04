import { Document, Types } from 'mongoose';
import { AttendanceStatus } from '../common/enums/enum.service.js';

export interface IStudentEntry {
    studentId:   Types.ObjectId;
    studentName: string;            // embedded — no populate needed on read
    scannedAt?:  Date;              // only for present/late
    status?:     AttendanceStatus;
    homeworkDone?: boolean | null;
    relatedSessionId?: Types.ObjectId;
    relatedGroupName?: string;
    relatedDate?:      Date;
}

export interface IAttendanceSnapshot {
    sessionId:       Types.ObjectId;    // unique — one snapshot per session
    groupId:         Types.ObjectId;
    teacherId:       Types.ObjectId;
    date:            Date;
    presentStudents:     IStudentEntry[];
    absentStudents:      IStudentEntry[];
    guestStudents:       IStudentEntry[];
    compensatedStudents: IStudentEntry[];
    presentCount:        number;
    absentCount:         number;
    compensatedCount:    number;
    totalCount:          number;
    createdAt?:          Date;
    updatedAt?:          Date;
}

export interface IAttendanceSnapshotDocument extends IAttendanceSnapshot, Document {}

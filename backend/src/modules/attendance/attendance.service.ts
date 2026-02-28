import { AttendanceModel }         from '../../database/models/attendance.model.js';
import { AttendanceSnapshotModel }  from '../../database/models/attendance-snapshot.model.js';
import { SessionModel }             from '../../database/models/session.model.js';
import { StudentModel }             from '../../database/models/student.model.js';
import { SessionStatus, AttendanceStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import type { RecordAttendanceDTO, BatchAttendanceDTO } from '../../types/attendance-dto.types.js';
import mongoose from 'mongoose';

export class AttendanceService {

    // ─── Record single attendance (QR scan or manual) ──────────────
    static async recordAttendance(scannedBy: string, data: RecordAttendanceDTO) {
        // Verify session exists
        const session = await SessionModel.findById(data.sessionId).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'انتهت هذه الحصة ولا يمكن تسجيل حضور عليها' });
        }
        if (session.status === SessionStatus.CANCELLED) {
            throw BadRequestException({ message: 'هذه الحصة مُلغاة' });
        }

        // Verify student exists
        const student = await StudentModel.findById(data.studentId).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        try {
            const record = await AttendanceModel.create({
                studentId: data.studentId,
                sessionId: data.sessionId,
                status:    data.status,
                isGuest:   data.isGuest ?? false,
                scannedAt: new Date(),
                scannedBy,
                ...(data.notes ? { notes: data.notes } : {}),
            });
            return record;
        } catch (error: any) {
            if (error.code === 11000) {
                throw ConflictException({ message: 'تم تسجيل حضور هذا الطالب بالفعل في هذه الحصة' });
            }
            throw error;
        }
    }

    // ─── Batch record (all students at once — for fast manual entry) ─
    static async batchRecordAttendance(scannedBy: string, data: BatchAttendanceDTO) {
        const session = await SessionModel.findById(data.sessionId).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'انتهت هذه الحصة ولا يمكن تسجيل حضور عليها' });
        }

        // Build bulk records — insertMany with ordered:false to continue on duplicate errors
        const docs = data.records.map(r => ({
            studentId: new mongoose.Types.ObjectId(r.studentId),
            sessionId: new mongoose.Types.ObjectId(data.sessionId),
            status:    r.status,
            isGuest:   r.isGuest ?? false,
            scannedAt: new Date(),
            scannedBy: new mongoose.Types.ObjectId(scannedBy),
            notes:     r.notes,
        }));

        const result = await AttendanceModel.insertMany(docs, {
            ordered: false,   // continue on errors (e.g., duplicate unique constraint)
        }).catch((err: any) => {
            // Partial success is ok — return what succeeded
            if (err.writeErrors || err.insertedDocs) return err.insertedDocs ?? [];
            throw err;
        });

        return { inserted: (result as any[]).length, total: docs.length };
    }

    // ─── Get attendance for a session (the live list) ────────────────
    static async getSessionAttendance(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const records = await AttendanceModel.find({ sessionId })
            .populate('studentId', 'studentName studentPhone')
            .lean();

        return records;
    }

    // ─── Complete session + generate Snapshot ───────────────────────
    static async completeSession(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'الحصة مكتملة بالفعل' });
        }

        // Get all students registered in this group
        const allStudents = await StudentModel.find(
            { groupId: session.groupId, teacherId, isActive: true },
            { _id: 1, studentName: 1 }
        ).lean();

        // Get all present/late attendance records
        const attendanceRecords = await AttendanceModel.find({ sessionId }).lean();
        const attendedSet = new Map(attendanceRecords.map(r => [r.studentId.toString(), r]));

        // Build snapshot lists
        const presentStudents: any[] = [];
        const absentStudents:  any[] = [];
        const guestStudents:   any[] = [];

        // Regular students
        for (const student of allStudents) {
            const record = attendedSet.get(student._id.toString());
            if (record && record.status !== AttendanceStatus.ABSENT) {
                presentStudents.push({
                    studentId:   student._id,
                    studentName: student.studentName,
                    scannedAt:   record.scannedAt,
                });
            } else {
                absentStudents.push({
                    studentId:   student._id,
                    studentName: student.studentName,
                });
            }
        }

        // Guest students (isGuest = true)
        const guestRecords = attendanceRecords.filter(r => r.isGuest);
        for (const r of guestRecords) {
            const student = await StudentModel.findById(r.studentId, { studentName: 1 }).lean();
            if (student) {
                guestStudents.push({
                    studentId:   student._id,
                    studentName: student.studentName,
                    scannedAt:   r.scannedAt,
                });
            }
        }

        // Run session update + snapshot creation in parallel
        const [updatedSession, snapshot] = await Promise.all([
            SessionModel.findByIdAndUpdate(
                sessionId,
                { status: SessionStatus.COMPLETED },
                { new: true }
            ).lean(),
            AttendanceSnapshotModel.findOneAndUpdate(
                { sessionId },
                {
                    sessionId,
                    groupId:   session.groupId,
                    teacherId: session.teacherId,
                    date:      session.date,
                    presentStudents,
                    absentStudents,
                    guestStudents,
                    presentCount: presentStudents.length,
                    absentCount:  absentStudents.length,
                    totalCount:   allStudents.length,
                },
                { upsert: true, new: true }
            ).lean(),
        ]);

        return { session: updatedSession, snapshot };
    }

    // ─── Get snapshot (fast read — no populate) ──────────────────────
    static async getSnapshot(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId }).lean();
        if (!snapshot) throw NotFoundException({ message: 'لم يتم إنهاء هذه الحصة بعد' });

        return snapshot;
    }

    // ─── Get all snapshots for a group (attendance history) ──────────
    static async getGroupHistory(groupId: string, teacherId: string, queryFilters: any = {}) {
        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip  = (page - 1) * limit;

        const [data, total] = await Promise.all([
            AttendanceSnapshotModel.find({ groupId, teacherId })
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AttendanceSnapshotModel.countDocuments({ groupId, teacherId }),
        ]);

        return {
            data,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─── Generate WhatsApp Links for Session ─────────────────────────
    static async generateWhatsAppLinks(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId })
            .populate('groupId', 'name')
            .lean();
            
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const groupName = (session.groupId as any)?.name || 'مجموعة غير معروفة';

        // 1. Get all students in the group
        const allStudents = await StudentModel.find(
            { groupId: session.groupId, teacherId, isActive: true },
            { studentName: 1, parentPhone: 1 }
        ).lean();

        // 2. Get attendance records for this session
        const records = await AttendanceModel.find({ sessionId }).lean();
        const attendedSet = new Map(records.map(r => [r.studentId.toString(), r]));

        // Formatter for WhatsApp (wa.me accepts standard phone numbers with country code)
        // If the number doesn't start with country code, assume Egypt (+20) for Monazem context
        const formatPhone = (phone: string) => {
            let clean = phone.replace(/\D/g, '');
            if (clean.startsWith('01')) clean = '2' + clean; // e.g. 010... -> 2010...
            else if (!clean.startsWith('20') && clean.length === 10) clean = '20' + clean;
            return clean;
        };

        const shortDate = session.date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

        return allStudents.map(student => {
            const record = attendedSet.get(student._id.toString());
            const isPresent = record && record.status !== AttendanceStatus.ABSENT;

            let message = '';
            if (isPresent) {
                const timeStr = record.scannedAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                message = `أهلاً بك ولي أمر الطالب/ة: ${student.studentName}.\n\nنعلمكم بحضور الطالب لحصة [${groupName}] بتاريخ ${shortDate}.\nوقت الوصول: ${timeStr}.\n\nشكراً لتعاونكم.`;
            } else {
                message = `أهلاً بك ولي أمر الطالب/ة: ${student.studentName}.\n\nنعلمكم بغياب الطالب عن حصة [${groupName}] بتاريخ ${shortDate}.\nبرجاء متابعة الأمر، شكراً لتعاونكم.`;
            }

            const encodedMessage = encodeURIComponent(message);
            const waPhone = formatPhone(student.parentPhone);

            return {
                studentId: student._id,
                studentName: student.studentName,
                status: isPresent ? 'PRESENT' : 'ABSENT',
                whatsappLink: `https://wa.me/${waPhone}?text=${encodedMessage}`,
            };
        });
    }
}

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
    static async recordAttendance(scannedBy: string, data: RecordAttendanceDTO, teacherId: string) {
        // Verify session belongs to this teacher
        const session = await SessionModel.findOne({ _id: data.sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'انتهت هذه الحصة ولا يمكن تسجيل حضور عليها' });
        }
        if (session.status === SessionStatus.CANCELLED) {
            throw BadRequestException({ message: 'هذه الحصة مُلغاة' });
        }

        // Resolve student — scoped to this teacher to prevent cross-tenant scan
        const isObjectId = mongoose.Types.ObjectId.isValid(data.studentId) && data.studentId.length === 24;
        const student = isObjectId
            ? await StudentModel.findOne({ _id: data.studentId, teacherId }).lean()
            : await StudentModel.findOne({
                teacherId,
                $or: [
                    { studentCode: data.studentId },
                    { barcode: data.studentId },
                ],
              }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        try {
            // Check for existing record to prevent duplicates regardless of DB index state
            const existing = await AttendanceModel.findOne({
                studentId: student._id,
                sessionId: data.sessionId
            }).lean();
            
            if (existing) {
                throw ConflictException({ message: 'تم تسجيل حضور هذا الطالب بالفعل في هذه الحصة' });
            }

            // Auto-detect guest: student not in this session's group
            const isGuest = student.groupId?.toString() !== session.groupId?.toString();

            const record = await AttendanceModel.create({
                studentId: student._id,
                sessionId: data.sessionId,
                status:    data.status,
                isGuest,
                scannedAt: new Date(),
                scannedBy,
                type:      'SESSION',
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

    // ─── Record manual manual quota attendance (checkbox) ──────────
    static async recordManualAttendance(scannedBy: string, studentId: string, teacherId: string) {
        const student = await StudentModel.findOne({ _id: studentId, teacherId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Find all sessions for the group this month
        const sessions = await SessionModel.find({
            groupId: student.groupId,
            teacherId,
            date: { $gte: monthStart, $lte: monthEnd }
        }).sort({ date: 1, startTime: 1 }).lean();

        // Get existing attendance for this student in these sessions
        const sessionIds = sessions.map(s => s._id);
        const existingAttendance = await AttendanceModel.find({
            studentId: student._id,
            sessionId: { $in: sessionIds as any },
            status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] }
        }).lean();

        const attendedSessionIds = new Set(existingAttendance.map(a => a.sessionId?.toString()));

        // Find earliest unattended session
        const nextSession = sessions.find(s => !attendedSessionIds.has(s._id.toString()));

        return await AttendanceModel.create({
            studentId: student._id,
            ...(nextSession ? { sessionId: nextSession._id } : {}),
            status:    AttendanceStatus.PRESENT,
            type:      nextSession ? 'SESSION' : 'MANUAL',
            scannedAt: new Date(),
            scannedBy,
        });
    }

    // ─── Batch record (all students at once — for fast manual entry) ─
    static async batchRecordAttendance(scannedBy: string, data: BatchAttendanceDTO, teacherId: string) {
        const session = await SessionModel.findOne({ _id: data.sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'انتهت هذه الحصة ولا يمكن تسجيل حضور عليها' });
        }

        // Build bulk records
        const docs = data.records.map(r => ({
            studentId: new mongoose.Types.ObjectId(r.studentId),
            sessionId: new mongoose.Types.ObjectId(data.sessionId),
            status:    r.status,
            isGuest:   r.isGuest ?? false,
            scannedAt: new Date(),
            scannedBy: new mongoose.Types.ObjectId(scannedBy),
            notes:     r.notes,
        }));

        // Chunk the inserts to avoid hitting MongoDB Atlas Free Tier IOPS limit (100 ops/sec)
        const BATCH_SIZE = 50; 
        let totalInserted = 0;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const chunk = docs.slice(i, i + BATCH_SIZE);
            try {
                const result = await AttendanceModel.insertMany(chunk, { ordered: false });
                totalInserted += (result as any[]).length;
            } catch (err: any) {
                // Partial success is ok — count what succeeded
                if (err.writeErrors || err.insertedDocs) {
                    totalInserted += (err.insertedDocs?.length || 0);
                } else {
                    throw err; // Rethrow if it's a fatal error
                }
            }
            // A tiny artificial delay (50ms) to let the database breathe and reset its IOPS counter
            if (i + BATCH_SIZE < docs.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        return { inserted: totalInserted, total: docs.length };
    }

    // ─── Get attendance for a session (the live list) ────────────────
    static async getSessionAttendance(sessionId: string, teacherId: string, search?: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        let matchFilter: any = {};
        if (search) {
            const searchTerm = search.trim();
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const prefixRegex = new RegExp(`^${escaped}`, 'i');
            const anywhereRegex = new RegExp(escaped, 'i');
            
            matchFilter.$or = [
                { studentCode:  prefixRegex },
                { studentPhone: prefixRegex },
                { studentName:  anywhereRegex },
            ];
        }

        const records = await AttendanceModel.find({ sessionId })
            .populate({
                path: 'studentId',
                select: 'studentName studentPhone studentCode',
                match: Object.keys(matchFilter).length > 0 ? matchFilter : undefined
            })
            .lean();

        // Mongoose populate with match returns null for studentId if it doesn't match the filter
        // So we filter out the records where studentId is null (meaning the student didn't match the search)
        const filtered = records.filter(r => r.studentId !== null);

        // Sort alphabetically by student name
        filtered.sort((a, b) => {
            const nameA = (a.studentId as any)?.studentName ?? '';
            const nameB = (b.studentId as any)?.studentName ?? '';
            return nameA.localeCompare(nameB, 'ar');
        });

        return filtered;
    }

    // ─── Complete session + generate Snapshot ───────────────────────
    static async completeSession(sessionId: string, teacherId: string, completedBy?: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'الحصة مكتملة بالفعل' });
        }

        // Get all students registered in this group — sorted alphabetically
        const allStudents = await StudentModel.find(
            { groupId: session.groupId, teacherId, isActive: true },
            { _id: 1, studentName: 1, excusedSessionsCount: 1, excusedUntil: 1 }
        ).sort({ studentName: 1 }).lean();

        // Get all present/late attendance records
        const attendanceRecords = await AttendanceModel.find({ sessionId }).lean();
        const attendedSet = new Map(attendanceRecords.map(r => [r.studentId.toString(), r]));

        // Build snapshot lists
        const presentStudents: any[] = [];
        const absentStudents:  any[] = [];
        const guestStudents:   any[] = [];

        // Arrays to accumulate bulk operations (to avoid hitting DB inside the loop)
        const excusedAttendanceDocsToInsert: any[] = [];
        const absentAttendanceDocsToInsert:  any[] = [];
        const studentIdsToDecrementExcuse: any[] = [];

        for (const student of allStudents) {
            const record = attendedSet.get(student._id.toString());
            
            if (record && record.status !== AttendanceStatus.ABSENT) {
                presentStudents.push({
                    studentId:   student._id,
                    studentName: student.studentName,
                    scannedAt:   record.scannedAt,
                    status:      record.status, // might be LATE or EXCUSED
                });
            } else {
                // If student is absent, check if they are "Excused" (on leave)
                // Priority 1: Session count excuse
                // Priority 2: Date-based excuse (for compatibility)
                const hasSessionExcuse = (student.excusedSessionsCount || 0) > 0;
                const matchesDateExcuse = student.excusedUntil && new Date(student.excusedUntil) >= session.date;
                const isExcused = hasSessionExcuse || matchesDateExcuse;
                
                if (isExcused) {
                    presentStudents.push({
                        studentId:   student._id,
                        studentName: student.studentName,
                        scannedAt:   session.date,
                        status:      AttendanceStatus.EXCUSED,
                    });
                    
                    // Also create an actual attendance record as EXCUSED if it doesn't exist
                    if (!record) {
                        excusedAttendanceDocsToInsert.push({
                            studentId: student._id,
                            sessionId: session._id,
                            status:    AttendanceStatus.EXCUSED,
                            type:      'SESSION',
                            scannedBy: completedBy ? new mongoose.Types.ObjectId(completedBy) : undefined,
                            notes:     hasSessionExcuse 
                                ? `مُستأذن (متبقي ${student.excusedSessionsCount} حصص قبل هذه)` 
                                : 'مُستأذن تلقائياً بناءً على تاريخ الإذن',
                        });
                    }

                    // Decrement session count if it was a session-based excuse
                    if (hasSessionExcuse) {
                        studentIdsToDecrementExcuse.push(student._id);
                    }
                } else {
                    absentStudents.push({
                        studentId:   student._id,
                        studentName: student.studentName,
                    });

                    // Create actual attendance record as ABSENT if it doesn't exist
                    if (!record) {
                        absentAttendanceDocsToInsert.push({
                            studentId: student._id,
                            sessionId: session._id,
                            status:    AttendanceStatus.ABSENT,
                            type:      'SESSION',
                            scannedBy: completedBy ? new mongoose.Types.ObjectId(completedBy) : undefined,
                        });
                    }
                }
            }
        }

        // Guest students (isGuest = true) — batch fetch to avoid N+1
        const guestRecords = attendanceRecords.filter(r => r.isGuest);
        if (guestRecords.length > 0) {
            const guestIds = guestRecords.map(r => r.studentId);
            const guestStudentDocs = await StudentModel.find(
                { _id: { $in: guestIds } },
                { studentName: 1 }
            ).lean();
            const guestMap = new Map(guestStudentDocs.map(s => [s._id.toString(), s]));
            for (const r of guestRecords) {
                const student = guestMap.get(r.studentId.toString());
                if (student) {
                    guestStudents.push({
                        studentId:   student._id,
                        studentName: student.studentName,
                        scannedAt:   r.scannedAt,
                    });
                }
            }
        }

        // Execute Accumulated Bulk Operations outside the loop
        if (excusedAttendanceDocsToInsert.length > 0) {
            await AttendanceModel.insertMany(excusedAttendanceDocsToInsert, { ordered: false }).catch(() => {});
        }

        if (absentAttendanceDocsToInsert.length > 0) {
            await AttendanceModel.insertMany(absentAttendanceDocsToInsert, { ordered: false }).catch(() => {});
        }
        
        if (studentIdsToDecrementExcuse.length > 0) {
            await StudentModel.updateMany(
                { _id: { $in: studentIdsToDecrementExcuse } },
                { $inc: { excusedSessionsCount: -1 } }
            );
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

    // ─── Update a single attendance record (manual edit by assistant) ──
    static async updateAttendance(attendanceId: string, updatedBy: string, status: string, teacherId: string, notes?: string) {
        const record = await AttendanceModel.findById(attendanceId).lean();
        if (!record) throw NotFoundException({ message: 'سجل الحضور غير موجود' });

        // Verify the session belongs to this teacher before allowing edit (if session-based)
        if (record.sessionId) {
            const session = await SessionModel.findOne({ _id: record.sessionId as any, teacherId }).lean();
            if (!session) throw NotFoundException({ message: 'الحصة غير موجودة أو لا صلاحية لك عليها' });
            if (session.status === SessionStatus.COMPLETED) {
                throw BadRequestException({ message: 'لا يمكن تعديل حضور حصة مكتملة' });
            }
        } else {
            // For manual records, just verify the student belongs to the teacher
            const student = await StudentModel.findOne({ _id: record.studentId, teacherId }).lean();
            if (!student) throw NotFoundException({ message: 'الطالب غير موجود أو لا صلاحية لك عليه' });
        }

        if (!Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
            throw BadRequestException({ message: 'حالة الحضور غير صحيحة' });
        }

        return await AttendanceModel.findByIdAndUpdate(
            attendanceId,
            {
                status,
                scannedBy: new mongoose.Types.ObjectId(updatedBy),
                ...(notes !== undefined ? { notes } : {}),
            },
            { new: true, runValidators: true }
        ).lean();
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

        // 1. Get all students in the group — sorted alphabetically
        const allStudents = await StudentModel.find(
            { groupId: session.groupId, teacherId, isActive: true },
            { studentName: 1, parentPhone: 1 }
        ).sort({ studentName: 1 }).lean();

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

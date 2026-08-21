import { AttendanceModel }         from '../../database/models/attendance.model.js';
import { AttendanceSnapshotModel }  from '../../database/models/attendance-snapshot.model.js';
import { SessionModel }             from '../../database/models/session.model.js';
import { StudentModel }             from '../../database/models/student.model.js';
import { GroupModel }               from '../../database/models/group.model.js';
import { UserModel }                from '../../database/models/user.model.js';
import { CycleEnrollmentModel }     from '../../database/models/cycle-enrollment.model.js';
import { PriceSettingsModel }       from '../../database/models/price-settings.model.js';
import { SessionStatus, AttendanceStatus, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import type { RecordAttendanceDTO, BatchAttendanceDTO } from '../../types/attendance-dto.types.js';
import { enqueueWhatsApp } from '../../infrastructure/queues/whatsapp.queue.js';
import { cache, CacheKeys } from '../../infrastructure/cache/cache.service.js';
import mongoose from 'mongoose';
import { startOfDayEgyptMs } from '../../common/utils/date.util.js';

// ─── Date helper ─────────────────────────────────────────────────────────────
// Centralized in common/utils/date.util.ts — returns midnight Egypt time as ms
const startOfDay = startOfDayEgyptMs;

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

        // Guard: cannot record attendance before the session day
        if (startOfDay(new Date()) < startOfDay(new Date(session.date))) {
            throw BadRequestException({ message: 'لا يمكن تسجيل الحضور قبل يوم الحصة' });
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

        // ── Step 1: Grade-level enforcement ──────────────────────────────────
        // Fetch the session's group to compare grade levels (lean for performance)
        const sessionGroup = await GroupModel.findById(session.groupId, { gradeLevel: 1 }).lean();
        if (!sessionGroup) throw NotFoundException({ message: 'المجموعة المرتبطة بالحصة غير موجودة' });

        if (student.gradeLevel !== sessionGroup.gradeLevel) {
            throw BadRequestException({ message: 'عفواً، هذه المجموعة لمرحلة دراسية مختلفة' });
        }

        try {
            // Check for existing record to prevent duplicates regardless of DB index state
            const existing = await AttendanceModel.findOne({
                studentId: student._id,
                sessionId: data.sessionId
            }).lean();
            
            if (existing) {
                throw ConflictException({ message: 'تم تسجيل حضور هذا الطالب بالفعل في هذه الحصة' });
            }

            // ── Step 2: Guest detection ───────────────────────────────────────
            // Grades match (enforced above) — guest if from a different group
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

            // ── Step 3: Retroactive Compensation ──────────────────────────────
            // If student was marked ABSENT in their own group earlier this week,
            // convert the previous ABSENT record to EXCUSED (compensated) and decrement consecutive absences.
            if (isGuest && (data.status === AttendanceStatus.PRESENT || data.status === AttendanceStatus.LATE)) {
                const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const pastAbsentRecord = await AttendanceModel.findOne({
                    studentId: student._id,
                    status: AttendanceStatus.ABSENT,
                    scannedAt: { $gte: oneWeekAgo }
                }).sort({ scannedAt: -1 });

                if (pastAbsentRecord) {
                    pastAbsentRecord.status = AttendanceStatus.EXCUSED;
                    pastAbsentRecord.notes = 'معوّض — حضر كزائر في مجموعة أخرى';
                    await pastAbsentRecord.save();

                    // Synchronize AttendanceSnapshotModel: remove student from absentStudents of the past session
                    if (pastAbsentRecord.sessionId) {
                        const pastSnapshot = await AttendanceSnapshotModel.findOne({ sessionId: pastAbsentRecord.sessionId });
                        if (pastSnapshot) {
                            const originalLen = pastSnapshot.absentStudents.length;
                            pastSnapshot.absentStudents = pastSnapshot.absentStudents.filter(
                                s => s.studentId.toString() !== student._id.toString()
                            );
                            if (pastSnapshot.absentStudents.length !== originalLen) {
                                pastSnapshot.absentCount = pastSnapshot.absentStudents.length;
                                await pastSnapshot.save();
                            }
                        }
                    }

                    if ((student.consecutiveAbsences || 0) > 0) {
                        await StudentModel.findByIdAndUpdate(student._id, {
                            $inc: { consecutiveAbsences: -1 }
                        });
                    }
                }
            }

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

        const record = await AttendanceModel.create({
            studentId: student._id,
            ...(nextSession ? { sessionId: nextSession._id } : {}),
            status:    AttendanceStatus.PRESENT,
            type:      nextSession ? 'SESSION' : 'MANUAL',
            scannedAt: new Date(),
            scannedBy,
        });

        // Invalidate teacher cache
        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return record;
    }

    // ─── Batch record (all students at once — for fast manual entry) ─
    static async batchRecordAttendance(scannedBy: string, data: BatchAttendanceDTO, teacherId: string) {
        const session = await SessionModel.findOne({ _id: data.sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'انتهت هذه الحصة ولا يمكن تسجيل حضور عليها' });
        }

        // Guard: cannot record attendance before the session day
        if (startOfDay(new Date()) < startOfDay(new Date(session.date))) {
            throw BadRequestException({ message: 'لا يمكن تسجيل الحضور قبل يوم الحصة' });
        }

        // Build bulk records — insertMany with ordered:false to continue on duplicate errors
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

        // Retroactive compensation for any guest students marked present
        const guestDocs = docs.filter(d => d.isGuest && (d.status === AttendanceStatus.PRESENT || d.status === AttendanceStatus.LATE));
        if (guestDocs.length > 0) {
            const guestStudentIds = guestDocs.map(d => d.studentId);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            const absentRecords = await AttendanceModel.find({
                studentId: { $in: guestStudentIds },
                status: AttendanceStatus.ABSENT,
                scannedAt: { $gte: oneWeekAgo }
            }).sort({ scannedAt: -1 }).lean();

            if (absentRecords.length > 0) {
                const compensatedStudentIds: any[] = [];
                const updates = absentRecords.map(r => {
                    compensatedStudentIds.push(r.studentId);
                    return {
                        updateOne: {
                            filter: { _id: r._id },
                            update: {
                                $set: {
                                    status: AttendanceStatus.EXCUSED,
                                    notes: 'معوّض — حضر كزائر في مجموعة أخرى'
                                }
                            }
                        }
                    };
                });

                await AttendanceModel.bulkWrite(updates);

                // Synchronize AttendanceSnapshotModel for affected sessions
                const sessionIdsToSync = Array.from(new Set(absentRecords.filter(r => r.sessionId).map(r => r.sessionId!.toString())));
                const compensatedStudentIdSet = new Set(compensatedStudentIds.map(id => id.toString()));
                for (const pastSessionId of sessionIdsToSync) {
                    const pastSnapshot = await AttendanceSnapshotModel.findOne({ sessionId: pastSessionId });
                    if (pastSnapshot) {
                        const originalLen = pastSnapshot.absentStudents.length;
                        pastSnapshot.absentStudents = pastSnapshot.absentStudents.filter(
                            s => !compensatedStudentIdSet.has(s.studentId.toString())
                        );
                        if (pastSnapshot.absentStudents.length !== originalLen) {
                            pastSnapshot.absentCount = pastSnapshot.absentStudents.length;
                            await pastSnapshot.save();
                        }
                    }
                }

                if (compensatedStudentIds.length > 0) {
                    await StudentModel.updateMany(
                        { _id: { $in: compensatedStudentIds }, consecutiveAbsences: { $gt: 0 } },
                        { $inc: { consecutiveAbsences: -1 } }
                    );
                }
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

        const group = await GroupModel.findOne({ _id: session.groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة المرتبطة بالحصة غير موجودة' });

        // Get all students in this group — sorted alphabetically
        const allStudents = await StudentModel.find(
            { groupId: session.groupId, teacherId, isActive: true },
            { _id: 1, studentName: 1, excusedSessionsCount: 1, excusedUntil: 1, parentPhone: 1, consecutiveAbsences: 1, createdAt: 1 }
        ).sort({ studentName: 1 }).lean();

        // Get all present/late/manual attendance records for this session
        const attendanceRecords = await AttendanceModel.find({ sessionId }).lean();
        const attendedSet = new Map(attendanceRecords.map(r => [r.studentId.toString(), r]));

        // Check for guest attendances in other groups within the same week window (compensation)
        const sessionDate = new Date(session.date);
        const windowStart = new Date(sessionDate);
        windowStart.setDate(windowStart.getDate() - 7);
        windowStart.setHours(0, 0, 0, 0);

        const windowEnd = new Date(sessionDate);
        windowEnd.setDate(windowEnd.getDate() + 7);
        windowEnd.setHours(23, 59, 59, 999);

        const studentIds = allStudents.map(s => s._id);
        const guestAttendances = await AttendanceModel.find({
            studentId: { $in: studentIds },
            isGuest: true,
            status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] },
            scannedAt: { $gte: windowStart, $lte: windowEnd }
        }).sort({ scannedAt: 1 }).lean();

        const compensatedMap = new Map<string, any>();
        for (const g of guestAttendances) {
            if (!compensatedMap.has(g.studentId.toString())) {
                compensatedMap.set(g.studentId.toString(), g);
            }
        }

        // Build snapshot lists
        const presentStudents: any[] = [];
        const absentStudents:  any[] = [];
        const guestStudents:   any[] = [];

        // Arrays to accumulate bulk operations
        const excusedAttendanceDocsToInsert: any[] = [];
        const absentAttendanceDocsToInsert:  any[] = [];
        const attendanceRecordsToUpdate: any[] = []; // For existing absent records that reach threshold
        const studentIdsToDecrementExcuse: any[] = [];

        for (const student of allStudents) {
            const record = attendedSet.get(student._id.toString());
            
            if (record && record.status !== AttendanceStatus.ABSENT) {
                presentStudents.push({
                    studentId:   student._id,
                    studentName: student.studentName,
                    scannedAt:   record.scannedAt,
                    status:      record.status,
                });
            } else {
                const isCompensated = compensatedMap.has(student._id.toString());
                const hasSessionExcuse = (student.excusedSessionsCount || 0) > 0;
                const matchesDateExcuse = student.excusedUntil && new Date(student.excusedUntil) >= session.date;
                const isExcused = isCompensated || hasSessionExcuse || matchesDateExcuse;
                
                if (isExcused) {
                    presentStudents.push({
                        studentId:   student._id,
                        studentName: student.studentName,
                        scannedAt:   session.date,
                        status:      AttendanceStatus.EXCUSED,
                    });
                    
                    if (!record) {
                        const excuseNote = isCompensated
                            ? 'معوّض — حضر كزائر في مجموعة أخرى'
                            : (hasSessionExcuse 
                                ? `مُستأذن (متبقي ${student.excusedSessionsCount} حصص قبل هذه)` 
                                : 'مُستأذن تلقائياً بناءً على تاريخ الإذن');

                        excusedAttendanceDocsToInsert.push({
                            studentId: student._id,
                            sessionId: session._id,
                            status:    AttendanceStatus.EXCUSED,
                            type:      'SESSION',
                            scannedBy: completedBy ? new mongoose.Types.ObjectId(completedBy) : undefined,
                            isConsumed: false,
                            notes:     excuseNote,
                        });
                    } else if (record.status === AttendanceStatus.ABSENT) {
                        const excuseNote = isCompensated
                            ? 'معوّض — حضر كزائر في مجموعة أخرى'
                            : (hasSessionExcuse 
                                ? `مُستأذن (متبقي ${student.excusedSessionsCount} حصص قبل هذه)` 
                                : 'مُستأذن تلقائياً بناءً على تاريخ الإذن');

                        attendanceRecordsToUpdate.push({
                            updateOne: {
                                filter: { _id: record._id },
                                update: {
                                    $set: {
                                        status: AttendanceStatus.EXCUSED,
                                        notes: excuseNote,
                                        isConsumed: false
                                    }
                                }
                            }
                        });
                    }

                    if (!isCompensated && hasSessionExcuse) {
                        studentIdsToDecrementExcuse.push(student._id);
                    }
                } else {
                    absentStudents.push({
                        studentId:   student._id,
                        studentName: student.studentName,
                    });

                    const currentAbsences = (student.consecutiveAbsences || 0) + 1;
                    const isPending = currentAbsences >= 3;

                    if (!record) {
                        absentAttendanceDocsToInsert.push({
                            studentId: student._id,
                            sessionId: session._id,
                            status:    AttendanceStatus.ABSENT,
                            type:      'SESSION',
                            scannedBy: completedBy ? new mongoose.Types.ObjectId(completedBy) : undefined,
                            isConsumed: true,
                            ...(isPending ? {
                                exemptionDecision: {
                                    decision: 'PENDING',
                                    decidedAt: new Date(),
                                    consecutiveCountAtTime: currentAbsences
                                }
                            } : {})
                        });
                    } else if (record.status === AttendanceStatus.ABSENT && isPending && !record.exemptionDecision) {
                        attendanceRecordsToUpdate.push({
                            updateOne: {
                                filter: { _id: record._id },
                                update: {
                                    $set: {
                                        exemptionDecision: {
                                            decision: 'PENDING',
                                            decidedAt: new Date(),
                                            consecutiveCountAtTime: currentAbsences
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }

        // Guest students (exclude any student who is already enrolled in this group to avoid intra-snapshot duplication)
        const allStudentIdSet = new Set(allStudents.map(s => s._id.toString()));
        const guestRecords = attendanceRecords.filter(r => r.isGuest && !allStudentIdSet.has(r.studentId.toString()));
        const guestMap = new Map<string, any>();
        if (guestRecords.length > 0) {
            const guestIds = guestRecords.map(r => r.studentId);
            const guestStudentDocs = await StudentModel.find(
                { _id: { $in: guestIds } },
                { studentName: 1 }
            ).lean();
            for (const s of guestStudentDocs) guestMap.set(s._id.toString(), s);
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

        // ── Group Cycle Progression ──
        let capacity = group.cycle?.capacity ?? (group.schedule?.length || 2) * 4;
        let currentCycleNumber = group.cycle?.currentCycleNumber ?? 1;
        let currentSessionNumber = group.cycle?.currentSessionNumber ?? 0;
        let startedAt = group.cycle?.startedAt ?? new Date();
        let priceSnapshot = group.cycle?.priceSnapshot ?? new Map<string, number>();

        currentSessionNumber++;
        let cycleRolledOver = false;
        
        if (currentSessionNumber > capacity) {
            currentSessionNumber = 1;
            currentCycleNumber++;
            startedAt = new Date();
            cycleRolledOver = true;
        } else if (!group.cycle || (currentSessionNumber === 1 && !group.cycle.startedAt)) {
            startedAt = new Date();
            cycleRolledOver = true;
        }

        // Get Price Snapshot if rolling over or first cycle (to freeze prices for the cycle)
        if (cycleRolledOver || !group.cycle?.priceSnapshot) {
            const priceSettings = await PriceSettingsModel.findOne({ teacherId: session.teacherId }).lean();
            const newSnapshot = new Map<string, number>();
            if (priceSettings?.prices) {
                priceSettings.prices.forEach(p => newSnapshot.set(p.gradeLevel, p.amount));
            }
            priceSnapshot = newSnapshot;
        }

        // ── Cycle Enrollments (Upsert for all active students in group) ──
        // Charge existing students for the full cycle, and mid-cycle joiners pro-rated
        const activeStudents = await StudentModel.find(
            { groupId: group._id, isActive: true },
            { _id: 1, gradeLevel: 1, createdAt: 1 }
        ).lean();

        const enrollmentOps = activeStudents.map(student => {
            // @ts-ignore - priceSnapshot can be Map or plain object depending on Mongoose version/hydration
            const fullMonthPrice = (priceSnapshot instanceof Map ? priceSnapshot.get(student.gradeLevel) : priceSnapshot?.[student.gradeLevel]) || 0;
            const pricePerSession = capacity > 0 ? fullMonthPrice / capacity : 0;
            
            // Fixed full cycle price for all students - no automatic prorating
            const chargeableSessions = capacity;
            const cycleCharge = fullMonthPrice;

            return {
                updateOne: {
                    filter: {
                        studentId: student._id,
                        groupId: group._id,
                        cycleNumber: currentCycleNumber
                    },
                    update: {
                        $setOnInsert: {
                            studentId: student._id,
                            groupId: group._id,
                            teacherId: session.teacherId,
                            cycleNumber: currentCycleNumber,
                            cycleCapacity: capacity,
                            pricePerSession,
                            fullCyclePrice: fullMonthPrice,
                            startSession: 1,
                            chargeableSessions,
                            cycleCharge,
                            totalPaid: 0,
                            remainingAmount: cycleCharge,
                            status: CycleEnrollmentStatus.UNPAID
                        }
                    },
                    upsert: true
                }
            };
        });

        // ── All mutations wrapped in a transaction ──
        const { updatedSession, snapshot } = await withTransaction(async (dbSession) => {
            if (excusedAttendanceDocsToInsert.length > 0) {
                await AttendanceModel.insertMany(excusedAttendanceDocsToInsert, { ordered: false, session: dbSession }).catch(() => {});
            }
            if (absentAttendanceDocsToInsert.length > 0) {
                await AttendanceModel.insertMany(absentAttendanceDocsToInsert, { ordered: false, session: dbSession }).catch(() => {});
            }
            if (attendanceRecordsToUpdate.length > 0) {
                await AttendanceModel.bulkWrite(attendanceRecordsToUpdate, { session: dbSession });
            }

            if (studentIdsToDecrementExcuse.length > 0) {
                await StudentModel.updateMany(
                    { _id: { $in: studentIdsToDecrementExcuse } },
                    { $inc: { excusedSessionsCount: -1 } },
                    { session: dbSession }
                );
            }

            if (enrollmentOps.length > 0) {
                await CycleEnrollmentModel.bulkWrite(enrollmentOps, { session: dbSession });
            }

            // Group Cycle Update
            await GroupModel.findByIdAndUpdate(
                group._id,
                {
                    $set: {
                        'cycle.capacity': capacity,
                        'cycle.currentSessionNumber': currentSessionNumber,
                        'cycle.currentCycleNumber': currentCycleNumber,
                        'cycle.startedAt': startedAt,
                        'cycle.priceSnapshot': priceSnapshot
                    }
                },
                { session: dbSession }
            );

            // Session Update
            const [updatedSession, snapshot] = await Promise.all([
                SessionModel.findByIdAndUpdate(
                    sessionId,
                    { 
                        status: SessionStatus.COMPLETED,
                        cycleContext: { cycleNumber: currentCycleNumber, sessionNumber: currentSessionNumber }
                    },
                    { new: true, session: dbSession }
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
                    { upsert: true, new: true, session: dbSession }
                ).lean(),
            ]);

            // ── Consecutive Absences Updates ──
            const studentBulkOps: any[] = [];
            const excusedIds = new Set(
                presentStudents
                    .filter(s => s.status === AttendanceStatus.EXCUSED)
                    .map(s => s.studentId.toString())
            );

            for (const s of presentStudents) {
                if (!excusedIds.has(s.studentId.toString())) {
                    studentBulkOps.push({ updateOne: { filter: { _id: s.studentId }, update: { $set: { consecutiveAbsences: 0 } } } });
                }
            }

            for (const s of absentStudents) {
                const id = s.studentId.toString();
                const student = allStudents.find(st => st._id.toString() === id);
                if (student) {
                    const currentCount = (student.consecutiveAbsences || 0) + 1;
                    studentBulkOps.push({ updateOne: { filter: { _id: s.studentId }, update: { $set: { consecutiveAbsences: currentCount } } } });
                }
            }

            for (const s of guestStudents) {
                studentBulkOps.push({ updateOne: { filter: { _id: s.studentId }, update: { $set: { consecutiveAbsences: 0 } } } });
            }

            if (studentBulkOps.length > 0) {
                await StudentModel.bulkWrite(studentBulkOps, { session: dbSession });
            }

            return { updatedSession, snapshot };
        });

        trackEvent('session_completed', {
            tenantId: teacherId,
            userId:   completedBy || teacherId,
            targetId: sessionId,
            meta:     {
                groupId:      session.groupId?.toString(),
                presentCount: presentStudents.length,
                absentCount:  absentStudents.length,
                guestCount:   guestStudents.length,
            },
        });

        if (absentStudents.length > 0) {
            const phoneMap = new Map(
                allStudents
                    .filter(s => (s as any).parentPhone)
                    .map(s => [s._id.toString(), (s as any).parentPhone as string])
            );

            const teacherDoc = await UserModel.findById(teacherId, { name: 1, subject: 1 }).lean().catch(() => null);
            const rawTeacherName = (teacherDoc as any)?.name ?? '';
            const subject = (teacherDoc as any)?.subject;
            const teacherName = subject ? `${rawTeacherName} (${subject})` : rawTeacherName;

            for (const absent of absentStudents) {
                const parentPhone = phoneMap.get(absent.studentId.toString());
                if (!parentPhone) continue;

                enqueueWhatsApp({
                    kind:        'session_absent',
                    teacherId,
                    parentPhone,
                    studentId:   absent.studentId.toString(),
                    studentName: absent.studentName,
                    groupName:   group.name,
                    sessionDate: session.date.toISOString(),
                    teacherName,
                });
            }
        }

        // Invalidate teacher cache (dashboard, groups, etc.)
        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return { session: updatedSession, snapshot };
    }

    // ─── Resolve Absence Exemption ──────────────────────────────────────
    static async resolveAbsenceExemption(attendanceId: string, teacherId: string, decision: 'CONSUMED' | 'EXEMPTED') {
        const record = await AttendanceModel.findById(attendanceId).lean();
        if (!record) throw NotFoundException({ message: 'سجل الحضور غير موجود' });
        
        const session = await SessionModel.findOne({ _id: record.sessionId as any, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'لا توجد صلاحية للوصول لهذا السجل' });

        if (!record.exemptionDecision) {
            throw BadRequestException({ message: 'هذا السجل لا يتطلب قراراً بشأن الإعفاء' });
        }

        const isConsumed = decision === 'CONSUMED';
        
        return await AttendanceModel.findByIdAndUpdate(
            attendanceId,
            {
                $set: {
                    isConsumed,
                    'exemptionDecision.decision': decision,
                    'exemptionDecision.decidedBy': new mongoose.Types.ObjectId(teacherId),
                    'exemptionDecision.decidedAt': new Date()
                }
            },
            { new: true, runValidators: true }
        ).lean();
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

    // ─── Adjust attendance for a COMPLETED session (safe, idempotent, no billing side-effects) ──
    static async adjustCompletedSessionAttendance(
        sessionId: string,
        studentId: string,
        newStatus: AttendanceStatus,
        teacherId: string,
        updatedBy: string,
        notes?: string
    ) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status !== SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'هذه الدالة مخصصة لتصحيح حضور الحصص المكتملة فقط' });
        }

        if (!Object.values(AttendanceStatus).includes(newStatus)) {
            throw BadRequestException({ message: 'حالة الحضور غير صحيحة' });
        }

        const student = await StudentModel.findOne({ _id: studentId, teacherId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        let record = await AttendanceModel.findOne({ sessionId, studentId });
        const oldStatus = record ? record.status : AttendanceStatus.ABSENT;

        if (oldStatus === newStatus && record) {
            return { success: true, message: 'لم يحدث تغيير في حالة الحضور', record };
        }

        if (!record) {
            record = new AttendanceModel({
                studentId: student._id,
                sessionId: session._id,
                status: newStatus,
                type: 'SESSION',
                scannedBy: new mongoose.Types.ObjectId(updatedBy),
                scannedAt: session.date,
                isConsumed: newStatus === AttendanceStatus.ABSENT,
                ...(notes ? { notes } : {})
            });
            await record.save();
        } else {
            record.status = newStatus;
            record.scannedBy = new mongoose.Types.ObjectId(updatedBy);
            if (notes !== undefined) record.notes = notes;
            record.isConsumed = newStatus === AttendanceStatus.ABSENT;
            await record.save();
        }

        // ── Update AttendanceSnapshotModel atomically ──
        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId });
        if (snapshot) {
            // Remove from all student arrays in snapshot
            snapshot.presentStudents = snapshot.presentStudents.filter(
                s => s.studentId.toString() !== student._id.toString()
            );
            snapshot.absentStudents = snapshot.absentStudents.filter(
                s => s.studentId.toString() !== student._id.toString()
            );
            if (snapshot.guestStudents) {
                snapshot.guestStudents = snapshot.guestStudents.filter(
                    s => s.studentId.toString() !== student._id.toString()
                );
            }

            // Insert into the proper array according to newStatus
            if (newStatus === AttendanceStatus.ABSENT) {
                snapshot.absentStudents.push({
                    studentId: student._id,
                    studentName: student.studentName
                });
            } else {
                snapshot.presentStudents.push({
                    studentId: student._id,
                    studentName: student.studentName,
                    scannedAt: session.date,
                    status: newStatus
                });
            }

            snapshot.presentCount = snapshot.presentStudents.length;
            snapshot.absentCount = snapshot.absentStudents.length;
            await snapshot.save();
        }

        // ── Adjust consecutiveAbsences on StudentModel if transitioning to/from ABSENT ──
        if (oldStatus === AttendanceStatus.ABSENT && newStatus !== AttendanceStatus.ABSENT) {
            await StudentModel.findByIdAndUpdate(student._id, {
                $set: { consecutiveAbsences: Math.max(0, (student.consecutiveAbsences || 0) - 1) }
            });
        } else if (oldStatus !== AttendanceStatus.ABSENT && newStatus === AttendanceStatus.ABSENT) {
            await StudentModel.findByIdAndUpdate(student._id, {
                $inc: { consecutiveAbsences: 1 }
            });
        }

        trackEvent('attendance_adjusted', {
            tenantId: teacherId,
            userId: updatedBy,
            targetId: record._id.toString(),
            meta: {
                studentId: student._id.toString(),
                studentName: student.studentName,
                sessionId,
                oldStatus,
                newStatus
            }
        });

        // Invalidate teacher cache
        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return { success: true, message: 'تم تصحيح حالة الحضور بنجاح', record };
    }

    // ─── Delete attendance for a student from a specific session ───────────────
    static async deleteStudentSessionAttendance(
        sessionId: string,
        studentId: string,
        teacherId: string,
        deletedBy: string
    ) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const student = await StudentModel.findOne({ _id: studentId, teacherId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        const record = await AttendanceModel.findOne({ sessionId, studentId });
        const oldStatus = record ? record.status : null;

        if (record) {
            await AttendanceModel.deleteOne({ _id: record._id });
        }

        // Update AttendanceSnapshotModel atomically
        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId });
        if (snapshot) {
            snapshot.presentStudents = snapshot.presentStudents.filter(
                s => s.studentId.toString() !== student._id.toString()
            );
            snapshot.absentStudents = snapshot.absentStudents.filter(
                s => s.studentId.toString() !== student._id.toString()
            );
            if (snapshot.guestStudents) {
                snapshot.guestStudents = snapshot.guestStudents.filter(
                    s => s.studentId.toString() !== student._id.toString()
                );
            }

            snapshot.presentCount = snapshot.presentStudents.length;
            snapshot.absentCount = snapshot.absentStudents.length;
            await snapshot.save();
        }

        // Adjust consecutiveAbsences on StudentModel if the deleted record was ABSENT
        if (oldStatus === AttendanceStatus.ABSENT) {
            await StudentModel.findByIdAndUpdate(student._id, {
                $set: { consecutiveAbsences: Math.max(0, (student.consecutiveAbsences || 0) - 1) }
            });
        }

        trackEvent('attendance_deleted', {
            tenantId: teacherId,
            userId: deletedBy,
            targetId: sessionId,
            meta: {
                studentId: student._id.toString(),
                studentName: student.studentName,
                sessionId,
                oldStatus
            }
        });

        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return { success: true, message: 'تم حذف حضور الطالب من الحصة بنجاح' };
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
        const [session, teacher] = await Promise.all([
            SessionModel.findOne({ _id: sessionId, teacherId })
                .populate('groupId', 'name')
                .lean(),
            UserModel.findById(teacherId, { name: 1 }).lean(),
        ]);
            
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const groupName   = (session.groupId as any)?.name || 'مجموعة غير معروفة';
        const teacherName = teacher?.name || '';

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
            const signature = teacherName ? `\n\nمع تحيات أ/ ${teacherName}` : '';
            if (isPresent) {
                const timeStr = record?.scannedAt ? new Date(record.scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
                const PRESENT_TEMPLATES = [
                    `السلام عليكم ورحمة الله،\nنحيطكم علمًا بحضور الطالب/ة: **${student.studentName}** لحصة [${groupName}] بتاريخ ${shortDate} (وقت الوصول: ${timeStr}).\n\n📌 **الرجاء الرد بـ (تم) للتأكيد والاستلام.**${signature}`,
                    `أهلاً بحضرتك،\nتم بنجاح تسجيل حضور **${student.studentName}** لحصة اليوم [${groupName}].\n\n📌 **يرجى الرد بـ (تم) لتأكيد الاطلاع.**${signature}`,
                    `تحية طيبة،\nنود إعلامكم بتواجد الطالب/ة **${student.studentName}** في مجموعة [${groupName}] بتاريخ ${shortDate}.\n\n📌 **الرجاء الرد بكلمة (تم) للتأكيد.**\nبالتوفيق دائمًا.${signature}`,
                    `السلام عليكم،\nتم رصد حضور **${student.studentName}** في موعد الحصة اليوم [${groupName}].\n\n📌 **الرجاء الرد بـ (تم) للتأكيد.**${signature}`,
                ];
                message = PRESENT_TEMPLATES[Math.floor(Math.random() * PRESENT_TEMPLATES.length)] as string;
            } else {
                const ABSENT_TEMPLATES = [
                    `السلام عليكم ورحمة الله،\nنحيطكم علمًا بعدم حضور الطالب/ة **${student.studentName}** لحصة [${groupName}] بتاريخ ${shortDate}.\n\n📌 **الرجاء الرد بـ (تم) لتأكيد استلام الإشعار.**${signature}`,
                    `أهلاً بحضرتك يا فندم،\nحرصًا منا على متابعة مستوى **${student.studentName}**، تم تسجيل غيابه عن حصة [${groupName}] اليوم (${shortDate}). نرجو الاطمئنان عليه ومتابعة تعويض ما فاته.\n\n📌 **يرجى الرد بكلمة (تم) للتأكيد.**${signature}`,
                    `⚠️ **إشعار غياب**:\nتم تسجيل غياب الطالب/ة **${student.studentName}** عن موعد حصة [${groupName}] بتاريخ ${shortDate}.\n\n📌 **الرجاء الرد بـ (تم) لتأكيد العلم.**${signature}`,
                    `تحية طيبة وبعد،\nنود إبلاغكم بأن الطالب/ة **${student.studentName}** لم يسجل حضورًا بحصة اليوم [${groupName}].\n\n📌 **الرجاء الرد بـ (تم) للاطلاع.**${signature}`,
                    `أهلاً بحضرتك،\nنلفت انتباهكم إلى غياب **${student.studentName}** عن حصة [${groupName}] بتاريخ ${shortDate}. برجاء التأكد من سبب الغياب.\n\n📌 **يرجى الرد بـ (تم) لتأكيد المتابعة.**${signature}`,
                ];
                message = ABSENT_TEMPLATES[Math.floor(Math.random() * ABSENT_TEMPLATES.length)] as string;
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

import { StudentModel }   from '../../database/models/student.model.js';
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { CenterModel } from '../../database/models/center.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { CenterCheckInModel } from '../../database/models/center-checkin.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { SessionModel } from '../../database/models/session.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { ExamResultModel }  from '../../database/models/exam-result.model.js';
import { GroupModel }       from '../../database/models/group.model.js';
import { UserModel }        from '../../database/models/user.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { TransactionType, TransactionCategory, AttendanceStatus, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';
import { formatTimeEgypt, format24hToEgypt12h, getArabicMonthName } from '../../common/utils/date.util.js';

export class ParentService {

    static async lookupByPhone(parentPhone: string) {
        // Normalize phone: strip all whitespace, dashes, dots, and parens
        // then handle Egyptian country code (+20 or 0020 → 0)
        let phone = (parentPhone || '').replace(/[\s\-\.\(\)]/g, '').trim();
        if (!phone) throw BadRequestException({ message: 'رقم الهاتف مطلوب' });

        // Convert +20XXXXXXXXXX or 0020XXXXXXXXXX → 0XXXXXXXXXX
        if (phone.startsWith('+20')) phone = '0' + phone.slice(3);
        else if (phone.startsWith('0020')) phone = '0' + phone.slice(4);
        // If only 10 digits starting with 1 (missing leading 0) → add 0
        else if (/^1\d{9}$/.test(phone)) phone = '0' + phone;

        const last10 = phone.replace(/\D/g, '').slice(-10);
        const phoneRegex = last10.length >= 8 ? new RegExp(`${last10}$`, 'i') : phone;

        // Search both teacher students and center students
        const [students, centerStudents] = await Promise.all([
            StudentModel.find(
                { parentPhone: { $regex: phoneRegex } },
                { studentName: 1, gradeLevel: 1, groupId: 1, teacherId: 1,
                  studentCode: 1, isActive: 1, parentName: 1 }
            ).lean(),
            CenterStudentModel.find(
                { parentPhone: { $regex: phoneRegex } }
            ).lean(),
        ]);

        if (!students.length && !centerStudents.length) {
            throw NotFoundException({ message: 'لم يتم العثور على أي طالب مرتبط بهذا الرقم' });
        }

        const studentSummaries = await Promise.all(students.map(student =>
            ParentService.buildStudentSummary(student)
        ));

        const centerSummaries = await Promise.all(centerStudents.map(cs =>
            ParentService.buildCenterStudentSummary(cs)
        ));

        return [...studentSummaries, ...centerSummaries];
    }

    private static async buildStudentSummary(student: any) {
        const teacherId  = student.teacherId;
        const studentId  = student._id;

        // Group name and cycle
        const group = await GroupModel.findOne(
            { _id: student.groupId, teacherId },
            { name: 1, cycle: 1 }
        ).lean();

        // Teacher name, subject & features
        const teacher = await UserModel.findById(teacherId, { name: 1, subject: 1, features: 1 }).lean();
        const isHomeworkEnabled = Boolean((teacher as any)?.features?.homeworkTracking);

        // 1. Attendance snapshots
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': studentId },
                { 'absentStudents.studentId':  studentId },
                { 'guestStudents.studentId':   studentId },
                { 'compensatedStudents.studentId': studentId },
            ],
        }, { sessionId: 1, date: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1, compensatedStudents: 1 })
            .sort({ date: -1 })
            .lean();

        // 2. Direct attendance records
        const directAttendances = await AttendanceModel.find({ studentId })
            .populate('sessionId', 'date startTime cycleContext status')
            .sort({ createdAt: -1 })
            .lean();

        // 3. Cache session documents to obtain cycleContext & startTime
        const sessionDocMap = new Map<string, any>();
        directAttendances.forEach((a: any) => {
            if (a.sessionId && typeof a.sessionId === 'object' && a.sessionId._id) {
                sessionDocMap.set(a.sessionId._id.toString(), a.sessionId);
            }
        });

        const missingSessionIds = snapshots
            .map(s => s.sessionId ? s.sessionId.toString() : null)
            .filter((id): id is string => !!id && !sessionDocMap.has(id));

        if (missingSessionIds.length > 0) {
            const extraSessions = await SessionModel.find(
                { _id: { $in: missingSessionIds } },
                { date: 1, startTime: 1, cycleContext: 1, status: 1 }
            ).lean();
            extraSessions.forEach(s => sessionDocMap.set(s._id.toString(), s));
        }

        // Map and deduplicate by session / date (priority: PRESENT/LATE (4) > GUEST (3) > EXCUSED (2) > ABSENT (1))
        type SessionEntry = {
            sessionId?: any;
            date: Date;
            scannedAt?: Date | undefined;
            startTime?: string | undefined;
            status: string;
            homeworkDone?: boolean | null | undefined;
            priority: number;
            isGuest?: boolean | undefined;
            cycleNumber?: number | undefined;
        };

        const sessionMap = new Map<string, SessionEntry>();

        for (const snap of snapshots) {
            const sid = studentId.toString();
            const presentStudent = snap.presentStudents?.find((s: any) => s.studentId?.toString() === sid);
            const isAbsent  = snap.absentStudents?.some((s: any)  => s.studentId?.toString() === sid);
            const isGuest   = snap.guestStudents?.some((s: any)  => s.studentId?.toString() === sid);
            const isCompensated = (snap as any).compensatedStudents?.some((s: any) => s.studentId?.toString() === sid);

            let status = 'UNKNOWN';
            let priority = 0;
            let homeworkDone: boolean | null = null;
            let scannedAt: Date | undefined;

            if (isCompensated || presentStudent?.status === AttendanceStatus.EXCUSED) {
                status = 'EXCUSED';
                priority = 2;
            } else if (presentStudent) {
                status = presentStudent.status || AttendanceStatus.PRESENT;
                priority = 4;
                homeworkDone = typeof presentStudent.homeworkDone === 'boolean' ? presentStudent.homeworkDone : null;
                scannedAt = presentStudent.scannedAt;
            } else if (isGuest) {
                status = 'GUEST';
                priority = 3;
                const guestStudent = snap.guestStudents?.find((s: any) => s.studentId?.toString() === sid);
                homeworkDone = typeof guestStudent?.homeworkDone === 'boolean' ? guestStudent.homeworkDone : null;
                scannedAt = guestStudent?.scannedAt;
            } else if (isAbsent) {
                status = 'ABSENT';
                priority = 1;
            }

            if (status !== 'UNKNOWN' && snap.date) {
                const sessionKey = snap.sessionId ? snap.sessionId.toString() : (snap._id?.toString() || new Date(snap.date).toISOString().split('T')[0] || 'unknown');
                const sessionDoc = snap.sessionId ? sessionDocMap.get(snap.sessionId.toString()) : null;
                const existing = sessionMap.get(sessionKey);
                if (!existing || priority > existing.priority) {
                    sessionMap.set(sessionKey, {
                        sessionId: snap.sessionId,
                        date: snap.date,
                        scannedAt: scannedAt || existing?.scannedAt,
                        startTime: sessionDoc?.startTime,
                        cycleNumber: sessionDoc?.cycleContext?.cycleNumber,
                        status,
                        homeworkDone,
                        priority,
                        isGuest: !!isGuest || status === 'GUEST',
                    });
                }
            }
        }

        for (const att of directAttendances as any[]) {
            let status = att.status as string;
            let priority = 1;
            if (att.isGuest && att.status === AttendanceStatus.PRESENT) {
                status = 'GUEST';
                priority = 3;
            } else if (att.status === AttendanceStatus.PRESENT || att.status === AttendanceStatus.LATE) {
                status = att.status;
                priority = 4;
            } else if (att.status === AttendanceStatus.EXCUSED) {
                status = 'EXCUSED';
                priority = 2;
            } else {
                status = 'ABSENT';
                priority = 1;
            }

            const sidStr = att.sessionId ? (att.sessionId._id ? att.sessionId._id.toString() : att.sessionId.toString()) : att._id.toString();
            const sessionDoc = sessionDocMap.get(sidStr);
            const recordDate = sessionDoc?.date || att.scannedAt || att.createdAt;
            if (!recordDate) continue;

            const existing = sessionMap.get(sidStr);
            if (!existing || priority > existing.priority) {
                sessionMap.set(sidStr, {
                    sessionId: att.sessionId?._id || att.sessionId,
                    date: recordDate,
                    scannedAt: att.scannedAt || existing?.scannedAt,
                    startTime: sessionDoc?.startTime,
                    cycleNumber: sessionDoc?.cycleContext?.cycleNumber,
                    status,
                    homeworkDone: typeof att.homeworkDone === 'boolean' ? att.homeworkDone : existing?.homeworkDone,
                    priority,
                    isGuest: !!att.isGuest || status === 'GUEST',
                });
            }
        }

        const deduplicatedEntries = Array.from(sessionMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Filter out redundant EXCUSED entries if compensated by a GUEST session
        const guestCount = deduplicatedEntries.filter(e => e.status === 'GUEST' || e.isGuest).length;
        let availableGuestCredits = guestCount;

        const effectiveEntries = deduplicatedEntries.filter(e => {
            if (e.status === AttendanceStatus.EXCUSED) {
                if (availableGuestCredits > 0) {
                    availableGuestCredits--;
                    return false; // Suppress phantom compensated absence card
                }
            }
            return true;
        });

        // Group into Cycles
        const currentCycleNumber = (group as any)?.cycle?.currentCycleNumber || 1;
        const rawGroupStartedAt = (group as any)?.cycle?.startedAt;
        const cycleStartedAt = rawGroupStartedAt ? new Date(rawGroupStartedAt) : null;

        const cyclesMap = new Map<number, {
            cycleNumber: number;
            monthName: string;
            cycleLabel: string;
            isCurrent: boolean;
            startDate: Date;
            sessions: any[];
        }>();

        const chronologicalEntries = [...effectiveEntries].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        chronologicalEntries.forEach((entry) => {
            let targetCycle: number;
            if (entry.cycleNumber) {
                targetCycle = entry.cycleNumber;
            } else if (cycleStartedAt && new Date(entry.date) >= cycleStartedAt) {
                targetCycle = currentCycleNumber;
            } else {
                targetCycle = currentCycleNumber > 1 ? currentCycleNumber - 1 : 1;
            }

            let timeStr = '';
            if (entry.scannedAt) {
                timeStr = formatTimeEgypt(entry.scannedAt);
            } else if (entry.startTime) {
                timeStr = format24hToEgypt12h(entry.startTime);
            }

            if (!cyclesMap.has(targetCycle)) {
                const earliestDate = new Date(entry.date);
                const monthName = getArabicMonthName(earliestDate);
                cyclesMap.set(targetCycle, {
                    cycleNumber: targetCycle,
                    monthName,
                    cycleLabel: `دورة ${targetCycle} — شهر ${monthName}`,
                    isCurrent: targetCycle === currentCycleNumber,
                    startDate: earliestDate,
                    sessions: [],
                });
            }

            const cycleObj = cyclesMap.get(targetCycle)!;
            (entry as any).time = timeStr;
            (entry as any).cycleNumber = targetCycle;
            (entry as any).cycleMonth = cycleObj.monthName;
            (entry as any).cycleLabel = cycleObj.cycleLabel;

            cycleObj.sessions.push({
                sessionId: entry.sessionId?.toString(),
                sessionNumber: cycleObj.sessions.length + 1,
                date: entry.date,
                time: timeStr,
                status: entry.status,
                homeworkDone: isHomeworkEnabled ? (entry.homeworkDone ?? null) : null,
            });
        });

        const cyclesList = Array.from(cyclesMap.values()).map(c => {
            const pCount = c.sessions.filter(s => s.status === AttendanceStatus.PRESENT || s.status === AttendanceStatus.LATE || s.status === 'GUEST' || s.status === AttendanceStatus.EXCUSED).length;
            const aCount = c.sessions.filter(s => s.status === AttendanceStatus.ABSENT).length;
            return {
                cycleNumber: c.cycleNumber,
                monthName: c.monthName,
                cycleLabel: c.cycleLabel,
                isCurrent: c.isCurrent,
                startDate: c.startDate.toISOString(),
                totalSessions: c.sessions.length,
                presentCount: pCount,
                absentCount: aCount,
                sessions: c.sessions,
            };
        }).sort((a, b) => b.cycleNumber - a.cycleNumber);

        const presentCount = effectiveEntries.filter(
            e => e.status === AttendanceStatus.PRESENT || e.status === AttendanceStatus.LATE || e.status === 'GUEST' || e.status === AttendanceStatus.EXCUSED
        ).length;
        const absentCount  = effectiveEntries.filter(e => e.status === AttendanceStatus.ABSENT).length;

        const attendanceHistory = effectiveEntries.slice(0, 50).map(e => ({
            date: e.date,
            time: (e as any).time || (e.scannedAt ? formatTimeEgypt(e.scannedAt) : (e.startTime ? format24hToEgypt12h(e.startTime) : '')),
            status: e.status,
            homeworkDone: isHomeworkEnabled ? (e.homeworkDone ?? null) : null,
            cycleNumber: (e as any).cycleNumber,
            cycleMonth: (e as any).cycleMonth,
            cycleLabel: (e as any).cycleLabel,
        }));

        const totalSessions  = presentCount + absentCount;
        const attendanceRate = totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100)
            : 0;

        // Payments (income only, linked to student)
        const payments = await TransactionModel.find(
            { teacherId, studentId, type: TransactionType.INCOME },
            { category: 1, paidAmount: 1, discountAmount: 1, date: 1, description: 1 }
        ).sort({ date: -1 }).lean();

        const totalPaid     = payments.reduce((sum, p) => sum + p.paidAmount, 0);
        const subscriptions = payments.filter(p => 
            p.category === TransactionCategory.SUBSCRIPTION || 
            p.category === TransactionCategory.DEBT_PAYMENT
        );

        // Active subscription for current cycle?
        const currentEnrollment = await CycleEnrollmentModel.findOne({
            studentId,
            groupId: student.groupId,
            cycleNumber: currentCycleNumber,
        }).lean();

        const hasActiveSubscription = (currentEnrollment && currentEnrollment.status === CycleEnrollmentStatus.PAID)
            || (cycleStartedAt ? subscriptions.some(s => new Date(s.date) >= cycleStartedAt) : false);

        // Exam results
        const examResults = await ExamResultModel.find(
            { studentId, teacherId },
            { examId: 1, score: 1, totalMarks: 1, date: 1 }
        ).populate('examId', 'title').sort({ date: -1 }).lean();

        return {
            studentId:   studentId.toString(),
            studentName: student.studentName,
            studentCode: student.studentCode,
            gradeLevel:  student.gradeLevel,
            groupName:   group?.name ?? '—',
            teacherId:   teacherId?.toString(),
            teacherName: teacher?.name ?? '—',
            subject:     (teacher as any)?.subject ?? undefined,
            isActive:    student.isActive,
            hasActiveSubscription,
            attendance: {
                totalSessions,
                presentCount,
                absentCount,
                attendanceRate: `${attendanceRate}%`,
                history: attendanceHistory,
                cycles: cyclesList,
            },
            payments: {
                totalPaid,
                subscriptionsCount: subscriptions.length,
                lastSubscriptions:  subscriptions.slice(0, 5),
            },
            exams: examResults.slice(0, 10).map((e: any) => ({
                examId: e.examId?._id?.toString() || e.examId?.toString(),
                examName: e.examId?.title ?? 'امتحان بدون عنوان',
                score: e.score ?? null,
                totalMarks: e.totalMarks,
                date: e.date,
            })),
        };
    }

    private static async buildCenterStudentSummary(student: any) {
        const center = await CenterModel.findById(student.centerId, { name: 1 }).lean();
        const centerName = center?.name ? (center.name.trim().startsWith('سنتر') ? center.name.trim() : `سنتر ${center.name.trim()}`) : 'السنتر';

        const enrollment = await CenterEnrollmentModel.findOne({
            centerId: student.centerId,
            studentId: student._id,
            isActive: true,
        }).lean();

        let groupName = student.gradeLevel || 'السنتر';
        if (enrollment?.packageId) {
            const pkg = await CenterPackageModel.findById(enrollment.packageId, { name: 1 }).lean();
            if (pkg?.name) groupName = pkg.name;
        }

        // Attendance: gate check-ins & group attendance
        const [gateCheckIns, groupAttendances] = await Promise.all([
            CenterCheckInModel.find({
                centerId: student.centerId,
                studentId: student._id,
            }).sort({ date: -1 }).limit(50).lean(),
            CenterAttendanceModel.find({
                centerId: student.centerId,
                studentId: student._id,
            }).sort({ date: -1 }).limit(50).lean(),
        ]);

        const history: any[] = [];
        for (const c of gateCheckIns) {
            const checkInDate = c.checkInTime || c.date;
            const timeStr = c.checkInTime ? formatTimeEgypt(c.checkInTime) : '';
            const mName = getArabicMonthName(checkInDate);
            history.push({
                date: checkInDate,
                time: timeStr,
                status: 'PRESENT',
                homeworkDone: null,
                cycleNumber: new Date(checkInDate).getMonth() + 1,
                cycleMonth: mName,
                cycleLabel: `شهر ${mName}`,
                notes: timeStr ? `تسجيل حضور في تمام ${timeStr}` : 'دخول بوابة السنتر',
            });
        }
        for (const a of groupAttendances) {
            const attDate = a.scannedAt || a.date;
            const timeStr = a.scannedAt ? formatTimeEgypt(a.scannedAt) : '';
            const mName = getArabicMonthName(attDate);
            history.push({
                date: attDate,
                time: timeStr,
                status: a.status,
                homeworkDone: null,
                cycleNumber: new Date(attDate).getMonth() + 1,
                cycleMonth: mName,
                cycleLabel: `شهر ${mName}`,
                notes: timeStr ? `تسجيل حضور في تمام ${timeStr}` : 'حضور مجموعة دراسية',
            });
        }
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Group into monthly cycles for Center students
        const centerMonthMap = new Map<string, any>();
        history.forEach(h => {
            const d = new Date(h.date);
            const mKey = `${d.getFullYear()}-${d.getMonth()}`;
            const monthName = h.cycleMonth || getArabicMonthName(d);
            const cycleLabel = `شهر ${monthName}`;
            if (!centerMonthMap.has(mKey)) {
                centerMonthMap.set(mKey, {
                    cycleNumber: d.getMonth() + 1,
                    monthName,
                    cycleLabel,
                    isCurrent: true,
                    startDate: h.date,
                    sessions: [],
                });
            }
            centerMonthMap.get(mKey).sessions.push(h);
        });

        const centerCycles = Array.from(centerMonthMap.values()).map(c => ({
            cycleNumber: c.cycleNumber,
            monthName: c.monthName,
            cycleLabel: c.cycleLabel,
            isCurrent: c.isCurrent,
            startDate: new Date(c.startDate).toISOString(),
            totalSessions: c.sessions.length,
            presentCount: c.sessions.filter((s: any) => s.status === 'PRESENT' || s.status === 'LATE' || s.status === 'GUEST').length,
            absentCount: c.sessions.filter((s: any) => s.status === 'ABSENT').length,
            sessions: c.sessions,
        }));

        const presentCount = history.filter(h => h.status === 'PRESENT' || h.status === 'LATE' || h.status === 'GUEST').length;
        const absentCount = history.filter(h => h.status === 'ABSENT').length;
        const totalSessions = presentCount + absentCount;
        const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

        // Transactions
        const transactions = await TransactionModel.find({
            centerId: student.centerId,
            studentId: student._id,
        }).sort({ date: -1 }).lean();

        const totalPaid = transactions.reduce((sum, t: any) => sum + (t.paidAmount || 0), 0);
        const totalDebt = transactions.reduce((sum, t: any) => sum + (t.remainingAmount || 0), 0);
        const hasActiveSubscription = totalDebt === 0;

        return {
            studentId:   student._id.toString(),
            studentName: student.studentName,
            studentCode: student.studentCode,
            gradeLevel:  student.gradeLevel,
            groupName,
            teacherId:   undefined,
            teacherName: centerName,
            subject:     'طالب سنتر',
            isActive:    student.isActive,
            hasActiveSubscription,
            isCenter:    true,
            attendance: {
                totalSessions,
                presentCount,
                absentCount,
                attendanceRate: `${attendanceRate}%`,
                history: history.slice(0, 50),
                cycles: centerCycles,
            },
            payments: {
                totalPaid,
                subscriptionsCount: transactions.length,
                lastSubscriptions:  transactions.slice(0, 5),
            },
            exams: [],
        };
    }
}

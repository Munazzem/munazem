import { StudentModel }   from '../../database/models/student.model.js';
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { CenterModel } from '../../database/models/center.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { CenterCheckInModel } from '../../database/models/center-checkin.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { ExamResultModel }  from '../../database/models/exam-result.model.js';
import { GroupModel }       from '../../database/models/group.model.js';
import { UserModel }        from '../../database/models/user.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { TransactionType, TransactionCategory, AttendanceStatus, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';

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

        // Attendance snapshots
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': studentId },
                { 'absentStudents.studentId':  studentId },
                { 'guestStudents.studentId':   studentId },
            ],
        }, { date: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1 })
            .sort({ date: -1 })
            .lean();

        // Map and deduplicate by date (priority: PRESENT/LATE (4) > GUEST (3) > EXCUSED (2) > ABSENT (1))
        const dayMap = new Map<string, { date: Date; status: string; homeworkDone?: boolean | null; priority: number }>();

        for (const snap of snapshots) {
            const sid = studentId.toString();
            const presentStudent = snap.presentStudents?.find((s: any) => s.studentId?.toString() === sid);
            const isAbsent  = snap.absentStudents?.some((s: any)  => s.studentId?.toString() === sid);
            const isGuest   = snap.guestStudents?.some((s: any)  => s.studentId?.toString() === sid);

            let status = 'UNKNOWN';
            let priority = 0;
            let homeworkDone: boolean | null = null;

            if (presentStudent) {
                const s = presentStudent.status || AttendanceStatus.PRESENT;
                if (s === AttendanceStatus.EXCUSED) {
                    status = 'EXCUSED';
                    priority = 2;
                } else {
                    status = s; // PRESENT / LATE
                    priority = 4;
                    homeworkDone = typeof presentStudent.homeworkDone === 'boolean' ? presentStudent.homeworkDone : null;
                }
            } else if (isGuest) {
                status = 'GUEST';
                priority = 3;
                const guestStudent = snap.guestStudents?.find((s: any) => s.studentId?.toString() === sid);
                homeworkDone = typeof guestStudent?.homeworkDone === 'boolean' ? guestStudent.homeworkDone : null;
            } else if (isAbsent) {
                status = 'ABSENT';
                priority = 1;
            }

            if (status !== 'UNKNOWN') {
                const dayKey = snap.date ? (new Date(snap.date).toISOString().split('T')[0] || 'unknown') : ((snap as any)._id?.toString() || 'unknown');
                const existing = dayMap.get(dayKey);
                if (!existing || priority > existing.priority) {
                    dayMap.set(dayKey, { date: snap.date, status, homeworkDone, priority });
                }
            }
        }

        const deduplicatedEntries = Array.from(dayMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Filter out redundant EXCUSED entries if compensated by a GUEST session
        const guestCount = deduplicatedEntries.filter(e => e.status === 'GUEST').length;
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

        const presentCount = effectiveEntries.filter(
            e => e.status === AttendanceStatus.PRESENT || e.status === AttendanceStatus.LATE || e.status === 'GUEST' || e.status === AttendanceStatus.EXCUSED
        ).length;
        const absentCount  = effectiveEntries.filter(e => e.status === AttendanceStatus.ABSENT).length;
        const attendanceHistory = effectiveEntries.slice(0, 20).map(e => ({
            date: e.date,
            status: e.status,
            homeworkDone: isHomeworkEnabled ? (e.homeworkDone ?? null) : null,
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
        const subscriptions = payments.filter(p => p.category === TransactionCategory.SUBSCRIPTION);

        // Active subscription for current cycle?
        const currentCycleNumber = (group as any)?.cycle?.currentCycleNumber || 1;
        const currentEnrollment = await CycleEnrollmentModel.findOne({
            studentId,
            groupId: student.groupId,
            cycleNumber: currentCycleNumber,
        }).lean();

        const cycleStartedAt = (group as any)?.cycle?.startedAt ? new Date((group as any).cycle.startedAt) : new Date('2099-01-01');
        const hasActiveSubscription = (currentEnrollment && currentEnrollment.status === CycleEnrollmentStatus.PAID)
            || subscriptions.some(s => new Date(s.date) >= cycleStartedAt);

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
            }).sort({ date: -1 }).limit(20).lean(),
            CenterAttendanceModel.find({
                centerId: student.centerId,
                studentId: student._id,
            }).sort({ date: -1 }).limit(20).lean(),
        ]);

        const history: any[] = [];
        for (const c of gateCheckIns) {
            history.push({
                date: c.checkInTime || c.date,
                status: 'PRESENT',
                homeworkDone: null,
            });
        }
        for (const a of groupAttendances) {
            history.push({
                date: a.scannedAt || a.date,
                status: a.status,
                homeworkDone: null,
            });
        }
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
                history: history.slice(0, 20),
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

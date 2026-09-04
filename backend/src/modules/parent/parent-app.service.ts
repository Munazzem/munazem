import mongoose from 'mongoose';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { SessionModel } from '../../database/models/session.model.js';
import { ExamModel } from '../../database/models/exam.model.js';
import { CardModel } from '../../database/models/card.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { ExamResultModel } from '../../database/models/exam-result.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { ParentNotificationModel } from '../../database/models/parent-notification.model.js';
import { ParentModel } from '../../database/models/parent.model.js';
import { assertParentStudentAccess } from '../../middlewares/parent-auth.middleware.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { getPhoneSearchFilter } from './parent-auth.service.js';

export class ParentAppService {
  /**
   * Home: Global Family Overview + Child Cards with QR Code & Real Stats
   */
  static async getFamilyOverview(parentId: string) {
    const parent = await ParentModel.findById(parentId).lean();
    if (!parent) throw NotFoundException({ message: 'حساب ولي الأمر غير موجود' });

    let activeLinks = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    })
      .populate({
        path: 'studentId',
        populate: [
          { path: 'teacherId', select: 'name subject centerName' },
          { path: 'groupId', select: 'name schedule' },
        ],
      })
      .lean();

    // Auto-heal / Auto-sync: If no active links exist, look up matching students by parent.phone
    if (activeLinks.length === 0 && parent.phone) {
      const phoneFilter = getPhoneSearchFilter(parent.phone);
      const matchingStudents = await StudentModel.find(phoneFilter).lean();

      if (matchingStudents.length > 0) {
        const writes = matchingStudents.map((s) => ({
          updateOne: {
            filter: { parentId: parent._id, studentId: s._id },
            update: {
              $set: {
                status: 'ACTIVE' as const,
                verifiedVia: 'AUTO_CONFIRMED' as const,
                linkedAt: new Date(),
              },
            },
            upsert: true,
          },
        }));

        await ParentStudentModel.bulkWrite(writes as any);

        activeLinks = await ParentStudentModel.find({
          parentId: new mongoose.Types.ObjectId(parentId),
          status: 'ACTIVE',
        })
          .populate({
            path: 'studentId',
            populate: [
              { path: 'teacherId', select: 'name subject centerName' },
              { path: 'groupId', select: 'name schedule' },
            ],
          })
          .lean();
      }
    }

    const childrenMap = new Map<string, any>();
    let totalDebt = 0;
    let anyAbsenceToday = false;

    for (const link of activeLinks) {
      const student = link.studentId as any;
      if (!student || student.isActive === false) continue;

      const normalizedName = (student.studentName || '').trim();
      const teacher = student.teacherId || {};
      const group = student.groupId || {};

      totalDebt += student.totalDebt || 0;

      if (!childrenMap.has(normalizedName)) {
        // Find linked smart card if exists
        const card = await CardModel.findOne({
          studentId: student._id,
          status: 'LINKED',
        }).lean();

        const qrValue = card?.cardToken || student.barcode || student.studentCode;

        childrenMap.set(normalizedName, {
          id: student._id.toString(),
          studentName: student.studentName,
          gradeLevel: student.gradeLevel,
          studentCode: student.studentCode || '',
          barcode: student.barcode || '',
          cardNumber: card?.cardNumber || null,
          qrValue,
          subjectsCount: 0,
          subjects: [],
          attendanceRate: 100,
          latestAttendance: null,
          latestExam: null,
          financialSummary: {
            hasOutstandingDebt: false,
            remainingAmount: 0,
            hasActiveSubscription: true,
          },
        });
      }

      const child = childrenMap.get(normalizedName);
      child.subjectsCount += 1;
      child.subjects.push({
        studentId: student._id.toString(),
        teacherId: teacher._id?.toString() || '',
        teacherName: teacher.name || 'المعلم',
        subject: teacher.subject || 'مادة دراسية',
        centerName: teacher.centerName || '',
        groupName: group.name || '',
        studentCode: student.studentCode,
        barcode: student.barcode,
        financialSummary: {
          hasOutstandingDebt: (student.totalDebt || 0) > 0,
          remainingAmount: student.totalDebt || 0,
          hasActiveSubscription: !(student.totalDebt && student.totalDebt > 0),
        },
      });

      if (student.totalDebt && student.totalDebt > 0) {
        child.financialSummary.hasOutstandingDebt = true;
        child.financialSummary.remainingAmount += student.totalDebt;
        child.financialSummary.hasActiveSubscription = false;
      }
    }

    // Enrich with latest attendance, exams, and attendance rates for each child in parallel
    const childrenList = Array.from(childrenMap.values());

    await Promise.all(
      childrenList.map(async (child) => {
        // Enrich each subject with its own teacher-specific stats
        await Promise.all(
          child.subjects.map(async (subj: any) => {
            const sid = new mongoose.Types.ObjectId(subj.studentId);

            // ── Same priority logic as ReportsService & getChildAttendance ────
            // Read from both AttendanceModel (live) AND AttendanceSnapshot (completed)
            // so counts match the dashboard system exactly.
            type Entry = { date: Date; status: string; priority: number; isGuest?: boolean };
            const sessionMap = new Map<string, Entry>();

            // 1. Direct attendance records (in-progress / live sessions)
            const rawAtts = await AttendanceModel.find({ studentId: sid })
              .populate('sessionId', 'date')
              .lean() as any[];

            for (const r of rawAtts) {
              let status = r.status as string;
              let priority = 1;
              if (r.isGuest && r.status === 'PRESENT') { status = 'GUEST'; priority = 3; }
              else if (r.status === 'PRESENT' || r.status === 'LATE') { status = 'PRESENT'; priority = 4; }
              else if (r.status === 'EXCUSED') { status = 'EXCUSED'; priority = 2; }
              else { status = 'ABSENT'; priority = 1; }

              const recordDate = r.sessionId?.date || r.scannedAt || r.createdAt;
              const key = r.sessionId
                ? (r.sessionId._id?.toString() ?? r.sessionId.toString())
                : r._id.toString();

              const ex = sessionMap.get(key);
              if (!ex || priority > ex.priority) {
                sessionMap.set(key, { date: recordDate, status, priority, isGuest: !!r.isGuest });
              }
            }

            // 2. AttendanceSnapshots (completed sessions)
            const snaps = await AttendanceSnapshotModel.find({
              $or: [
                { 'presentStudents.studentId': sid },
                { 'absentStudents.studentId': sid },
                { 'guestStudents.studentId': sid },
                { 'compensatedStudents.studentId': sid },
              ],
            }, {
              date: 1, sessionId: 1,
              presentStudents: 1, absentStudents: 1,
              guestStudents: 1, compensatedStudents: 1,
            }).lean() as any[];

            const sidStr = sid.toString();
            for (const snap of snaps) {
              const presentEntry = snap.presentStudents?.find((s: any) => s.studentId?.toString() === sidStr);
              const isAbsent = snap.absentStudents?.some((s: any) => s.studentId?.toString() === sidStr);
              const isGuest = snap.guestStudents?.some((s: any) => s.studentId?.toString() === sidStr);
              const isCompensated = snap.compensatedStudents?.some((s: any) => s.studentId?.toString() === sidStr);

              let status = 'UNKNOWN';
              let priority = 0;
              if (isCompensated || presentEntry?.status === 'EXCUSED') { status = 'EXCUSED'; priority = 2; }
              else if (presentEntry) { status = 'PRESENT'; priority = 4; }
              else if (isGuest) { status = 'GUEST'; priority = 3; }
              else if (isAbsent) { status = 'ABSENT'; priority = 1; }

              if (status !== 'UNKNOWN' && snap.date) {
                const key = snap.sessionId ? snap.sessionId.toString() : snap._id?.toString() || 'snap';
                const ex = sessionMap.get(key);
                if (!ex || priority > ex.priority) {
                  sessionMap.set(key, { date: snap.date, status, priority, isGuest: ex?.isGuest || !!isGuest || status === 'GUEST' });
                }
              }
            }

            // 3. Build counts from deduplicated entries (faithful to dashboard ReportsService)
            const allEntries = Array.from(sessionMap.values());
            const guestCount = allEntries.filter(e => e.status === 'GUEST' || (e as any).isGuest).length;
            let availableGuestCredits = guestCount;
            const effectiveEntries = allEntries.filter(e => {
              if (e.status === 'EXCUSED') {
                if (availableGuestCredits > 0) {
                  availableGuestCredits--;
                  return false; // Suppress phantom compensated absence card
                }
              }
              return true;
            });

            const presAtt  = effectiveEntries.filter(e => e.status === 'PRESENT').length;
            const absAtt   = effectiveEntries.filter(e => e.status === 'ABSENT').length;
            const excAtt   = effectiveEntries.filter(e => e.status === 'EXCUSED').length;
            const guestAtt = effectiveEntries.filter(e => e.status === 'GUEST').length;
            const totalAtt = effectiveEntries.length;

            const attendedCount = presAtt + guestAtt + excAtt; // معوض = حضر تعويضاً → يُعدّ حاضراً
            subj.attendanceRate = totalAtt > 0 ? Math.round((attendedCount / totalAtt) * 100) : 0;
            subj.presentCount = presAtt;
            subj.absentCount = absAtt;
            subj.excusedCount = excAtt;
            subj.guestCount = guestAtt;
            subj.totalSessions = totalAtt;

            // Latest attendance — pick most recent from rawAtts
            const latestAtt = rawAtts.sort((a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0] as any | null;

            // Latest exam result
            const latestEx = await ExamResultModel.findOne({ studentId: sid })
              .sort({ createdAt: -1 })
              .populate('examId', 'title totalMarks')
              .lean() as any;

            if (latestAtt) {
              if (latestAtt.status === 'ABSENT') {
                anyAbsenceToday = true;
              }
              subj.latestAttendance = {
                date: latestAtt.sessionId?.date?.toISOString() || latestAtt.createdAt?.toISOString(),
                status: latestAtt.status,
                subject: subj.subject,
                teacherName: subj.teacherName,
              };
            } else {
              subj.latestAttendance = null;
            }

            if (latestEx && latestEx.examId) {
              subj.latestExam = {
                title: latestEx.examId.title,
                score: latestEx.score,
                totalMarks: latestEx.examId.totalMarks,
                date: latestEx.createdAt?.toISOString(),
                subject: subj.subject,
                teacherName: subj.teacherName,
              };
            } else {
              subj.latestExam = null;
            }
          })
        );

        // Fallback for default display (first subject or primary)
        if (child.subjects.length > 0) {
          const primary = child.subjects[0];
          child.attendanceRate = primary.attendanceRate;
          child.latestAttendance = primary.latestAttendance;
          child.latestExam = primary.latestExam;
        }
      })
    );

    const todayDate = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let healthStatus: 'ALL_GOOD' | 'NEEDS_ATTENTION' | 'UPDATES_AVAILABLE' | 'NO_DATA' = 'ALL_GOOD';
    let alertMessage = 'جميع الأبناء منتظمون في حصصهم اليوم ولا توجد تنبيهات غياب.';

    if (childrenList.length === 0) {
      healthStatus = 'NO_DATA';
      alertMessage = 'لم تقم بربط أي طالب بعد. امسح كارت الطالب للمتابعة.';
    } else if (anyAbsenceToday) {
      healthStatus = 'NEEDS_ATTENTION';
      alertMessage = 'تنبيه: تم تسجيل غياب لأحد الأبناء في حصة حديثة.';
    } else if (totalDebt > 0) {
      healthStatus = 'UPDATES_AVAILABLE';
      alertMessage = `توجد مستحقات مالية متبقية بقيمة ${totalDebt} ج.`;
    }

    return {
      parentName: parent.name || 'ولي الأمر',
      todayFormatted: todayDate,
      healthStatus,
      alertMessage,
      totalChildren: childrenList.length,
      totalOutstandingDebt: totalDebt,
      children: childrenList,
    };
  }

  /**
   * Child Details: Enrolled Subjects & Teachers
   */
  static async getChildSubjects(parentId: string, studentId: string) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    // Find all linked students sharing this child's name for this parent
    const links = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    })
      .populate({
        path: 'studentId',
        populate: [
          { path: 'teacherId', select: 'name subject centerName' },
          { path: 'groupId', select: 'name schedule' },
        ],
      })
      .lean();

    const matchingEnrollments = await Promise.all(
      links
        .map(l => l.studentId as any)
        .filter(s => s && s.studentName === baseStudent.studentName)
        .map(async (s) => {
          const card = await CardModel.findOne({
            studentId: s._id,
            status: 'LINKED',
          }).lean();

          return {
            studentId: s._id.toString(),
            teacherId: s.teacherId?._id?.toString() || '',
            teacherName: s.teacherId?.name || 'المعلم',
            subject: s.teacherId?.subject || 'مادة',
            centerName: s.teacherId?.centerName || '',
            groupId: s.groupId?._id?.toString() || '',
            groupName: s.groupId?.name || 'مجموعة',
            schedule: s.groupId?.schedule || [],
            gradeLevel: s.gradeLevel,
            studentCode: s.studentCode || '',
            barcode: s.barcode || '',
            cardNumber: card?.cardNumber || null,
            qrValue: card?.cardToken || s.barcode || s.studentCode,
          };
        })
    );

    return matchingEnrollments;
  }

  /**
   * Child Digital Smart Card (QR Code & Details)
   */
  static async getChildCard(parentId: string, studentId: string) {
    await assertParentStudentAccess(parentId, studentId);

    const student = await StudentModel.findById(studentId)
      .populate('teacherId', 'name subject centerName')
      .populate('groupId', 'name schedule')
      .lean() as any;

    if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

    const card = await CardModel.findOne({
      studentId: student._id,
      status: 'LINKED',
    }).lean();

    const qrValue = card?.cardToken || student.barcode || student.studentCode;

    return {
      studentId: student._id.toString(),
      studentName: student.studentName,
      gradeLevel: student.gradeLevel,
      studentCode: student.studentCode,
      barcode: student.barcode,
      cardNumber: card?.cardNumber || null,
      qrValue,
      teacherName: student.teacherId?.name || 'المعلم',
      subject: student.teacherId?.subject || 'مادة دراسية',
      centerName: student.teacherId?.centerName || '',
      groupName: student.groupId?.name || 'مجموعة',
    };
  }

  /**
   * Child Details: Attendance History
   * Uses identical priority logic to ReportsService so counts match the dashboard system exactly.
   * Priority: PRESENT/LATE (4) > GUEST (3) > EXCUSED (2) > ABSENT (1)
   */
  static async getChildAttendance(parentId: string, studentId: string, params?: { subjectId?: string; all?: string }) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    // Build the set of studentIds to query
    let targetStudentIds: mongoose.Types.ObjectId[] = [baseStudent._id as any];

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate('studentId', 'studentName').lean();

      targetStudentIds = links
        .map(l => l.studentId as any)
        .filter(s => s && s.studentName === baseStudent.studentName)
        .map(s => s._id);
    } else if (params?.subjectId && params.subjectId !== 'ALL' && mongoose.Types.ObjectId.isValid(params.subjectId)) {
      targetStudentIds = [new mongoose.Types.ObjectId(params.subjectId)];
    }

    // ── Same priority dedup logic as ReportsService.getStudentReport ─────────
    const sessionMap = new Map<string, {
      sessionId?: any; date: Date; status: string; priority: number;
      subject: string; teacherName: string; groupName: string; notes: string;
      isGuest?: boolean;
    }>();

    // 1. Direct attendance records
    const rawRecords = await AttendanceModel.find({ studentId: { $in: targetStudentIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({
        path: 'studentId',
        populate: [
          { path: 'teacherId', select: 'name subject' },
          { path: 'groupId', select: 'name' },
        ],
      })
      .populate('sessionId', 'date')
      .lean();

    for (const r of rawRecords as any[]) {
      const student = r.studentId || {};
      const teacher = student.teacherId || {};
      const group = student.groupId || {};

      let status: string = r.status;
      let priority = 1;
      if (r.isGuest && r.status === 'PRESENT') { status = 'GUEST'; priority = 3; }
      else if (r.status === 'PRESENT' || r.status === 'LATE') { status = 'PRESENT'; priority = 4; }
      else if (r.status === 'EXCUSED') { status = 'EXCUSED'; priority = 2; }
      else { status = 'ABSENT'; priority = 1; }

      const recordDate = r.sessionId?.date || r.scannedAt || r.createdAt;
      const sessionKey = r.sessionId
        ? (r.sessionId._id?.toString() ?? r.sessionId.toString())
        : r._id.toString();

      const existing = sessionMap.get(sessionKey);
      if (!existing || priority > existing.priority) {
        sessionMap.set(sessionKey, {
          sessionId: r.sessionId,
          date: recordDate,
          status, priority,
          subject: teacher.subject || 'مادة',
          teacherName: teacher.name || 'المعلم',
          groupName: group.name || 'مجموعة',
          notes: r.notes || '',
          isGuest: !!r.isGuest,
        });
      }
    }

    // 2. AttendanceSnapshots (completed sessions — same as ReportsService)
    const snapshots = await AttendanceSnapshotModel.find({
      $or: targetStudentIds.map(sid => ({
        $or: [
          { 'presentStudents.studentId': sid },
          { 'absentStudents.studentId': sid },
          { 'guestStudents.studentId': sid },
          { 'compensatedStudents.studentId': sid },
        ]
      }))
    }, {
      date: 1, sessionId: 1, presentStudents: 1, absentStudents: 1,
      guestStudents: 1, compensatedStudents: 1,
    }).sort({ date: -1 }).lean() as any[];

    for (const snap of snapshots) {
      for (const sid of targetStudentIds) {
        const sidStr = sid.toString();
        const presentEntry = snap.presentStudents?.find((s: any) => s.studentId?.toString() === sidStr);
        const isAbsent = snap.absentStudents?.some((s: any) => s.studentId?.toString() === sidStr);
        const guestEntry = snap.guestStudents?.find((s: any) => s.studentId?.toString() === sidStr);
        const isCompensated = snap.compensatedStudents?.some((s: any) => s.studentId?.toString() === sidStr);

        let status = 'UNKNOWN';
        let priority = 0;
        if (isCompensated || presentEntry?.status === 'EXCUSED') { status = 'EXCUSED'; priority = 2; }
        else if (presentEntry) { status = 'PRESENT'; priority = 4; }
        else if (guestEntry) { status = 'GUEST'; priority = 3; }
        else if (isAbsent) { status = 'ABSENT'; priority = 1; }

        if (status !== 'UNKNOWN' && snap.date) {
          const sessionKey = snap.sessionId ? snap.sessionId.toString() : (snap._id?.toString() || 'snap');
          const existing = sessionMap.get(sessionKey);
          if (!existing || priority > existing.priority) {
            sessionMap.set(sessionKey, {
              sessionId: snap.sessionId,
              date: snap.date,
              status, priority,
              subject: existing?.subject || 'مادة',
              teacherName: existing?.teacherName || 'المعلم',
              groupName: existing?.groupName || 'مجموعة',
              notes: existing?.notes || '',
              isGuest: existing?.isGuest || !!guestEntry || status === 'GUEST',
            });
          }
        }
      }
    }

    // 3. Filter out redundant EXCUSED entries if compensated by a GUEST session (exact same as ReportsService.getStudentReport)
    const deduplicatedEntries = Array.from(sessionMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const guestCount = deduplicatedEntries.filter(
      e => e.status === 'GUEST' || (e as any).isGuest || e.notes?.includes('زائر')
    ).length;
    let availableGuestCredits = guestCount;

    const effectiveEntries = deduplicatedEntries.filter(e => {
      if (e.status === 'EXCUSED') {
        if (availableGuestCredits > 0) {
          availableGuestCredits--;
          return false; // Suppress phantom compensated absence card
        }
      }
      return true;
    });

    return effectiveEntries.map((e, i) => ({
      id: e.sessionId?.toString() || `entry-${i}`,
      date: new Date(e.date).toISOString(),
      status: e.status,
      subject: e.subject,
      teacherName: e.teacherName,
      groupName: e.groupName,
      notes: e.notes,
    }));
  }

  /**
   * Child Details: Exam Results
   */
  static async getChildExams(parentId: string, studentId: string, params?: { subjectId?: string; all?: string }) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    let query: any = {};

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate('studentId', 'studentName').lean();

      const childStudentIds = links
        .map(l => l.studentId as any)
        .filter(s => s && s.studentName === baseStudent.studentName)
        .map(s => s._id);

      query = { studentId: { $in: childStudentIds } };
    } else if (params?.subjectId && params.subjectId !== 'ALL' && mongoose.Types.ObjectId.isValid(params.subjectId)) {
      query = {
        $or: [
          { teacherId: new mongoose.Types.ObjectId(params.subjectId) },
          { studentId: new mongoose.Types.ObjectId(params.subjectId) },
        ],
      };
    } else {
      // Isolated to this teacher's student document
      query = { studentId: baseStudent._id };
    }

    const results = await ExamResultModel.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('examId', 'title totalMarks passingMarks date')
      .populate('teacherId', 'name subject')
      .lean();

    return results.map((r: any) => {
      const exam = r.examId || {};
      const totalMarks = exam.totalMarks || 100;
      const score = r.score || 0;
      const percentage = Math.round((score / totalMarks) * 100);

      return {
        id: r._id.toString(),
        title: exam.title || 'امتحان',
        score,
        totalMarks,
        passingMarks: exam.passingMarks || 50,
        percentage,
        passed: score >= (exam.passingMarks || 50),
        date: exam.date?.toISOString() || r.createdAt?.toISOString(),
        subject: r.teacherId?.subject || 'مادة',
        teacherName: r.teacherId?.name || 'المعلم',
      };
    });
  }

  /**
   * Child Details: Financial & Cycle Breakdown
   */
  static async getChildFinancial(parentId: string, studentId: string, params?: { subjectId?: string; all?: string }) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    let targetStudents: any[] = [];

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate({
        path: 'studentId',
        populate: { path: 'teacherId', select: 'name subject' },
      }).lean();

      targetStudents = links
        .map(l => l.studentId as any)
        .filter(s => s && s.studentName === baseStudent.studentName);
    } else if (params?.subjectId && params.subjectId !== 'ALL' && mongoose.Types.ObjectId.isValid(params.subjectId)) {
      const specific = await StudentModel.findById(params.subjectId)
        .populate('teacherId', 'name subject')
        .lean();
      if (specific) targetStudents = [specific];
    } else {
      const specific = await StudentModel.findById(baseStudent._id)
        .populate('teacherId', 'name subject')
        .lean();
      if (specific) targetStudents = [specific];
    }

    const results: any[] = [];

    for (const student of targetStudents) {
      const enrollments = await CycleEnrollmentModel.find({
        studentId: student._id,
      })
        .sort({ cycleNumber: -1 })
        .limit(10)
        .lean();

      const transactions = await TransactionModel.find({
        studentId: student._id,
        type: 'INCOME',
      })
        .sort({ date: -1 })
        .limit(20)
        .lean();

      const paymentsList = transactions.map((t: any) => ({
        id: t._id.toString(),
        amount: t.paidAmount,
        date: t.date?.toISOString(),
        description: t.description || 'سداد اشتراك',
      }));

      if (enrollments.length === 0) {
        results.push({
          cycleNumber: student.cycleNumber || 1,
          cycleCapacity: student.cycleCapacity || 8,
          sessionsConsumed: student.remainingSessions ? Math.max(0, (student.cycleCapacity || 8) - student.remainingSessions) : 0,
          fullCyclePrice: student.totalDebt || 0,
          totalPaid: 0,
          remainingAmount: student.totalDebt || 0,
          status: (student.totalDebt || 0) > 0 ? 'UNPAID' : 'PAID',
          subject: (student.teacherId as any)?.subject || 'مادة',
          teacherName: (student.teacherId as any)?.name || 'المعلم',
          payments: paymentsList,
        });
      } else {
        for (const e of enrollments) {
          results.push({
            cycleNumber: e.cycleNumber,
            cycleCapacity: e.cycleCapacity || 8,
            sessionsConsumed: (e as any).sessionsConsumed || e.chargeableSessions || 0,
            fullCyclePrice: e.fullCyclePrice || 0,
            totalPaid: e.totalPaid || 0,
            remainingAmount: e.remainingAmount || 0,
            status: e.status,
            subject: (student.teacherId as any)?.subject || 'مادة',
            teacherName: (student.teacherId as any)?.name || 'المعلم',
            payments: paymentsList,
          });
        }
      }
    }

    return results;
  }

  /**
   * Notifications: In-App List
   */
  static async getNotifications(parentId: string, params?: { page?: number; limit?: number }) {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const skip = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      ParentNotificationModel.find({ parentId: new mongoose.Types.ObjectId(parentId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('studentId', 'studentName')
        .populate('teacherId', 'name subject')
        .lean(),
      ParentNotificationModel.countDocuments({
        parentId: new mongoose.Types.ObjectId(parentId),
        isRead: false,
      }),
    ]);

    return {
      notifications: notifications.map((n: any) => ({
        id: n._id.toString(),
        studentId: n.studentId?._id?.toString() || '',
        studentName: n.studentId?.studentName,
        teacherId: n.teacherId?._id?.toString() || '',
        teacherName: n.teacherId?.name,
        type: n.type,
        title: n.title,
        body: n.body,
        deepLink: n.deepLink,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt?.toISOString(),
      })),
      unreadCount,
    };
  }

  /**
   * Notifications: Mark as read
   */
  static async markNotificationRead(parentId: string, notificationId: string) {
    await ParentNotificationModel.updateOne(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        parentId: new mongoose.Types.ObjectId(parentId),
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );
  }
}

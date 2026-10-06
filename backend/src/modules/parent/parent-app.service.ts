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
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { CenterModel } from '../../database/models/center.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { CenterCheckInModel } from '../../database/models/center-checkin.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { CenterGroupModel } from '../../database/models/center-group.model.js';
import { CenterTeacherModel } from '../../database/models/center-teacher.model.js';
import { assertParentStudentAccess } from '../../middlewares/parent-auth.middleware.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { getPhoneSearchFilter } from './parent-auth.service.js';

function formatCenterName(name?: string, fallback = 'السنتر'): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (trimmed.startsWith('سنتر')) return trimmed;
  return `سنتر ${trimmed}`;
}

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
        strictPopulate: false,
        populate: [
          { path: 'teacherId', select: 'name subject centerName', strictPopulate: false },
          { path: 'groupId', select: 'name schedule', strictPopulate: false },
        ],
      })
      .lean();

    // Auto-heal / Auto-sync: If no active links exist, look up matching students by parent.phone
    if (activeLinks.length === 0 && parent.phone) {
      const phoneFilter = getPhoneSearchFilter(parent.phone);
      const [matchingStudents, matchingCenterStudents] = await Promise.all([
        StudentModel.find(phoneFilter).lean(),
        CenterStudentModel.find(phoneFilter).lean(),
      ]);

      const teacherWrites = matchingStudents.map((s) => ({
        updateOne: {
          filter: { parentId: parent._id, studentId: s._id },
          update: {
            $set: {
              studentModelType: 'Student' as const,
              status: 'ACTIVE' as const,
              verifiedVia: 'AUTO_CONFIRMED' as const,
              linkedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const centerWrites = matchingCenterStudents.map((s) => ({
        updateOne: {
          filter: { parentId: parent._id, studentId: s._id },
          update: {
            $set: {
              studentModelType: 'CenterStudent' as const,
              centerStudentId: s._id,
              centerId: s.centerId,
              status: 'ACTIVE' as const,
              verifiedVia: 'AUTO_CONFIRMED' as const,
              linkedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const writes = [...teacherWrites, ...centerWrites];
      if (writes.length > 0) {
        await ParentStudentModel.bulkWrite(writes as any);

        activeLinks = await ParentStudentModel.find({
          parentId: new mongoose.Types.ObjectId(parentId),
          status: 'ACTIVE',
        })
          .populate({
            path: 'studentId',
            strictPopulate: false,
            populate: [
              { path: 'teacherId', select: 'name subject centerName', strictPopulate: false },
              { path: 'groupId', select: 'name schedule', strictPopulate: false },
            ],
          })
          .lean();
      }
    }

    const childrenMap = new Map<string, any>();
    let totalDebt = 0;
    let anyAbsenceToday = false;

    for (const link of activeLinks) {
      let student = link.studentId as any;
      let isCenter = link.studentModelType === 'CenterStudent' || !!link.centerId || !!student?.centerId;

      if (!student || !student.studentName) {
        if (isCenter) {
          student = await CenterStudentModel.findById(link.studentId || link.centerStudentId).lean();
        } else {
          student = await StudentModel.findById(link.studentId)
            .populate({ path: 'teacherId', select: 'name subject centerName', strictPopulate: false })
            .populate({ path: 'groupId', select: 'name schedule', strictPopulate: false })
            .lean();
          if (!student) {
            student = await CenterStudentModel.findById(link.studentId).lean();
            if (student) isCenter = true;
          }
        }
      }

      if (!student || student.isActive === false || !student.studentName) continue;

      const normalizedName = (student.studentName || '').trim();

      // ── Handle Center Student ─────────────────────────────────────────────
      if (isCenter) {
        const centerId = link.centerId || student.centerId;
        const center = centerId ? await CenterModel.findById(centerId).select('name address phone').lean() : null;
        const enrollment = await CenterEnrollmentModel.findOne({
          centerId,
          studentId: student._id,
          isActive: true,
        }).lean();

        const card = await CardModel.findOne({
          centerStudentId: student._id,
          status: 'LINKED',
        }).lean();

        const lastCheckIn = await CenterCheckInModel.findOne({
          centerId,
          studentId: student._id,
        }).sort({ date: -1 }).lean();

        const transactions = await TransactionModel.find({
          centerId,
          studentId: student._id,
        }).lean();

        const totalPaid = transactions.reduce((acc, t) => acc + (t.paidAmount || 0), 0);
        const remainingAmount = transactions.reduce((acc, t) => acc + (t.remainingAmount || 0), 0);

        totalDebt += remainingAmount;
        const qrValue = card?.cardToken || student.barcode || student.studentCode;

        if (!childrenMap.has(normalizedName)) {
          let latestAttendance: any = null;
          if (lastCheckIn) {
            const timeStr = lastCheckIn.checkInTime
              ? new Date(lastCheckIn.checkInTime).toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Africa/Cairo',
                })
              : '';
            latestAttendance = {
              date: (lastCheckIn.date || lastCheckIn.checkInTime || lastCheckIn.createdAt)?.toISOString(),
              status: 'PRESENT',
              subject: 'حضور بالسنتر',
              teacherName: formatCenterName(center?.name),
              sessionTitle: `دخول بوابة السنتر${timeStr ? ` (${timeStr})` : ''}`,
            };
          }

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
            latestAttendance,
            latestExam: null,
            financialSummary: {
              hasOutstandingDebt: remainingAmount > 0,
              remainingAmount,
              hasActiveSubscription: remainingAmount <= 0,
            },
            isCenter: true,
            centerName: center?.name || '',
          });
        }

        const child = childrenMap.get(normalizedName);
        let addedSubj = false;

        if (enrollment?.packageId) {
          const pkg = await CenterPackageModel.findById(enrollment.packageId)
            .populate('teachers.teacherId', 'name subject')
            .lean();

          if (pkg && pkg.teachers && pkg.teachers.length > 0) {
            for (const t of pkg.teachers) {
              const tch = t.teacherId as any;
              child.subjectsCount += 1;
              child.subjects.push({
                studentId: student._id.toString(),
                teacherId: tch?._id?.toString() || '',
                teacherName: tch?.name || 'مدرس الباقة',
                subject: tch?.subject || 'مادة دراسية',
                centerName: formatCenterName(center?.name),
                groupName: pkg.name || 'باقة السنتر',
                studentCode: student.studentCode,
                barcode: student.barcode,
                financialSummary: {
                  hasOutstandingDebt: remainingAmount > 0,
                  remainingAmount,
                  hasActiveSubscription: remainingAmount <= 0,
                },
                isCenter: true,
              });
              addedSubj = true;
            }
          }
        }

        if (enrollment?.privateTeachers && enrollment.privateTeachers.length > 0) {
          for (const pt of enrollment.privateTeachers) {
            const tch = pt.centerTeacherId
              ? await CenterTeacherModel.findById(pt.centerTeacherId).select('name subject').lean()
              : null;
            child.subjectsCount += 1;
            child.subjects.push({
              studentId: student._id.toString(),
              teacherId: (tch as any)?._id?.toString() || '',
              teacherName: (tch as any)?.name || 'المعلم',
              subject: (tch as any)?.subject || 'مادة دراسية',
              centerName: formatCenterName(center?.name),
              groupName: 'مجموعة خاصة',
              studentCode: student.studentCode,
              barcode: student.barcode,
              financialSummary: {
                hasOutstandingDebt: remainingAmount > 0,
                remainingAmount,
                hasActiveSubscription: remainingAmount <= 0,
              },
              isCenter: true,
            });
            addedSubj = true;
          }
        }

        if (!addedSubj) {
          child.subjectsCount += 1;
          child.subjects.push({
            studentId: student._id.toString(),
            teacherId: '',
            teacherName: formatCenterName(center?.name),
            subject: 'طالب سنتر عام',
            centerName: formatCenterName(center?.name),
            groupName: student.gradeLevel || 'السنتر',
            studentCode: student.studentCode,
            barcode: student.barcode,
            financialSummary: {
              hasOutstandingDebt: remainingAmount > 0,
              remainingAmount,
              hasActiveSubscription: remainingAmount <= 0,
            },
            isCenter: true,
          });
        }

        if (remainingAmount > 0) {
          child.financialSummary.hasOutstandingDebt = true;
          child.financialSummary.remainingAmount = Math.max(child.financialSummary.remainingAmount, remainingAmount);
          child.financialSummary.hasActiveSubscription = false;
        }

        continue;
      }

      // ── Handle Regular Teacher Student ────────────────────────────────────
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
            if (subj.isCenter) return;
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

        // Fallback for default display (first subject or primary) for teacher students
        if (!child.isCenter && child.subjects.length > 0) {
          const primary = child.subjects[0];
          child.attendanceRate = primary.attendanceRate;
          child.latestAttendance = primary.latestAttendance;
          child.latestExam = primary.latestExam;
        }
      })
    );

    const todayDate = new Date().toLocaleDateString('ar-EG', {
      timeZone: 'Africa/Cairo',
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

    const [baseStudent, baseCenterStudent] = await Promise.all([
      StudentModel.findById(studentId).lean(),
      CenterStudentModel.findById(studentId).lean(),
    ]);

    if (!baseStudent && !baseCenterStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    if (baseCenterStudent) {
      const center = await CenterModel.findById(baseCenterStudent.centerId).select('name').lean();
      const enrollment = await CenterEnrollmentModel.findOne({
        centerId: baseCenterStudent.centerId,
        studentId: baseCenterStudent._id,
        isActive: true,
      }).lean();

      const card = await CardModel.findOne({
        centerStudentId: baseCenterStudent._id,
        status: 'LINKED',
      }).lean();

      const subjects: any[] = [];

      if (enrollment?.packageId) {
        const pkg = await CenterPackageModel.findById(enrollment.packageId)
          .populate('teachers.teacherId', 'name subject')
          .lean();

        const packageGroups = await CenterGroupModel.find({
          _id: { $in: enrollment.packageGroups || [] },
        }).lean();

        if (pkg && pkg.teachers) {
          for (const t of pkg.teachers) {
            const tch = t.teacherId as any;
            const grp = packageGroups.find((g) => {
              const gTid = typeof g.centerTeacherId === 'object' ? (g.centerTeacherId as any)._id : g.centerTeacherId;
              return gTid?.toString() === tch?._id?.toString();
            });

            subjects.push({
              studentId: baseCenterStudent._id.toString(),
              teacherId: tch?._id?.toString() || '',
              teacherName: tch?.name || 'مدرس الباقة',
              subject: tch?.subject || 'مادة دراسية',
              centerName: formatCenterName(center?.name),
              groupId: grp?._id?.toString() || '',
              groupName: grp?.name || pkg.name || 'باقة السنتر',
              schedule: grp?.schedule || [],
              gradeLevel: baseCenterStudent.gradeLevel,
              studentCode: baseCenterStudent.studentCode || '',
              barcode: baseCenterStudent.barcode || '',
              cardNumber: card?.cardNumber || null,
              qrValue: card?.cardToken || baseCenterStudent.barcode || baseCenterStudent.studentCode,
              isCenter: true,
            });
          }
        }
      }

      if (enrollment?.privateTeachers && enrollment.privateTeachers.length > 0) {
        for (const pt of enrollment.privateTeachers) {
          const tch = pt.centerTeacherId
            ? await CenterTeacherModel.findById(pt.centerTeacherId).select('name subject').lean()
            : null;
          const grp = pt.groupId ? await CenterGroupModel.findById(pt.groupId).select('name schedule').lean() : null;

          subjects.push({
            studentId: baseCenterStudent._id.toString(),
            teacherId: (tch as any)?._id?.toString() || '',
            teacherName: (tch as any)?.name || 'المعلم',
            subject: (tch as any)?.subject || 'مادة دراسية',
            centerName: formatCenterName(center?.name),
            groupId: (grp as any)?._id?.toString() || '',
            groupName: (grp as any)?.name || 'مجموعة خاصة',
            schedule: (grp as any)?.schedule || [],
            gradeLevel: baseCenterStudent.gradeLevel,
            studentCode: baseCenterStudent.studentCode || '',
            barcode: baseCenterStudent.barcode || '',
            cardNumber: card?.cardNumber || null,
            qrValue: card?.cardToken || baseCenterStudent.barcode || baseCenterStudent.studentCode,
            isCenter: true,
          });
        }
      }

      if (subjects.length === 0) {
        subjects.push({
          studentId: baseCenterStudent._id.toString(),
          teacherId: '',
          teacherName: formatCenterName(center?.name),
          subject: 'طالب سنتر عام',
          centerName: formatCenterName(center?.name),
          groupId: '',
          groupName: baseCenterStudent.gradeLevel || 'السنتر',
          schedule: [],
          gradeLevel: baseCenterStudent.gradeLevel,
          studentCode: baseCenterStudent.studentCode || '',
          barcode: baseCenterStudent.barcode || '',
          cardNumber: card?.cardNumber || null,
          qrValue: card?.cardToken || baseCenterStudent.barcode || baseCenterStudent.studentCode,
          isCenter: true,
        });
      }

      return subjects;
    }

    // Find all linked students sharing this child's name for this parent
    const links = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    })
      .populate({
        path: 'studentId',
        strictPopulate: false,
        populate: [
          { path: 'teacherId', select: 'name subject centerName', strictPopulate: false },
          { path: 'groupId', select: 'name schedule', strictPopulate: false },
        ],
      })
      .lean();

    const matchingEnrollments = await Promise.all(
      links
        .map(async (l) => {
          let s = l.studentId as any;
          if (!s || !s.studentName) {
            s = await StudentModel.findById(l.studentId)
              .populate('teacherId', 'name subject centerName')
              .populate('groupId', 'name schedule')
              .lean();
          }
          return s;
        })
    );
    const validStudents = (matchingEnrollments.filter(Boolean) as any[])
      .filter(s => s && s.studentName === baseStudent!.studentName);

    const enrollments = await Promise.all(
      validStudents
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

    const [student, centerStudent] = await Promise.all([
      StudentModel.findById(studentId)
        .populate('teacherId', 'name subject centerName')
        .populate('groupId', 'name schedule')
        .lean() as any,
      CenterStudentModel.findById(studentId).lean(),
    ]);

    if (!student && !centerStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    if (centerStudent) {
      const center = await CenterModel.findById(centerStudent.centerId).select('name').lean();
      const card = await CardModel.findOne({
        centerStudentId: centerStudent._id,
        status: 'LINKED',
      }).lean();

      const qrValue = card?.cardToken || centerStudent.barcode || centerStudent.studentCode;

      return {
        studentId: centerStudent._id.toString(),
        studentName: centerStudent.studentName,
        gradeLevel: centerStudent.gradeLevel,
        studentCode: centerStudent.studentCode,
        barcode: centerStudent.barcode,
        cardNumber: card?.cardNumber || null,
        qrValue,
        teacherName: formatCenterName(center?.name),
        subject: 'طالب سنتر',
        centerName: formatCenterName(center?.name),
        groupName: centerStudent.gradeLevel,
        isCenter: true,
      };
    }

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

    const [baseStudent, baseCenterStudent] = await Promise.all([
      StudentModel.findById(studentId).lean(),
      CenterStudentModel.findById(studentId).lean(),
    ]);

    if (!baseStudent && !baseCenterStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    if (baseCenterStudent) {
      const center = await CenterModel.findById(baseCenterStudent.centerId).select('name').lean();
      const centerName = formatCenterName(center?.name);

      // 1. Gate check-ins
      const gateCheckIns = await CenterCheckInModel.find({
        centerId: baseCenterStudent.centerId,
        studentId: baseCenterStudent._id,
      })
        .sort({ date: -1, checkInTime: -1 })
        .limit(100)
        .lean();

      // 2. Class attendance in center groups
      const groupAttendances = await CenterAttendanceModel.find({
        centerId: baseCenterStudent.centerId,
        studentId: baseCenterStudent._id,
      })
        .sort({ date: -1 })
        .limit(100)
        .populate({
          path: 'groupId',
          select: 'name centerTeacherId',
          populate: { path: 'centerTeacherId', select: 'name subject' },
        })
        .lean();

      const combined: any[] = [];

      for (const checkIn of gateCheckIns) {
        const checkInDate = checkIn.checkInTime || checkIn.date;
        const timeStr = checkIn.checkInTime
          ? new Date(checkIn.checkInTime).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Cairo',
            })
          : '';

        combined.push({
          id: checkIn._id.toString(),
          date: new Date(checkInDate).toISOString(),
          status: 'PRESENT',
          subject: 'دخول السنتر (البوابة)',
          teacherName: centerName,
          groupName: `بوابة السنتر (${checkIn.source || 'QR_SCAN'})`,
          notes: timeStr ? `تم تسجيل الحضور في تمام ${timeStr}` : (checkIn.notes || 'تسجيل دخول السنتر'),
        });
      }

      for (const att of groupAttendances as any[]) {
        const grp = att.groupId || {};
        const tch = grp.centerTeacherId || {};

        let status = att.status;
        if (status === 'PRESENT' || status === 'LATE') status = 'PRESENT';
        else if (status === 'EXCUSED') status = 'EXCUSED';
        else status = 'ABSENT';

        combined.push({
          id: att._id.toString(),
          date: new Date(att.scannedAt || att.date).toISOString(),
          status,
          subject: tch.subject || 'مادة دراسية',
          teacherName: tch.name || 'مدرس المادة',
          groupName: grp.name || 'مجموعة دراسية',
          notes: att.notes || (att.source === 'GATE_CHECKIN' ? 'تسجيل تلقائي عبر البوابة' : ''),
        });
      }

      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return combined.slice(0, 100);
    }

    // Build the set of studentIds to query
    let targetStudentIds: mongoose.Types.ObjectId[] = [baseStudent!._id as any];

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate('studentId', 'studentName').lean();

      const populatedStudents = await Promise.all(
        links.map(async (l) => {
          let s = l.studentId as any;
          if (!s || !s.studentName) {
            s = await StudentModel.findById(l.studentId).select('studentName').lean();
          }
          return s;
        })
      );

      targetStudentIds = populatedStudents
        .filter(s => s && s.studentName === baseStudent!.studentName)
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

    const [baseStudent, baseCenterStudent] = await Promise.all([
      StudentModel.findById(studentId).lean(),
      CenterStudentModel.findById(studentId).lean(),
    ]);

    if (!baseStudent && !baseCenterStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    if (baseCenterStudent) {
      return [];
    }

    let query: any = {};

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate('studentId', 'studentName').lean();

      const populatedStudents = await Promise.all(
        links.map(async (l) => {
          let s = l.studentId as any;
          if (!s || !s.studentName) {
            s = await StudentModel.findById(l.studentId).select('studentName').lean();
          }
          return s;
        })
      );

      const childStudentIds = populatedStudents
        .filter(s => s && s.studentName === baseStudent!.studentName)
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
      query = { studentId: baseStudent!._id };
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

    const [baseStudent, baseCenterStudent] = await Promise.all([
      StudentModel.findById(studentId).lean(),
      CenterStudentModel.findById(studentId).lean(),
    ]);

    if (!baseStudent && !baseCenterStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    if (baseCenterStudent) {
      const center = await CenterModel.findById(baseCenterStudent.centerId).select('name').lean();
      const enrollment = await CenterEnrollmentModel.findOne({
        centerId: baseCenterStudent.centerId,
        studentId: baseCenterStudent._id,
        isActive: true,
      }).lean();

      const transactions = await TransactionModel.find({
        centerId: baseCenterStudent.centerId,
        studentId: baseCenterStudent._id,
      })
        .sort({ date: -1 })
        .lean();

      const payments = transactions.map((t: any) => ({
        id: t._id.toString(),
        amount: t.paidAmount || 0,
        discount: t.discountAmount || 0,
        date: t.date?.toISOString() || t.createdAt?.toISOString(),
        description: t.description || (t.category === 'CENTER_PACKAGE' ? 'اشتراك باقة سنتر' : 'سداد بالسنتر'),
      }));

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalDiscount = payments.reduce((sum, p) => sum + p.discount, 0);
      const totalDebt = transactions.reduce((sum: number, t: any) => sum + (t.remainingAmount || 0), 0);

      let fullPrice = totalPaid + totalDiscount + totalDebt;
      if (enrollment?.packageMonthlyPrice && enrollment.packageMonthlyPrice > fullPrice) {
        fullPrice = enrollment.packageMonthlyPrice;
      }

      return [
        {
          cycleNumber: 1,
          cycleCapacity: 1,
          sessionsConsumed: 1,
          fullCyclePrice: fullPrice,
          totalPaid,
          totalDiscount,
          settledAmount: totalPaid + totalDiscount,
          remainingAmount: totalDebt,
          status: totalDebt > 0 ? 'UNPAID' : 'PAID',
          subject: enrollment?.packageId ? 'باقة السنتر الشهرية' : 'اشتراك السنتر',
          teacherName: formatCenterName(center?.name, 'إدارة السنتر'),
          payments,
        },
      ];
    }

    let targetStudents: any[] = [];

    if (params?.all === 'true') {
      const links = await ParentStudentModel.find({
        parentId: new mongoose.Types.ObjectId(parentId),
        status: 'ACTIVE',
      }).populate({
        path: 'studentId',
        strictPopulate: false,
        populate: { path: 'teacherId', select: 'name subject', strictPopulate: false },
      }).lean();

      const populatedStudents = await Promise.all(
        links.map(async (l) => {
          let s = l.studentId as any;
          if (!s || !s.studentName) {
            s = await StudentModel.findById(l.studentId)
              .populate('teacherId', 'name subject')
              .lean();
          }
          return s;
        })
      );

      targetStudents = populatedStudents
        .filter(s => s && s.studentName === baseStudent!.studentName);
    } else if (params?.subjectId && params.subjectId !== 'ALL' && mongoose.Types.ObjectId.isValid(params.subjectId)) {
      const specific = await StudentModel.findById(params.subjectId)
        .populate('teacherId', 'name subject')
        .lean();
      if (specific) targetStudents = [specific];
    } else {
      const specific = await StudentModel.findById(baseStudent!._id)
        .populate('teacherId', 'name subject')
        .lean();
      if (specific) targetStudents = [specific];
    }

    const results: any[] = [];

    for (const student of targetStudents) {
      const enrollments = await CycleEnrollmentModel.find({
        studentId: student._id,
        isWaived: { $ne: true },
        $or: [
          { cycleCharge: { $gt: 0 } },
          { totalPaid: { $gt: 0 } }
        ]
      })
        .sort({ cycleNumber: -1 })
        .limit(10)
        .lean();

      const transactions = await TransactionModel.find({
        studentId: student._id,
        type: 'INCOME',
      })
        .sort({ date: -1 })
        .limit(50)
        .lean();

      if (enrollments.length === 0) {
        const unassignedPayments = transactions.map((t: any) => ({
          id: t._id.toString(),
          amount: t.paidAmount || 0,
          discount: t.discountAmount || 0,
          date: t.date?.toISOString(),
          description: t.description || 'سداد اشتراك',
        }));
        const totalDiscount = unassignedPayments.reduce((s: number, p: any) => s + (p.discount || 0), 0);
        const totalPaid = unassignedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);

        results.push({
          cycleNumber: student.cycleNumber || 1,
          cycleCapacity: student.cycleCapacity || 8,
          sessionsConsumed: student.remainingSessions ? Math.max(0, (student.cycleCapacity || 8) - student.remainingSessions) : 0,
          fullCyclePrice: student.totalDebt || 0,
          totalPaid,
          totalDiscount,
          settledAmount: totalPaid + totalDiscount,
          remainingAmount: student.totalDebt || 0,
          status: (student.totalDebt || 0) > 0 ? 'UNPAID' : 'PAID',
          subject: (student.teacherId as any)?.subject || 'مادة',
          teacherName: (student.teacherId as any)?.name || 'المعلم',
          payments: unassignedPayments,
        });
      } else {
        const assignedTxIds = new Set<string>();

        const studentCycleRecords = enrollments.map((e) => {
          const cyclePayments = transactions
            .filter((t: any) => t.cycleNumber != null && t.cycleNumber === e.cycleNumber)
            .map((t: any) => {
              assignedTxIds.add(t._id.toString());
              return {
                id: t._id.toString(),
                amount: t.paidAmount || 0,
                discount: t.discountAmount || 0,
                date: t.date?.toISOString(),
                description: t.description || 'سداد اشتراك',
              };
            });

          const cycleTotalDiscount = cyclePayments.reduce((s, p) => s + (p.discount || 0), 0);
          // In CycleEnrollmentModel, totalPaid tracks settled portion (paidAmount + discountAmount)
          // Actual cash paid = settled amount minus discounts
          const actualPaid = Math.max(0, (e.totalPaid || 0) - cycleTotalDiscount);

          return {
            cycleNumber: e.cycleNumber,
            cycleCapacity: e.cycleCapacity || 8,
            sessionsConsumed: (e as any).sessionsConsumed || e.chargeableSessions || 0,
            fullCyclePrice: e.fullCyclePrice || 0,
            totalPaid: actualPaid,
            totalDiscount: cycleTotalDiscount,
            settledAmount: e.totalPaid || 0,
            remainingAmount: e.remainingAmount || 0,
            status: e.status,
            subject: (student.teacherId as any)?.subject || 'مادة',
            teacherName: (student.teacherId as any)?.name || 'المعلم',
            payments: cyclePayments,
          };
        });

        // Attach unassigned/legacy transactions (without cycleNumber) to the latest cycle
        const unassigned = transactions.filter((t: any) => !assignedTxIds.has(t._id.toString()));
        const latestCycle = studentCycleRecords[0];
        if (unassigned.length > 0 && latestCycle) {
          const unassignedPayments = unassigned.map((t: any) => ({
            id: t._id.toString(),
            amount: t.paidAmount || 0,
            discount: t.discountAmount || 0,
            date: t.date?.toISOString(),
            description: t.description || 'سداد اشتراك',
          }));
          latestCycle.payments.push(...unassignedPayments);
          const unassignedDiscount = unassignedPayments.reduce((s, p) => s + (p.discount || 0), 0);
          latestCycle.totalDiscount = (latestCycle.totalDiscount || 0) + unassignedDiscount;
        }

        results.push(...studentCycleRecords);
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
        studentId: n.studentId?._id?.toString() || (n.studentId ? n.studentId.toString() : ''),
        studentName: n.studentId?.studentName,
        teacherId: n.teacherId?._id?.toString() || (n.teacherId ? n.teacherId.toString() : ''),
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

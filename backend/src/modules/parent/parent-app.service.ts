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
        const childStudentIds = child.subjects.map(
          (s: any) => new mongoose.Types.ObjectId(s.studentId)
        );

        // 1. Attendance counts and latest attendance in parallel
        const [totalAttendances, presentAttendances, latestAttendanceRecord, latestExamResult] =
          await Promise.all([
            AttendanceModel.countDocuments({
              studentId: { $in: childStudentIds },
            }),
            AttendanceModel.countDocuments({
              studentId: { $in: childStudentIds },
              status: { $in: ['PRESENT', 'LATE'] },
            }),
            AttendanceModel.findOne({
              studentId: { $in: childStudentIds },
            })
              .sort({ createdAt: -1 })
              .populate({
                path: 'studentId',
                populate: { path: 'teacherId', select: 'name subject' },
              })
              .populate('sessionId', 'date')
              .lean() as any,
            ExamResultModel.findOne({
              studentId: { $in: childStudentIds },
            })
              .sort({ createdAt: -1 })
              .populate('examId', 'title totalMarks')
              .populate('teacherId', 'subject name')
              .lean() as any,
          ]);

        if (totalAttendances > 0) {
          child.attendanceRate = Math.round(
            (presentAttendances / totalAttendances) * 100
          );
        }

        if (latestAttendanceRecord) {
          const attStudent = latestAttendanceRecord.studentId || {};
          const attTeacher = attStudent.teacherId || {};
          if (latestAttendanceRecord.status === 'ABSENT') {
            anyAbsenceToday = true;
          }
          child.latestAttendance = {
            date:
              latestAttendanceRecord.sessionId?.date?.toISOString() ||
              latestAttendanceRecord.createdAt?.toISOString(),
            status: latestAttendanceRecord.status,
            subject: attTeacher.subject || 'حصة دراسية',
            teacherName: attTeacher.name || '',
          };
        }

        if (latestExamResult && latestExamResult.examId) {
          child.latestExam = {
            title: latestExamResult.examId.title,
            score: latestExamResult.score,
            totalMarks: latestExamResult.examId.totalMarks,
            date: latestExamResult.createdAt?.toISOString(),
            subject: latestExamResult.teacherId?.subject || 'امتحان',
            teacherName: latestExamResult.teacherId?.name || '',
          };
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
   */
  static async getChildAttendance(parentId: string, studentId: string, params?: { subjectId?: string }) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    // Find all sibling student IDs for this child across subjects
    const links = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    }).populate('studentId', 'studentName').lean();

    const childStudentIds = links
      .map(l => l.studentId as any)
      .filter(s => s && s.studentName === baseStudent.studentName)
      .map(s => s._id);

    const query: any = { studentId: { $in: childStudentIds } };

    if (params?.subjectId && params.subjectId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(params.subjectId)) {
        query.$or = [
          { studentId: new mongoose.Types.ObjectId(params.subjectId) },
        ];
      }
    }

    const records = await AttendanceModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({
        path: 'studentId',
        populate: [
          { path: 'teacherId', select: 'name subject' },
          { path: 'groupId', select: 'name' },
        ],
      })
      .populate('sessionId', 'date')
      .lean();

    return records.map((r: any) => {
      const student = r.studentId || {};
      const teacher = student.teacherId || {};
      const group = student.groupId || {};

      return {
        id: r._id.toString(),
        date: r.sessionId?.date?.toISOString() || r.scannedAt?.toISOString() || r.createdAt?.toISOString(),
        status: r.status,
        subject: teacher.subject || 'مادة',
        teacherName: teacher.name || 'المعلم',
        groupName: group.name || 'مجموعة',
        notes: r.notes || '',
      };
    });
  }

  /**
   * Child Details: Exam Results
   */
  static async getChildExams(parentId: string, studentId: string, params?: { subjectId?: string }) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    const links = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    }).populate('studentId', 'studentName').lean();

    const childStudentIds = links
      .map(l => l.studentId as any)
      .filter(s => s && s.studentName === baseStudent.studentName)
      .map(s => s._id);

    const query: any = { studentId: { $in: childStudentIds } };

    if (params?.subjectId && params.subjectId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(params.subjectId)) {
        query.$or = [
          { teacherId: new mongoose.Types.ObjectId(params.subjectId) },
          { studentId: new mongoose.Types.ObjectId(params.subjectId) },
        ];
      }
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
  static async getChildFinancial(parentId: string, studentId: string) {
    await assertParentStudentAccess(parentId, studentId);

    const baseStudent = await StudentModel.findById(studentId).lean();
    if (!baseStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

    const links = await ParentStudentModel.find({
      parentId: new mongoose.Types.ObjectId(parentId),
      status: 'ACTIVE',
    }).populate({
      path: 'studentId',
      populate: { path: 'teacherId', select: 'name subject' },
    }).lean();

    const matchingStudents = links
      .map(l => l.studentId as any)
      .filter(s => s && s.studentName === baseStudent.studentName);

    const results: any[] = [];

    for (const student of matchingStudents) {
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

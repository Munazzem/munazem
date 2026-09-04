import mongoose from 'mongoose';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../database/models/parent-notification.model.js';
import { ParentModel } from '../../database/models/parent.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { ParentNotificationType } from '../../types/parent.types.js';
import { logger } from '../../common/utils/logger.util.js';
import { normalizePhone } from './parent-auth.service.js';

// ── Expo Push API endpoint ─────────────────────────────────────────────────────
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Expo Push Message type ─────────────────────────────────────────────────────
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// ── Deep link builder ──────────────────────────────────────────────────────────
function buildDeepLink(studentId: string, tab: 'attendance' | 'exams' | 'financial'): string {
  return `monazem://child/${studentId}?tab=${tab}`;
}

// ── Resolve Teacher Signature Info with Subject ─────────────────────────────
interface TeacherSigInfo {
  cleanName: string;
  cleanSubject: string;
  teacherSig: string;
}

async function resolveTeacherSigInfo(
  teacherId: string,
  teacherName?: string,
  subject?: string
): Promise<TeacherSigInfo> {
  let cleanName = (teacherName || '').trim();
  let cleanSubject = (subject || '').trim();

  const match = cleanName.match(/^(.*?)\s*\((.*?)\)$/);
  if (match && match[1]) {
    cleanName = match[1].trim();
    if (!cleanSubject && match[2]) cleanSubject = match[2].trim();
  }
  cleanName = cleanName.replace(/^(أ\/|أ\.|الأستاذ\/|الأستاذ\s+)/, '').trim();

  if (!cleanSubject && teacherId) {
    try {
      const teacher = await UserModel.findById(teacherId, { name: 1, subject: 1 }).lean();
      if (teacher) {
        if (!cleanName && (teacher as any).name) {
          cleanName = (teacher as any).name.replace(/^(أ\/|أ\.|الأستاذ\/|الأستاذ\s+)/, '').trim();
        }
        if ((teacher as any).subject) {
          cleanSubject = (teacher as any).subject.trim();
        }
      }
    } catch {
      // ignore
    }
  }

  const teacherSig = cleanName
    ? (cleanSubject ? `أ/ ${cleanName} (${cleanSubject})` : `أ/ ${cleanName}`)
    : '';

  return { cleanName, cleanSubject, teacherSig };
}

// ── Send messages to Expo Push API ────────────────────────────────────────────
async function sendExpoMessages(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.warn('expo_push_http_error', { status: resp.status, body: text });
      return [];
    }

    const json = (await resp.json()) as { data: ExpoPushTicket[] };
    return json.data ?? [];
  } catch (err) {
    logger.warn('expo_push_fetch_error', { err });
    return [];
  }
}

// ── Deactivate invalid push tokens ────────────────────────────────────────────
async function deactivateInvalidTokens(
  tokens: string[],
  tickets: ExpoPushTicket[]
): Promise<void> {
  const invalidTokens: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered'
    ) {
      const token = tokens[idx];
      if (token !== undefined) invalidTokens.push(token);
    }
  });

  if (invalidTokens.length === 0) return;

  await ParentDeviceModel.updateMany(
    { fcmToken: { $in: invalidTokens } },
    { $set: { fcmToken: null } }
  );

  logger.info('expo_push_invalid_tokens_cleared', { count: invalidTokens.length });
}

// ── Core push delivery for a single parent ────────────────────────────────────
async function deliverToParent(
  parentId: string,
  message: Omit<ExpoPushMessage, 'to'>
): Promise<void> {
  // Get active devices with a valid Expo push token
  const devices = await ParentDeviceModel.find({
    parentId: new mongoose.Types.ObjectId(parentId),
    isActive: true,
    fcmToken: { $ne: null, $exists: true },
  })
    .select('fcmToken')
    .lean();

  if (devices.length === 0) return;

  const validTokens = devices
    .map((d) => d.fcmToken as string)
    .filter((t) => t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')));

  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    ...message,
  }));

  const tickets = await sendExpoMessages(messages);
  await deactivateInvalidTokens(validTokens, tickets);
}

// ── Find all parents linked to a student ─────────────────────────────────────
async function getParentsForStudent(studentId: string): Promise<string[]> {
  let links = await ParentStudentModel.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'ACTIVE',
  })
    .select('parentId')
    .lean();

  if (links.length > 0) {
    return links.map((l) => l.parentId.toString());
  }

  // Fallback: look up student parentPhone and auto-link matching registered parent
  try {
    const student = await StudentModel.findById(studentId, { parentPhone: 1 }).lean();
    if (student?.parentPhone) {
      const normalized = normalizePhone(student.parentPhone);
      const digits = normalized.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10.length >= 8) {
        const parents = await ParentModel.find({
          phone: { $regex: new RegExp(`${last10}$`, 'i') },
        }, { _id: 1 }).lean();

        if (parents.length > 0) {
          const writes = parents.map((p) => ({
            updateOne: {
              filter: { parentId: p._id, studentId: new mongoose.Types.ObjectId(studentId) },
              update: {
                $set: {
                  status: 'ACTIVE',
                  verifiedVia: 'AUTO_CONFIRMED',
                  linkedAt: new Date(),
                },
              },
              upsert: true,
            },
          }));
          await ParentStudentModel.bulkWrite(writes as any).catch(() => {});
          return parents.map((p) => p._id.toString());
        }
      }
    }
  } catch (err) {
    logger.warn('get_parents_fallback_error', { err, studentId });
  }

  return [];
}

// ── Save in-app notification (idempotent) ─────────────────────────────────────
async function saveInAppNotification(params: {
  parentId: string;
  studentId: string;
  teacherId: string;
  type: ParentNotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, any>;
  eventId: string;
}): Promise<void> {
  try {
    await ParentNotificationModel.create({
      parentId: new mongoose.Types.ObjectId(params.parentId),
      studentId: new mongoose.Types.ObjectId(params.studentId),
      teacherId: new mongoose.Types.ObjectId(params.teacherId),
      type: params.type,
      title: params.title,
      body: params.body,
      deepLink: params.deepLink,
      data: params.data ?? {},
      eventId: params.eventId,
    });
  } catch (err: any) {
    // Duplicate eventId — notification already saved, safe to ignore
    if (err.code !== 11000) {
      logger.warn('parent_notification_save_error', { err });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
export class ParentPushService {
  /**
   * Notify parents when a student's attendance is recorded.
   * Fires-and-forgets — never throws so it cannot break the attendance flow.
   */
  static notifyAttendance(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    sessionDate: Date;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    isGuest?: boolean;
  }): void {
    // Resolve parents asynchronously — completely non-blocking
    setImmediate(() => {
      ParentPushService._sendAttendance(params).catch((err) =>
        logger.warn('parent_push_attendance_error', { err })
      );
    });
  }

  private static async _sendAttendance(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    sessionDate: Date;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    isGuest?: boolean;
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const { studentId, studentName, sessionDate, status, isGuest } = params;
    const { cleanName, teacherSig } = await resolveTeacherSigInfo(
      params.teacherId,
      params.teacherName,
      params.subject
    );
    const teacherDisplay = cleanName ? `أ/ ${cleanName}` : (params.teacherName || '');
    const signature = teacherSig ? `\nمع تحيات: ${teacherSig}` : '';

    // ── Build notification content ─────────────────────────────────────────
    const dateStr = new Date(sessionDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let title: string;
    let body: string;
    let notificationType: ParentNotificationType;

    if (isGuest && (status === 'PRESENT' || status === 'LATE')) {
      notificationType = ParentNotificationType.ATTENDANCE_PRESENT;
      title = `${studentName} — حاضر كزائر 🔄`;
      body = `سُجِّل حضور ${studentName} اليوم كزائر في حصة ${teacherDisplay}.${signature}`;
    } else if (status === 'PRESENT' || status === 'LATE') {
      notificationType = ParentNotificationType.ATTENDANCE_PRESENT;
      const statusLabel = status === 'LATE' ? 'حاضر (متأخر)' : 'حاضر ✓';
      title = `${studentName} — ${statusLabel}`;
      body = `سُجِّل حضور ${studentName} في حصة ${teacherDisplay} بتاريخ ${dateStr}.${signature}`;
    } else if (status === 'ABSENT') {
      notificationType = ParentNotificationType.ATTENDANCE_ABSENT;
      title = `${studentName} — غائب ⚠️`;
      body = `سُجِّل غياب ${studentName} عن حصة ${teacherDisplay} بتاريخ ${dateStr}. يرجى المتابعة.${signature}`;
    } else {
      // EXCUSED / COMPENSATED
      notificationType = ParentNotificationType.ATTENDANCE_PRESENT;
      title = `${studentName} — تم تعويض الغياب 🔄`;
      body = `تم تسجيل غياب ${studentName} كمعوّض عن حصة ${teacherDisplay} بتاريخ ${dateStr}.${signature}`;
    }

    const deepLink = buildDeepLink(studentId, 'attendance');
    const sessionDateObj = new Date(sessionDate);
    const datePart = !isNaN(sessionDateObj.getTime())
      ? sessionDateObj.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const eventId = `attendance:${studentId}:${params.teacherId}:${datePart}:${status}${isGuest ? ':guest' : ''}`;
    const pushData = { deepLink, studentId, tab: 'attendance', status, isGuest };

    // ── Send to all parents in parallel ───────────────────────────────────
    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        await saveInAppNotification({
          parentId,
          studentId,
          teacherId: params.teacherId,
          type: notificationType,
          title,
          body,
          deepLink,
          data: pushData,
          eventId: `${eventId}:${parentId}`,
        });

        await deliverToParent(parentId, { title, body, data: pushData });
      })
    );

    logger.info('parent_push_attendance_sent', {
      studentId,
      status,
      isGuest,
      parentCount: parentIds.length,
    });
  }

  /**
   * Notify parents when a student's past missed session has been compensated.
   * Fires-and-forgets — non-blocking.
   */
  static notifyCompensation(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    missedSessionDate: Date;
    hostGroupName?: string;
  }): void {
    setImmediate(() => {
      ParentPushService._sendCompensation(params).catch((err) =>
        logger.warn('parent_push_compensation_error', { err })
      );
    });
  }

  private static async _sendCompensation(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    missedSessionDate: Date;
    hostGroupName?: string;
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const { studentId, studentName, missedSessionDate } = params;
    const { cleanName, teacherSig } = await resolveTeacherSigInfo(
      params.teacherId,
      params.teacherName,
      params.subject
    );
    const teacherDisplay = cleanName ? `أ/ ${cleanName}` : (params.teacherName || '');
    const signature = teacherSig ? `\nمع تحيات: ${teacherSig}` : '';

    const dateStr = new Date(missedSessionDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const title = `${studentName} — تم تعويض الغياب بنجاح 🔄`;
    const body = `تم تعويض حصة الغياب لـ ${studentName} في ${teacherDisplay} (حصة يوم ${dateStr}) بعد حضوره كزائر.${signature}`;

    const deepLink = buildDeepLink(studentId, 'attendance');
    const sessionDateObj = new Date(missedSessionDate);
    const datePart = !isNaN(sessionDateObj.getTime())
      ? sessionDateObj.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const eventId = `compensation:${studentId}:${params.teacherId}:${datePart}`;
    const pushData = { deepLink, studentId, tab: 'attendance', status: 'EXCUSED' };

    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        await saveInAppNotification({
          parentId,
          studentId,
          teacherId: params.teacherId,
          type: ParentNotificationType.ATTENDANCE_PRESENT,
          title,
          body,
          deepLink,
          data: pushData,
          eventId: `${eventId}:${parentId}`,
        });

        await deliverToParent(parentId, { title, body, data: pushData });
      })
    );

    logger.info('parent_push_compensation_sent', {
      studentId,
      parentCount: parentIds.length,
    });
  }

  /**
   * Notify parents when an exam result is recorded for a student.
   * Fires-and-forgets — never throws so it cannot break the exam flow.
   */
  static notifyExamResult(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    examTitle: string;
    examId: string;
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    grade: string;
    examDate: Date;
  }): void {
    setImmediate(() => {
      ParentPushService._sendExamResult(params).catch((err) =>
        logger.warn('parent_push_exam_error', { err })
      );
    });
  }

  private static async _sendExamResult(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    subject?: string;
    examTitle: string;
    examId: string;
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    grade: string;
    examDate: Date;
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const {
      studentId,
      studentName,
      examTitle,
      examId,
      score,
      totalMarks,
      percentage,
      passed,
      grade,
    } = params;

    const { cleanName, teacherSig } = await resolveTeacherSigInfo(
      params.teacherId,
      params.teacherName,
      params.subject
    );
    const teacherDisplay = cleanName ? `أ/ ${cleanName}` : (params.teacherName || '');
    const signature = teacherSig ? `\nمع تحيات: ${teacherSig}` : '';

    const resultEmoji = passed ? '✅' : '❌';
    const title = `${studentName} — نتيجة ${examTitle} ${resultEmoji}`;
    const body = `حصل ${studentName} على ${score}/${totalMarks} — تقدير ${grade} — ${passed ? 'ناجح' : 'راسب'} في اختبار ${teacherDisplay}.${signature}`;

    const deepLink = buildDeepLink(studentId, 'exams');
    const eventId = `exam_result:${examId}:${studentId}`;
    const pushData = { deepLink, studentId, tab: 'exams', examId, passed, grade };

    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        await saveInAppNotification({
          parentId,
          studentId,
          teacherId: params.teacherId,
          type: ParentNotificationType.EXAM_RESULT,
          title,
          body,
          deepLink,
          data: pushData,
          eventId: `${eventId}:${parentId}`,
        });

        await deliverToParent(parentId, { title, body, data: pushData });
      })
    );

    logger.info('parent_push_exam_sent', {
      studentId,
      examId,
      passed,
      parentCount: parentIds.length,
    });
  }
}

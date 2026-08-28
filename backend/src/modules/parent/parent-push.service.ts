import mongoose from 'mongoose';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../database/models/parent-notification.model.js';
import { ParentNotificationType } from '../../types/parent.types.js';
import { logger } from '../../common/utils/logger.util.js';

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
  const links = await ParentStudentModel.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'ACTIVE',
  })
    .select('parentId')
    .lean();

  return links.map((l) => l.parentId.toString());
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
    sessionDate: Date;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
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
    sessionDate: Date;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const { studentId, studentName, teacherName, sessionDate, status } = params;

    // ── Build notification content ─────────────────────────────────────────
    const dateStr = new Date(sessionDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    let title: string;
    let body: string;
    let notificationType: ParentNotificationType;

    if (status === 'PRESENT' || status === 'LATE') {
      notificationType = ParentNotificationType.ATTENDANCE_PRESENT;
      const statusLabel = status === 'LATE' ? 'حاضر (متأخر)' : 'حاضر ✓';
      title = `${studentName} — ${statusLabel}`;
      body = `سُجِّل حضور ${studentName} في حصة ${teacherName} بتاريخ ${dateStr}.`;
    } else if (status === 'ABSENT') {
      notificationType = ParentNotificationType.ATTENDANCE_ABSENT;
      title = `${studentName} — غائب ⚠️`;
      body = `سُجِّل غياب ${studentName} عن حصة ${teacherName} بتاريخ ${dateStr}. يرجى المتابعة.`;
    } else {
      // EXCUSED — not critical, skip push but still save in-app
      notificationType = ParentNotificationType.ATTENDANCE_PRESENT;
      title = `${studentName} — غياب معذور`;
      body = `تم تعذير غياب ${studentName} عن حصة ${teacherName} بتاريخ ${dateStr}.`;
    }

    const deepLink = buildDeepLink(studentId, 'attendance');
    const eventId = `attendance:${studentId}:${params.teacherId}:${sessionDate.toISOString().split('T')[0]}:${status}`;
    const pushData = { deepLink, studentId, tab: 'attendance', status };

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
      teacherName,
      examTitle,
      examId,
      score,
      totalMarks,
      percentage,
      passed,
      grade,
    } = params;

    const resultEmoji = passed ? '✅' : '❌';
    const title = `${studentName} — نتيجة ${examTitle} ${resultEmoji}`;
    const body = `حصل ${studentName} على ${score}/${totalMarks} (${percentage}%) — تقدير ${grade} — ${passed ? 'ناجح' : 'راسب'} في اختبار ${teacherName}.`;

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

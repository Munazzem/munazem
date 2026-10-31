import mongoose from 'mongoose';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../database/models/parent-notification.model.js';
import { ParentModel } from '../../database/models/parent.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { TeacherMessageModel } from '../../database/models/teacher-message.model.js';
import { ParentNotificationType } from '../../types/parent.types.js';
import { logger } from '../../common/utils/logger.util.js';
import { normalizePhone } from './parent-auth.service.js';
import { formatTimeEgypt, formatDateEgypt, format24hToEgypt12h } from '../../common/utils/date.util.js';

// ── Expo Push API endpoint ─────────────────────────────────────────────────────
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Expo Push Message type ─────────────────────────────────────────────────────
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// ── Token validation helper ────────────────────────────────────────────────────
export function isValidExpoPushToken(token: any): boolean {
  return (
    typeof token === 'string' &&
    /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token.trim())
  );
}

// ── Status label helper (Arabic) ──────────────────────────────────────────────
export function formatAttendanceStatusArabic(status: string): string {
  switch (status) {
    case 'PRESENT': return 'حاضر';
    case 'LATE': return 'حاضر (متأخر)';
    case 'ABSENT': return 'غائب';
    case 'EXCUSED': return 'مُستأذن';
    default: return status;
  }
}

// ── Deep link builder ──────────────────────────────────────────────────────────
export function buildDeepLink(studentId: string, tab: 'attendance' | 'exams' | 'financial'): string {
  return `monazem://child/${studentId}?tab=${tab}`;
}

// ── Resolve Teacher Signature Info with Subject ─────────────────────────────
export interface TeacherSigInfo {
  cleanName: string;
  cleanSubject: string;
  teacherSig: string;
}

export async function resolveTeacherSigInfo(
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

// ── Pure Content Builder for Attendance Notifications ─────────────────────────
export type AttendanceNotificationKind =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'GUEST'
  | 'GUEST_COMPENSATED'
  | 'EXCUSED'
  | 'COMPENSATED_ADVANCE'
  | 'CORRECTION';

export interface BuildAttendanceContentParams {
  kind: AttendanceNotificationKind;
  studentName: string;
  teacherSig?: string | undefined;
  groupName?: string | undefined;
  sessionDate: Date | string;
  scannedAt?: Date | string | null | undefined;
  startTime?: string | undefined;
  relatedGroupName?: string | undefined;
  relatedDate?: Date | string | undefined;
  oldStatus?: string | undefined;
  newStatus?: string | undefined;
}

export function buildAttendanceContent(params: BuildAttendanceContentParams): {
  title: string;
  body: string;
  notificationType: ParentNotificationType;
} {
  const teacherText = params.teacherSig || 'المدرس';
  const groupText = params.groupName ? ` — مجموعة [${params.groupName}]` : '';
  const dateStr = formatDateEgypt(params.sessionDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = params.scannedAt ? formatTimeEgypt(params.scannedAt) : '';
  const startTimeStr = params.startTime ? format24hToEgypt12h(params.startTime) : '';
  const relDateStr = params.relatedDate
    ? formatDateEgypt(params.relatedDate, { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const relGroupText = params.relatedGroupName ? ` في مجموعة [${params.relatedGroupName}]` : '';

  switch (params.kind) {
    case 'PRESENT':
      return {
        title: `${params.studentName} — حاضر ✓`,
        body: `تم تسجيل حضور ${params.studentName} بحصة ${teacherText}${groupText}${timeStr ? ` في تمام الساعة ${timeStr}` : ''}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'LATE':
      return {
        title: `${params.studentName} — حاضر (متأخر) ⏰`,
        body: `تم تسجيل حضور ${params.studentName} (متأخر) بحصة ${teacherText}${groupText}${timeStr ? ` — وقت الوصول: ${timeStr}` : ''}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'ABSENT':
      return {
        title: `${params.studentName} — غائب ⚠️`,
        body: `نحيطكم علماً بغياب ${params.studentName} عن حصة ${teacherText}${groupText} اليوم ${dateStr}${startTimeStr ? ` (موعد الحصة: ${startTimeStr})` : ''}. يرجى المتابعة.`,
        notificationType: ParentNotificationType.ATTENDANCE_ABSENT,
      };

    case 'GUEST':
      return {
        title: `${params.studentName} — حاضر كزائر 🔄`,
        body: `سُجِّل حضور ${params.studentName} كزائر بحصة ${teacherText}${groupText}${timeStr ? ` في تمام الساعة ${timeStr}` : ''}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'GUEST_COMPENSATED':
      return {
        title: `${params.studentName} — حاضر كزائر (تعويض غياب) 🔄`,
        body: `سُجِّل حضور ${params.studentName} كزائر بحصة ${teacherText}${groupText}${timeStr ? ` في تمام الساعة ${timeStr}` : ''}، كتعويض عن غيابه بحصة ${relDateStr ? `يوم ${relDateStr}` : 'سابقة'}${relGroupText}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'EXCUSED':
      return {
        title: `${params.studentName} — مُستأذن 📝`,
        body: `تم تسجيل إذن غياب للطالب ${params.studentName} عن حصة ${teacherText}${groupText} بتاريخ ${dateStr}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'COMPENSATED_ADVANCE':
      return {
        title: `${params.studentName} — معوّض مسبقاً 🔄`,
        body: `نحيطكم علماً بأن الطالب ${params.studentName} معوّض مسبقاً لحصة ${teacherText}${groupText}، بحضوره كزائر بتاريخ ${relDateStr || dateStr}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };

    case 'CORRECTION': {
      const newStatusLabel = formatAttendanceStatusArabic(params.newStatus || 'PRESENT');
      const oldStatusLabel = formatAttendanceStatusArabic(params.oldStatus || 'ABSENT');
      const notifType =
        params.newStatus === 'ABSENT'
          ? ParentNotificationType.ATTENDANCE_ABSENT
          : ParentNotificationType.ATTENDANCE_PRESENT;
      return {
        title: `[تصحيح] ${params.studentName} — ${newStatusLabel}`,
        body: `نحيطكم علماً بتصحيح حالة الطالب ${params.studentName} بحصة ${teacherText}${groupText} إلى (${newStatusLabel}) بدلاً من (${oldStatusLabel}).`,
        notificationType: notifType,
      };
    }

    default:
      return {
        title: `${params.studentName} — تسجيل الحضور`,
        body: `تم تسجيل حالة الحضور للطالب ${params.studentName} بحصة ${teacherText}${groupText}.`,
        notificationType: ParentNotificationType.ATTENDANCE_PRESENT,
      };
  }
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
    .filter(isValidExpoPushToken);

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
    let parentPhone: string | undefined;
    let studentModelType: 'Student' | 'CenterStudent' = 'Student';

    const student = await StudentModel.findById(studentId, { parentPhone: 1 }).lean();
    if (student?.parentPhone) {
      parentPhone = student.parentPhone;
    } else {
      const centerStudent = await CenterStudentModel.findById(studentId, { parentPhone: 1 }).lean();
      if (centerStudent?.parentPhone) {
        parentPhone = centerStudent.parentPhone;
        studentModelType = 'CenterStudent';
      }
    }

    if (parentPhone) {
      const normalized = normalizePhone(parentPhone);
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
                  studentModelType,
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

// ── Save in-app notification (idempotent, returns boolean indicating whether created) ──
async function saveInAppNotificationSafe(params: {
  parentId: string;
  studentId: string;
  teacherId?: string;
  centerId?: string;
  type: ParentNotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, any>;
  eventId: string;
}): Promise<boolean> {
  try {
    const docData: any = {
      parentId: new mongoose.Types.ObjectId(params.parentId),
      studentId: new mongoose.Types.ObjectId(params.studentId),
      type: params.type,
      title: params.title,
      body: params.body,
      deepLink: params.deepLink,
      data: params.data ?? {},
      eventId: params.eventId,
    };
    if (params.teacherId && mongoose.Types.ObjectId.isValid(params.teacherId)) {
      docData.teacherId = new mongoose.Types.ObjectId(params.teacherId);
    }
    if (params.centerId && mongoose.Types.ObjectId.isValid(params.centerId)) {
      docData.centerId = new mongoose.Types.ObjectId(params.centerId);
    }

    await ParentNotificationModel.create(docData);
    return true;
  } catch (err: any) {
    // Duplicate eventId — notification already saved, safe to ignore
    if (err.code !== 11000) {
      logger.warn('parent_notification_save_error', { err });
    }
    return false;
  }
}

// ── Backward-compatible helper for legacy callers ──────────────────────────────
async function saveInAppNotification(params: {
  parentId: string;
  studentId: string;
  teacherId?: string;
  centerId?: string;
  type: ParentNotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, any>;
  eventId: string;
}): Promise<void> {
  await saveInAppNotificationSafe(params);
}

// ── Batch interfaces ──────────────────────────────────────────────────────────
export interface SessionAttendanceItem {
  studentId: string;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  kind: AttendanceNotificationKind;
  scannedAt?: Date | string | null | undefined;
  homeworkDone?: boolean | null | undefined;
  relatedSessionId?: string | mongoose.Types.ObjectId | undefined;
  relatedGroupName?: string | undefined;
  relatedDate?: Date | string | undefined;
  notes?: string | undefined;
}

export interface NotifySessionAttendanceBatchParams {
  sessionId: string;
  teacherId: string;
  teacherName?: string | undefined;
  subject?: string | undefined;
  groupName?: string | undefined;
  sessionDate: Date | string;
  startTime?: string | undefined;
  items: SessionAttendanceItem[];
}

export interface NotifyAttendanceCorrectionParams {
  sessionId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName?: string | undefined;
  subject?: string | undefined;
  groupName?: string | undefined;
  sessionDate: Date | string;
  oldStatus: string;
  newStatus: string;
  rev: number;
  actualScannedAt?: Date | string | null | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
export class ParentPushService {
  /**
   * Unified batch sender called upon session completion.
   * Completely non-blocking (fire-and-forget).
   */
  static notifySessionAttendanceBatch(params: NotifySessionAttendanceBatchParams): void {
    setImmediate(() => {
      ParentPushService._sendSessionAttendanceBatch(params).catch((err) =>
        logger.warn('parent_push_session_batch_error', { err, sessionId: params.sessionId })
      );
    });
  }

  /**
   * Internal implementation of batch attendance notifications.
   * Public for testing.
   */
  static async _sendSessionAttendanceBatch(
    params: NotifySessionAttendanceBatchParams
  ): Promise<{ insertedCount: number; pushCount: number }> {
    if (!params.items || params.items.length === 0) {
      return { insertedCount: 0, pushCount: 0 };
    }

    const { sessionId, teacherId, groupName, sessionDate, startTime, items } = params;

    // 1. Resolve teacher info
    const { cleanName, cleanSubject, teacherSig } = await resolveTeacherSigInfo(
      teacherId,
      params.teacherName,
      params.subject
    );

    // 2. Fetch parents for all students in one bulk query
    const studentObjectIds = Array.from(new Set(items.map((i) => i.studentId)))
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const activeLinks = await ParentStudentModel.find({
      studentId: { $in: studentObjectIds },
      status: 'ACTIVE',
    })
      .select('studentId parentId')
      .lean();

    const studentToParentIdsMap = new Map<string, string[]>();
    for (const link of activeLinks) {
      const sid = link.studentId.toString();
      const list = studentToParentIdsMap.get(sid) || [];
      list.push(link.parentId.toString());
      studentToParentIdsMap.set(sid, list);
    }

    // Fallback: auto-link any students missing parents
    const missingStudentIds = items
      .map((i) => i.studentId)
      .filter((id) => !studentToParentIdsMap.has(id));

    if (missingStudentIds.length > 0) {
      for (const sid of missingStudentIds) {
        const pids = await getParentsForStudent(sid);
        if (pids.length > 0) {
          studentToParentIdsMap.set(sid, pids);
        }
      }
    }

    // 3. Collect all unique parent ObjectIds and fetch devices in one query
    const allParentIdStrings = Array.from(
      new Set(Array.from(studentToParentIdsMap.values()).flat())
    );

    if (allParentIdStrings.length === 0) {
      return { insertedCount: 0, pushCount: 0 };
    }

    const parentObjectIds = allParentIdStrings
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const devices = await ParentDeviceModel.find({
      parentId: { $in: parentObjectIds },
      isActive: true,
      fcmToken: { $ne: null, $exists: true },
    })
      .select('parentId fcmToken')
      .lean();

    const parentToTokensMap = new Map<string, string[]>();
    for (const d of devices) {
      const pid = d.parentId.toString();
      const token = (d.fcmToken as string || '').trim();
      if (isValidExpoPushToken(token)) {
        const tokens = parentToTokensMap.get(pid) || [];
        if (!tokens.includes(token)) {
          tokens.push(token);
          parentToTokensMap.set(pid, tokens);
        }
      }
    }

    // 4. Build in-app notification docs with deterministic eventId
    const notificationDocs: any[] = [];
    const docMetaMap = new Map<string, { studentId: string; status: string }>();

    for (const item of items) {
      const parentIds = studentToParentIdsMap.get(item.studentId) || [];
      if (parentIds.length === 0) continue;

      const { title, body, notificationType } = buildAttendanceContent({
        kind: item.kind,
        studentName: item.studentName,
        teacherSig,
        groupName,
        sessionDate,
        scannedAt: item.scannedAt,
        startTime,
        relatedGroupName: item.relatedGroupName,
        relatedDate: item.relatedDate,
      });

      const deepLink = buildDeepLink(item.studentId, 'attendance');
      const pushData = {
        deepLink,
        studentId: item.studentId,
        sessionId,
        tab: 'attendance',
        kind: item.kind,
        status: item.status,
        scannedAt: item.scannedAt ? new Date(item.scannedAt).toISOString() : null,
        sessionDate: new Date(sessionDate).toISOString(),
        startTime: startTime || null,
        teacherName: cleanName,
        subject: cleanSubject,
        groupName: groupName || null,
        isGuest: item.kind === 'GUEST' || item.kind === 'GUEST_COMPENSATED',
        isCorrection: false,
        relatedGroupName: item.relatedGroupName || null,
        relatedDate: item.relatedDate ? new Date(item.relatedDate).toISOString() : null,
      };

      for (const parentId of parentIds) {
        const eventId = `attendance:${sessionId}:${item.studentId}:r0`;
        const docKey = `${parentId}:${eventId}`;
        docMetaMap.set(docKey, { studentId: item.studentId, status: item.status });

        notificationDocs.push({
          parentId: new mongoose.Types.ObjectId(parentId),
          studentId: new mongoose.Types.ObjectId(item.studentId),
          teacherId: new mongoose.Types.ObjectId(teacherId),
          type: notificationType,
          title,
          body,
          deepLink,
          data: pushData,
          eventId,
        });
      }
    }

    if (notificationDocs.length === 0) {
      return { insertedCount: 0, pushCount: 0 };
    }

    // 5. Atomic insert with duplicate key handling
    let insertedDocs: any[] = [];
    try {
      insertedDocs = (await ParentNotificationModel.insertMany(notificationDocs, {
        ordered: false,
      })) as any[];
    } catch (err: any) {
      if (err.insertedDocs && Array.isArray(err.insertedDocs) && err.insertedDocs.length > 0) {
        insertedDocs = err.insertedDocs;
      } else if (err.writeErrors && Array.isArray(err.writeErrors)) {
        const failedIndices = new Set(err.writeErrors.map((e: any) => e.index));
        insertedDocs = notificationDocs.filter((_, idx) => !failedIndices.has(idx));
      } else {
        logger.warn('parent_notifications_insert_many_partial_failure', {
          code: err.code,
          message: err.message,
        });
      }
    }

    if (insertedDocs.length === 0) {
      return { insertedCount: 0, pushCount: 0 };
    }

    // 6. Update parentNotify on AttendanceModel for students whose notifications were actually inserted
    const studentIdsWithInsertedNotif = new Set(
      insertedDocs.map((d: any) => d.studentId?.toString()).filter(Boolean)
    );

    const attendanceUpdates = items
      .filter((item) => studentIdsWithInsertedNotif.has(item.studentId))
      .map((item) => ({
        updateOne: {
          filter: {
            sessionId: new mongoose.Types.ObjectId(sessionId),
            studentId: new mongoose.Types.ObjectId(item.studentId),
          },
          update: {
            $set: {
              'parentNotify.status': item.status,
              'parentNotify.rev': 0,
              'parentNotify.sentAt': new Date(),
            },
          },
        },
      }));

    if (attendanceUpdates.length > 0) {
      await AttendanceModel.bulkWrite(attendanceUpdates).catch((err) => {
        logger.warn('parent_notify_attendance_update_error', { err });
      });
    }

    // 7. Dispatch push notifications ONLY for insertedDocs
    const pushMessages: ExpoPushMessage[] = [];
    const tokensInMessages: string[] = [];

    for (const doc of insertedDocs) {
      const parentIdStr = doc.parentId?.toString();
      if (!parentIdStr) continue;
      const tokens = parentToTokensMap.get(parentIdStr) || [];
      for (const token of tokens) {
        pushMessages.push({
          to: token,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          title: doc.title,
          body: doc.body,
          data: doc.data,
        });
        tokensInMessages.push(token);
      }
    }

    // 8. Chunk into Expo batches of 100 max with isolated try/catch
    const BATCH_SIZE = 100;
    for (let i = 0; i < pushMessages.length; i += BATCH_SIZE) {
      const chunkMessages = pushMessages.slice(i, i + BATCH_SIZE);
      const chunkTokens = tokensInMessages.slice(i, i + BATCH_SIZE);
      try {
        const tickets = await sendExpoMessages(chunkMessages);
        await deactivateInvalidTokens(chunkTokens, tickets);
      } catch (batchErr) {
        logger.warn('expo_push_batch_send_error', { batchErr, offset: i });
      }
    }

    logger.info('parent_push_session_batch_sent', {
      sessionId,
      itemsCount: items.length,
      notificationsInserted: insertedDocs.length,
      pushMessagesCount: pushMessages.length,
    });

    return { insertedCount: insertedDocs.length, pushCount: pushMessages.length };
  }

  /**
   * Correction notification sender called upon adjusting a completed session.
   * Completely non-blocking (fire-and-forget).
   */
  static notifyAttendanceCorrection(params: NotifyAttendanceCorrectionParams): void {
    setImmediate(() => {
      ParentPushService._sendAttendanceCorrection(params).catch((err) =>
        logger.warn('parent_push_correction_error', { err, studentId: params.studentId })
      );
    });
  }

  /**
   * Internal implementation of correction notification.
   * Public for testing.
   */
  static async _sendAttendanceCorrection(
    params: NotifyAttendanceCorrectionParams
  ): Promise<{ insertedCount: number; pushCount: number }> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return { insertedCount: 0, pushCount: 0 };

    const { cleanName, cleanSubject, teacherSig } = await resolveTeacherSigInfo(
      params.teacherId,
      params.teacherName,
      params.subject
    );

    const { title, body, notificationType } = buildAttendanceContent({
      kind: 'CORRECTION',
      studentName: params.studentName,
      teacherSig,
      groupName: params.groupName,
      sessionDate: params.sessionDate,
      scannedAt: params.actualScannedAt,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
    });

    const deepLink = buildDeepLink(params.studentId, 'attendance');
    const pushData = {
      deepLink,
      studentId: params.studentId,
      sessionId: params.sessionId,
      tab: 'attendance',
      kind: 'CORRECTION',
      status: params.newStatus,
      oldStatus: params.oldStatus,
      isCorrection: true,
      rev: params.rev,
      teacherName: cleanName,
      subject: cleanSubject,
      groupName: params.groupName || null,
      sessionDate: new Date(params.sessionDate).toISOString(),
      scannedAt: params.actualScannedAt ? new Date(params.actualScannedAt).toISOString() : null,
    };

    const eventId = `attendance:${params.sessionId}:${params.studentId}:r${params.rev}`;
    let insertedCount = 0;
    let pushCount = 0;

    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        const inserted = await saveInAppNotificationSafe({
          parentId,
          studentId: params.studentId,
          teacherId: params.teacherId,
          type: notificationType,
          title,
          body,
          deepLink,
          data: pushData,
          eventId,
        });

        if (inserted) {
          insertedCount++;
          await deliverToParent(parentId, { title, body, data: pushData });
          pushCount++;
        }
      })
    );

    logger.info('parent_push_correction_sent', {
      studentId: params.studentId,
      rev: params.rev,
      insertedCount,
      pushCount,
    });

    return { insertedCount, pushCount };
  }

  /**
   * Notify parents when a student enters the center gate.
   * Fires-and-forgets — non-blocking.
   */
  static notifyCenterCheckIn(params: {
    studentId: string;
    studentName: string;
    centerId: string;
    centerName: string;
    checkInTime?: Date;
    source?: string;
  }): void {
    setImmediate(() => {
      ParentPushService._sendCenterCheckIn(params).catch((err) =>
        logger.warn('parent_push_center_checkin_error', { err })
      );
    });
  }

  private static async _sendCenterCheckIn(params: {
    studentId: string;
    studentName: string;
    centerId: string;
    centerName: string;
    checkInTime?: Date;
    source?: string;
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const { studentId, studentName, centerId, centerName } = params;
    const time = params.checkInTime || new Date();
    const timeStr = formatTimeEgypt(time);

    const title = `${studentName} — وصل السنتر 🏢`;
    const body = `تم تسجيل دخول ${studentName} إلى سنتر ${centerName} بسلام في تمام الساعة ${timeStr}.`;

    const deepLink = buildDeepLink(studentId, 'attendance');
    const datePart = new Date(time).toISOString().split('T')[0];
    const eventId = `center_checkin:${studentId}:${centerId}:${datePart}`;
    const pushData = { deepLink, studentId, tab: 'attendance', type: 'CENTER_CHECKIN' };

    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        const inserted = await saveInAppNotificationSafe({
          parentId,
          studentId,
          centerId,
          type: ParentNotificationType.CENTER_CHECKIN,
          title,
          body,
          deepLink,
          data: pushData,
          eventId,
        });

        if (inserted) {
          await deliverToParent(parentId, { title, body, data: pushData });
        }
      })
    );
  }



  /**
   * Notify parents when an exam result is recorded for a student.
   * Fires-and-forgets — never throws.
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
        const inserted = await saveInAppNotificationSafe({
          parentId,
          studentId,
          teacherId: params.teacherId,
          type: ParentNotificationType.EXAM_RESULT,
          title,
          body,
          deepLink,
          data: pushData,
          eventId,
        });

        if (inserted) {
          await deliverToParent(parentId, { title, body, data: pushData });
        }
      })
    );
  }

  /**
   * Notify parents when a student's subscription payment is recorded.
   * Fires-and-forgets — never throws.
   */
  static notifyPayment(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName?: string | undefined;
    subject?: string | undefined;
    paidAmount: number;
    remainingAmount?: number | undefined;
    cycleNumber?: number | undefined;
    transactionId: string;
    date?: Date | undefined;
  }): void {
    setImmediate(() => {
      ParentPushService._sendPayment(params).catch((err) =>
        logger.warn('parent_push_payment_error', { err })
      );
    });
  }

  private static async _sendPayment(params: {
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName?: string | undefined;
    subject?: string | undefined;
    paidAmount: number;
    remainingAmount?: number | undefined;
    cycleNumber?: number | undefined;
    transactionId: string;
    date?: Date | undefined;
  }): Promise<void> {
    const parentIds = await getParentsForStudent(params.studentId);
    if (parentIds.length === 0) return;

    const {
      studentId,
      studentName,
      paidAmount,
      remainingAmount,
      cycleNumber,
      transactionId,
    } = params;

    const { cleanName, teacherSig } = await resolveTeacherSigInfo(
      params.teacherId,
      params.teacherName,
      params.subject
    );
    const teacherDisplay = cleanName ? `أ/ ${cleanName}` : (params.teacherName || '');
    const signature = teacherSig ? `\nمع تحيات: ${teacherSig}` : '';

    const cycleText = cycleNumber ? `الدورة (${cycleNumber})` : 'الاشتراك';
    const remainingText =
      remainingAmount !== undefined && remainingAmount > 0
        ? ` (المتبقي: ${remainingAmount} ج.م)`
        : '';

    const title = `${studentName} — تسجيل سداد الاشتراك 💳`;
    const body = `تم تسجيل سداد مبلغ ${paidAmount} ج.م لاشتراك ${cycleText} لـ ${studentName} لدى ${teacherDisplay}${remainingText}.${signature}`;

    const deepLink = buildDeepLink(studentId, 'financial');
    const eventId = `payment:${transactionId}:${studentId}`;
    const pushData = {
      deepLink,
      studentId,
      tab: 'financial',
      transactionId,
      paidAmount,
      cycleNumber,
    };

    await Promise.allSettled(
      parentIds.map(async (parentId) => {
        const inserted = await saveInAppNotificationSafe({
          parentId,
          studentId,
          teacherId: params.teacherId,
          type: ParentNotificationType.PAYMENT_RECORDED,
          title,
          body,
          deepLink,
          data: pushData,
          eventId,
        });

        if (inserted) {
          await deliverToParent(parentId, { title, body, data: pushData });
        }
      })
    );
  }

  /**
   * Broadcast a custom message from teacher to parents.
   * Fire-and-forget; never blocks the caller.
   */
  static notifyTeacherMessage(messageId: string): void {
    setImmediate(() => {
      ParentPushService._sendTeacherMessage(messageId).catch((err) => {
        logger.error('parent_push_teacher_message_unhandled_error', {
          messageId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      });
    });
  }

  /**
   * Internal implementation of broadcast teacher message.
   * Public for testing.
   */
  static async _sendTeacherMessage(
    messageId: string
  ): Promise<{ insertedCount: number; pushCount: number }> {
    try {
      const msg = await TeacherMessageModel.findById(messageId);
      if (!msg) {
        logger.warn('teacher_message_not_found', { messageId });
        return { insertedCount: 0, pushCount: 0 };
      }

      if (msg.status !== 'SENDING') {
        logger.info('teacher_message_already_processed_or_not_sending', {
          messageId,
          status: msg.status,
        });
        return { insertedCount: 0, pushCount: 0 };
      }

      const { cleanName, cleanSubject, teacherSig } = await resolveTeacherSigInfo(
        msg.teacherId.toString()
      );

      // Build target student query
      const studentQuery: any = {
        teacherId: msg.teacherId,
        isActive: true,
        centerId: null,
      };
      if (msg.targetType === 'GROUP') {
        studentQuery.groupId = msg.groupId;
      } else {
        studentQuery.gradeLevel = msg.gradeLevel;
      }

      const students = await StudentModel.find(studentQuery)
        .select('_id studentName')
        .sort({ studentName: 1 })
        .lean();

      if (students.length === 0) {
        msg.status = 'FAILED';
        msg.targetStudentCount = 0;
        msg.reachedParentCount = 0;
        msg.pushSentCount = 0;
        await msg.save();
        return { insertedCount: 0, pushCount: 0 };
      }

      const allStudentIds = students.map((s) => s._id);

      // Chunk student IDs in slices of 500 to fetch ACTIVE ParentStudent links
      // Note: ONLY active links with studentModelType: 'Student' - NO regex fallback!
      const CHUNK_SIZE = 500;
      const activeLinks: { studentId: any; parentId: any }[] = [];

      for (let i = 0; i < allStudentIds.length; i += CHUNK_SIZE) {
        const slice = allStudentIds.slice(i, i + CHUNK_SIZE);
        const links = await ParentStudentModel.find({
          studentId: { $in: slice },
          status: 'ACTIVE',
          studentModelType: 'Student',
        })
          .select('studentId parentId')
          .lean();
        activeLinks.push(...links);
      }

      // Group students by parent (A parent with multiple children gets 1 notification)
      const studentNameMap = new Map<string, string>();
      students.forEach((s) => studentNameMap.set(s._id.toString(), s.studentName));

      const parentToStudentsMap = new Map<string, { studentId: string; studentName: string }[]>();
      for (const link of activeLinks) {
        const pId = link.parentId.toString();
        const sId = link.studentId.toString();
        const sName = studentNameMap.get(sId);
        if (!sName) continue;

        const list = parentToStudentsMap.get(pId) || [];
        if (!list.some((item) => item.studentId === sId)) {
          list.push({ studentId: sId, studentName: sName });
          list.sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
          parentToStudentsMap.set(pId, list);
        }
      }

      const uniqueParentIds = Array.from(parentToStudentsMap.keys());
      if (uniqueParentIds.length === 0) {
        msg.status = 'FAILED';
        msg.targetStudentCount = students.length;
        msg.reachedParentCount = 0;
        msg.pushSentCount = 0;
        await msg.save();
        return { insertedCount: 0, pushCount: 0 };
      }

      // Fetch active devices in chunks of 500
      const parentToTokensMap = new Map<string, string[]>();
      for (let i = 0; i < uniqueParentIds.length; i += CHUNK_SIZE) {
        const parentSlice = uniqueParentIds
          .slice(i, i + CHUNK_SIZE)
          .map((id) => new mongoose.Types.ObjectId(id));
        const devices = await ParentDeviceModel.find({
          parentId: { $in: parentSlice },
          isActive: true,
          fcmToken: { $ne: null, $exists: true },
        })
          .select('parentId fcmToken')
          .lean();

        for (const d of devices) {
          const pid = d.parentId.toString();
          const token = ((d.fcmToken as string) || '').trim();
          if (isValidExpoPushToken(token)) {
            const tokens = parentToTokensMap.get(pid) || [];
            if (!tokens.includes(token)) {
              tokens.push(token);
              parentToTokensMap.set(pid, tokens);
            }
          }
        }
      }

      // Build notification documents (1 doc per parent)
      const notificationDocs: any[] = [];
      const title = (msg.title || '').trim() || (teacherSig ? `رسالة من ${teacherSig}` : 'رسالة من المدرس');
      const body = msg.body.trim();
      const pushBody = body.length > 180 ? `${body.slice(0, 177)}...` : body;

      for (const [parentId, childList] of parentToStudentsMap.entries()) {
        const firstChild = childList[0]!;
        const studentIds = childList.map((c) => c.studentId);
        const studentNames = childList.map((c) => c.studentName);

        const eventId = `teacher_message:${msg._id.toString()}`;
        const data = {
          kind: 'TEACHER_MESSAGE',
          messageId: msg._id.toString(),
          teacherName: cleanName,
          subject: cleanSubject,
          groupName: msg.groupName || null,
          gradeLevel: msg.gradeLevel,
          studentIds,
          studentNames,
        };

        notificationDocs.push({
          parentId: new mongoose.Types.ObjectId(parentId),
          studentId: new mongoose.Types.ObjectId(firstChild.studentId),
          teacherId: msg.teacherId,
          type: ParentNotificationType.TEACHER_MESSAGE,
          title,
          body,
          deepLink: 'monazem://notifications',
          data,
          eventId,
        });
      }

      // Atomic insert in chunks of 500
      let insertedDocs: any[] = [];
      for (let i = 0; i < notificationDocs.length; i += CHUNK_SIZE) {
        const chunk = notificationDocs.slice(i, i + CHUNK_SIZE);
        try {
          const res = (await ParentNotificationModel.insertMany(chunk, { ordered: false })) as any[];
          insertedDocs.push(...res);
        } catch (err: any) {
          if (err.insertedDocs && Array.isArray(err.insertedDocs) && err.insertedDocs.length > 0) {
            insertedDocs.push(...err.insertedDocs);
          } else if (err.writeErrors && Array.isArray(err.writeErrors)) {
            const failedIndices = new Set(err.writeErrors.map((e: any) => e.index));
            const passed = chunk.filter((_, idx) => !failedIndices.has(idx));
            insertedDocs.push(...passed);
          } else {
            logger.warn('teacher_message_insert_many_partial_failure', {
              code: err.code,
              message: err.message,
            });
          }
        }
      }

      // Dispatch Push notifications ONLY for insertedDocs
      const pushMessages: ExpoPushMessage[] = [];
      const tokensInMessages: string[] = [];

      for (const doc of insertedDocs) {
        const parentIdStr = doc.parentId?.toString();
        if (!parentIdStr) continue;
        const tokens = parentToTokensMap.get(parentIdStr) || [];
        for (const token of tokens) {
          pushMessages.push({
            to: token,
            sound: 'default',
            priority: 'high',
            channelId: 'default',
            title: doc.title,
            body: pushBody,
            data: doc.data,
          });
          tokensInMessages.push(token);
        }
      }

      const PUSH_BATCH_SIZE = 100;
      for (let i = 0; i < pushMessages.length; i += PUSH_BATCH_SIZE) {
        const chunkMessages = pushMessages.slice(i, i + PUSH_BATCH_SIZE);
        const chunkTokens = tokensInMessages.slice(i, i + PUSH_BATCH_SIZE);
        try {
          const tickets = await sendExpoMessages(chunkMessages);
          await deactivateInvalidTokens(chunkTokens, tickets);
        } catch (batchErr) {
          logger.warn('expo_push_batch_send_error', { batchErr, offset: i });
        }
      }

      msg.status = 'SENT';
      msg.targetStudentCount = students.length;
      msg.reachedParentCount = insertedDocs.length;
      msg.pushSentCount = pushMessages.length;
      await msg.save();

      logger.info('teacher_message_sent_successfully', {
        messageId: msg._id.toString(),
        targetStudentCount: msg.targetStudentCount,
        reachedParentCount: msg.reachedParentCount,
        pushSentCount: msg.pushSentCount,
      });

      return { insertedCount: insertedDocs.length, pushCount: pushMessages.length };
    } catch (error) {
      logger.error('teacher_message_send_failed', {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      try {
        await TeacherMessageModel.findByIdAndUpdate(messageId, {
          $set: { status: 'FAILED' },
        });
      } catch (dbErr) {
        logger.error('teacher_message_status_update_failed', { messageId, dbErr });
      }

      return { insertedCount: 0, pushCount: 0 };
    }
  }
}


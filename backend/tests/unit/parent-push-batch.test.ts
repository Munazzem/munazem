import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import {
  isValidExpoPushToken,
  formatAttendanceStatusArabic,
  buildAttendanceContent,
  ParentPushService,
} from '../../src/modules/parent/parent-push.service.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { AttendanceStatus, UserRole } from '../../src/common/enums/enum.service.js';

describe('Phase 1: Parent Push Layer & Content Builder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token validation (isValidExpoPushToken)', () => {
    it('يقبل توكنات Expo الصحيحة فقط ويستبعد التوكنات التالفة أو الفارغة', () => {
      expect(isValidExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
      expect(isValidExpoPushToken('ExpoPushToken[1234567890abcdef]')).toBe(true);
      expect(isValidExpoPushToken('  ExponentPushToken[valid-with-spaces]  ')).toBe(true);

      expect(isValidExpoPushToken(null)).toBe(false);
      expect(isValidExpoPushToken(undefined)).toBe(false);
      expect(isValidExpoPushToken('')).toBe(false);
      expect(isValidExpoPushToken('   ')).toBe(false);
      expect(isValidExpoPushToken(12345)).toBe(false);
      expect(isValidExpoPushToken('fcm_token_without_expo_prefix')).toBe(false);
      expect(isValidExpoPushToken('ExponentPushToken[]')).toBe(false);
    });
  });

  describe('Status label helper (formatAttendanceStatusArabic)', () => {
    it('يرجع الأسماء العربية الدقيقة لحالات الحضور', () => {
      expect(formatAttendanceStatusArabic('PRESENT')).toBe('حاضر');
      expect(formatAttendanceStatusArabic('LATE')).toBe('حاضر (متأخر)');
      expect(formatAttendanceStatusArabic('ABSENT')).toBe('غائب');
      expect(formatAttendanceStatusArabic('EXCUSED')).toBe('مُستأذن');
      expect(formatAttendanceStatusArabic('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('Pure Content Builder (buildAttendanceContent)', () => {
    const baseParams = {
      studentName: 'أحمد محمود',
      teacherSig: 'أ/ محمد إبراهيم (الفيزياء)',
      groupName: 'مجموعة الأحد 5 م',
      sessionDate: new Date('2026-10-25T15:00:00.000Z'),
    };

    it('يبني إشعار حاضر PRESENT بنص كامل وذاتي ووقت حضور دقيق', () => {
      const scannedAt = new Date('2026-10-25T15:14:00.000Z');
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'PRESENT',
        scannedAt,
      });

      expect(content.title).toContain('أحمد محمود — حاضر ✓');
      expect(content.body).toContain('تم تسجيل حضور أحمد محمود');
      expect(content.body).toContain('أ/ محمد إبراهيم (الفيزياء)');
      expect(content.body).toContain('مجموعة [مجموعة الأحد 5 م]');
      expect(content.body).toContain('الساعة');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });

    it('يبني إشعار متأخر LATE بنص يوضح وقت الوصول', () => {
      const scannedAt = new Date('2026-10-25T15:45:00.000Z');
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'LATE',
        scannedAt,
      });

      expect(content.title).toContain('حاضر (متأخر) ⏰');
      expect(content.body).toContain('وقت الوصول:');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });

    it('يبني إشعار غائب ABSENT بنص يوضح موعد الحصة وتنبيه المتابعة', () => {
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'ABSENT',
        startTime: '15:00',
      });

      expect(content.title).toContain('أحمد محمود — غائب ⚠️');
      expect(content.body).toContain('نحيطكم علماً بغياب أحمد محمود');
      expect(content.body).toContain('موعد الحصة:');
      expect(content.body).toContain('يرجى المتابعة');
      expect(content.notificationType).toBe('ATTENDANCE_ABSENT');
    });

    it('يبني إشعار زائر معوّض GUEST_COMPENSATED موضحاً الحصة المعوّض عنها', () => {
      const scannedAt = new Date('2026-10-25T15:10:00.000Z');
      const relatedDate = new Date('2026-10-18T15:00:00.000Z');
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'GUEST_COMPENSATED',
        scannedAt,
        relatedGroupName: 'المجموعة الأصلية السبت',
        relatedDate,
      });

      expect(content.title).toContain('حاضر كزائر (تعويض غياب) 🔄');
      expect(content.body).toContain('كتعويض عن غيابه');
      expect(content.body).toContain('المجموعة الأصلية السبت');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });

    it('يبني إشعار مُستأذن EXCUSED ببيانات واضحة تفرق عن التعويض', () => {
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'EXCUSED',
      });

      expect(content.title).toContain('أحمد محمود — مُستأذن 📝');
      expect(content.body).toContain('تم تسجيل إذن غياب للطالب أحمد محمود');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });

    it('يبني إشعار معوّض مسبقاً COMPENSATED_ADVANCE', () => {
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'COMPENSATED_ADVANCE',
        relatedDate: new Date('2026-10-20T12:00:00.000Z'),
      });

      expect(content.title).toContain('أحمد محمود — معوّض مسبقاً 🔄');
      expect(content.body).toContain('معوّض مسبقاً');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });

    it('يبني إشعار تصحيح CORRECTION مع بادئة واضحة وتوضيح الحالة السابقة والجديدة', () => {
      const content = buildAttendanceContent({
        ...baseParams,
        kind: 'CORRECTION',
        oldStatus: 'ABSENT',
        newStatus: 'PRESENT',
      });

      expect(content.title).toContain('[تصحيح] أحمد محمود — حاضر');
      expect(content.body).toContain('إلى (حاضر) بدلاً من (غائب)');
      expect(content.notificationType).toBe('ATTENDANCE_PRESENT');
    });
  });

  describe('Batch Notification & Idempotency (_sendSessionAttendanceBatch)', () => {
    it('يحفظ إشعارات الحصة دفعة واحدة ويمنع تكرار الإرسال والـ Push عند استدعائه مرتين', async () => {
      const teacherId = new mongoose.Types.ObjectId();
      const student1Id = new mongoose.Types.ObjectId();
      const student2Id = new mongoose.Types.ObjectId();
      const parent1Id = new mongoose.Types.ObjectId();
      const parent2Id = new mongoose.Types.ObjectId();
      const sessionId = new mongoose.Types.ObjectId().toString();

      // إنشاء المدرس في قاعدة البيانات
      await UserModel.create({
        _id: teacherId,
        name: 'أحمد سامي',
        subject: 'كيمياء',
        email: 'chemist@test.com',
        phone: '01000000001',
        password: 'hashed_password_123',
        role: UserRole.teacher,
      });

      // إنشاء الروابط بين الطالب وولي الأمر
      await ParentStudentModel.create([
        {
          parentId: parent1Id,
          studentId: student1Id,
          status: 'ACTIVE',
          verifiedVia: 'AUTO_CONFIRMED',
          linkedAt: new Date(),
        },
        {
          parentId: parent2Id,
          studentId: student2Id,
          status: 'ACTIVE',
          verifiedVia: 'AUTO_CONFIRMED',
          linkedAt: new Date(),
        },
      ]);

      // إنشاء أجهزة أولياء الأمور بتوكنات صالحة
      await ParentDeviceModel.create([
        {
          parentId: parent1Id,
          deviceId: 'dev_1',
          fcmToken: 'ExponentPushToken[token_parent_1]',
          platform: 'android',
          refreshTokenHash: 'hash1',
          isActive: true,
          lastSeenAt: new Date(),
          lastTokenRotationAt: new Date(),
        },
        {
          parentId: parent2Id,
          deviceId: 'dev_2',
          fcmToken: 'ExponentPushToken[token_parent_2]',
          platform: 'ios',
          refreshTokenHash: 'hash2',
          isActive: true,
          lastSeenAt: new Date(),
          lastTokenRotationAt: new Date(),
        },
      ]);

      // إنشاء سجلات حضور في AttendanceModel
      await AttendanceModel.create([
        {
          sessionId: new mongoose.Types.ObjectId(sessionId),
          studentId: student1Id,
          status: AttendanceStatus.PRESENT,
          type: 'SESSION',
          scannedAt: new Date(),
        },
        {
          sessionId: new mongoose.Types.ObjectId(sessionId),
          studentId: student2Id,
          status: AttendanceStatus.ABSENT,
          type: 'SESSION',
          scannedAt: new Date(),
        },
      ]);

      // Mock لـ global.fetch للتحقق من رسائل Expo
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            data: [{ status: 'ok', id: 'ticket-1' }, { status: 'ok', id: 'ticket-2' }],
          }),
        } as any;
      });

      const batchParams = {
        sessionId,
        teacherId: teacherId.toString(),
        teacherName: 'أحمد سامي',
        subject: 'كيمياء',
        groupName: 'مجموعة الكيمياء 1',
        sessionDate: new Date('2026-10-25T14:00:00.000Z'),
        startTime: '14:00',
        items: [
          {
            studentId: student1Id.toString(),
            studentName: 'محمود حسن',
            status: 'PRESENT' as const,
            kind: 'PRESENT' as const,
            scannedAt: new Date('2026-10-25T14:05:00.000Z'),
          },
          {
            studentId: student2Id.toString(),
            studentName: 'عمر خالد',
            status: 'ABSENT' as const,
            kind: 'ABSENT' as const,
          },
        ],
      };

      // ── المرة الأولى: يجب أن تنجح ويتم إدراج إشعارين وإرسال 2 Push ──
      const result1 = await ParentPushService._sendSessionAttendanceBatch(batchParams);
      expect(result1.insertedCount).toBe(2);
      expect(result1.pushCount).toBe(2);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // التأكد من حفظ الإشعارات في قاعدة البيانات
      const savedNotifs = await ParentNotificationModel.find({
        eventId: { $regex: `^attendance:${sessionId}:` },
      });
      expect(savedNotifs.length).toBe(2);

      // التأكد من تحديث parentNotify على AttendanceModel
      const attRecord1 = await AttendanceModel.findOne({
        sessionId,
        studentId: student1Id,
      }).lean();
      expect(attRecord1?.parentNotify?.status).toBe('PRESENT');
      expect(attRecord1?.parentNotify?.rev).toBe(0);

      // ── المرة الثانية (محاكاة Double-click أو تكرار): يجب ألا يتم إدراج أو إرسال أي Push جديد ──
      fetchSpy.mockClear();
      const result2 = await ParentPushService._sendSessionAttendanceBatch(batchParams);
      expect(result2.insertedCount).toBe(0);
      expect(result2.pushCount).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();

      // العدد في قاعدة البيانات يظل 2 دون أي تكرار
      const notifsAfterRetry = await ParentNotificationModel.countDocuments({
        eventId: { $regex: `^attendance:${sessionId}:` },
      });
      expect(notifsAfterRetry).toBe(2);
    });
  });

  describe('Correction Notification (_sendAttendanceCorrection)', () => {
    it('يرسل إشعار تصحيح بـ eventId يحمل رقم المراجعة rev', async () => {
      const teacherId = new mongoose.Types.ObjectId();
      const studentId = new mongoose.Types.ObjectId();
      const parentId = new mongoose.Types.ObjectId();
      const sessionId = new mongoose.Types.ObjectId().toString();

      await ParentStudentModel.create({
        parentId,
        studentId,
        status: 'ACTIVE',
        verifiedVia: 'AUTO_CONFIRMED',
        linkedAt: new Date(),
      });

      await ParentDeviceModel.create({
        parentId,
        deviceId: 'dev_corr_1',
        fcmToken: 'ExponentPushToken[token_corr]',
        platform: 'android',
        refreshTokenHash: 'hash_corr',
        isActive: true,
        lastSeenAt: new Date(),
        lastTokenRotationAt: new Date(),
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ data: [{ status: 'ok', id: 'corr-ticket-1' }] }),
        } as any;
      });

      const result = await ParentPushService._sendAttendanceCorrection({
        sessionId,
        studentId: studentId.toString(),
        studentName: 'سارة طارق',
        teacherId: teacherId.toString(),
        teacherName: 'أ/ منى',
        subject: 'أحياء',
        groupName: 'أولى ثانوي',
        sessionDate: new Date('2026-10-25T16:00:00.000Z'),
        oldStatus: 'ABSENT',
        newStatus: 'PRESENT',
        rev: 1,
      });

      expect(result.insertedCount).toBe(1);
      expect(result.pushCount).toBe(1);

      const savedCorr = await ParentNotificationModel.findOne({
        eventId: `attendance:${sessionId}:${studentId}:r1`,
      }).lean();

      expect(savedCorr).toBeDefined();
      expect(savedCorr?.title).toContain('[تصحيح] سارة طارق — حاضر');
      expect(savedCorr?.body).toContain('بدلاً من (غائب)');
    });
  });
});

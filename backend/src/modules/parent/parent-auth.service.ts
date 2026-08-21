import crypto from 'crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { ParentModel } from '../../database/models/parent.model.js';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../database/models/parent-device.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { CardModel } from '../../database/models/card.model.js';
import { TokenUtil } from '../../common/utils/token.util.js';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '../../common/utils/response/error.responce.js';
import type { IParentJwtPayload } from '../../types/parent.types.js';

export function convertArabicToEnglishDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
}

export function normalizePhone(input: string): string {
  if (!input) return '';
  const converted = convertArabicToEnglishDigits(input);
  let cleaned = converted.replace(/\D/g, '');
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0020') && cleaned.length === 14) {
    cleaned = cleaned.substring(4);
  }
  if (cleaned.length === 10 && ['10', '11', '12', '15'].some(p => cleaned.startsWith(p))) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Builds a search query with all possible representations of a phone number
 * to match whatever format is in the database (e.g. 010..., 2010..., +2010..., 10..., arabic digits)
 * and matches both parentPhone and studentPhone fields.
 */
export function getPhoneSearchFilter(rawPhone: string) {
  const converted = convertArabicToEnglishDigits(rawPhone || '');
  const normalized = normalizePhone(converted);
  const digits = converted.replace(/\D/g, '');
  const last10 = (normalized.length >= 10 ? normalized.slice(-10) : digits.slice(-10)) || digits;

  const variants: string[] = [
    rawPhone.trim(),
    converted.trim(),
    normalized,
    digits,
    `0${last10}`,
    `20${last10}`,
    `+20${last10}`,
    `0020${last10}`,
    last10,
  ].filter(Boolean);

  const uniqueVariants = Array.from(new Set(variants));

  const regexConditions = last10.length >= 8 ? [
    { parentPhone: { $regex: new RegExp(`${last10}$`, 'i') } },
    { studentPhone: { $regex: new RegExp(`${last10}$`, 'i') } },
  ] : [];

  return {
    $or: [
      { parentPhone: { $in: uniqueVariants } },
      { studentPhone: { $in: uniqueVariants } },
      ...regexConditions,
    ],
  };
}

export class ParentAuthService {
  /**
   * Helper to resolve a Student from any scan input:
   * 1. CardModel.cardToken (Smart Card QR)
   * 2. CardModel.cardNumber
   * 3. StudentModel.barcode (UUID)
   * 4. StudentModel.studentCode
   * 5. StudentModel._id
   */
  static async resolveStudent(rawInput: string) {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) return null;

    // 1. UUID extraction (if URL like "https://.../card/UUID" or raw UUID)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const uuidMatch = trimmed.match(uuidRegex);
    const candidateToken = uuidMatch ? uuidMatch[0] : trimmed;

    // 2. Check CardModel by cardToken (Smart Card QR)
    const cardByToken = await CardModel.findOne({ cardToken: candidateToken }).lean();
    if (cardByToken?.studentId) {
      const student = await StudentModel.findById(cardByToken.studentId).lean();
      if (student) return student;
    }

    // 3. Check CardModel by cardNumber
    const cardByNumber = await CardModel.findOne({ cardNumber: trimmed }).lean();
    if (cardByNumber?.studentId) {
      const student = await StudentModel.findById(cardByNumber.studentId).lean();
      if (student) return student;
    }

    // 4. Check StudentModel by barcode
    let student = await StudentModel.findOne({ barcode: candidateToken }).lean();
    if (student) return student;

    // 5. Check StudentModel by studentCode
    student = await StudentModel.findOne({ studentCode: trimmed }).lean();
    if (student) return student;

    // 6. Check StudentModel by _id (if valid ObjectId)
    if (mongoose.Types.ObjectId.isValid(candidateToken)) {
      student = await StudentModel.findById(candidateToken).lean();
      if (student) return student;
    }

    return null;
  }

  /**
   * Primary Entry / Verification: QR / Barcode Scan (with optional parentPhone verification)
   */
  static async verifyBarcode(dto: {
    barcode: string;
    parentPhone?: string;
    deviceId: string;
    platform: 'ios' | 'android';
    ip?: string;
  }) {
    const { barcode, deviceId, platform, ip } = dto;

    // 1. Locate student by any card / barcode / token representation
    const student = await ParentAuthService.resolveStudent(barcode);
    if (!student) {
      throw NotFoundException({ message: 'لم يتم العثور على طالب بهذا الكارت أو الرمز' });
    }

    // 2. Resolve parent phone
    let normalizedPhone = '';
    if (dto.parentPhone) {
      normalizedPhone = normalizePhone(dto.parentPhone);
      const studentParentPhone = normalizePhone(student.parentPhone || '');
      if (studentParentPhone && studentParentPhone.slice(-10) !== normalizedPhone.slice(-10)) {
        throw BadRequestException({
          message: 'رقم الهاتف المدخل غير مطابق لرقم ولي الأمر المسجل على بطاقة هذا الطالب',
        });
      }
    } else {
      normalizedPhone = normalizePhone(student.parentPhone || '');
    }

    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw BadRequestException({
        message: 'لا يوجد رقم هاتف ولي أمر مسجل لهذا الطالب، يرجى مراجعة المعلم لتسجيل رقم هاتفك',
      });
    }

    // 3. Find or create Platform-level Parent
    let parent = await ParentModel.findOne({ phone: normalizedPhone });
    if (!parent) {
      parent = await ParentModel.create({
        phone: normalizedPhone,
        name: student.parentName || student.studentName + ' (ولي أمر)',
        isActive: true,
        lastLoginAt: new Date(),
      });
    } else {
      parent.lastLoginAt = new Date();
      if (!parent.name && student.parentName) {
        parent.name = student.parentName;
      }
      await parent.save();
    }

    // 4. Create or activate ParentStudent link
    await ParentStudentModel.findOneAndUpdate(
      { parentId: parent._id, studentId: student._id },
      {
        $set: {
          status: 'ACTIVE' as const,
          verifiedVia: 'BARCODE_SCAN' as const,
          linkedAt: new Date(),
          ...(deviceId ? { 'audit.linkedByDeviceId': deviceId } : {}),
          ...(ip ? { 'audit.linkedIp': ip } : {}),
        },
      },
      { upsert: true, new: true }
    );

    // 5. Auto-Discovery: Find other students with the same phone not yet linked
    const existingLinks = await ParentStudentModel.find({
      parentId: parent._id,
      status: 'ACTIVE',
    }).select('studentId').lean();

    const linkedStudentIds = new Set(existingLinks.map(l => l.studentId.toString()));
    const phoneFilter = getPhoneSearchFilter(normalizedPhone);

    const otherStudents = await StudentModel.find({
      ...phoneFilter,
      _id: { $nin: Array.from(linkedStudentIds).map(id => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    })
      .populate('teacherId', 'name subject')
      .populate('groupId', 'name')
      .lean();

    const discoveredStudents = otherStudents.map((s: any) => ({
      studentId: s._id.toString(),
      studentName: s.studentName,
      gradeLevel: s.gradeLevel,
      teacherName: s.teacherId?.name || 'المعلم',
      subject: s.teacherId?.subject || 'مادة',
      groupName: s.groupId?.name || 'مجموعة',
    }));

    // 6. Generate Tokens & Register Device Session
    const payload: IParentJwtPayload = {
      parentId: parent._id.toString(),
      phone: parent.phone,
      deviceId,
      role: 'parent',
      isActive: parent.isActive,
    };

    const accessToken = TokenUtil.generateAccessToken(payload as any, '30d');
    const rawRefreshToken = crypto.randomUUID() + '.' + crypto.randomUUID();
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

    await ParentDeviceModel.findOneAndUpdate(
      { parentId: parent._id, deviceId },
      {
        $set: {
          platform,
          refreshTokenHash,
          isActive: true,
          lastSeenAt: new Date(),
          lastTokenRotationAt: new Date(),
          revokedAt: null,
          revokedReason: null,
        },
      },
      { upsert: true, new: true }
    );

    return {
      parent: {
        id: parent._id.toString(),
        phone: parent.phone,
        name: parent.name,
        isActive: parent.isActive,
        lastLoginAt: parent.lastLoginAt?.toISOString(),
      },
      token: accessToken,
      refreshToken: rawRefreshToken,
      discoveredStudents,
    };
  }

  /**
   * Phone-Only Direct Login: Enter Phone -> Auto-Link All Registered Children -> Direct Entry
   */
  static async loginByPhone(dto: {
    parentPhone: string;
    deviceId: string;
    platform: 'ios' | 'android';
    ip?: string;
  }) {
    const { deviceId, platform, ip } = dto;
    const normalizedPhone = normalizePhone(dto.parentPhone);

    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw BadRequestException({ message: 'يرجى إدخال رقم هاتف محمول صحيح مكون من 11 رقماً' });
    }

    // 1. Find all active students matching any format of this parent phone
    const phoneFilter = getPhoneSearchFilter(dto.parentPhone);
    let students = await StudentModel.find({
      ...phoneFilter,
      isActive: { $ne: false },
    })
      .populate('teacherId', 'name subject')
      .populate('groupId', 'name')
      .lean();

    // Fallback 1: Try without isActive constraint
    if (students.length === 0) {
      students = await StudentModel.find(phoneFilter)
        .populate('teacherId', 'name subject')
        .populate('groupId', 'name')
        .lean();
    }

    // Fallback 2: Check if a Parent record exists with previously linked students
    if (students.length === 0) {
      const existingParent = await ParentModel.findOne({
        phone: {
          $in: [
            normalizedPhone,
            `0${normalizedPhone.slice(-10)}`,
            normalizedPhone.slice(-10),
            `20${normalizedPhone.slice(-10)}`,
          ],
        },
      });
      if (existingParent) {
        const linkedRelations = await ParentStudentModel.find({
          parentId: existingParent._id,
        }).lean();
        const studentIds = linkedRelations.map((r) => r.studentId);
        if (studentIds.length > 0) {
          students = await StudentModel.find({ _id: { $in: studentIds } })
            .populate('teacherId', 'name subject')
            .populate('groupId', 'name')
            .lean();
        }
      }
    }

    if (students.length === 0) {
      throw NotFoundException({
        message:
          'لم يتم العثور على أي طالب مسجل برقم الهاتف هذا. يرجى التأكد من الرقم أو مراجعة المعلم لتسجيله.',
      });
    }

    // 2. Find or create Platform-level Parent
    const primaryStudent = students[0]!;
    let parent = await ParentModel.findOne({ phone: normalizedPhone });
    if (!parent) {
      parent = await ParentModel.create({
        phone: normalizedPhone,
        name: primaryStudent.parentName || primaryStudent.studentName + ' (ولي أمر)',
        isActive: true,
        lastLoginAt: new Date(),
      });
    } else {
      parent.lastLoginAt = new Date();
      if (!parent.name && primaryStudent.parentName) {
        parent.name = primaryStudent.parentName;
      }
      await parent.save();
    }

    // 3. Link all found students automatically
    const writes = students.map((student) => ({
      updateOne: {
        filter: { parentId: parent._id, studentId: student._id },
        update: {
          $set: {
            status: 'ACTIVE' as const,
            verifiedVia: 'AUTO_CONFIRMED' as const,
            linkedAt: new Date(),
            ...(deviceId ? { 'audit.linkedByDeviceId': deviceId } : {}),
            ...(ip ? { 'audit.linkedIp': ip } : {}),
          },
        },
        upsert: true,
      },
    }));

    if (writes.length > 0) {
      await ParentStudentModel.bulkWrite(writes as any);
    }

    // 4. Generate Tokens & Register Device Session
    const payload: IParentJwtPayload = {
      parentId: parent._id.toString(),
      phone: parent.phone,
      deviceId,
      role: 'parent',
      isActive: parent.isActive,
    };

    const accessToken = TokenUtil.generateAccessToken(payload as any, '30d');
    const rawRefreshToken = crypto.randomUUID() + '.' + crypto.randomUUID();
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

    await ParentDeviceModel.findOneAndUpdate(
      { parentId: parent._id, deviceId },
      {
        $set: {
          platform,
          refreshTokenHash,
          isActive: true,
          lastSeenAt: new Date(),
          lastTokenRotationAt: new Date(),
          revokedAt: null,
          revokedReason: null,
        },
      },
      { upsert: true, new: true }
    );

    const discoveredStudents = students.map((s: any) => ({
      studentId: s._id.toString(),
      studentName: s.studentName,
      gradeLevel: s.gradeLevel,
      teacherName: s.teacherId?.name || 'المعلم',
      subject: s.teacherId?.subject || 'مادة',
      groupName: s.groupId?.name || 'مجموعة',
    }));

    return {
      parent: {
        id: parent._id.toString(),
        phone: parent.phone,
        name: parent.name,
        isActive: parent.isActive,
        lastLoginAt: parent.lastLoginAt?.toISOString(),
      },
      token: accessToken,
      refreshToken: rawRefreshToken,
      discoveredStudents,
    };
  }

  /**
   * Refresh Token Endpoint
   */
  static async refreshSession(dto: { refreshToken: string; deviceId: string }) {
    const { refreshToken, deviceId } = dto;
    if (!refreshToken || !deviceId) {
      throw UnauthorizedException({ message: 'بيانات الجلسة غير مكتملة' });
    }

    const device = await ParentDeviceModel.findOne({ deviceId, isActive: true });
    if (!device) {
      throw UnauthorizedException({ message: 'الجلسة غير صالحة أو تم تسجيل الخروج' });
    }

    const isMatch = await bcrypt.compare(refreshToken, device.refreshTokenHash);
    if (!isMatch) {
      throw UnauthorizedException({ message: 'رمز التجديد غير صالح' });
    }

    const parent = await ParentModel.findById(device.parentId).lean();
    if (!parent || !parent.isActive) {
      throw UnauthorizedException({ message: 'تم إيقاف حساب ولي الأمر' });
    }

    const payload: IParentJwtPayload = {
      parentId: parent._id.toString(),
      phone: parent.phone,
      deviceId,
      role: 'parent',
      isActive: parent.isActive,
    };

    const newAccessToken = TokenUtil.generateAccessToken(payload as any, '30d');
    const newRawRefreshToken = crypto.randomUUID() + '.' + crypto.randomUUID();
    device.refreshTokenHash = await bcrypt.hash(newRawRefreshToken, 10);
    device.lastTokenRotationAt = new Date();
    device.lastSeenAt = new Date();
    await device.save();

    return {
      token: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Explicit confirmation of auto-discovered students
   */
  static async confirmDiscovered(parentId: string, studentIds: string[], deviceId?: string) {
    const parent = await ParentModel.findById(parentId).lean();
    if (!parent) throw NotFoundException({ message: 'حساب ولي الأمر غير موجود' });

    const students = await StudentModel.find({
      _id: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).lean();

    const writes = students.map(student => ({
      updateOne: {
        filter: { parentId: new mongoose.Types.ObjectId(parentId), studentId: student._id },
        update: {
          $set: {
            status: 'ACTIVE' as const,
            verifiedVia: 'AUTO_CONFIRMED' as const,
            linkedAt: new Date(),
            ...(deviceId ? { 'audit.linkedByDeviceId': deviceId } : {}),
          },
        },
        upsert: true,
      },
    }));

    if (writes.length > 0) {
      await ParentStudentModel.bulkWrite(writes as any);
    }
  }

  /**
   * Device Logout
   */
  static async logoutDevice(parentId: string, deviceId: string) {
    await ParentDeviceModel.updateOne(
      { parentId: new mongoose.Types.ObjectId(parentId), deviceId },
      {
        $set: {
          isActive: false,
          fcmToken: null,
          revokedAt: new Date(),
          revokedReason: 'LOGOUT',
        },
      }
    );
  }

  /**
   * Register or update FCM Push Token
   */
  static async registerPushToken(parentId: string, deviceId: string, fcmToken: string, platform?: 'ios' | 'android') {
    await ParentDeviceModel.updateOne(
      { parentId: new mongoose.Types.ObjectId(parentId), deviceId },
      {
        $set: {
          fcmToken,
          platform: platform || 'android',
          lastSeenAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}

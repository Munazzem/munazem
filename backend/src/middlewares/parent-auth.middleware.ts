import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import {
  UnauthorizedException,
  ForbiddenException,
} from '../common/utils/response/error.responce.js';
import { TokenUtil } from '../common/utils/token.util.js';
import type { IParentJwtPayload } from '../types/parent.types.js';
import { ParentModel } from '../database/models/parent.model.js';
import { ParentStudentModel } from '../database/models/parent-student.model.js';
import { ParentDeviceModel } from '../database/models/parent-device.model.js';
import { StudentModel } from '../database/models/student.model.js';

const SLIDING_THRESHOLD_SECONDS = 15 * 60; // 15 minutes

export interface AuthenticatedParentRequest extends Request {
  parent: IParentJwtPayload;
}

export const authenticateParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1] as string;
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw UnauthorizedException({
        message: 'الرجاء تسجيل الدخول للوصول إلى هذا المسار',
      });
    }

    const payload = TokenUtil.verifyAccessToken(token) as any as IParentJwtPayload;

    if (payload.role !== 'parent') {
      throw ForbiddenException({
        message: 'غير مصرح لك بالوصول إلى مسارات ولي الأمر',
      });
    }

    if (!payload.isActive) {
      throw UnauthorizedException({
        message: 'تم إيقاف هذا الحساب، يرجى مراجعة إدارة المنصة',
      });
    }

    // Optional quick check on device status
    const deviceId = req.headers['x-device-id'] as string || payload.deviceId;
    if (deviceId) {
      const activeDevice = await ParentDeviceModel.findOne({
        parentId: payload.parentId,
        deviceId,
        isActive: true,
      }).lean();

      if (!activeDevice) {
        throw UnauthorizedException({
          message: 'انتهت صلاحية جلسة هذا الجهاز، يرجى إعادة تسجيل الدخول',
        });
      }
    }

    // Attach to request
    (req as any).parent = payload;

    // Sliding Token: Issue fresh token if close to expiry
    if (payload.exp) {
      const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
      if (secondsLeft < SLIDING_THRESHOLD_SECONDS) {
        const { iat, exp, ...cleanPayload } = payload;
        const freshToken = TokenUtil.generateAccessToken(cleanPayload as any);
        res.setHeader('X-New-Token', freshToken);
      }
    }

    next();
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('jwt')) {
      next(UnauthorizedException({ message: 'توثيق غير صالح أو منتهي الصلاحية' }));
    } else {
      next(error);
    }
  }
};

/**
 * IDOR Prevention Guard: Verifies that the authenticated parent has an ACTIVE link to studentId
 */
export async function assertParentStudentAccess(
  parentId: string,
  studentId: string
): Promise<void> {
  const hasAccess = await ParentStudentModel.exists({
    parentId: new mongoose.Types.ObjectId(parentId),
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'ACTIVE',
  });

  if (hasAccess) return;

  // Auto-healing fallback: Check if parent exists and phone matches this student
  const [parent, student] = await Promise.all([
    ParentModel.findById(parentId).lean(),
    StudentModel.findById(studentId).lean(),
  ]);

  if (parent && student && parent.phone) {
    const parentDigits = parent.phone.replace(/\D/g, '').slice(-10);
    const studentParentDigits = (student.parentPhone || '').replace(/\D/g, '').slice(-10);
    const studentDigits = (student.studentPhone || '').replace(/\D/g, '').slice(-10);

    if (
      (parentDigits && studentParentDigits && parentDigits === studentParentDigits) ||
      (parentDigits && studentDigits && parentDigits === studentDigits)
    ) {
      await ParentStudentModel.findOneAndUpdate(
        { parentId: parent._id, studentId: student._id },
        {
          $set: {
            status: 'ACTIVE',
            verifiedVia: 'AUTO_CONFIRMED',
            linkedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return;
    }
  }

  throw ForbiddenException({
    message: 'غير مصرح لك بالوصول إلى بيانات هذا الطالب',
  });
}

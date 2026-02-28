import mongoose from 'mongoose';
import { UserModel } from '../../database/models/user.model.js';
import { PasswordUtil } from '../../common/utils/password.util.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { UnauthorizedException, BadRequestException, ErrorResponse } from '../../common/utils/response/error.responce.js';
import { SubscriptionService } from '../subscriptions/subscriptions.service.js';

export class UserService {
    static async createUser(creatorRole: string, creatorId: string, data: any) {

        if (creatorRole === UserRole.assistant) {
            throw UnauthorizedException({ message: 'غير مصرح لك بإضافة مستخدمين للنظام' });
        }

        if (creatorRole === UserRole.teacher) {
            // Force the role to Assistant (ignoring whatever was sent)
            data.role = UserRole.assistant;
            data.teacherId = creatorId;
            data.stage = null; // Assistants don't have a stage
        }

        if (creatorRole === UserRole.superAdmin) {
            // Force the role to Teacher (ignoring whatever was sent)
            data.role = UserRole.teacher;
            data.teacherId = null;
            if (!data.stage) {
                throw BadRequestException({ message: 'يجب تحديد المرحلة الدراسية للمعلم (إعدادي أو ثانوي)' });
            }
        }


        const existingUser = await UserModel.findOne({ phone: data.phone }).lean();
        if (existingUser) {
            throw BadRequestException({ message: 'رقم الهاتف مسجل بالفعل في النظام' });
        }
        const hashedPassword = await PasswordUtil.hashPassword(data.password);

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const newUserArray = await UserModel.create([{
                ...data,
                password: hashedPassword,
            }], { session });

            const createdUser = newUserArray[0];
            if (!createdUser) {
                throw new Error("فشل في إنشاء الحساب، يرجى المحاولة مرة أخرى");
            }

            // If a Super Admin is creating this account, it's a Teacher, and we must couple a Subscription atomically
            if (creatorRole === UserRole.superAdmin && data.subscription) {
                await SubscriptionService.createSubscription(
                    createdUser._id.toString(),
                    data.subscription,
                    session
                );
            }

            await session.commitTransaction();

            const userObject = createdUser.toObject();
            delete userObject.password;

            return userObject;
        } catch (error: any) {
            await session.abortTransaction();
            // Re-throw the error so the controller can catch it
            throw error;
        } finally {
            session.endSession();
        }
    }
}
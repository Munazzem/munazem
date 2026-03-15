import mongoose from 'mongoose';
import { UserModel }        from '../../database/models/user.model.js';
import { PasswordUtil }     from '../../common/utils/password.util.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { UnauthorizedException, BadRequestException, ErrorResponse, NotFoundException } from '../../common/utils/response/error.responce.js';
import { PaymentsService } from '../payments/payments.service.js';
import { TransactionCategory } from '../../common/enums/enum.service.js';

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

        if (creatorRole === UserRole.superAdmin || creatorRole === 'SUPER_ADMIN') {
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

        // Local environments often don't have MongoDB Replica Sets configured, which breaks transactions.
        // We will remove session logic for now so it works correctly on local environments.
        // Avoid E11000 duplicate key error on email by ensuring a unique dummy email if not provided
        const userData = { ...data };
        if (!userData.email) {
            userData.email = `no-email-${Date.now()}-${Math.floor(Math.random() * 10000)}@system.local`;
        }

        try {
            const newUserArray = await UserModel.create([{
                ...userData,
                password: hashedPassword,
            }]);

            const createdUser = newUserArray[0];
            if (!createdUser) {
                throw new Error("فشل في إنشاء الحساب، يرجى المحاولة مرة أخرى");
            }



            const userObject = createdUser.toObject();
            delete userObject.password;

            return userObject;
        } catch (error: any) {
            // Re-throw the error so the controller can catch it
            throw error;
        }
    }

    static async getUsers(requesterRole: string, requesterId: string, query: any) {
        let filter: any = {};

        if (requesterRole === UserRole.superAdmin || requesterRole === 'SUPER_ADMIN') {
            filter.role = UserRole.teacher;
        } else if (requesterRole === UserRole.teacher) {
            filter.role = UserRole.assistant;
            filter.teacherId = requesterId;
        } else {
            throw UnauthorizedException({ message: 'غير مصرح لك بعرض المستخدمين' });
        }

        // Apply additional filters from query if needed (e.g. search by name)
        if (query.name) {
            filter.name = { $regex: query.name, $options: 'i' };
        }

        const users = await UserModel.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        return users;
    }

    static async updateUser(requesterRole: string, requesterId: string, targetUserId: string, data: any) {
        const targetUser = await UserModel.findById(targetUserId);

        if (!targetUser) {
            throw BadRequestException({ message: 'المستخدم غير موجود' });
        }

        // Authorization check
        if (requesterRole === UserRole.assistant) {
            throw UnauthorizedException({ message: 'غير مصرح لك بتعديل بيانات المستخدمين' });
        }

        if (requesterRole === UserRole.teacher && targetUser.teacherId?.toString() !== requesterId) {
            throw UnauthorizedException({ message: 'هذا المستخدم لا يتبع لك' });
        }

        if ((requesterRole === UserRole.superAdmin || requesterRole === 'SUPER_ADMIN') && targetUser.role !== UserRole.teacher) {
            throw UnauthorizedException({ message: 'يمكنك فقط تعديل بيانات المعلمين' });
        }

        if (data.phone && data.phone !== targetUser.phone) {
            const existingUser = await UserModel.findOne({ phone: data.phone }).lean();
            if (existingUser) {
                throw BadRequestException({ message: 'رقم الهاتف مسجل بالفعل في النظام' });
            }
        }

        if (data.password) {
            data.password = await PasswordUtil.hashPassword(data.password);
        }

        const updatedUser = await UserModel.findByIdAndUpdate(targetUserId, data, { new: true })
            .select('-password')
            .lean();

        return updatedUser;
    }

    static async paySalary(teacherId: string, assistantId: string, amount: number, notes?: string) {
        const assistant = await UserModel.findOne({
            _id:       assistantId,
            teacherId: teacherId,
            role:      UserRole.assistant,
        }).lean();

        if (!assistant) throw NotFoundException({ message: 'المساعد غير موجود أو لا ينتمي إليك' });

        // Reuse PaymentsService.recordExpense to keep ledger logic consistent
        const tx = await PaymentsService.recordExpense(
            teacherId,
            teacherId, // createdBy = the teacher
            {
                category:    TransactionCategory.SALARY,
                amount,
                description: notes ?? `راتب ${assistant.name}`,
            }
        );

        return tx;
    }

    static async deleteUser(requesterRole: string, requesterId: string, targetUserId: string) {
        const targetUser = await UserModel.findById(targetUserId);

        if (!targetUser) {
            throw BadRequestException({ message: 'المستخدم غير موجود' });
        }

        // Authorization check
        if (requesterRole === UserRole.assistant) {
            throw UnauthorizedException({ message: 'غير مصرح لك بحذف المستخدمين' });
        }

        if (requesterRole === UserRole.teacher && targetUser.teacherId?.toString() !== requesterId) {
            throw UnauthorizedException({ message: 'هذا المستخدم لا يتبع لك' });
        }

        if ((requesterRole === UserRole.superAdmin || requesterRole === 'SUPER_ADMIN') && targetUser.role !== UserRole.teacher) {
            throw UnauthorizedException({ message: 'يمكنك فقط حذف المعلمين' });
        }

        // Hard delete for now. Optionally could be soft delete by setting isActive to false.
        await UserModel.findByIdAndDelete(targetUserId);

        return { message: 'تم حذف المستخدم بنجاح' };
    }
}
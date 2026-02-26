import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { BadRequestException, NotFoundException } from '../../common/utils/response/error.responce.js';

export class SubscriptionService {
    static async createSubscription(teacherId: string, data: any) {
        // Validate teacher exists and is actually a Teacher
        const teacher = await UserModel.findById(teacherId);
        if (!teacher) {
            throw NotFoundException({ message: 'المعلم غير موجود' });
        }
        if (teacher.role !== UserRole.teacher) {
            throw BadRequestException({ message: 'هذا الحساب لا يخص معلماً، لا يمكن إضافة اشتراك له' });
        }

        // Create the subscription
        const newSubscription = await SubscriptionModel.create({
            teacherId,
            endDate: new Date(data.endDate),
            amount: data.amount,
            paymentMethod: data.paymentMethod
        });

        // Optionally, we could activate the teacher account if it was inactive
        if (!teacher.isActive) {
            teacher.isActive = true;
            await teacher.save();
        }

        return newSubscription;
    }

    static async getAllSubscriptions() {
        // Find all subscriptions and populate the teacher's name and email
        return await SubscriptionModel.find()
            .populate('teacherId', 'name email phone')
            .sort({ createdAt: -1 });
    }

    static async getTeacherSubscriptions(teacherId: string) {
        return await SubscriptionModel.find({ teacherId })
            .sort({ createdAt: -1 });
    }
}

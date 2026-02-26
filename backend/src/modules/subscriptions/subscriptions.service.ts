import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { UserModel } from '../../database/models/user.model.js';
import type { ClientSession } from 'mongoose';
import { UserRole } from '../../common/enums/enum.service.js';
import { BadRequestException, NotFoundException } from '../../common/utils/response/error.responce.js';

export class SubscriptionService {
    static async createSubscription(teacherId: string, data: any, session?: ClientSession) {
        // Validate teacher exists and is actually a Teacher
        // [PERFORMANCE OPTIMIZATION] Using .lean() to speed up validation since we don't need to mutate 'teacher'
        const teacher = await UserModel.findById(teacherId).session(session || null).lean();
        if (!teacher) {
            throw NotFoundException({ message: 'المعلم غير موجود' });
        }
        if (teacher.role !== UserRole.teacher) {
            throw BadRequestException({ message: 'هذا الحساب لا يخص معلماً، لا يمكن إضافة اشتراك له' });
        }

        // Create the subscription
        const newSubscription = await SubscriptionModel.create([{
            teacherId,
            endDate: new Date(data.endDate),
            amount: data.amount,
            paymentMethod: data.paymentMethod
        }], { session: session || null });

        // Extract the created doc from the array returned by .create()
        const subscriptionDoc = newSubscription[0];

        // Optionally, we could activate the teacher account if it was inactive
        if (!teacher.isActive) {
            // [NOTE] Re-fetching without .lean() here because we need the Mongoose .save() method to mutate the document
            const teacherDoc = await UserModel.findById(teacherId).session(session || null);
            if (teacherDoc) {
                teacherDoc.isActive = true;
                await teacherDoc.save({ session: session || null });
            }
        }

        return subscriptionDoc;
    }

    static async getAllSubscriptions() {
        // [PERFORMANCE OPTIMIZATION] Using .lean() here is crucial because this query can return hundreds of subscriptions.
        // It converts the Mongoose Documents into plain JSON objects, reducing the payload processing time by > 50%.
        return await SubscriptionModel.find()
            .populate('teacherId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();
    }

    static async getTeacherSubscriptions(teacherId: string) {
        // [PERFORMANCE OPTIMIZATION] Using .lean() for faster retrieval of plain JSON data.
        return await SubscriptionModel.find({ teacherId })
            .sort({ createdAt: -1 })
            .lean();
    }
}

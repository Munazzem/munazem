import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { UserModel } from '../../database/models/user.model.js';
import type { ClientSession } from 'mongoose';
import {
    UserRole,
    SubscriptionStatus,
    SubscriptionPlan,
    PLAN_PRICES,
    DURATION_LABELS,
    type DurationMonths,
} from '../../common/enums/enum.service.js';
import { BadRequestException, NotFoundException } from '../../common/utils/response/error.responce.js';

export class SubscriptionService {
    static async createSubscription(
        teacherId: string,
        data: { planTier: SubscriptionPlan; durationMonths: DurationMonths; paymentMethod?: string },
        session?: ClientSession
    ) {
        const teacher = await UserModel.findById(teacherId).session(session || null).lean();
        if (!teacher) {
            throw NotFoundException({ message: 'المعلم غير موجود' });
        }
        if (teacher.role !== UserRole.teacher) {
            throw BadRequestException({ message: 'هذا الحساب لا يخص معلماً، لا يمكن إضافة اشتراك له' });
        }

        const pricePerMonth = PLAN_PRICES[data.planTier];
        const amount = pricePerMonth * data.durationMonths;

        // If the teacher has an active subscription, renew from its endDate; otherwise start from today
        const activeSubscription = await SubscriptionModel.findOne({
            teacherId,
            status: SubscriptionStatus.ACTIVE,
            endDate: { $gt: new Date() },
        }).sort({ endDate: -1 }).session(session || null).lean();

        const startDate = activeSubscription ? new Date(activeSubscription.endDate) : new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + data.durationMonths);

        const subscriptionData: Record<string, unknown> = {
            teacherId,
            planTier: data.planTier,
            durationMonths: data.durationMonths,
            startDate,
            endDate,
            amount,
        };
        if (data.paymentMethod) {
            subscriptionData.paymentMethod = data.paymentMethod;
        }

        const newSubscription = await SubscriptionModel.create([subscriptionData], { session: session || null });

        const subscriptionDoc = newSubscription[0];

        if (!teacher.isActive) {
            const teacherDoc = await UserModel.findById(teacherId).session(session || null);
            if (teacherDoc) {
                teacherDoc.isActive = true;
                await teacherDoc.save({ session: session || null });
            }
        }

        return subscriptionDoc;
    }

    static async getAllSubscriptions() {
        return await SubscriptionModel.find()
            .populate('teacherId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();
    }

    static async getTeacherSubscriptions(teacherId: string) {
        return await SubscriptionModel.find({ teacherId })
            .sort({ createdAt: -1 })
            .lean();
    }

    static getAvailablePlans() {
        return [
            {
                tier: SubscriptionPlan.BASIC,
                name: 'الباقة الأساسية',
                pricePerMonth: PLAN_PRICES[SubscriptionPlan.BASIC],
                durations: Object.entries(DURATION_LABELS).map(([months, label]) => ({
                    months: Number(months),
                    label,
                    total: PLAN_PRICES[SubscriptionPlan.BASIC] * Number(months),
                })),
            },
            {
                tier: SubscriptionPlan.PRO,
                name: 'الباقة الاحترافية',
                pricePerMonth: PLAN_PRICES[SubscriptionPlan.PRO],
                durations: Object.entries(DURATION_LABELS).map(([months, label]) => ({
                    months: Number(months),
                    label,
                    total: PLAN_PRICES[SubscriptionPlan.PRO] * Number(months),
                })),
            },
            {
                tier: SubscriptionPlan.PREMIUM,
                name: 'الباقة المتميزة',
                pricePerMonth: PLAN_PRICES[SubscriptionPlan.PREMIUM],
                durations: Object.entries(DURATION_LABELS).map(([months, label]) => ({
                    months: Number(months),
                    label,
                    total: PLAN_PRICES[SubscriptionPlan.PREMIUM] * Number(months),
                })),
            },
        ];
    }
}

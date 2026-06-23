import { UserModel }         from '../../database/models/user.model.js';
import { StudentModel }      from '../../database/models/student.model.js';
import { GroupModel }        from '../../database/models/group.model.js';
import { SessionModel }      from '../../database/models/session.model.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { ErrorLogModel }     from '../../database/models/error-log.model.js';
import { ActivityLogModel }   from '../../database/models/activity-log.model.js';
import { PlatformSettingsModel } from '../../database/models/platform-settings.model.js';
import { PromoCodeModel } from '../../database/models/promo-code.model.js';
import { AnnouncementModel } from '../../database/models/announcement.model.js';
import { UserRole, SubscriptionStatus, PLAN_PRICES } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';

export class AdminService {

    // ── Platform-wide overview KPIs ──────────────────────────────────
    static async getOverviewStats() {
        const now       = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalTeachers,
            activeTeachers,
            totalStudents,
            activeSubscriptions,
            expiredSubscriptions,
            newTeachersThisMonth,
            recentErrors,
        ] = await Promise.all([
            UserModel.countDocuments({ role: UserRole.teacher }),
            UserModel.countDocuments({ role: UserRole.teacher, isActive: true }),
            StudentModel.countDocuments({}),
            SubscriptionModel.countDocuments({ status: SubscriptionStatus.ACTIVE }),
            SubscriptionModel.countDocuments({ status: SubscriptionStatus.EXPIRED }),
            UserModel.countDocuments({ role: UserRole.teacher, createdAt: { $gte: monthStart } }),
            ErrorLogModel.countDocuments({ level: { $in: ['error', 'critical'] }, createdAt: { $gte: monthStart } }),
        ]);

        // MRR (Monthly Recurring Revenue) Calculation
        // Sum of (amount / durationMonths) for all currently ACTIVE subscriptions
        const mrrAgg = await SubscriptionModel.aggregate([
            { $match: { status: SubscriptionStatus.ACTIVE } },
            { 
                $group: { 
                    _id: null, 
                    mrr: { $sum: { $divide: ['$amount', '$durationMonths'] } } 
                } 
            }
        ]);
        const mrr = Math.round(mrrAgg[0]?.mrr ?? 0);

        // Monthly revenue (cash collected this month)
        const revenueAgg = await SubscriptionModel.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const monthlyRevenue = Math.round(revenueAgg[0]?.total ?? 0);

        // Churn Rate: percentage of teachers whose subscriptions expired in the last 30 days and didn't renew
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentlyExpired = await SubscriptionModel.distinct('teacherId', { 
            status: SubscriptionStatus.EXPIRED,
            endDate: { $gte: thirtyDaysAgo }
        });
        const activeNow = await SubscriptionModel.distinct('teacherId', { status: SubscriptionStatus.ACTIVE });
        const churnedTeachers = recentlyExpired.filter(id => !activeNow.some(aId => aId.toString() === id.toString())).length;
        const totalEligible = recentlyExpired.length;
        const churnRate = totalEligible > 0 ? Math.round((churnedTeachers / totalEligible) * 100) : 0;

        // Top 5 Teachers by Student Count
        const topTeachersAgg = await StudentModel.aggregate([
            { $group: { _id: '$teacherId', studentCount: { $sum: 1 } } },
            { $sort: { studentCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'teacher' } },
            { $unwind: '$teacher' },
            { $project: { _id: 1, studentCount: 1, name: '$teacher.name', phone: '$teacher.phone' } }
        ]);

        // Expiring Soon Subscriptions (Next 15 days)
        const fifteenDaysFromNow = new Date();
        fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
        const expiringSoon = await SubscriptionModel.find({
            status: SubscriptionStatus.ACTIVE,
            endDate: { $gte: now, $lte: fifteenDaysFromNow }
        }).populate('teacherId', 'name phone').sort({ endDate: 1 }).lean();

        return {
            totalTeachers,
            activeTeachers,
            inactiveTeachers:     totalTeachers - activeTeachers,
            totalStudents,
            activeSubscriptions,
            expiredSubscriptions,
            newTeachersThisMonth,
            monthlyRevenue,
            mrr,
            churnRate,
            recentErrorsThisMonth: recentErrors,
            topTeachers: topTeachersAgg,
            expiringSoon: expiringSoon.map(sub => ({
                _id: sub._id,
                planTier: sub.planTier,
                endDate: sub.endDate,
                teacher: sub.teacherId
            })),
        };
    }

    // ── Monthly growth: new teachers per month (last 6 months) ───────
    static async getGrowthData() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const data = await UserModel.aggregate([
            { $match: { role: UserRole.teacher, createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        return data.map(d => ({
            label: `${d._id.year}-${String(d._id.month).padStart(2, '0')}`,
            count: d.count,
        }));
    }

    // ── List all tenants (teachers) with their key stats ─────────────
    static async getAllTenants(query: {
        page?: number; limit?: number; search?: string; status?: string;
    }) {
        const page  = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, query.limit ?? 20);
        const skip  = (page - 1) * limit;

        const filter: any = { role: UserRole.teacher };
        if (query.search) {
            filter.$or = [
                { name:  { $regex: query.search, $options: 'i' } },
                { email: { $regex: query.search, $options: 'i' } },
                { phone: { $regex: query.search, $options: 'i' } },
            ];
        }
        if (query.status === 'active')   filter.isActive = true;
        if (query.status === 'inactive') filter.isActive = false;

        const [teachers, total] = await Promise.all([
            UserModel.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            UserModel.countDocuments(filter),
        ]);

        const teacherIds = teachers.map(t => t._id);

        // Batch-fetch student counts + subscriptions for all teachers
        const [studentCounts, subscriptions] = await Promise.all([
            StudentModel.aggregate([
                { $match: { teacherId: { $in: teacherIds } } },
                { $group: { _id: '$teacherId', count: { $sum: 1 } } },
            ]),
            SubscriptionModel.find({ teacherId: { $in: teacherIds } })
                .sort({ endDate: -1 })
                .lean(),
        ]);

        const studentMap = new Map(studentCounts.map(s => [s._id.toString(), s.count]));
        const subMap     = new Map<string, any>();
        for (const sub of subscriptions) {
            const key = sub.teacherId.toString();
            if (!subMap.has(key)) subMap.set(key, sub); // keep latest
        }

        const enriched = teachers.map(t => ({
            ...t,
            studentCount: studentMap.get(t._id.toString()) ?? 0,
            subscription: subMap.get(t._id.toString()) ?? null,
        }));

        return { data: enriched, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    // ── Single teacher full detail ────────────────────────────────────
    static async getTenantDetail(teacherId: string) {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [teacher, studentCount, groupCount, sessionsThisMonth, subscription] = await Promise.all([
            UserModel.findOne({ _id: teacherId, role: UserRole.teacher }).select('-password').lean(),
            StudentModel.countDocuments({ teacherId }),
            GroupModel.countDocuments({ teacherId }),
            SessionModel.countDocuments({ teacherId, date: { $gte: monthStart } }),
            SubscriptionModel.findOne({ teacherId }).sort({ endDate: -1 }).lean(),
        ]);

        if (!teacher) return null;

        return { teacher, studentCount, groupCount, sessionsThisMonth, subscription };
    }

    // ── Get recent error logs ─────────────────────────────────────────
    static async getRecentErrors(query: {
        limit?: number; level?: string; page?: number;
    }) {
        const page  = Math.max(1, query.page ?? 1);
        const limit = Math.min(200, query.limit ?? 50);
        const skip  = (page - 1) * limit;

        const filter: any = {};
        if (query.level && ['warn', 'error', 'critical'].includes(query.level)) {
            filter.level = query.level;
        }

        const [logs, total] = await Promise.all([
            ErrorLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            ErrorLogModel.countDocuments(filter),
        ]);

        return { data: logs, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    // ── Suspend / Reactivate a teacher ────────────────────────────────
    static async setTenantStatus(teacherId: string, isActive: boolean) {
        return UserModel.findOneAndUpdate(
            { _id: teacherId, role: UserRole.teacher },
            { isActive },
            { new: true }
        ).select('-password').lean();
    }

    // ── Get activity feed (business event log) ────────────────────────
    static async getActivityFeed(query: {
        page?: number; limit?: number; event?: string; tenantId?: string;
    }) {
        const page  = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, query.limit ?? 20);
        const skip  = (page - 1) * limit;

        const filter: any = {};
        if (query.event)    filter.event    = query.event;
        if (query.tenantId) filter.tenantId = query.tenantId;

        const [logs, total] = await Promise.all([
            ActivityLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            ActivityLogModel.countDocuments(filter),
        ]);

        // Enrich with teacher names for display
        const tenantIds = [...new Set(logs.map(l => l.tenantId.toString()))];
        const teachers = await UserModel.find(
            { _id: { $in: tenantIds } },
            { name: 1, centerName: 1 }
        ).lean();
        const teacherMap = new Map(teachers.map(t => [t._id.toString(), t]));

        const enriched = logs.map(log => ({
            ...log,
            teacherName: (teacherMap.get(log.tenantId.toString()) as any)?.name ?? null,
        }));

        return { data: enriched, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    // ── Platform Settings (Dynamic Pricing) ───────────────────────────
    static async getPlatformSettings() {
        let settings = await PlatformSettingsModel.findOne({ key: 'PLAN_PRICES' }).lean();
        if (!settings) {
            // Seed with defaults if not exists
            settings = await PlatformSettingsModel.create({
                key: 'PLAN_PRICES',
                value: PLAN_PRICES
            });
        }
        return settings.value;
    }

    static async updatePlanPrices(newPrices: Record<string, number>) {
        const settings = await PlatformSettingsModel.findOneAndUpdate(
            { key: 'PLAN_PRICES' },
            { value: newPrices },
            { new: true, upsert: true }
        ).lean();
        return settings.value;
    }

    // ── Promo Codes ────────────────────────────────────────────────────────

    static async getPromoCodes() {
        return PromoCodeModel.find().sort({ createdAt: -1 }).lean();
    }

    static async createPromoCode(data: { code: string; discountPercentage: number; maxUses?: number; expiresAt?: Date }) {
        const existing = await PromoCodeModel.findOne({ code: data.code.toUpperCase() });
        if (existing) throw BadRequestException({ message: 'كود الخصم موجود بالفعل' });
        
        return PromoCodeModel.create({
            ...data,
            code: data.code.toUpperCase()
        });
    }

    static async togglePromoCode(id: string) {
        const promo = await PromoCodeModel.findById(id);
        if (!promo) throw NotFoundException({ message: 'كود الخصم غير موجود' });
        
        promo.isActive = !promo.isActive;
        await promo.save();
        return promo;
    }

    static async deletePromoCode(id: string) {
        const result = await PromoCodeModel.findByIdAndDelete(id);
        if (!result) throw NotFoundException({ message: 'كود الخصم غير موجود' });
        return true;
    }

    static async validatePromoCode(code: string) {
        const promo = await PromoCodeModel.findOne({ code: code.toUpperCase() });
        if (!promo) throw BadRequestException({ message: 'كود الخصم غير صحيح' });
        if (!promo.isActive) throw BadRequestException({ message: 'كود الخصم غير مفعل' });
        if (promo.expiresAt && promo.expiresAt < new Date()) throw BadRequestException({ message: 'كود الخصم منتهي الصلاحية' });
        if (promo.maxUses && promo.usedCount >= promo.maxUses) throw BadRequestException({ message: 'تم تجاوز الحد الأقصى لاستخدام كود الخصم' });
        
        return promo;
    }

    // ── Announcements ──────────────────────────────────────────────────────

    static async getAnnouncements() {
        return AnnouncementModel.find().sort({ createdAt: -1 }).lean();
    }

    static async getActiveAnnouncements() {
        return AnnouncementModel.find({ 
            isActive: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        }).sort({ createdAt: -1 }).lean();
    }

    static async createAnnouncement(data: { title: string; content: string; type: 'info' | 'warning' | 'success'; expiresAt?: Date }) {
        return AnnouncementModel.create(data);
    }

    static async toggleAnnouncement(id: string) {
        const ann = await AnnouncementModel.findById(id);
        if (!ann) throw NotFoundException({ message: 'الإشعار غير موجود' });
        
        ann.isActive = !ann.isActive;
        await ann.save();
        return ann;
    }

    static async deleteAnnouncement(id: string) {
        const result = await AnnouncementModel.findByIdAndDelete(id);
        if (!result) throw NotFoundException({ message: 'الإشعار غير موجود' });
        return true;
    }
}

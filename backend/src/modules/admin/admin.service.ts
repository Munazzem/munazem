import { UserModel }         from '../../database/models/user.model.js';
import { StudentModel }      from '../../database/models/student.model.js';
import { GroupModel }        from '../../database/models/group.model.js';
import { SessionModel }      from '../../database/models/session.model.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { ErrorLogModel }     from '../../database/models/error-log.model.js';
import { UserRole, SubscriptionStatus } from '../../common/enums/enum.service.js';

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

        // Monthly revenue from active subscriptions
        const revenueAgg = await SubscriptionModel.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const monthlyRevenue = revenueAgg[0]?.total ?? 0;

        return {
            totalTeachers,
            activeTeachers,
            inactiveTeachers:     totalTeachers - activeTeachers,
            totalStudents,
            activeSubscriptions,
            expiredSubscriptions,
            newTeachersThisMonth,
            monthlyRevenue,
            recentErrorsThisMonth: recentErrors,
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
}

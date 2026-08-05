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
import { MessageLogModel } from '../../database/models/message-log.model.js';
import { UserRole, SubscriptionStatus, SubscriptionPlan, PLAN_PRICES } from '../../common/enums/enum.service.js';
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
                    mrr: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$durationMonths', 0] }, 0] }, 
                                0, 
                                { $divide: ['$amount', '$durationMonths'] }
                            ]
                        } 
                    } 
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

    // ── Update Tenant Profile ─────────────────────────────────────────
    static async updateTenant(id: string, updateData: { name?: string; phone?: string; stages?: string[]; subject?: string; centerName?: string }) {
        const teacher = await UserModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password').lean();
        
        if (!teacher) throw NotFoundException({ message: 'Teacher not found' });
        return teacher;
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

    // ── Queues (WhatsApp) ────────────────────────────────────────────
    static async getWhatsAppQueueStatus(filters?: { phone?: string; teacherId?: string }) {
        const { whatsAppQueue } = await import('../../infrastructure/queues/whatsapp.queue.js');
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            whatsAppQueue.getWaitingCount(),
            whatsAppQueue.getActiveCount(),
            whatsAppQueue.getCompletedCount(),
            whatsAppQueue.getFailedCount(),
            whatsAppQueue.getDelayedCount(),
        ]);

        let recentFailed = await whatsAppQueue.getFailed(0, 50);
        let recentCompleted = await whatsAppQueue.getCompleted(0, 50);

        if (filters?.phone) {
            const phone = filters.phone.replace(/\D/g, '');
            recentFailed = recentFailed.filter(job => {
                const d = job?.data as any;
                const jobPhone = String(d?.parentPhone || d?.phone || '').replace(/\D/g, '');
                return jobPhone.includes(phone);
            });
            recentCompleted = recentCompleted.filter(job => {
                const d = job?.data as any;
                const jobPhone = String(d?.parentPhone || d?.phone || '').replace(/\D/g, '');
                return jobPhone.includes(phone);
            });
        }
        if (filters?.teacherId) {
            recentFailed = recentFailed.filter(job => {
                const d = job?.data as any;
                return String(d?.teacherId) === filters.teacherId;
            });
            recentCompleted = recentCompleted.filter(job => {
                const d = job?.data as any;
                return String(d?.teacherId) === filters.teacherId;
            });
        }

        return {
            counts: { waiting, active, completed, failed, delayed },
            recentFailed: recentFailed.slice(0, 20).map(job => ({
                id: job?.id,
                name: job?.name,
                data: job?.data,
                failedReason: job?.failedReason,
                timestamp: job?.timestamp
            })),
            recentCompleted: recentCompleted.slice(0, 20).map(job => ({
                id: job?.id,
                name: job?.name,
                data: job?.data,
                timestamp: job?.timestamp,
                finishedOn: job?.finishedOn
            }))
        };
    }

    static async retryAllFailedWhatsAppJobs() {
        const { whatsAppQueue } = await import('../../infrastructure/queues/whatsapp.queue.js');
        const failedJobs = await whatsAppQueue.getFailed(0, 100);
        let retried = 0;
        for (const job of failedJobs) {
            try { await job.retry(); retried++; } catch { /* skip */ }
        }
        return { retried };
    }

    static async clearAllFailedWhatsAppJobs() {
        const { whatsAppQueue } = await import('../../infrastructure/queues/whatsapp.queue.js');
        const failedJobs = await whatsAppQueue.getFailed(0, 500);
        let cleared = 0;
        for (const job of failedJobs) {
            try { await job.remove(); cleared++; } catch { /* skip */ }
        }
        return { cleared };
    }

    // ── Monitoring: Message History (paginated from MongoDB) ──────────
    static async getMessageHistory(params: {
        page?: number; limit?: number; kind?: string; status?: string;
        teacherId?: string; phone?: string; search?: string;
    }) {
        const page  = Math.max(1, params.page  ?? 1);
        const limit = Math.min(100, Math.max(1, params.limit ?? 30));
        const skip  = (page - 1) * limit;

        const filter: any = {};
        if (params.kind)      filter.kind      = params.kind;
        if (params.status)    filter.status     = params.status;
        if (params.teacherId) filter.teacherId  = params.teacherId;
        if (params.phone)     filter.parentPhone = { $regex: params.phone, $options: 'i' };

        const [data, total] = await Promise.all([
            MessageLogModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('teacherId', 'name phone subject')
                .lean(),
            MessageLogModel.countDocuments(filter),
        ]);

        return {
            data,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ── Monitoring: Comprehensive Message Statistics ──────────────────
    static async getMessageStatistics() {
        const now        = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart  = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get BullMQ queue counts
        const { whatsAppQueue } = await import('../../infrastructure/queues/whatsapp.queue.js');
        const [waiting, active, delayed, failed] = await Promise.all([
            whatsAppQueue.getWaitingCount(),
            whatsAppQueue.getActiveCount(),
            whatsAppQueue.getDelayedCount(),
            whatsAppQueue.getFailedCount(),
        ]);

        // MessageLog-based stats
        const [todayTotal, weekTotal, monthTotal, todaySent, todayFailed, monthSent, monthFailed] = await Promise.all([
            MessageLogModel.countDocuments({ createdAt: { $gte: todayStart } }),
            MessageLogModel.countDocuments({ createdAt: { $gte: weekStart } }),
            MessageLogModel.countDocuments({ createdAt: { $gte: monthStart } }),
            MessageLogModel.countDocuments({ createdAt: { $gte: todayStart }, status: 'sent' }),
            MessageLogModel.countDocuments({ createdAt: { $gte: todayStart }, status: 'failed' }),
            MessageLogModel.countDocuments({ createdAt: { $gte: monthStart }, status: 'sent' }),
            MessageLogModel.countDocuments({ createdAt: { $gte: monthStart }, status: 'failed' }),
        ]);

        // Kind breakdown this month
        const kindBreakdown = await MessageLogModel.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            { $group: { _id: '$kind', count: { $sum: 1 } } },
        ]);

        const successRate = monthTotal > 0
            ? Math.round((monthSent / monthTotal) * 100)
            : 0;

        // System health
        const mem    = process.memoryUsage();
        const uptime = Math.floor(process.uptime());

        return {
            queue: { waiting, active, delayed, failed },
            messages: {
                today:      todayTotal,
                thisWeek:   weekTotal,
                thisMonth:  monthTotal,
                todaySent,
                todayFailed,
                monthSent,
                monthFailed,
                successRate,
            },
            kindBreakdown: Object.fromEntries(kindBreakdown.map(k => [k._id, k.count])),
            system: {
                uptime,
                memoryMB: Math.round(mem.rss / 1024 / 1024),
                heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                nodeVersion: process.version,
            },
        };
    }

    // ── Monitoring: WhatsApp Connections ──────────────────────────────
    static async getWhatsAppConnections() {
        const teachers = await UserModel.find(
            { role: UserRole.teacher, isActive: true },
            { name: 1, phone: 1, whatsappStatus: 1, subject: 1, updatedAt: 1 },
        ).sort({ whatsappStatus: -1, name: 1 }).lean();

        // Get active subscription info for each teacher
        const teacherIds = teachers.map(t => t._id);
        const subs = await SubscriptionModel.find({
            teacherId: { $in: teacherIds },
            status: SubscriptionStatus.ACTIVE,
            endDate: { $gt: new Date() },
        }, { teacherId: 1, planTier: 1, endDate: 1 }).lean();

        const subMap = new Map(subs.map(s => [s.teacherId.toString(), s]));

        const connected    = teachers.filter(t => t.whatsappStatus === 'connected').length;
        const disconnected = teachers.filter(t => t.whatsappStatus === 'disconnected').length;
        const pending      = teachers.filter(t => t.whatsappStatus === 'pending').length;

        return {
            summary: { connected, disconnected, pending, total: teachers.length },
            teachers: teachers.map(t => {
                const sub = subMap.get(t._id.toString());
                return {
                    _id:            t._id,
                    name:           t.name,
                    phone:          t.phone,
                    subject:        (t as any).subject,
                    whatsappStatus: t.whatsappStatus,
                    planTier:       sub?.planTier ?? null,
                    isPremium:      sub?.planTier === SubscriptionPlan.PREMIUM,
                    subExpiresAt:   sub?.endDate ?? null,
                    lastUpdate:     t.updatedAt,
                };
            }),
        };
    }

    // ── Monitoring: Per-Teacher Message Stats ─────────────────────────
    static async getTeacherMessageStats() {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const stats = await MessageLogModel.aggregate([
            { $match: { createdAt: { $gte: monthStart } } },
            {
                $group: {
                    _id: '$teacherId',
                    total:  { $sum: 1 },
                    sent:   { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                    queued: { $sum: { $cond: [{ $eq: ['$status', 'queued'] }, 1, 0] } },
                    lastMessage: { $max: '$createdAt' },
                },
            },
            { $sort: { total: -1 } },
        ]);

        // Enrich with teacher info
        const teacherIds = stats.map(s => s._id);
        const teachers = await UserModel.find(
            { _id: { $in: teacherIds } },
            { name: 1, phone: 1, whatsappStatus: 1, subject: 1 },
        ).lean();
        const teacherMap = new Map(teachers.map(t => [t._id.toString(), t]));

        return stats.map(s => {
            const teacher = teacherMap.get(s._id.toString());
            return {
                teacherId: s._id,
                teacherName: teacher?.name ?? 'Unknown',
                teacherPhone: teacher?.phone,
                subject: (teacher as any)?.subject,
                whatsappStatus: teacher?.whatsappStatus,
                total:   s.total,
                sent:    s.sent,
                failed:  s.failed,
                queued:  s.queued,
                successRate: s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0,
                lastMessage: s.lastMessage,
            };
        });
    }

    // ── WhatsApp Templates Management ────────────────────────────────────────────────────────
    
    static async getWhatsAppTemplates(): Promise<any> {
        const doc = await PlatformSettingsModel.findOne({ key: 'whatsapp_templates' }).lean();
        if (doc && doc.value) return doc.value;
        
        // Return defaults if none exist
        const { DEFAULT_SESSION_ABSENT_TEMPLATES, DEFAULT_EXAM_RESULT_TEMPLATES } = await import('../../infrastructure/queues/whatsapp.templates.js');
        return {
            session_absent: DEFAULT_SESSION_ABSENT_TEMPLATES,
            exam_result: DEFAULT_EXAM_RESULT_TEMPLATES,
        };
    }

    static async updateWhatsAppTemplates(templates: { session_absent: string[]; exam_result: string[] }): Promise<any> {
        if (!templates.session_absent || templates.session_absent.length < 3) {
            throw new Error('يجب إدخال 3 صيغ على الأقل لرسائل الغياب لتجنب الحظر');
        }
        if (!templates.exam_result || templates.exam_result.length < 3) {
            throw new Error('يجب إدخال 3 صيغ على الأقل لرسائل الامتحانات لتجنب الحظر');
        }

        // Clean out empty strings
        templates.session_absent = templates.session_absent.filter(t => t.trim().length > 0);
        templates.exam_result = templates.exam_result.filter(t => t.trim().length > 0);

        if (templates.session_absent.length < 3 || templates.exam_result.length < 3) {
            throw new Error('يجب إدخال 3 صيغ صحيحة على الأقل لكل قالب');
        }

        await PlatformSettingsModel.updateOne(
            { key: 'whatsapp_templates' },
            { $set: { value: templates } },
            { upsert: true }
        );

        // Clear cache so changes take effect immediately
        const { cache } = await import('../../infrastructure/cache/cache.service.js');
        await cache.del('whatsapp_dynamic_templates');

        return templates;
    }
}



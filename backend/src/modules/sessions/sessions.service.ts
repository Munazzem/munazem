import { SessionModel } from '../../database/models/session.model.js';
import { GroupModel }   from '../../database/models/group.model.js';
import { SessionStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import type { CreateSessionDTO } from '../../types/attendance-dto.types.js';

export class SessionService {

    // Create a new session for a group
    static async createSession(teacherId: string, data: CreateSessionDTO) {
        // Verify the group exists and belongs to this teacher
        const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة أو لا صلاحية لك عليها' });

        // Prevent duplicate session for same group on same day
        const sessionDate = new Date(data.date);
        sessionDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(sessionDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const existing = await SessionModel.findOne({
            groupId: data.groupId,
            date: { $gte: sessionDate, $lt: nextDay },
        }).lean();
        if (existing) throw ConflictException({ message: 'يوجد حصة مسجلة لهذه المجموعة في هذا اليوم بالفعل' });

        return await SessionModel.create({
            groupId:   data.groupId,
            teacherId,
            date:      new Date(data.date),
            startTime: data.startTime,
            status:    SessionStatus.SCHEDULED,
        });
    }

    // Get all sessions for a teacher (paginated), optionally filtered by groupId or date
    static async getSessionsByTeacher(teacherId: string, queryFilters: any = {}) {
        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip  = (page - 1) * limit;

        const filter: any = { teacherId };
        if (queryFilters.groupId) filter.groupId = queryFilters.groupId;
        if (queryFilters.status)  filter.status  = queryFilters.status;
        
        // Exact Date match
        if (queryFilters.date) {
            const d = new Date(queryFilters.date);
            d.setHours(0, 0, 0, 0);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.date = { $gte: d, $lt: next };
        } 
        // Date Range match (startDate - endDate)
        else if (queryFilters.startDate || queryFilters.endDate) {
            filter.date = {};
            if (queryFilters.startDate) {
                const d = new Date(queryFilters.startDate);
                d.setHours(0, 0, 0, 0);
                filter.date.$gte = d;
            }
            if (queryFilters.endDate) {
                const d = new Date(queryFilters.endDate);
                d.setHours(23, 59, 59, 999);
                filter.date.$lte = d;
            }
        }

        const [data, total] = await Promise.all([
            SessionModel.find(filter)
                .sort({ date: -1, startTime: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SessionModel.countDocuments(filter),
        ]);

        return {
            data,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // Get session by ID — validates ownership
    static async getSessionById(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });
        return session;
    }

    // Update session status — e.g., mark as IN_PROGRESS or CANCELLED
    static async updateSessionStatus(sessionId: string, teacherId: string, status: SessionStatus) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'لا يمكن تعديل حصة مكتملة' });
        }

        return await SessionModel.findByIdAndUpdate(
            sessionId,
            { status },
            { new: true, runValidators: true }
        ).lean();
    }

    // ─── Auto-generate week sessions from group schedules ────────────
    // weekStart: ISO date string of the week's start day (e.g., Saturday "2026-03-07")
    static async generateWeekSessions(teacherId: string, weekStart: string) {
        // Arabic day name → JS getUTCDay() (0 = Sunday)
        const dayMap: Record<string, number> = {
            'الأحد':     0,
            'الاثنين':   1,
            'الثلاثاء':  2,
            'الأربعاء':  3,
            'الخميس':    4,
            'الجمعة':    5,
            'السبت':     6,
        };

        const startDate = new Date(weekStart);
        startDate.setUTCHours(0, 0, 0, 0);
        const startDayOfWeek = startDate.getUTCDay(); // 0–6

        // Get all active groups with schedule
        const groups = await GroupModel.find(
            { teacherId },
            { _id: 1, schedule: 1 }
        ).lean();

        let createdCount = 0;
        let skippedCount = 0;

        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0) continue;

            for (const slot of group.schedule) {
                const targetDay = dayMap[slot.day];
                if (targetDay === undefined) continue; // unknown day name — skip

                // Calculate how many days from weekStart to that day
                let diff = targetDay - startDayOfWeek;
                if (diff < 0) diff += 7; // wrap to next occurrence within the week

                const sessionDate = new Date(startDate);
                sessionDate.setUTCDate(startDate.getUTCDate() + diff);

                // Duplicate guard (same logic as createSession)
                const nextDay = new Date(sessionDate);
                nextDay.setUTCDate(sessionDate.getUTCDate() + 1);

                const existing = await SessionModel.findOne({
                    groupId: group._id,
                    date: { $gte: sessionDate, $lt: nextDay },
                }).lean();

                if (existing) {
                    skippedCount++;
                    continue;
                }

                await SessionModel.create({
                    groupId:   group._id,
                    teacherId,
                    date:      sessionDate,
                    startTime: slot.time,
                    status:    SessionStatus.SCHEDULED,
                });

                createdCount++;
            }
        }

        return {
            weekStart,
            createdCount,
            skippedCount,
            message: `تم إنشاء ${createdCount} حصة، تم تجاهل ${skippedCount} حصة موجودة مسبقاً`,
        };
    }
}

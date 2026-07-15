import { SessionModel } from '../../database/models/session.model.js';
import { GroupModel }   from '../../database/models/group.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { SessionStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import type { CreateSessionDTO } from '../../types/attendance-dto.types.js';
import { DAY_MAP } from '../../common/utils/date.util.js';

/**
 * Given a group schedule and a reference date, returns the next available
 * schedule slot AFTER that date (i.e. the day strictly after `afterDate`).
 */
function findNextScheduleSlot(
    schedule: { day: string; time: string }[],
    afterDate: Date
): { date: Date; time: string } {
    const candidates = schedule
        .map(slot => {
            const targetDay = DAY_MAP[slot.day];
            if (targetDay === undefined) return null;

            // Start searching from the day AFTER afterDate
            const next = new Date(afterDate);
            next.setUTCDate(next.getUTCDate() + 1);

            const diff = (targetDay - next.getUTCDay() + 7) % 7;
            next.setUTCDate(next.getUTCDate() + diff);
            next.setUTCHours(0, 0, 0, 0);

            return { date: next, time: slot.time };
        })
        .filter(Boolean) as { date: Date; time: string }[];

    // Return the earliest candidate
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candidates[0]!;
}

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
            startTime: data.startTime,
        }).lean();
        if (existing) throw ConflictException({ message: 'يوجد حصة مسجلة لهذه المجموعة في نفس اليوم والوقت بالفعل' });

        const session = await SessionModel.create({
            groupId:   data.groupId,
            teacherId,
            date:      new Date(data.date),
            startTime: data.startTime,
            status:    SessionStatus.SCHEDULED,
        });

        // ── Enforce monthly quota ───────────────────────────────────────
        const targetDate = new Date(data.date);
        const year = targetDate.getUTCFullYear();
        const month = targetDate.getUTCMonth(); // 0-11
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month + 1, 1));

        const currentCount = await SessionModel.countDocuments({
            groupId: data.groupId,
            date: { $gte: monthStart, $lt: monthEnd },
            status: { $ne: SessionStatus.CANCELLED }
        });

        const maxSessions = (group.schedule?.length ?? 2) * 4;

        if (currentCount > maxSessions) {
            const lastSession = await SessionModel.findOne({
                groupId: data.groupId,
                status: SessionStatus.SCHEDULED,
                date: { $gte: monthStart, $lt: monthEnd }
            }).sort({ date: -1, startTime: -1 }).lean();

            if (lastSession && lastSession._id.toString() !== session._id.toString()) {
                await SessionModel.findByIdAndDelete(lastSession._id);
                await AttendanceModel.deleteMany({ sessionId: lastSession._id });
            }
        }

        return session;
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
    // When CANCELLED: deletes attendance records and auto-generates a replacement session.
    static async updateSessionStatus(sessionId: string, teacherId: string, status: SessionStatus) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'لا يمكن تعديل حصة مكتملة' });
        }

        // ── Handle CANCELLED — clean up ──────────────────
        let replacementSession = null;
        if (status === SessionStatus.CANCELLED) {
            // 1. Delete any attendance records linked to this session
            await AttendanceModel.deleteMany({ sessionId });
        }

        const updated = await SessionModel.findByIdAndUpdate(
            sessionId,
            { status },
            { new: true, runValidators: true }
        ).lean();

        return { session: updated, replacementSession };
    }

    // Delete session permanently — NO replacement generated.
    // Used for end-of-term cleanup or removing unnecessary sessions.
    static async deleteSession(sessionId: string, teacherId: string) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'لا يمكن حذف حصة مكتملة' });
        }

        // Delete any attendance records for this session
        await AttendanceModel.deleteMany({ sessionId });

        // Delete the session document itself
        await SessionModel.findByIdAndDelete(sessionId);

        return { message: 'تم حذف الحصة بدون تعويض' };
    }

    // ─── Auto-generate today's sessions from group schedules ─────────
    static async generateTodaySessions(teacherId: string) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayDayOfWeek = today.getUTCDay(); // 0-6
        const dateStr = today.toISOString().split('T')[0];

        // Get all active groups with schedule
        const groups = await GroupModel.find(
            { teacherId },
            { _id: 1, schedule: 1 }
        ).lean();

        // Step 1: Build candidate sessions for today
        const candidates: { groupId: any; date: Date; time: string }[] = [];

        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0) continue;

            for (const slot of group.schedule) {
                const targetDay = DAY_MAP[slot.day];
                if (targetDay === todayDayOfWeek) {
                    candidates.push({ groupId: group._id, date: today, time: slot.time });
                }
            }
        }

        if (candidates.length === 0) {
            return { date: dateStr, createdCount: 0, skippedCount: 0, message: 'لا توجد حصص مجدولة لهذا اليوم' };
        }

        // Step 2: Single batch existence check for today
        const nextDay = new Date(today);
        nextDay.setUTCDate(today.getUTCDate() + 1);

        const groupIds = [...new Set(candidates.map(c => c.groupId.toString()))];
        const existingSessions = await SessionModel.find(
            {
                groupId: { $in: groupIds },
                date: { $gte: today, $lt: nextDay },
            },
            { groupId: 1, date: 1, startTime: 1 }
        ).lean();

        const existingSet = new Set(
            existingSessions.map(s => `${s.groupId.toString()}_${s.startTime}`)
        );

        // Step 3: Filter out duplicates and insertMany
        const toCreate = candidates
            .filter(c => !existingSet.has(`${c.groupId.toString()}_${c.time}`))
            .map(c => ({
                groupId:   c.groupId,
                teacherId,
                date:      c.date,
                startTime: c.time,
                status:    SessionStatus.SCHEDULED,
            }));

        const skippedCount = candidates.length - toCreate.length;

        if (toCreate.length > 0) {
            await SessionModel.insertMany(toCreate);
        }

        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId:   teacherId,
            meta:     { type: 'today', date: dateStr, createdCount: toCreate.length, skippedCount },
        });

        return {
            date: dateStr,
            createdCount: toCreate.length,
            skippedCount,
            message: `تم إنشاء ${toCreate.length} حصة لليوم، تم تجاهل ${skippedCount} حصة موجودة مسبقاً`,
        };
    }

    // ─── Auto-generate week sessions from group schedules ────────────
    // weekStart: ISO date string of the week's start day (e.g., Saturday "2026-03-07")
    // Optimized: uses batch existence check + insertMany instead of N+1 queries
    static async generateWeekSessions(teacherId: string, weekStart: string) {
        const startDate = new Date(weekStart);
        startDate.setUTCHours(0, 0, 0, 0);
        const startDayOfWeek = startDate.getUTCDay(); // 0–6

        // Get all active groups with schedule
        const groups = await GroupModel.find(
            { teacherId },
            { _id: 1, schedule: 1 }
        ).lean();

        // Step 1: Build all candidate sessions
        const candidates: { groupId: any; date: Date; time: string }[] = [];

        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0) continue;

            for (const slot of group.schedule) {
                const targetDay = DAY_MAP[slot.day];
                if (targetDay === undefined) continue;

                let diff = targetDay - startDayOfWeek;
                if (diff < 0) diff += 7;

                const sessionDate = new Date(startDate);
                sessionDate.setUTCDate(startDate.getUTCDate() + diff);

                candidates.push({ groupId: group._id, date: sessionDate, time: slot.time });
            }
        }

        if (candidates.length === 0) {
            return { weekStart, createdCount: 0, skippedCount: 0, message: 'لا توجد مجموعات بجداول محددة' };
        }

        // Step 2: Single batch existence check for the entire week
        const weekEnd = new Date(startDate);
        weekEnd.setUTCDate(startDate.getUTCDate() + 7);

        const groupIds = [...new Set(candidates.map(c => c.groupId.toString()))];
        const existingSessions = await SessionModel.find(
            {
                groupId: { $in: groupIds },
                date: { $gte: startDate, $lt: weekEnd },
            },
            { groupId: 1, date: 1 }
        ).lean();

        // Build a Set of "groupId_YYYY-MM-DD" keys for O(1) lookup
        const existingSet = new Set(
            existingSessions.map(s =>
                `${s.groupId.toString()}_${s.date.toISOString().split('T')[0]}`
            )
        );

        // Step 3: Filter out duplicates and insertMany
        const toCreate = candidates
            .filter(c => !existingSet.has(
                `${c.groupId.toString()}_${c.date.toISOString().split('T')[0]}`
            ))
            .map(c => ({
                groupId:   c.groupId,
                teacherId,
                date:      c.date,
                startTime: c.time,
                status:    SessionStatus.SCHEDULED,
            }));

        const skippedCount = candidates.length - toCreate.length;

        if (toCreate.length > 0) {
            await SessionModel.insertMany(toCreate);
        }

        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId:   teacherId,
            meta:     { type: 'week', weekStart, createdCount: toCreate.length, skippedCount },
        });

        return {
            weekStart,
            createdCount: toCreate.length,
            skippedCount,
            message: `تم إنشاء ${toCreate.length} حصة، تم تجاهل ${skippedCount} حصة موجودة مسبقاً`,
        };
    }

}

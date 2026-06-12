import { SessionModel } from '../../database/models/session.model.js';
import { GroupModel }   from '../../database/models/group.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { SessionStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import type { CreateSessionDTO } from '../../types/attendance-dto.types.js';
// ─── Day-name helper ─────────────────────────────────────────────────────────
const DAY_MAP: Record<string, number> = {
    'الأحد':     0, 'الاحد':     0,
    'الاثنين':   1, 'الإثنين':   1,
    'الثلاثاء':  2,
    'الأربعاء':  3, 'الاربعاء':  3,
    'الخميس':    4,
    'الجمعة':    5,
    'السبت':     6,
};

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
    // When CANCELLED: deletes attendance records and auto-generates a replacement session.
    static async updateSessionStatus(sessionId: string, teacherId: string, status: SessionStatus) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'لا يمكن تعديل حصة مكتملة' });
        }

        // ── Handle CANCELLED — clean up + auto-replacement ──────────────────
        let replacementSession = null;
        if (status === SessionStatus.CANCELLED) {
            // 1. Delete any attendance records linked to this session
            await AttendanceModel.deleteMany({ sessionId });

            // 2. Generate a replacement session after the last non-cancelled session
            const group = await GroupModel.findById(session.groupId, { schedule: 1 }).lean();
            if (group && group.schedule && group.schedule.length > 0) {
                // Find the last non-cancelled session for this group
                const lastSession = await SessionModel.findOne({
                    groupId: session.groupId,
                    status: { $ne: SessionStatus.CANCELLED },
                    _id: { $ne: sessionId }, // exclude the one being cancelled
                }).sort({ date: -1 }).lean();

                const referenceDate = lastSession?.date || session.date;
                const nextSlot = findNextScheduleSlot(group.schedule, referenceDate);

                if (nextSlot) {
                    // Duplicate guard — avoid creating on a day that already has a session
                    const nextDay = new Date(nextSlot.date);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                    const exists = await SessionModel.findOne({
                        groupId: session.groupId,
                        date: { $gte: nextSlot.date, $lt: nextDay },
                    }).lean();

                    if (!exists) {
                        replacementSession = await SessionModel.create({
                            groupId:   session.groupId,
                            teacherId: session.teacherId,
                            date:      nextSlot.date,
                            startTime: nextSlot.time,
                            status:    SessionStatus.SCHEDULED,
                        });
                    }
                }
            }
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

    // ─── Auto-generate week sessions from group schedules ────────────
    // weekStart: ISO date string of the week's start day (e.g., Saturday "2026-03-07")
    static async generateWeekSessions(teacherId: string, weekStart: string) {
        // Arabic day name → JS getUTCDay() (0 = Sunday)
        const dayMap: Record<string, number> = {
            'الأحد':     0,
            'الاحد':     0,
            'الاثنين':   1,
            'الإثنين':   1,
            'الثلاثاء':  2,
            'الأربعاء':  3,
            'الاربعاء':  3,
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

        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId:   teacherId,
            meta:     { type: 'week', weekStart, createdCount, skippedCount },
        });

        return {
            weekStart,
            createdCount,
            skippedCount,
            message: `تم إنشاء ${createdCount} حصة، تم تجاهل ${skippedCount} حصة موجودة مسبقاً`,
        };
    }

    // ─── Auto-generate month sessions from group schedules ───────────
    // year: full year e.g. 2026, month: 1-12
    // Max sessions per group = schedule.length × 4 (dynamic based on schedule)
    static async generateMonthSessions(teacherId: string, year: number, month: number) {
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        // First and last day of the month (UTC)
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd   = new Date(Date.UTC(year, month, 1)); // exclusive

        // Get all groups with schedule
        const groups = await GroupModel.find(
            { teacherId },
            { _id: 1, schedule: 1 }
        ).lean();

        let createdCount = 0;
        let skippedCount = 0;

        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0) continue;

            // Dynamic max: schedule slots per week × 4 weeks
            const maxSessions = (group.schedule?.length ?? 2) * 4;

            // Count existing NON-CANCELLED sessions for this group in this month
            let groupSessionCount = await SessionModel.countDocuments({
                groupId: group._id,
                date: { $gte: monthStart, $lt: monthEnd },
                status: { $ne: SessionStatus.CANCELLED }
            });

            // To preserve chronological order and avoid skipping days (e.g. Wednesday in the middle of the month),
            // we first collect all possible dates matching the schedule, sort them, and THEN apply the 8-session limit.
            const possibleDates: { date: Date, time: string }[] = [];

            for (const slot of group.schedule) {
                const targetDay = DAY_MAP[slot.day];
                if (targetDay === undefined) continue;

                // Find the first occurrence of that weekday in the month (on or after today)
                const startDayToUse = monthStart > today ? monthStart : today;
                const diff = (targetDay - startDayToUse.getUTCDay() + 7) % 7;
                
                const firstOccurrence = new Date(startDayToUse);
                firstOccurrence.setUTCDate(startDayToUse.getUTCDate() + diff);

                let sessionDate = new Date(firstOccurrence);
                while (sessionDate < monthEnd) {
                    possibleDates.push({ date: new Date(sessionDate), time: slot.time });
                    // Advance to next week
                    sessionDate.setUTCDate(sessionDate.getUTCDate() + 7);
                }
            }

            // Sort chronologically
            possibleDates.sort((a, b) => a.date.getTime() - b.date.getTime());

            // Create sessions respecting the limit
            for (const slot of possibleDates) {
                if (groupSessionCount >= maxSessions) break;

                const sessionDate = slot.date;
                const nextDay = new Date(sessionDate);
                nextDay.setUTCDate(sessionDate.getUTCDate() + 1);

                const existing = await SessionModel.findOne({
                    groupId: group._id,
                    date: { $gte: sessionDate, $lt: nextDay },
                }).lean();

                if (existing) {
                    skippedCount++;
                } else {
                    await SessionModel.create({
                        groupId:   group._id,
                        teacherId,
                        date:      new Date(sessionDate),
                        startTime: slot.time,
                        status:    SessionStatus.SCHEDULED,
                    });
                    createdCount++;
                    groupSessionCount++;
                }
            }
        }

        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId:   teacherId,
            meta:     { type: 'month', year, month, createdCount, skippedCount },
        });

        return {
            year,
            month,
            createdCount,
            skippedCount,
            message: `تم إنشاء ${createdCount} حصة لشهر ${month}/${year}، تجاهل ${skippedCount} موجودة (الحد الأقصى ${(groups[0]?.schedule?.length ?? 2) * 4} حصة لكل مجموعة)`,
        };
    }
}

import { SessionModel } from '../../database/models/session.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { SessionStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import { DAY_MAP } from '../../common/utils/date.util.js';
/**
 * Given a group schedule and a reference date, returns the next available
 * schedule slot AFTER that date (i.e. the day strictly after `afterDate`).
 */
function findNextScheduleSlot(schedule, afterDate) {
    const candidates = schedule
        .map(slot => {
        const targetDay = DAY_MAP[slot.day];
        if (targetDay === undefined)
            return null;
        // Start searching from the day AFTER afterDate
        const next = new Date(afterDate);
        next.setUTCDate(next.getUTCDate() + 1);
        const diff = (targetDay - next.getUTCDay() + 7) % 7;
        next.setUTCDate(next.getUTCDate() + diff);
        next.setUTCHours(0, 0, 0, 0);
        return { date: next, time: slot.time };
    })
        .filter(Boolean);
    // Return the earliest candidate
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candidates[0];
}
export class SessionService {
    // Create a new session for a group
    static async createSession(teacherId, data) {
        // Verify the group exists and belongs to this teacher
        const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
        if (!group)
            throw NotFoundException({ message: 'المجموعة غير موجودة أو لا صلاحية لك عليها' });
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
        if (existing)
            throw ConflictException({ message: 'يوجد حصة مسجلة لهذه المجموعة في نفس اليوم والوقت بالفعل' });
        const session = await SessionModel.create({
            groupId: data.groupId,
            teacherId,
            date: new Date(data.date),
            startTime: data.startTime,
            status: SessionStatus.SCHEDULED,
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
    static async getSessionsByTeacher(teacherId, queryFilters = {}) {
        const page = Math.max(1, parseInt(queryFilters.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip = (page - 1) * limit;
        const filter = { teacherId };
        if (queryFilters.groupId)
            filter.groupId = queryFilters.groupId;
        if (queryFilters.status)
            filter.status = queryFilters.status;
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
    static async getSessionById(sessionId, teacherId) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session)
            throw NotFoundException({ message: 'الحصة غير موجودة' });
        return session;
    }
    // Update session status — e.g., mark as IN_PROGRESS or CANCELLED
    // When CANCELLED: deletes attendance records and auto-generates a replacement session.
    static async updateSessionStatus(sessionId, teacherId, status) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session)
            throw NotFoundException({ message: 'الحصة غير موجودة' });
        if (session.status === SessionStatus.COMPLETED) {
            throw BadRequestException({ message: 'لا يمكن تعديل حصة مكتملة' });
        }
        // ── Handle CANCELLED — clean up ──────────────────
        let replacementSession = null;
        if (status === SessionStatus.CANCELLED) {
            // 1. Delete any attendance records linked to this session
            await AttendanceModel.deleteMany({ sessionId });
        }
        const updated = await SessionModel.findByIdAndUpdate(sessionId, { status }, { new: true, runValidators: true }).lean();
        return { session: updated, replacementSession };
    }
    // Delete session permanently — NO replacement generated.
    // Used for end-of-term cleanup or removing unnecessary sessions.
    static async deleteSession(sessionId, teacherId) {
        const session = await SessionModel.findOne({ _id: sessionId, teacherId }).lean();
        if (!session)
            throw NotFoundException({ message: 'الحصة غير موجودة' });
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
    // Optimized: uses batch existence check + insertMany instead of N+1 queries
    static async generateWeekSessions(teacherId, weekStart) {
        const startDate = new Date(weekStart);
        startDate.setUTCHours(0, 0, 0, 0);
        const startDayOfWeek = startDate.getUTCDay(); // 0–6
        // Get all active groups with schedule
        const groups = await GroupModel.find({ teacherId }, { _id: 1, schedule: 1 }).lean();
        // Step 1: Build all candidate sessions
        const candidates = [];
        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0)
                continue;
            for (const slot of group.schedule) {
                const targetDay = DAY_MAP[slot.day];
                if (targetDay === undefined)
                    continue;
                let diff = targetDay - startDayOfWeek;
                if (diff < 0)
                    diff += 7;
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
        const existingSessions = await SessionModel.find({
            groupId: { $in: groupIds },
            date: { $gte: startDate, $lt: weekEnd },
        }, { groupId: 1, date: 1 }).lean();
        // Build a Set of "groupId_YYYY-MM-DD" keys for O(1) lookup
        const existingSet = new Set(existingSessions.map(s => `${s.groupId.toString()}_${s.date.toISOString().split('T')[0]}`));
        // Step 3: Filter out duplicates and insertMany
        const toCreate = candidates
            .filter(c => !existingSet.has(`${c.groupId.toString()}_${c.date.toISOString().split('T')[0]}`))
            .map(c => ({
            groupId: c.groupId,
            teacherId,
            date: c.date,
            startTime: c.time,
            status: SessionStatus.SCHEDULED,
        }));
        const skippedCount = candidates.length - toCreate.length;
        if (toCreate.length > 0) {
            await SessionModel.insertMany(toCreate);
        }
        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId: teacherId,
            meta: { type: 'week', weekStart, createdCount: toCreate.length, skippedCount },
        });
        return {
            weekStart,
            createdCount: toCreate.length,
            skippedCount,
            message: `تم إنشاء ${toCreate.length} حصة، تم تجاهل ${skippedCount} حصة موجودة مسبقاً`,
        };
    }
    // ─── Auto-generate month sessions from group schedules ───────────
    // year: full year e.g. 2026, month: 1-12
    // Max sessions per group = schedule.length × 4 (dynamic based on schedule)
    // Optimized: uses batch existence check + insertMany instead of N+1 queries
    static async generateMonthSessions(teacherId, year, month) {
        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        // First and last day of the month (UTC)
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive
        // Get all groups with schedule
        const groups = await GroupModel.find({ teacherId }, { _id: 1, schedule: 1 }).lean();
        // Step 1: Build all candidate sessions with per-group limits
        const candidates = [];
        for (const group of groups) {
            if (!group.schedule || group.schedule.length === 0)
                continue;
            const possibleDates = [];
            for (const slot of group.schedule) {
                const targetDay = DAY_MAP[slot.day];
                if (targetDay === undefined)
                    continue;
                const startDayToUse = monthStart > today ? monthStart : today;
                const diff = (targetDay - startDayToUse.getUTCDay() + 7) % 7;
                const firstOccurrence = new Date(startDayToUse);
                firstOccurrence.setUTCDate(startDayToUse.getUTCDate() + diff);
                let sessionDate = new Date(firstOccurrence);
                while (sessionDate < monthEnd) {
                    possibleDates.push({ date: new Date(sessionDate), time: slot.time });
                    sessionDate.setUTCDate(sessionDate.getUTCDate() + 7);
                }
            }
            // Sort chronologically
            possibleDates.sort((a, b) => a.date.getTime() - b.date.getTime());
            // Add to candidates (we'll enforce limits after existence check)
            for (const slot of possibleDates) {
                candidates.push({ groupId: group._id, date: slot.date, time: slot.time });
            }
        }
        if (candidates.length === 0) {
            return { year, month, createdCount: 0, skippedCount: 0, message: 'لا توجد مجموعات بجداول محددة' };
        }
        // Step 2: Single batch existence check for the entire month
        const groupIds = [...new Set(candidates.map(c => c.groupId.toString()))];
        const existingSessions = await SessionModel.find({
            groupId: { $in: groupIds },
            date: { $gte: monthStart, $lt: monthEnd },
        }, { groupId: 1, date: 1, status: 1 }).lean();
        // Build a Set of "groupId_YYYY-MM-DD" keys for O(1) duplicate lookup
        const existingSet = new Set(existingSessions.map(s => `${s.groupId.toString()}_${s.date.toISOString().split('T')[0]}`));
        // Count existing NON-CANCELLED sessions per group for limit enforcement
        const groupSessionCounts = new Map();
        for (const s of existingSessions) {
            if (s.status !== SessionStatus.CANCELLED) {
                const gid = s.groupId.toString();
                groupSessionCounts.set(gid, (groupSessionCounts.get(gid) ?? 0) + 1);
            }
        }
        // Build a map of groupId -> maxSessions for quick lookup
        const groupMaxSessions = new Map();
        for (const group of groups) {
            const maxSessions = (group.schedule?.length ?? 2) * 4;
            groupMaxSessions.set(group._id.toString(), maxSessions);
        }
        // Step 3: Filter candidates — remove duplicates and enforce per-group limits
        const toCreate = [];
        let skippedCount = 0;
        for (const c of candidates) {
            const gid = c.groupId.toString();
            const dateKey = `${gid}_${c.date.toISOString().split('T')[0]}`;
            if (existingSet.has(dateKey)) {
                skippedCount++;
                continue;
            }
            const currentCount = groupSessionCounts.get(gid) ?? 0;
            const maxSessions = groupMaxSessions.get(gid) ?? 8;
            if (currentCount >= maxSessions) {
                continue; // limit reached
            }
            toCreate.push({
                groupId: c.groupId,
                teacherId,
                date: c.date,
                startTime: c.time,
                status: SessionStatus.SCHEDULED,
            });
            // Track the count so subsequent candidates for the same group respect the limit
            groupSessionCounts.set(gid, currentCount + 1);
            // Also add to existingSet to prevent duplicates within the same batch
            existingSet.add(dateKey);
        }
        if (toCreate.length > 0) {
            await SessionModel.insertMany(toCreate);
        }
        trackEvent('sessions_generated', {
            tenantId: teacherId,
            userId: teacherId,
            meta: { type: 'month', year, month, createdCount: toCreate.length, skippedCount },
        });
        return {
            year,
            month,
            createdCount: toCreate.length,
            skippedCount,
            message: `تم إنشاء ${toCreate.length} حصة لشهر ${month}/${year}، تجاهل ${skippedCount} موجودة`,
        };
    }
}
//# sourceMappingURL=sessions.service.js.map
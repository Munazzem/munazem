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
        if (queryFilters.date) {
            const d = new Date(queryFilters.date);
            d.setHours(0, 0, 0, 0);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.date = { $gte: d, $lt: next };
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
}

import { SessionStatus } from '../../common/enums/enum.service.js';
import type { CreateSessionDTO } from '../../types/attendance-dto.types.js';
export declare class SessionService {
    static createSession(teacherId: string, data: CreateSessionDTO): Promise<import("mongoose").Document<unknown, {}, import("../../types/session.types.js").ISessionDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/session.types.js").ISessionDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static getSessionsByTeacher(teacherId: string, queryFilters?: any): Promise<{
        data: (import("../../types/session.types.js").ISessionDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static getSessionById(sessionId: string, teacherId: string): Promise<import("../../types/session.types.js").ISessionDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static updateSessionStatus(sessionId: string, teacherId: string, status: SessionStatus): Promise<{
        session: (import("../../types/session.types.js").ISessionDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
        replacementSession: null;
    }>;
    static deleteSession(sessionId: string, teacherId: string): Promise<{
        message: string;
    }>;
    static generateWeekSessions(teacherId: string, weekStart: string): Promise<{
        weekStart: string;
        createdCount: number;
        skippedCount: number;
        message: string;
    }>;
    static generateMonthSessions(teacherId: string, year: number, month: number): Promise<{
        year: number;
        month: number;
        createdCount: number;
        skippedCount: number;
        message: string;
    }>;
}
//# sourceMappingURL=sessions.service.d.ts.map
import { UserRole } from '../../common/enums/enum.service.js';
export declare class AdminService {
    static getOverviewStats(): Promise<{
        totalTeachers: number;
        activeTeachers: number;
        inactiveTeachers: number;
        totalStudents: number;
        activeSubscriptions: number;
        expiredSubscriptions: number;
        newTeachersThisMonth: number;
        monthlyRevenue: any;
        recentErrorsThisMonth: number;
    }>;
    static getGrowthData(): Promise<{
        label: string;
        count: any;
    }[]>;
    static getAllTenants(query: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
    }): Promise<{
        data: {
            studentCount: any;
            subscription: any;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            email: string;
            phone: string;
            password?: string;
            role: UserRole;
            teacherId: import("mongoose").Types.ObjectId | null;
            stage: import("../../common/enums/enum.service.js").TeacherStage | null;
            salary: number | null;
            isActive: boolean;
            centerName?: string;
            logoUrl?: string;
            whatsappQr?: string | null;
            whatsappStatus?: "disconnected" | "pending" | "connected";
            subject?: string;
            _id: import("mongoose").Types.ObjectId;
            $locals: Record<string, unknown>;
            $op: "save" | "validate" | "remove" | null;
            $where: Record<string, unknown>;
            baseModelName?: string;
            collection: import("mongoose").Collection;
            db: import("mongoose").Connection;
            errors?: import("mongoose").Error.ValidationError;
            isNew: boolean;
            schema: import("mongoose").Schema;
            __v: number;
        }[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static getTenantDetail(teacherId: string): Promise<{
        teacher: import("../../types/user.types.js").IUserDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        };
        studentCount: number;
        groupCount: number;
        sessionsThisMonth: number;
        subscription: (import("../../types/subscription.types.js").ISubscription & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
    } | null>;
    static getRecentErrors(query: {
        limit?: number;
        level?: string;
        page?: number;
    }): Promise<{
        data: (import("../../database/models/error-log.model.js").IErrorLog & {
            _id: import("mongoose").Types.ObjectId;
        } & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static setTenantStatus(teacherId: string, isActive: boolean): Promise<(import("../../types/user.types.js").IUserDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static getActivityFeed(query: {
        page?: number;
        limit?: number;
        event?: string;
        tenantId?: string;
    }): Promise<{
        data: {
            teacherName: any;
            event: string;
            tenantId: import("mongoose").Types.ObjectId;
            userId: import("mongoose").Types.ObjectId;
            targetId?: string;
            meta?: Record<string, unknown>;
            createdAt: Date;
            _id: import("mongoose").Types.ObjectId;
            __v: number;
        }[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=admin.service.d.ts.map
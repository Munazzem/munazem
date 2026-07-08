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
        monthlyRevenue: number;
        mrr: number;
        churnRate: number;
        recentErrorsThisMonth: number;
        topTeachers: any[];
        expiringSoon: {
            _id: import("mongoose").Types.ObjectId;
            planTier: import("../../common/enums/enum.service.js").SubscriptionPlan;
            endDate: Date;
            teacher: import("mongoose").Types.ObjectId;
        }[];
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
            assistantsAccessEnabled?: boolean;
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
    static updateTenant(id: string, updateData: {
        name?: string;
        phone?: string;
        stage?: string;
        subject?: string;
        centerName?: string;
    }): Promise<import("../../types/user.types.js").IUserDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
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
    static getPlatformSettings(): Promise<Record<string, any>>;
    static updatePlanPrices(newPrices: Record<string, number>): Promise<Record<string, any>>;
    static getPromoCodes(): Promise<(import("../../database/models/promo-code.model.js").IPromoCode & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static createPromoCode(data: {
        code: string;
        discountPercentage: number;
        maxUses?: number;
        expiresAt?: Date;
    }): Promise<import("mongoose").Document<unknown, {}, import("../../database/models/promo-code.model.js").IPromoCode, {}, import("mongoose").DefaultSchemaOptions> & import("../../database/models/promo-code.model.js").IPromoCode & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static togglePromoCode(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../database/models/promo-code.model.js").IPromoCode, {}, import("mongoose").DefaultSchemaOptions> & import("../../database/models/promo-code.model.js").IPromoCode & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static deletePromoCode(id: string): Promise<boolean>;
    static validatePromoCode(code: string): Promise<import("mongoose").Document<unknown, {}, import("../../database/models/promo-code.model.js").IPromoCode, {}, import("mongoose").DefaultSchemaOptions> & import("../../database/models/promo-code.model.js").IPromoCode & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static getAnnouncements(): Promise<(import("../../database/models/announcement.model.js").IAnnouncement & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static getActiveAnnouncements(): Promise<(import("../../database/models/announcement.model.js").IAnnouncement & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static createAnnouncement(data: {
        title: string;
        content: string;
        type: 'info' | 'warning' | 'success';
        expiresAt?: Date;
    }): Promise<import("mongoose").Document<unknown, {}, import("../../database/models/announcement.model.js").IAnnouncement, {}, import("mongoose").DefaultSchemaOptions> & import("../../database/models/announcement.model.js").IAnnouncement & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static toggleAnnouncement(id: string): Promise<import("mongoose").Document<unknown, {}, import("../../database/models/announcement.model.js").IAnnouncement, {}, import("mongoose").DefaultSchemaOptions> & import("../../database/models/announcement.model.js").IAnnouncement & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static deleteAnnouncement(id: string): Promise<boolean>;
}
//# sourceMappingURL=admin.service.d.ts.map
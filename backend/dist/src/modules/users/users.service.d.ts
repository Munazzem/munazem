import mongoose from 'mongoose';
export declare class UserService {
    static createUser(creatorRole: string, creatorId: string, data: any): Promise<import("../../types/user.types.js").IUserDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static getUsers(requesterRole: string, requesterId: string, query: any): Promise<(import("../../types/user.types.js").IUserDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static updateUser(requesterRole: string, requesterId: string, targetUserId: string, data: any): Promise<(import("../../types/user.types.js").IUserDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static paySalary(teacherId: string, assistantId: string, amount: number, notes?: string): Promise<(mongoose.Document<unknown, {}, import("../../types/transaction.types.js").ITransactionDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/transaction.types.js").ITransactionDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static deleteUser(requesterRole: string, requesterId: string, targetUserId: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=users.service.d.ts.map
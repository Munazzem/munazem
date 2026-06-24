import { Model } from 'mongoose';
export interface IErrorLog {
    level: 'warn' | 'error' | 'critical';
    message: string;
    stack?: string;
    requestId?: string;
    path: string;
    method: string;
    statusCode: number;
    userId?: string;
    teacherId?: string;
    meta?: Record<string, unknown>;
    createdAt: Date;
}
export declare const ErrorLogModel: Model<IErrorLog>;
//# sourceMappingURL=error-log.model.d.ts.map
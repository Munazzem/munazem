import type { Response } from 'express';
export declare const SuccessResponse: ({ res, message, status, data }: {
    res: Response;
    message?: string;
    status?: number;
    data?: any;
}) => Response<any, Record<string, any>>;
//# sourceMappingURL=success.responce.d.ts.map
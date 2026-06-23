import type { Request, Response, NextFunction } from 'express';
export declare const ErrorResponse: ({ status, message, extra }?: {
    status?: number | undefined;
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const BadRequestException: ({ message, extra }?: {
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const NotFoundException: ({ message, extra }?: {
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const ConflictException: ({ message, extra }?: {
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const UnauthorizedException: ({ message, extra }?: {
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const ForbiddenException: ({ message, extra }?: {
    message?: string | undefined;
    extra?: undefined;
}) => never;
export declare const globalErrorHandler: (error: any, req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=error.responce.d.ts.map
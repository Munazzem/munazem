import { envVars } from '../../../../config/env.service.js';
import type { Request, Response, NextFunction } from 'express';
import type { IErrorResponse } from '../../../types/response.types.js';
import { logger } from '../logger.util.js';
import { ErrorLogModel } from '../../../database/models/error-log.model.js';


export const ErrorResponse = ({ status = 400, message = 'Something went wrong', extra = undefined } = {}) => {
    throw new Error(message, { cause: { status, extra } });
};

export const BadRequestException = ({ message = 'BadRequestException', extra = undefined } = {}) => {
    return ErrorResponse({ status: 400, message, extra });
};

export const NotFoundException = ({ message = 'NotFoundException', extra = undefined } = {}) => {
    return ErrorResponse({ status: 404, message, extra });
};

export const ConflictException = ({ message = 'ConflictException', extra = undefined } = {}) => {
    return ErrorResponse({ status: 409, message, extra });
};

export const UnauthorizedException = ({ message = 'UnauthorizedException', extra = undefined } = {}) => {
    return ErrorResponse({ status: 401, message, extra });
};

export const ForbiddenException = ({ message = 'ForbiddenException', extra = undefined } = {}) => {
    return ErrorResponse({ status: 403, message, extra });
};


export const globalErrorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
    const status    = error.cause?.status || 500;
    const message   = error.message || 'Something went wrong';
    const requestId = (req as any).requestId ?? undefined;
    const user      = (req as any).user;

    // Always log to console
    logger.error('request_error', {
        status,
        message,
        requestId,
        path:     req.path,
        method:   req.method,
        userId:   user?.userId  ?? null,
        role:     user?.role    ?? null,
        extra:    error.cause?.extra ?? undefined,
        stack:    status === 500 ? error.stack : undefined,
    });

    // Persist 5xx errors to MongoDB (fire-and-forget — never block the response)
    if (status >= 500) {
        const level = status >= 500 ? 'error' : 'warn';
        ErrorLogModel.create({
            level,
            message,
            stack:      error.stack,
            requestId,
            path:       req.path,
            method:     req.method,
            statusCode: status,
            userId:     user?.userId   ?? undefined,
            teacherId:  user?.teacherId ?? user?.userId ?? undefined,
            meta: {
                extra: error.cause?.extra,
                role:  user?.role,
            },
        }).catch(() => {
            // Silently ignore DB write failures — never crash the app over logging
        });
    }

    const response: IErrorResponse = {
        success: false,
        message,
        errors: error.cause?.extra,
        stack:  envVars.mood === 'DEV' ? error.stack : undefined,
    };

    res.status(status).json(response);
};

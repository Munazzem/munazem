import { envVars } from '../../../../config/env.service.js';
import type { Request, Response, NextFunction } from 'express';
import type { IErrorResponse } from '../../../types/response.types.js';
import { logger } from '../logger.util.js';


export const ErrorResponse = ({ status = 400, message = 'Something went wrong', extra = undefined } = {}) => {
    throw new Error(message, { cause: { status, extra } });
};

export const BadRequestException = ({ message = 'BadRequestException', extra = undefined } = {}) => {
    return ErrorResponse({
        status: 400,
        message,
        extra,
    });
};

export const NotFoundException = ({ message = 'NotFoundException', extra = undefined } = {}) => {
    return ErrorResponse({
        status: 404,
        message,
        extra,
    });
};

export const ConflictException = ({ message = 'ConflictException', extra = undefined } = {}) => {
    return ErrorResponse({
        status: 409,
        message,
        extra,
    });
};

export const UnauthorizedException = ({ message = 'UnauthorizedException', extra = undefined } = {}) => {
    return ErrorResponse({
        status: 401,
        message,
        extra,
    });
};

export const ForbiddenException = ({ message = 'ForbiddenException', extra = undefined } = {}) => {
    return ErrorResponse({
        status: 403,
        message,
        extra,
    });
};


export const globalErrorHandler = (error: any, req: Request, res: Response, _next: NextFunction) => {
    const status = error.cause?.status || 500;
    const displayErrorMessage = error.message || 'Something went wrong';

    // Structured error log
    logger.error('request_error', {
        status,
        message: error.message,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId ?? null,
        role: (req as any).user?.role ?? null,
        extra: error.cause?.extra ?? undefined,
        stack: status === 500 ? error.stack : undefined,
    });

    const response: IErrorResponse = {
        success: false,
        message: displayErrorMessage,
        errors: error.cause?.extra,
        stack: envVars.mood === 'DEV' ? error.stack : undefined,
    };

    res.status(status).json(response);
};


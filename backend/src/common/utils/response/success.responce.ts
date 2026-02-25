import type { Response } from 'express';

export const SuccessResponse = ({ res, message = "done", status = 200, data = undefined }: { res: Response, message?: string, status?: number, data?: any }) => {
    return res.status(status).json({ status, message, data });
}



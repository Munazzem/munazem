import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ParentService } from './parent.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';

const parentRouter = Router();

// POST /parent/lookup — no authentication required
// Body: { parentPhone: string }
parentRouter.post(
    '/lookup',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { parentPhone } = req.body;
            const data = await ParentService.lookupByPhone(parentPhone);
            return SuccessResponse({
                res,
                data,
                message: `تم العثور على ${data.length} طالب`,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default parentRouter;

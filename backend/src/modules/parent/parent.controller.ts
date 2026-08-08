import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ParentService } from './parent.service.js';
import { CardsService }  from '../cards/cards.service.js';
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

// GET /parent/card/:cardToken — no authentication required
// Scans a card token (from QR URL) and returns student summary for parent portal
parentRouter.get(
    '/card/:cardToken',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cardToken } = req.params;
            const data = await CardsService.resolveByToken(cardToken as string);
            return SuccessResponse({
                res,
                data,
                message: 'تم جلب بيانات الطالب بنجاح',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default parentRouter;


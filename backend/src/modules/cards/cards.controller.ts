import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { CardsService }  from './cards.service.js';
import { UserRole }      from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate }  from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate }       from '../../middlewares/validate.middleware.js';
import {
    generateBatchSchema,
    linkCardSchema,
    unlinkCardSchema,
    disableCardSchema,
    replaceCardSchema,
} from '../../validation/card.validation.js';
import { CardBatchPdfService } from './card-batch-pdf.service.js';

const cardsRouter = Router();
cardsRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── POST /cards/generate — Create a new batch of blank cards ─────────────────
cardsRouter.post(
    '/generate',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(generateBatchSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const result = await CardsService.generateBatch(teacherId, req.body);
            return SuccessResponse({ res, data: result, message: `تم إنشاء ${result.count} كارت بنجاح`, status: 201 });
        } catch (error) { next(error); }
    }
);

// ─── GET /cards/resolve/:scanInput — Unified QR / barcode / code resolution ───
// scanInput can be: a QR URL, a cardToken (UUID), a cardNumber, a barcode, or a studentCode
cardsRouter.get(
    '/resolve/:scanInput',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId  = resolveTeacherId((req as any).user);
            const scanInput  = decodeURIComponent(req.params['scanInput'] as string);
            const result = await CardsService.resolveCard(scanInput, teacherId);
            return SuccessResponse({ res, data: result, message: 'تم التعرف على الكارت بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── POST /cards/link — Link a card to a student ──────────────────────────────
cardsRouter.post(
    '/link',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(linkCardSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user      = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await CardsService.linkCard(req.body, teacherId, user.userId);
            return SuccessResponse({ res, data: result, message: 'تم ربط الكارت بالطالب بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── POST /cards/unlink — Unlink a card (set back to NEW) ────────────────────
cardsRouter.post(
    '/unlink',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(unlinkCardSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user      = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await CardsService.unlinkCard(req.body.cardNumber, teacherId);
            return SuccessResponse({ res, data: result, message: 'تم فك ربط الكارت بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── POST /cards/disable — Disable a card permanently ────────────────────────
cardsRouter.post(
    '/disable',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(disableCardSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user      = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await CardsService.disableCard(req.body, teacherId, user.userId);
            return SuccessResponse({ res, data: result, message: 'تم تعطيل الكارت بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── POST /cards/replace — Replace lost/damaged card with a new one ───────────
cardsRouter.post(
    '/replace',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(replaceCardSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user      = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await CardsService.replaceCard(req.body, teacherId, user.userId);
            return SuccessResponse({ res, data: result, message: result.message });
        } catch (error) { next(error); }
    }
);

// ─── GET /cards — List cards with optional filters ────────────────────────────
cardsRouter.get(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const result = await CardsService.getCards(teacherId, req.query);
            return SuccessResponse({ res, data: result, message: 'تم جلب الكروت بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /cards/stats — Quick card statistics ─────────────────────────────────
cardsRouter.get(
    '/stats',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const stats = await CardsService.getCardStats(teacherId);
            return SuccessResponse({ res, data: stats, message: 'تم جلب إحصائيات الكروت' });
        } catch (error) { next(error); }
    }
);

// ─── GET /cards/by-group/:groupId — Get linked card tokens for group students (offline cache) ─
cardsRouter.get(
    '/by-group/:groupId',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const groupId   = req.params['groupId'] as string;
            const result = await CardsService.getLinkedCardsByGroup(groupId, teacherId);
            return SuccessResponse({ res, data: result, message: 'تم جلب كروت المجموعة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /cards/batch/:batchId/print — Printable HTML for a card batch ────────
cardsRouter.get(
    '/batch/:batchId/print',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const batchId   = req.params['batchId'] as string;
            const html = await CardBatchPdfService.generateBatchHtml(batchId, teacherId);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(html);
        } catch (error) { next(error); }
    }
);

export default cardsRouter;

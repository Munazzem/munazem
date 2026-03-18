import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service.js';
import { UserRole, TransactionCategory } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { recordSubscriptionSchema, batchSubscriptionSchema, recordExpenseSchema, recordNotebookSaleSchema, upsertPriceSettingsSchema } from '../../validation/payment.validation.js';

const paymentsRouter = Router();

paymentsRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ════════════════════════════════════════════════════════════════
// PRICE SETTINGS — Teacher only
// ════════════════════════════════════════════════════════════════

// PUT /payments/prices — Upsert price settings (Teacher only)
paymentsRouter.put(
    '/prices',
    authorizeRoles(UserRole.teacher),
    validate(upsertPriceSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const result = await PaymentsService.upsertPriceSettings(teacherId, req.body.prices);
            return SuccessResponse({ res, data: result, message: 'تم حفظ أسعار المراحل بنجاح' });
        } catch (error) { next(error); }
    }
);

// GET /payments/prices — Get price settings (Teacher only)
paymentsRouter.get(
    '/prices',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const result = await PaymentsService.getPriceSettings(teacherId);
            return SuccessResponse({ res, data: result, message: 'تم جلب الأسعار بنجاح' });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// STUDENT TRANSACTIONS — Assistant (write) / Teacher (read)
// ════════════════════════════════════════════════════════════════

// POST /payments/subscription — Record student subscription (Assistant + Teacher)
paymentsRouter.post(
    '/subscription',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(recordSubscriptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const transaction = await PaymentsService.recordSubscription(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: transaction, message: 'تم تسجيل الاشتراك بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/subscription/batch — Record multiple subscriptions at once (Assistant + Teacher)
paymentsRouter.post(
    '/subscription/batch',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(batchSubscriptionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.recordBatchSubscription(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: `تم تسجيل ${result.successCount} اشتراك بنجاح`, status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/notebook — Record notebook sale (Assistant + Teacher)
paymentsRouter.post(
    '/notebook',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(recordNotebookSaleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const transaction = await PaymentsService.recordNotebookSale(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: transaction, message: 'تم تسجيل بيع المذكرة بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// EXPENSES — Both Teacher and Assistant
// ════════════════════════════════════════════════════════════════

// POST /payments/expense — Record expense (Teacher + Assistant)
paymentsRouter.post(
    '/expense',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(recordExpenseSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const transaction = await PaymentsService.recordExpense(teacherId, user.userId, {
                category:    req.body.category as TransactionCategory,
                amount:      req.body.amount,
                description: req.body.description,
                date:        req.body.date,
            });
            return SuccessResponse({ res, data: transaction, message: 'تم تسجيل المصروف بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// LEDGERS — Daily: both / Monthly: Teacher only
// ════════════════════════════════════════════════════════════════

// GET /payments/ledger/daily?date=2026-02-28 — (Teacher + Assistant)
paymentsRouter.get(
    '/ledger/daily',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const date = (req.query['date'] as string) ?? new Date().toISOString().split('T')[0];
            const ledger = await PaymentsService.getDailyLedger(teacherId, date);
            return SuccessResponse({ res, data: ledger, message: 'تم جلب الجارد اليومي بنجاح' });
        } catch (error) { next(error); }
    }
);

// GET /payments/ledger/monthly?year=2026&month=2 — (Teacher only)
paymentsRouter.get(
    '/ledger/monthly',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const now   = new Date();
            const year  = parseInt(req.query['year']  as string) || now.getUTCFullYear();
            const month = parseInt(req.query['month'] as string) || (now.getUTCMonth() + 1);
            const ledger = await PaymentsService.getMonthlyLedger(teacherId, year, month);
            return SuccessResponse({ res, data: ledger, message: 'تم جلب الجارد الشهري بنجاح' });
        } catch (error) { next(error); }
    }
);

export default paymentsRouter;

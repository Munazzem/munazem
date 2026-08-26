import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service.js';
import { UserRole, TransactionCategory } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { ForbiddenException } from '../../common/utils/response/error.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { recordSubscriptionSchema, batchSubscriptionSchema, recordExpenseSchema, recordNotebookSaleSchema, batchNotebookSaleSchema, reserveNotebookSchema, batchReserveNotebookSchema, upsertPriceSettingsSchema, deliverNotebookSchema, updateTransactionSchema, payDebtSchema, batchDeleteTransactionsSchema, payCycleDebtSchema, payAllPastCyclesSchema } from '../../validation/payment.validation.js';

const paymentsRouter = Router();

paymentsRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ════════════════════════════════════════════════════════════════
// PRICE SETTINGS — Teacher (write) / Assistant + Teacher (read)
// ════════════════════════════════════════════════════════════════

// PUT /payments/prices — Upsert price settings (Teacher only)
paymentsRouter.put(
    '/prices',
    authorizeRoles(UserRole.teacher),
    validate(upsertPriceSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const result = await PaymentsService.upsertPriceSettings(teacherId, req.body);
            return SuccessResponse({ res, data: result, message: 'تم حفظ أسعار المراحل بنجاح' });
        } catch (error) { next(error); }
    }
);

// GET /payments/prices — Get price settings (Teacher + Assistant)
paymentsRouter.get(
    '/prices',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
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

// POST /payments/notebook/batch — Record batch notebook sales (Assistant + Teacher)
paymentsRouter.post(
    '/notebook/batch',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(batchNotebookSaleSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.recordBatchNotebookSale(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: `تم تسجيل بيع المذكرة لـ ${result.successCount} طالب بنجاح`, status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/notebook/reserve — Reserve notebook (Assistant + Teacher)
paymentsRouter.post(
    '/notebook/reserve',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(reserveNotebookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.reserveNotebook(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: 'تم حجز المذكرة بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/notebook/reserve/batch — Batch reserve notebook (Assistant + Teacher)
paymentsRouter.post(
    '/notebook/reserve/batch',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(batchReserveNotebookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.recordBatchNotebookReservation(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: `تم حجز المذكرة لـ ${result.successCount} طالب بنجاح`, status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/pay-debt — Record debt payment (Teacher + Assistant)
paymentsRouter.post(
    '/pay-debt',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(payDebtSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.payDebt(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: 'تم سداد المديونية بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/pay-cycle-debt — Record payment for a specific past cycle (Teacher + Assistant)
paymentsRouter.post(
    '/pay-cycle-debt',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(payCycleDebtSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.payCycleDebt(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: `تم سداد مديونية الدورة (${req.body.cycleNumber}) بنجاح`, status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/pay-all-past-cycles — Record payment for all past unpaid cycles (Teacher + Assistant)
paymentsRouter.post(
    '/pay-all-past-cycles',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(payAllPastCyclesSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.payAllPastCycles(teacherId, user.userId, req.body);
            return SuccessResponse({ res, data: result, message: result.message, status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /payments/notebook/deliver/:reservationId — Deliver notebook (Assistant + Teacher)
paymentsRouter.post(
    '/notebook/deliver/:reservationId',
    authorizeRoles(UserRole.assistant, UserRole.teacher),
    validate(deliverNotebookSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.deliverNotebook(teacherId, user.userId, req.params['reservationId'] as string, req.body);
            return SuccessResponse({ res, data: result, message: 'تم تسليم المذكرة بنجاح' });
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

// PATCH /payments/:id — Update transaction (Teacher + Assistant)
paymentsRouter.patch(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(updateTransactionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const updated = await PaymentsService.updateTransaction(teacherId, req.params['id'] as string, req.body);
            return SuccessResponse({ res, data: updated, message: 'تم تعديل المعاملة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// CENTER DEDUCTION — Deduct center share from teacher earnings
// ════════════════════════════════════════════════════════════════

// POST /payments/center-deduction — Record center fee deduction (Teacher + Assistant)
paymentsRouter.post(
    '/center-deduction',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const { centerName, amount, date, description } = req.body;
            if (!centerName || !amount || amount <= 0) {
                throw new Error('اسم السنتر والمبلغ مطلوبان');
            }
            const result = await PaymentsService.recordCenterDeduction(teacherId, { centerName, amount, date, description });
            return SuccessResponse({ res, data: result, message: 'تم تسجيل خصم السنتر بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// DELETE /payments/batch — Void (delete) multiple transactions (Teacher + Assistant)
// ════════════════════════════════════════════════════════════════
paymentsRouter.delete(
    '/batch',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(batchDeleteTransactionsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.deleteBatchTransactions(teacherId, req.body.transactionIds);
            return SuccessResponse({ res, data: result, message: `تم مسح ${result.deletedCount} معاملة مالية بنجاح` });
        } catch (error) { next(error); }
    }
);

// POST alias for batch deletion (for clients or proxies that strip DELETE body)
paymentsRouter.post(
    '/batch-delete',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(batchDeleteTransactionsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.deleteBatchTransactions(teacherId, req.body.transactionIds);
            return SuccessResponse({ res, data: result, message: `تم مسح ${result.deletedCount} معاملة مالية بنجاح` });
        } catch (error) { next(error); }
    }
);

// ════════════════════════════════════════════════════════════════
// DELETE /payments/:id — Void (delete) a single transaction (Teacher + Assistant)
// يمسح المعاملة المالية ويعكس أثرها على السجلات.
// ════════════════════════════════════════════════════════════════
paymentsRouter.delete(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await PaymentsService.deleteTransaction(teacherId, req.params['id'] as string);
            return SuccessResponse({ res, data: result, message: 'تم مسح المعاملة المالية بنجاح' });
        } catch (error) { next(error); }
    }
);

export default paymentsRouter;


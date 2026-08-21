import mongoose from 'mongoose';
import { PriceSettingsModel } from '../../database/models/price-settings.model.js';
import { TransactionModel }   from '../../database/models/transaction.model.js';
import { DailyLedgerModel }   from '../../database/models/ledger.model.js';
import { MonthlyLedgerModel } from '../../database/models/ledger.model.js';
import { StudentModel }       from '../../database/models/student.model.js';
import { GroupModel }          from '../../database/models/group.model.js';
import { NotebookModel }      from '../../database/models/notebook.model.js';
import { NotebookReservationModel } from '../../database/models/notebook-reservation.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { ReservationStatus } from '../../types/notebook-reservation.types.js';
import { TransactionType, TransactionCategory, GradeLevel, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import { cache, CacheKeys, CacheTTL } from '../../infrastructure/cache/cache.service.js';
import { startOfDayEgypt, resolveTransactionDate, getEgyptYearMonth } from '../../common/utils/date.util.js';
import type { IPriceSetting } from '../../types/price-settings.types.js';

// ─── Helpers ─────────────────────────────────────────────────────
// Date helpers (startOfDayEgypt, resolveTransactionDate) are imported from common/utils/date.util.ts

// Alias for backward compatibility within this file
const startOfDay = startOfDayEgypt;

/**
 * Resolves the base subscription price (originalAmount) for a student.
 *
 * Price Resolution Hierarchy:
 *   1. group.customPrice  — persistent group-level override (most specific)
 *   2. priceSettings[gradeLevel].amount — teacher's grade-level default (fallback)
 *   3. throw BadRequestException — never silently fall back to 0
 *
 * @param groupCustomPrice - The group's customPrice field (null | undefined = no override)
 * @param gradeLevel       - The student's grade level (used for fallback lookup)
 * @param priceSettings    - The teacher's PriceSettings document (may be null)
 * @returns The resolved originalAmount (always a positive number)
 * @throws  BadRequestException if no price is configured at any level
 */
function resolveOriginalAmount(
    groupCustomPrice: number | null | undefined,
    gradeLevel: string,
    priceSettings: { prices: { gradeLevel: string; amount: number }[] } | null | undefined,
): number {
    // Level 1: Group-level override (most specific)
    // Note: != null catches both null and undefined intentionally
    if (groupCustomPrice != null) {
        return groupCustomPrice;
    }

    // Level 2: Grade-level default from PriceSettings (fallback)
    const gradePriceSetting = priceSettings?.prices.find(p => p.gradeLevel === gradeLevel);
    if (gradePriceSetting) {
        return gradePriceSetting.amount;
    }

    // Level 3: Hard failure — no price at any level
    throw BadRequestException({
        message: `لم يتم تحديد سعر للمجموعة ولا للمرحلة الدراسية: ${gradeLevel}`
    });
}

// Atomically updates (upsert) the DailyLedger when a transaction occurs
async function updateDailyLedger(
    teacherId: string,
    date: Date,
    transaction: { transactionId: any; type: string; category: string; paidAmount: number; studentName?: string | undefined; description?: string | undefined; createdBy: any; time: Date },
    isIncome: boolean,
    session?: mongoose.ClientSession
) {
    const day = startOfDay(date);
    const incIncome   = isIncome ? transaction.paidAmount : 0;
    const incExpense  = isIncome ? 0 : transaction.paidAmount;

    await DailyLedgerModel.findOneAndUpdate(
        { teacherId, date: day },
        {
            $push:  { transactions: transaction },
            $inc:   {
                totalIncome:   incIncome,
                totalExpenses: incExpense,
                netBalance:    isIncome ? transaction.paidAmount : -transaction.paidAmount,
            },
        },
        { upsert: true, ...(session ? { session } : {}) }
    );
}

// Atomically updates (upsert) the MonthlyLedger when a transaction occurs.
// Two-step approach: try to $inc existing day entry, fall back to $push if day not yet in array.
async function updateMonthlyLedger(
    teacherId: string,
    date: Date,
    paidAmount: number,
    isIncome: boolean,
    session?: mongoose.ClientSession
) {
    const { year, month } = getEgyptYearMonth(date);
    const day   = startOfDay(date);
    const net   = isIncome ? paidAmount : -paidAmount;

    const topLevelInc = {
        totalIncome:   isIncome ? paidAmount : 0,
        totalExpenses: isIncome ? 0 : paidAmount,
        netBalance:    net,
    };

    // Step 1 — Try to update the existing day entry with positional $ operator
    const updated = await MonthlyLedgerModel.findOneAndUpdate(
        { teacherId, year, month, 'dailySummaries.date': day },
        {
            $inc: {
                ...topLevelInc,
                'dailySummaries.$.totalIncome':      isIncome ? paidAmount : 0,
                'dailySummaries.$.totalExpenses':    isIncome ? 0 : paidAmount,
                'dailySummaries.$.netBalance':       net,
                'dailySummaries.$.transactionCount': 1,
            },
        },
        { ...(session ? { session } : {}) }
    );

    if (updated) return; // Day entry existed — done

    // Step 2 — Day not yet in array: push new entry (or upsert the whole document)
    await MonthlyLedgerModel.findOneAndUpdate(
        { teacherId, year, month },
        {
            $inc:  topLevelInc,
            $push: {
                dailySummaries: {
                    date:             day,
                    totalIncome:      isIncome ? paidAmount : 0,
                    totalExpenses:    isIncome ? 0 : paidAmount,
                    netBalance:       net,
                    transactionCount: 1,
                },
            },
        },
        { upsert: true, ...(session ? { session } : {}) }
    );
}


// ─── PaymentsService ─────────────────────────────────────────────
export class PaymentsService {

    // ── Price Settings ──────────────────────────────────────────────
    static async upsertPriceSettings(teacherId: string, data: { prices: IPriceSetting[], centerDiscounts?: any[] }) {
        const result = await PriceSettingsModel.findOneAndUpdate(
            { teacherId },
            { 
                teacherId, 
                prices: data.prices, 
                ...(data.centerDiscounts ? { centerDiscounts: data.centerDiscounts } : {}) 
            },
            { upsert: true, new: true, runValidators: true }
        ).lean();
        // Invalidate cached price settings
        await cache.del(CacheKeys.priceSettings(teacherId));
        return result;
    }

    static async getPriceSettings(teacherId: string) {
        // Check cache first (prices rarely change)
        const cacheKey = CacheKeys.priceSettings(teacherId);
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const settings = await PriceSettingsModel.findOne({ teacherId }).lean();
        if (!settings) throw NotFoundException({ message: 'لم يتم تحديد أسعار المراحل بعد' });

        await cache.set(cacheKey, settings, CacheTTL.PRICE_SETTINGS);
        return settings;
    }

    // ── Record Student Subscription ─────────────────────────────────
    static async recordSubscription(
        teacherId: string,
        createdBy: string,
        data: { studentId: string; discountAmount?: number; paidAmount?: number; description?: string; date?: string; customSessionsQuota?: number; idempotencyKey?: string }
    ) {
        if (data.idempotencyKey) {
            const existingTx = await TransactionModel.findOne({ idempotencyKey: data.idempotencyKey }).lean();
            if (existingTx) return existingTx;
        }

        // Get student info
        const student = await StudentModel.findById(data.studentId, {
            studentName: 1, gradeLevel: 1, teacherId: 1, groupId: 1, createdAt: 1
        }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }

        // Fetch Group to get cycle details
        const group = await GroupModel.findById(student.groupId).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });

        let cycleNumber = group.cycle?.currentCycleNumber ?? 1;
        let capacity = group.cycle?.capacity ?? (group.schedule?.length || 2) * 4;
        let currentSessionNumber = group.cycle?.currentSessionNumber ?? 0;
        let priceSnapshot = group.cycle?.priceSnapshot ?? new Map<string, number>();

        // Find or create CycleEnrollment
        let enrollment = await CycleEnrollmentModel.findOne({
            studentId: student._id,
            groupId: group._id,
            cycleNumber
        });

        const txDate = resolveTransactionDate(data.date);
        let enrollmentCreatedNow = false;

        if (!enrollment) {
            // The price snapshot (or PriceSettings or group.customPrice) is fundamentally the FULL CYCLE subscription price
            let fullMonthPrice = (group as any)?.customPrice;
            if (fullMonthPrice === undefined || fullMonthPrice === null) {
                fullMonthPrice = (priceSnapshot instanceof Map ? priceSnapshot.get(student.gradeLevel) : priceSnapshot?.[student.gradeLevel]);
            }
            if (fullMonthPrice === undefined || fullMonthPrice === null) {
                const settings = await PriceSettingsModel.findOne({ teacherId }).lean();
                fullMonthPrice = settings?.prices.find(p => p.gradeLevel === student.gradeLevel)?.amount || 0;
            }
            
            const pricePerSession = capacity > 0 ? fullMonthPrice / capacity : 0;
            
            // If student joined before the cycle started, they start from session 1; otherwise start from next session
            const studentCreatedAt = (student as any).createdAt;
            const wasRegisteredBeforeCycle = !group.cycle?.startedAt || 
                (studentCreatedAt && new Date(studentCreatedAt) <= new Date(group.cycle.startedAt));

            let defaultStartSession: number;

            if (wasRegisteredBeforeCycle || currentSessionNumber === 0) {
                defaultStartSession = 1;
            } else if (currentSessionNumber >= capacity) {
                // Current cycle is fully finished; new student will enter next cycle
                defaultStartSession = 1;
            } else {
                // Mid-cycle joiner: starts and continues from the next session
                defaultStartSession = currentSessionNumber + 1;
            }
            
            // Respect custom quota from UI if explicitly checked/provided, otherwise full cycle price
            const chargeableSessions = data.customSessionsQuota !== undefined 
                ? data.customSessionsQuota 
                : capacity;
                
            const cycleCharge = data.customSessionsQuota !== undefined && capacity > 0
                ? Math.round(data.customSessionsQuota * pricePerSession)
                : fullMonthPrice;

            enrollment = new CycleEnrollmentModel({
                studentId: student._id,
                groupId: group._id,
                teacherId: teacherId,
                cycleNumber,
                cycleCapacity: capacity,
                pricePerSession,
                fullCyclePrice: fullMonthPrice,
                startSession: wasRegisteredBeforeCycle ? 1 : defaultStartSession,
                chargeableSessions,
                cycleCharge,
                totalPaid: 0,
                remainingAmount: cycleCharge,
                status: CycleEnrollmentStatus.UNPAID
            });
            enrollmentCreatedNow = true;
        }

        if (enrollment.status === CycleEnrollmentStatus.PAID) {
            throw BadRequestException({ message: 'لقد تم دفع اشتراك هذه الدورة بالكامل مسبقاً.' });
        }

        const discountAmount = data.discountAmount ?? 0;
        const paidAmount = data.paidAmount ?? (enrollment.remainingAmount - discountAmount);

        if (paidAmount < 0) throw BadRequestException({ message: 'المدفوع لا يمكن أن يكون سالباً' });
        if (paidAmount + discountAmount > enrollment.remainingAmount) {
            throw BadRequestException({ message: 'إجمالي الدفع والخصم لا يمكن أن يتجاوز المطلوب سداده المتبقي للدورة.' });
        }

        const newTotalPaid = enrollment.totalPaid + paidAmount + discountAmount;
        const newRemainingAmount = enrollment.cycleCharge - newTotalPaid;
        let newStatus = CycleEnrollmentStatus.PARTIALLY_PAID;
        if (newRemainingAmount === 0) newStatus = CycleEnrollmentStatus.PAID;
        if (newRemainingAmount === enrollment.cycleCharge) newStatus = CycleEnrollmentStatus.UNPAID;

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const transaction = await withTransaction(async (session) => {
            if (enrollmentCreatedNow) {
                enrollment.totalPaid = newTotalPaid;
                enrollment.remainingAmount = newRemainingAmount;
                enrollment.status = newStatus;
                await enrollment.save({ session });
            } else {
                await CycleEnrollmentModel.findByIdAndUpdate(enrollment._id, {
                    $set: {
                        totalPaid: newTotalPaid,
                        remainingAmount: newRemainingAmount,
                        status: newStatus
                    }
                }, { session });
            }

            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.INCOME,
                category:       TransactionCategory.SUBSCRIPTION,
                studentId:      student._id,
                studentName:    student.studentName,
                gradeLevel:     student.gradeLevel,
                originalAmount: enrollment.cycleCharge,
                discountAmount,
                paidAmount,
                remainingAmount: newRemainingAmount,
                date:           txDate,
                cycleNumber,
                ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
                ...(data.description ? { description: data.description } : {}),
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.INCOME,
                    category:      TransactionCategory.SUBSCRIPTION,
                    paidAmount,
                    studentName:   student.studentName,
                    description:   tx!.description,
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
            ]);

            // Update student debt:
            // - If the payment is partial (leaving a remaining unpaid amount), record that remaining amount as debt.
            // - If the student is paying off a previous remaining balance, reduce their debt by the paid amount.
            // - If full payment is made initially, no debt is added.
            const studentUpdatePayload: any = {};
            let debtChange = 0;

            const wasAlreadyPartiallyPaid = enrollment.totalPaid > 0;
            if (wasAlreadyPartiallyPaid) {
                // Paying off part or all of previously recorded remaining debt
                debtChange = - (paidAmount + discountAmount);
            } else if (newRemainingAmount > 0) {
                // First payment is partial -> add only the remaining balance to debt
                debtChange = newRemainingAmount;
            }

            if (debtChange !== 0) {
                studentUpdatePayload.$inc = { totalDebt: debtChange };
            }

            if (Object.keys(studentUpdatePayload).length > 0) {
                await StudentModel.findByIdAndUpdate(student._id, studentUpdatePayload, { session });
            }

            return tx;
        });

        // Track after successful commit (fire-and-forget, outside transaction)
        trackEvent('payment_recorded', {
            tenantId: teacherId,
            userId:   createdBy,
            targetId: transaction!._id.toString(),
            meta:     { studentName: student.studentName, paidAmount, category: 'SUBSCRIPTION' },
        });
        // Invalidate dashboard cache so fresh financial data is shown
        cache.del(CacheKeys.dashboard(teacherId));

        return transaction;
    }

    // ── Record Batch Subscriptions ──────────────────────────────────
    static async recordBatchSubscription(
        teacherId: string,
        createdBy: string,
        data: { studentIds: string[]; discountAmount?: number; description?: string; date?: string; customSessionsQuota?: number; customAmount?: number; idempotencyKey?: string }
    ) {
        if (!data.studentIds || data.studentIds.length === 0) {
            throw BadRequestException({ message: 'يجب اختيار طالب واحد على الأقل' });
        }

        const txDate = resolveTransactionDate(data.date);
        const results: { studentId: string; studentName: string; paidAmount: number; status: 'success' | 'error'; error?: string }[] = [];

        // For batches, process sequentially to handle cycle enrollments, pro-rata and prevent lock contention
        for (const studentId of data.studentIds) {
            try {
                const tx = await PaymentsService.recordSubscription(teacherId, createdBy, {
                    studentId,
                    ...(data.discountAmount !== undefined ? { discountAmount: data.discountAmount } : {}),
                    ...(data.customAmount !== undefined ? { paidAmount: data.customAmount } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {}),
                    date: txDate.toISOString(),
                    ...(data.customSessionsQuota !== undefined ? { customSessionsQuota: data.customSessionsQuota } : {}),
                    ...(data.idempotencyKey !== undefined ? { idempotencyKey: `${data.idempotencyKey}_${studentId}` } : {})
                });
                results.push({ studentId, studentName: tx?.studentName ?? '', paidAmount: tx?.paidAmount ?? 0, status: 'success' });
            } catch (err: any) {
                let studentName = '';
                try {
                    const student = await StudentModel.findById(studentId, { studentName: 1 }).lean();
                    if (student) studentName = student.studentName;
                } catch (e) {}

                results.push({ 
                    studentId, 
                    studentName, 
                    paidAmount: 0, 
                    status: 'error', 
                    error: err?.message ?? 'فشل في حفظ المعاملة' 
                });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const totalPaid    = results.filter(r => r.status === 'success').reduce((sum, r) => sum + r.paidAmount, 0);

        if (successCount > 0) cache.del(CacheKeys.dashboard(teacherId));

        return { results, successCount, failCount: results.length - successCount, totalPaid };
    }

    // ── Record Notebook Sale ────────────────────────────────────────
    // notebookId is required — price is taken from the Notebook model,
    // and stock is decremented atomically with the ledger updates.
    static async recordNotebookSale(
        teacherId: string,
        createdBy: string,
        data: { studentId: string; notebookId: string; quantity?: number; discountAmount?: number; paidAmount?: number; description?: string; date?: string }
    ) {
        const student = await StudentModel.findById(data.studentId, { studentName: 1, teacherId: 1 }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }

        // Get notebook and validate stock
        const notebook = await NotebookModel.findOne({ _id: data.notebookId, teacherId }).lean();
        if (!notebook) throw NotFoundException({ message: 'المذكرة غير موجودة' });

        const quantity = data.quantity ?? 1;
        if (notebook.stock < quantity) {
            throw BadRequestException({ message: `الكمية المتاحة في المخزن: ${notebook.stock}` });
        }

        const originalAmount = notebook.price * quantity;
        const discountAmount = data.discountAmount ?? 0;
        const expectedAmount = originalAmount - discountAmount;
        const paidAmount     = data.paidAmount !== undefined ? data.paidAmount : expectedAmount;
        const remainingAmount = expectedAmount - paidAmount;
        const txDate         = resolveTransactionDate(data.date);

        if (paidAmount < 0) throw BadRequestException({ message: 'المدفوع لا يمكن أن يكون سالباً' });
        if (remainingAmount < 0) throw BadRequestException({ message: 'المدفوع لا يمكن أن يتجاوز المطلوب سداده' });

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const transaction = await withTransaction(async (session) => {
            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.INCOME,
                category:       TransactionCategory.NOTEBOOK_SALE,
                studentId:      student._id,
                studentName:    student.studentName,
                originalAmount,
                discountAmount,
                paidAmount,
                remainingAmount,
                date:           txDate,
                ...(data.description ? { description: data.description } : {}),
            }], { session });

            await Promise.all([
                NotebookModel.findByIdAndUpdate(data.notebookId, { $inc: { stock: -quantity } }, { session }),
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.INCOME,
                    category:      TransactionCategory.NOTEBOOK_SALE,
                    paidAmount,
                    studentName:   student.studentName,
                    description:   tx!.description,
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
            ]);

            if (remainingAmount > 0) {
                await StudentModel.findByIdAndUpdate(data.studentId, {
                    $inc: { totalDebt: remainingAmount }
                }, { session });
            }

            return tx;
        });

        return transaction;
    }

    // ── Reserve Notebook ────────────────────────────────────────────
    static async reserveNotebook(
        teacherId: string,
        createdBy: string,
        data: { studentId: string; notebookId: string; quantity?: number; paidAmount?: number; description?: string }
    ) {
        const student = await StudentModel.findById(data.studentId, { studentName: 1, teacherId: 1 }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) throw BadRequestException({ message: 'لا تملك صلاحية على هذا الطالب' });

        const notebook = await NotebookModel.findOne({ _id: data.notebookId, teacherId }).lean();
        if (!notebook) throw NotFoundException({ message: 'المذكرة غير موجودة' });

        const quantity = data.quantity ?? 1;
        const totalPrice = notebook.price * quantity;
        const paidAmount = data.paidAmount ?? 0;
        const txDate = new Date();

        if (paidAmount > totalPrice) throw BadRequestException({ message: 'المبلغ المدفوع أكبر من إجمالي السعر' });

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const reservation = await withTransaction(async (session) => {
            // 1. Create Reservation
            const [res] = await NotebookReservationModel.create([{
                teacherId,
                studentId: student._id,
                notebookId: notebook._id,
                quantity,
                totalPrice,
                paidAmount,
                status: ReservationStatus.PENDING,
            }], { session });

            const promises: Promise<any>[] = [
                // 2. Increment reservedCount
                NotebookModel.findByIdAndUpdate(notebook._id, { $inc: { reservedCount: quantity } }, { session })
            ];

            // 3. Record Transaction if any payment made
            if (paidAmount > 0) {
                const [tx] = await TransactionModel.create([{
                    teacherId,
                    createdBy,
                    type:           TransactionType.INCOME,
                    category:       TransactionCategory.NOTEBOOK_RESERVATION,
                    studentId:      student._id,
                    studentName:    student.studentName,
                    originalAmount: totalPrice,
                    discountAmount: 0,
                    paidAmount,
                    date:           txDate,
                    description:    data.description || `عربون حجز مذكرة: ${notebook.name}`,
                }], { session });

                promises.push(
                    updateDailyLedger(teacherId, txDate, {
                        transactionId: tx!._id,
                        type:          TransactionType.INCOME,
                        category:      TransactionCategory.NOTEBOOK_RESERVATION,
                        paidAmount,
                        studentName:   student.studentName,
                        createdBy,
                        time:          txDate,
                    }, true, session),
                    updateMonthlyLedger(teacherId, txDate, paidAmount, true, session)
                );
            }

            await Promise.all(promises);
            return res;
        });

        return reservation;
    }

    // ── Deliver Notebook ────────────────────────────────────────────
    static async deliverNotebook(
        teacherId: string,
        createdBy: string,
        reservationId: string,
        data: { paidAmount?: number; description?: string }
    ) {
        const reservation = await NotebookReservationModel.findOne({ _id: reservationId, teacherId })
            .populate('studentId', 'studentName')
            .populate('notebookId', 'name price stock');
        
        if (!reservation) throw NotFoundException({ message: 'الحجز غير موجود' });
        if (reservation.status !== ReservationStatus.PENDING) throw BadRequestException({ message: 'هذا الحجز مكتمل أو ملغى بالفعل' });

        const notebook = reservation.notebookId as any;
        const student = reservation.studentId as any;

        if (notebook.stock < reservation.quantity) {
            throw BadRequestException({ message: `الكمية المتاحة في المخزن (${notebook.stock}) أقل من الكمية المحجوزة (${reservation.quantity})` });
        }

        const remainingBalance = reservation.totalPrice - reservation.paidAmount;
        const additionalPayment = data.paidAmount ?? 0;
        const txDate = new Date();

        if (additionalPayment > remainingBalance) throw BadRequestException({ message: 'المبلغ المدفوع أكبر من المتبقي' });

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        await withTransaction(async (session) => {
            // 1. Update Reservation
            reservation.status = ReservationStatus.DELIVERED;
            reservation.paidAmount += additionalPayment;
            reservation.deliveredAt = txDate;
            await reservation.save({ session });

            const promises: Promise<any>[] = [
                // 2. Decrement Main Stock AND Decrement Reserved Count
                NotebookModel.findByIdAndUpdate(notebook._id, { 
                    $inc: { 
                        stock: -reservation.quantity,
                        reservedCount: -reservation.quantity 
                    } 
                }, { session })
            ];

            // 3. Record Transaction if any additional payment made
            if (additionalPayment > 0) {
                const [tx] = await TransactionModel.create([{
                    teacherId,
                    createdBy,
                    type:           TransactionType.INCOME,
                    category:       TransactionCategory.NOTEBOOK_DELIVERY,
                    studentId:      student._id,
                    studentName:    student.studentName,
                    originalAmount: reservation.totalPrice,
                    discountAmount: 0,
                    paidAmount:     additionalPayment,
                    date:           txDate,
                    description:    data.description || `تكملة ثمن مذكرة: ${notebook.name}`,
                }], { session });

                promises.push(
                    updateDailyLedger(teacherId, txDate, {
                        transactionId: tx!._id,
                        type:          TransactionType.INCOME,
                        category:      TransactionCategory.NOTEBOOK_DELIVERY,
                        paidAmount:    additionalPayment,
                        studentName:   student.studentName,
                        createdBy,
                        time:          txDate,
                    }, true, session),
                    updateMonthlyLedger(teacherId, txDate, additionalPayment, true, session)
                );
            }

            await Promise.all(promises);
        });

        return reservation;
    }

    // ── Record Expense ──────────────────────────────────────────────
    static async recordExpense(
        teacherId: string,
        createdBy: string,
        data: { category: TransactionCategory; amount: number; description?: string; date?: string }
    ) {
        const incomeCategories = [
            TransactionCategory.SUBSCRIPTION,
            TransactionCategory.NOTEBOOK_SALE,
            TransactionCategory.OTHER_INCOME,
        ];
        if (incomeCategories.includes(data.category)) {
            throw BadRequestException({ message: 'نوع العملية يجب أن يكون مصروفاً' });
        }

        const txDate = resolveTransactionDate(data.date);

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const transaction = await withTransaction(async (session) => {
            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.EXPENSE,
                category:       data.category,
                originalAmount: data.amount,
                discountAmount: 0,
                paidAmount:     data.amount,
                date:           txDate,
                ...(data.description ? { description: data.description } : {}),
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.EXPENSE,
                    category:      data.category,
                    paidAmount:    data.amount,
                    createdBy,
                    time:          txDate,
                    ...(data.description ? { description: data.description } : {}),
                }, false, session),
                updateMonthlyLedger(teacherId, txDate, data.amount, false, session),
            ]);

            return tx;
        });

        // Track after successful commit
        trackEvent('expense_recorded', {
            tenantId: teacherId,
            userId:   createdBy,
            targetId: transaction!._id.toString(),
            meta:     { amount: data.amount, category: data.category },
        });
        // Invalidate dashboard cache so fresh financial data is shown
        cache.del(CacheKeys.dashboard(teacherId));

        return transaction;
    }

    // ── Reconcile Monthly Ledger ────────────────────────────────────
    static async reconcileMonthlyLedger(teacherId: string, year: number, month: number) {
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        const dailyLedgers = await DailyLedgerModel.find({
            teacherId,
            date: { $gte: startDate, $lt: endDate }
        }).lean();

        const dailySummaries = dailyLedgers.map(dl => {
            const income = (dl.transactions || [])
                .filter((t: any) => t.type === TransactionType.INCOME)
                .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
            const expenses = (dl.transactions || [])
                .filter((t: any) => t.type === TransactionType.EXPENSE)
                .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
            return {
                date: dl.date,
                totalIncome: Math.max(0, income),
                totalExpenses: Math.max(0, expenses),
                netBalance: income - expenses,
                transactionCount: dl.transactions?.length || 0,
            };
        });

        const totalIncome = Math.max(0, dailySummaries.reduce((sum, d) => sum + d.totalIncome, 0));
        const totalExpenses = Math.max(0, dailySummaries.reduce((sum, d) => sum + d.totalExpenses, 0));
        const netBalance = totalIncome - totalExpenses;

        const updated = await MonthlyLedgerModel.findOneAndUpdate(
            { teacherId, year, month },
            {
                $set: {
                    dailySummaries,
                    totalIncome,
                    totalExpenses,
                    netBalance,
                }
            },
            { upsert: true, new: true }
        ).lean();

        return updated;
    }

    // ── Get Daily Ledger ────────────────────────────────────────────
    static async getDailyLedger(teacherId: string, date: string) {
        const dayDate = new Date(date);
        const day = startOfDay(dayDate);
        const { year, month } = getEgyptYearMonth(dayDate);

        let [ledger, monthlyLedger] = await Promise.all([
            DailyLedgerModel.findOne({ teacherId, date: day }),
            MonthlyLedgerModel.findOne({ teacherId, year, month }, { totalIncome: 1, totalExpenses: 1 }).lean(),
        ]);

        if (ledger) {
            // Auto-heal / Recalculate true totals from ledger.transactions if corrupted or negative
            const realIncome = (ledger.transactions || [])
                .filter((t: any) => t.type === TransactionType.INCOME)
                .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
            const realExpenses = (ledger.transactions || [])
                .filter((t: any) => t.type === TransactionType.EXPENSE)
                .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
            const realNet = realIncome - realExpenses;

            if (ledger.totalIncome !== realIncome || ledger.totalExpenses !== realExpenses || ledger.netBalance !== realNet || ledger.totalIncome < 0 || ledger.totalExpenses < 0) {
                ledger.totalIncome = Math.max(0, realIncome);
                ledger.totalExpenses = Math.max(0, realExpenses);
                ledger.netBalance = realNet;
                await DailyLedgerModel.updateOne(
                    { _id: ledger._id },
                    { $set: { totalIncome: ledger.totalIncome, totalExpenses: ledger.totalExpenses, netBalance: ledger.netBalance } }
                );

                // Heal MonthlyLedger
                await PaymentsService.reconcileMonthlyLedger(teacherId, year, month);
                monthlyLedger = await MonthlyLedgerModel.findOne({ teacherId, year, month }, { totalIncome: 1, totalExpenses: 1 }).lean();
            }

            // Auto-enrich any transactions missing description from TransactionModel
            const missingDescTxIds = (ledger.transactions || [])
                .filter((t: any) => !t.description && t.transactionId)
                .map((t: any) => t.transactionId);

            if (missingDescTxIds.length > 0) {
                const actualTxs = await TransactionModel.find(
                    { _id: { $in: missingDescTxIds }, teacherId },
                    { _id: 1, description: 1 }
                ).lean();

                const descMap = new Map(
                    actualTxs
                        .filter(t => t.description && t.description.trim() !== '')
                        .map(t => [t._id.toString(), t.description])
                );

                let updatedDesc = false;
                for (const t of ledger.transactions) {
                    if (!t.description && t.transactionId) {
                        const d = descMap.get(t.transactionId.toString());
                        if (d) {
                            t.description = d;
                            updatedDesc = true;
                        }
                    }
                }

                if (updatedDesc) {
                    await DailyLedgerModel.updateOne(
                        { _id: ledger._id },
                        { $set: { transactions: ledger.transactions } }
                    );
                }
            }
        }

        const base = ledger ? ledger.toObject() : { date: day, transactions: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        
        return {
            ...base,
            totalIncome: Math.max(0, base.totalIncome),
            totalExpenses: Math.max(0, base.totalExpenses),
            monthlyIncome: Math.max(0, monthlyLedger?.totalIncome ?? 0),
            monthlyExpenses: Math.max(0, monthlyLedger?.totalExpenses ?? 0),
        };
    }

    // ── Get Monthly Ledger ──────────────────────────────────────────
    static async getMonthlyLedger(teacherId: string, year: number, month: number) {
        let ledger = await MonthlyLedgerModel.findOne({ teacherId, year, month }).lean();
        if (!ledger || ledger.totalIncome < 0 || ledger.totalExpenses < 0) {
            ledger = await PaymentsService.reconcileMonthlyLedger(teacherId, year, month);
        }
        if (!ledger) return { year, month, dailySummaries: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        return {
            ...ledger,
            totalIncome: Math.max(0, ledger.totalIncome),
            totalExpenses: Math.max(0, ledger.totalExpenses),
        };
    }

    // ── Update Transaction (Teacher only) ───────────────────────────
    // Allowed fields: amount, category, description, date.
    // studentId is intentionally excluded to preserve audit integrity.
    // When amount changes, DailyLedger and MonthlyLedger are updated atomically.
    static async updateTransaction(
        teacherId: string,
        transactionId: string,
        data: { amount?: number; category?: TransactionCategory; description?: string; date?: string }
    ) {
        const transaction = await TransactionModel.findOne({ _id: transactionId, teacherId }).lean();
        if (!transaction) throw NotFoundException({ message: 'المعاملة غير موجودة' });

        const update: Record<string, any> = {};
        if (data.amount      !== undefined) { update['originalAmount'] = data.amount; update['paidAmount'] = data.amount; }
        if (data.category    !== undefined)   update['category']        = data.category;
        if (data.description !== undefined)   update['description']     = data.description;
        if (data.date !== undefined) {
            const newResolvedDate = resolveTransactionDate(data.date);
            const oldDay = startOfDay(new Date(transaction.date));
            const newDay = startOfDay(newResolvedDate);
            if (oldDay.getTime() !== newDay.getTime()) {
                throw BadRequestException({ message: 'لا يمكن تغيير تاريخ المعاملة ليوم مختلف. الرجاء مسح المعاملة وإعادة تسجيلها.' });
            }
            update['date'] = newResolvedDate;
        }

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const updated = await withTransaction(async (session) => {
            const result = await TransactionModel.findByIdAndUpdate(
                transactionId,
                { $set: update },
                { new: true, runValidators: true, session }
            ).lean();

            const txDate = transaction.date;
            const day = startOfDay(new Date(txDate));

            // ── Update embedded transaction fields in DailyLedger ─────────
            const embeddedUpdates: Record<string, any> = {};
            if (data.amount !== undefined)      embeddedUpdates['transactions.$.paidAmount'] = data.amount;
            if (data.category !== undefined)    embeddedUpdates['transactions.$.category']   = data.category;
            if (data.description !== undefined) embeddedUpdates['transactions.$.description'] = data.description;

            if (Object.keys(embeddedUpdates).length > 0) {
                await DailyLedgerModel.findOneAndUpdate(
                    { teacherId, date: day, 'transactions.transactionId': transaction._id },
                    { $set: embeddedUpdates },
                    { session }
                );
            }

            // ── Sync ledgers if amount changed ──────────────────────────────
            if (data.amount !== undefined && data.amount !== transaction.paidAmount) {
                const delta     = data.amount - transaction.paidAmount;
                const isIncome  = transaction.type === TransactionType.INCOME;
                const year      = new Date(txDate).getUTCFullYear();
                const month     = new Date(txDate).getUTCMonth() + 1;

                await Promise.all([
                    // Update DailyLedger totals
                    DailyLedgerModel.findOneAndUpdate(
                        { teacherId, date: day },
                        {
                            $inc: {
                                totalIncome:   isIncome ? delta : 0,
                                totalExpenses: isIncome ? 0 : delta,
                                netBalance:    isIncome ? delta : -delta,
                            },
                        },
                        { session }
                    ),
                    // Update MonthlyLedger totals + daily summary entry
                    MonthlyLedgerModel.findOneAndUpdate(
                        { teacherId, year, month, 'dailySummaries.date': day },
                        {
                            $inc: {
                                totalIncome:                       isIncome ? delta : 0,
                                totalExpenses:                     isIncome ? 0 : delta,
                                netBalance:                        isIncome ? delta : -delta,
                                'dailySummaries.$.totalIncome':    isIncome ? delta : 0,
                                'dailySummaries.$.totalExpenses':  isIncome ? 0 : delta,
                                'dailySummaries.$.netBalance':     isIncome ? delta : -delta,
                            },
                        },
                        { session }
                    ),
                ]);
            }

            return result;
        });

        // Cache invalidation AFTER successful commit (fire-and-forget)
        if (data.amount !== undefined && data.amount !== transaction.paidAmount) {
            cache.del(CacheKeys.dashboard(teacherId));
        }

        return updated;
    }

    // ── Record Center Deduction (Center Commission) ─────────────────────
    /**
     * Records a center-share deduction as an EXPENSE transaction.
     * This is used when a teacher wants to log the amount owed
     * to the center (e.g. monthly commission or percentage share).
     */
    static async recordCenterDeduction(
        teacherId: string,
        data: { centerName: string; amount: number; date?: string; description?: string }
    ) {
        const txDate = resolveTransactionDate(data.date);
        const description = data.description || `خصم سنتر: ${data.centerName}`;

        return await withTransaction(async (session) => {
            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy: teacherId,
                type:           TransactionType.EXPENSE,
                category:       TransactionCategory.OTHER_EXPENSE,
                originalAmount: data.amount,
                discountAmount: 0,
                paidAmount:     data.amount,
                description,
                date: txDate,
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.EXPENSE,
                    category:      TransactionCategory.OTHER_EXPENSE,
                    paidAmount:    data.amount,
                    description,
                    createdBy:     teacherId,
                    time:          txDate,
                }, false, session),
                updateMonthlyLedger(teacherId, txDate, data.amount, false, session),
            ]);

            cache.del(CacheKeys.dashboard(teacherId));
            return tx;
        });
    }

    // ── Record Debt Payment ──────────────────────────────────────────
    static async payDebt(
        teacherId: string,
        createdBy: string,
        data: { studentId: string; amount: number; description?: string; date?: string; idempotencyKey?: string }
    ) {
        if (data.idempotencyKey) {
            const existingTx = await TransactionModel.findOne({ idempotencyKey: data.idempotencyKey }).lean();
            if (existingTx) return existingTx;
        }

        const student = await StudentModel.findById(data.studentId, { studentName: 1, teacherId: 1, totalDebt: 1 }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }
        const totalStudentDebt = student.totalDebt || 0;
        if (totalStudentDebt < data.amount) {
            throw BadRequestException({ message: `المبلغ المدفوع (${data.amount}) أكبر من إجمالي المديونية (${totalStudentDebt})` });
        }

        const txDate = resolveTransactionDate(data.date);
        
        // ── FIFO Debt Allocation ──
        // Calculate how much debt belongs to cycles and how much is historical (before CycleEnrollments)
        const unpaidEnrollments = await CycleEnrollmentModel.find({
            studentId: student._id,
            status: { $in: [CycleEnrollmentStatus.UNPAID, CycleEnrollmentStatus.PARTIALLY_PAID] }
        }).sort({ cycleNumber: 1 }).lean(); // Sort oldest to newest

        const cycleDebt = unpaidEnrollments.reduce((sum, e) => sum + e.remainingAmount, 0);
        const historicalDebt = Math.max(0, totalStudentDebt - cycleDebt);

        let remainingAmountToPay = data.amount;

        // First, pay off historical debt (which has no enrollment record)
        if (historicalDebt > 0) {
            const payHistorical = Math.min(historicalDebt, remainingAmountToPay);
            remainingAmountToPay -= payHistorical;
        }

        // Then, pay off cycle debt
        const enrollmentUpdates: any[] = [];
        if (remainingAmountToPay > 0) {
            for (const enrollment of unpaidEnrollments) {
                if (remainingAmountToPay <= 0) break;

                const payCycle = Math.min(enrollment.remainingAmount, remainingAmountToPay);
                remainingAmountToPay -= payCycle;

                const newTotalPaid = enrollment.totalPaid + payCycle;
                const newRemainingAmount = enrollment.remainingAmount - payCycle;
                let newStatus = CycleEnrollmentStatus.PARTIALLY_PAID;
                if (newRemainingAmount === 0) newStatus = CycleEnrollmentStatus.PAID;

                enrollmentUpdates.push({
                    updateOne: {
                        filter: { _id: enrollment._id },
                        update: {
                            $set: {
                                totalPaid: newTotalPaid,
                                remainingAmount: newRemainingAmount,
                                status: newStatus
                            }
                        }
                    }
                });
            }
        }
        
        const transaction = await withTransaction(async (session) => {
            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.INCOME,
                category:       TransactionCategory.DEBT_PAYMENT,
                studentId:      student._id,
                studentName:    student.studentName,
                originalAmount: data.amount,
                discountAmount: 0,
                paidAmount:     data.amount,
                remainingAmount: 0,
                date:           txDate,
                ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
                ...(data.description ? { description: data.description } : {}),
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.INCOME,
                    category:      TransactionCategory.DEBT_PAYMENT,
                    paidAmount:    data.amount,
                    studentName:   student.studentName,
                    description:   tx!.description,
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, data.amount, true, session),
            ]);

            if (enrollmentUpdates.length > 0) {
                await CycleEnrollmentModel.bulkWrite(enrollmentUpdates, { session });
            }

            await StudentModel.findByIdAndUpdate(data.studentId, {
                $inc: { totalDebt: -data.amount }
            }, { session });

            return tx;
        });

        cache.del(CacheKeys.dashboard(teacherId));
        return transaction;
    }

    // ── Pay Specific Past Cycle Debt ─────────────────────────────────
    static async payCycleDebt(
        teacherId: string,
        createdBy: string,
        data: {
            studentId: string;
            cycleNumber: number;
            paidAmount?: number;
            discountAmount?: number;
            description?: string;
            date?: string;
            idempotencyKey?: string;
        }
    ) {
        if (data.idempotencyKey) {
            const existingTx = await TransactionModel.findOne({ idempotencyKey: data.idempotencyKey }).lean();
            if (existingTx) return existingTx;
        }

        const student = await StudentModel.findById(data.studentId, { studentName: 1, gradeLevel: 1, teacherId: 1, groupId: 1, totalDebt: 1 }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }

        const enrollment = await CycleEnrollmentModel.findOne({
            studentId: student._id,
            cycleNumber: data.cycleNumber
        });

        if (!enrollment) {
            throw NotFoundException({ message: `سجل الدورة رقم (${data.cycleNumber}) غير موجود لهذا الطالب` });
        }

        if (enrollment.status === CycleEnrollmentStatus.PAID) {
            throw BadRequestException({ message: `تم سداد اشتراك الدورة رقم (${data.cycleNumber}) بالكامل مسبقاً` });
        }

        const discountAmount = data.discountAmount ?? 0;
        const paidAmount = data.paidAmount ?? (enrollment.remainingAmount - discountAmount);

        if (paidAmount < 0) throw BadRequestException({ message: 'المدفوع لا يمكن أن يكون سالباً' });
        if (paidAmount + discountAmount > enrollment.remainingAmount) {
            throw BadRequestException({ message: 'إجمالي الدفع والخصم لا يمكن أن يتجاوز المبلغ المتبقي للدورة' });
        }

        const newTotalPaid = enrollment.totalPaid + paidAmount + discountAmount;
        const newRemainingAmount = enrollment.cycleCharge - newTotalPaid;
        let newStatus = CycleEnrollmentStatus.PARTIALLY_PAID;
        if (newRemainingAmount === 0) newStatus = CycleEnrollmentStatus.PAID;
        if (newRemainingAmount === enrollment.cycleCharge) newStatus = CycleEnrollmentStatus.UNPAID;

        const txDate = resolveTransactionDate(data.date);

        const transaction = await withTransaction(async (session) => {
            await CycleEnrollmentModel.findByIdAndUpdate(enrollment._id, {
                $set: {
                    totalPaid: newTotalPaid,
                    remainingAmount: newRemainingAmount,
                    status: newStatus
                }
            }, { session });

            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.INCOME,
                category:       TransactionCategory.SUBSCRIPTION,
                studentId:      student._id,
                studentName:    student.studentName,
                gradeLevel:     student.gradeLevel,
                originalAmount: enrollment.cycleCharge,
                discountAmount,
                paidAmount,
                remainingAmount: newRemainingAmount,
                date:           txDate,
                cycleNumber:    data.cycleNumber,
                ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
                description:    data.description || `سداد مديونية الدورة رقم ${data.cycleNumber}`,
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.INCOME,
                    category:      TransactionCategory.SUBSCRIPTION,
                    paidAmount,
                    studentName:   student.studentName,
                    description:   tx!.description,
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
            ]);

            // If student had debt from this partial cycle or historical debt, reduce it safely
            if (student.totalDebt && student.totalDebt > 0) {
                const reduceDebt = Math.min(student.totalDebt, paidAmount + discountAmount);
                if (reduceDebt > 0) {
                    await StudentModel.findByIdAndUpdate(student._id, {
                        $inc: { totalDebt: -reduceDebt }
                    }, { session });
                }
            }

            return tx;
        });

        cache.del(CacheKeys.dashboard(teacherId));
        return transaction;
    }

    // ── Pay All Past Cycles Debt ──────────────────────────────────────
    static async payAllPastCycles(
        teacherId: string,
        createdBy: string,
        data: {
            studentId: string;
            paidAmount?: number;
            description?: string;
            date?: string;
            idempotencyKey?: string;
        }
    ) {
        const student = await StudentModel.findById(data.studentId, { studentName: 1, gradeLevel: 1, teacherId: 1, groupId: 1, totalDebt: 1 }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }

        const group = await GroupModel.findById(student.groupId, { 'cycle.currentCycleNumber': 1 }).lean();
        const currentCycleNumber = group?.cycle?.currentCycleNumber || 1;

        // Find past unpaid or partially paid enrollments
        const pastEnrollments = await CycleEnrollmentModel.find({
            studentId: student._id,
            cycleNumber: { $lt: currentCycleNumber },
            status: { $in: [CycleEnrollmentStatus.UNPAID, CycleEnrollmentStatus.PARTIALLY_PAID] }
        }).sort({ cycleNumber: 1 });

        if (pastEnrollments.length === 0) {
            throw BadRequestException({ message: 'لا توجد دورات سابقة مستحقة على هذا الطالب' });
        }

        const totalPastDebt = pastEnrollments.reduce((sum, e) => sum + e.remainingAmount, 0);
        let amountToDistribute = data.paidAmount !== undefined ? data.paidAmount : totalPastDebt;

        if (amountToDistribute <= 0) {
            throw BadRequestException({ message: 'المبلغ يجب أن يكون أكبر من صفر' });
        }
        if (amountToDistribute > totalPastDebt) {
            throw BadRequestException({ message: `المبلغ المطلوب سداده (${amountToDistribute}) أكبر من إجمالي المديونيات السابقة (${totalPastDebt})` });
        }

        const results: any[] = [];
        let remainingToDistribute = amountToDistribute;

        for (const enrollment of pastEnrollments) {
            if (remainingToDistribute <= 0) break;
            const payForThisCycle = Math.min(enrollment.remainingAmount, remainingToDistribute);
            remainingToDistribute -= payForThisCycle;

            const tx = await PaymentsService.payCycleDebt(teacherId, createdBy, {
                studentId: data.studentId,
                cycleNumber: enrollment.cycleNumber,
                paidAmount: payForThisCycle,
                discountAmount: 0,
                description: data.description || `سداد مديونية الدورة رقم ${enrollment.cycleNumber} (سداد شامل)`,
                ...(data.date ? { date: data.date } : {}),
                ...(data.idempotencyKey ? { idempotencyKey: `${data.idempotencyKey}_cycle_${enrollment.cycleNumber}` } : {}),
            });
            results.push(tx);
        }

        return {
            message: 'تم سداد المديونيات السابقة بنجاح',
            totalPaid: amountToDistribute,
            transactions: results
        };
    }

    // ── Delete (Void) Transaction ────────────────────────────────────
    /**
     * Permanently deletes a transaction and reverses its effect on
     * the DailyLedger and MonthlyLedger atomically.
     * Only the teacher who owns the record may call this.
     */
    static async deleteTransaction(teacherId: string, transactionId: string) {
        let transaction = await TransactionModel.findOne({ _id: transactionId, teacherId }).lean();
        
        if (!transaction) {
            // Check if it exists in DailyLedger as an orphan
            const ledgerWithOrphan = await DailyLedgerModel.findOne({
                teacherId,
                'transactions.transactionId': transactionId
            }).lean();

            if (!ledgerWithOrphan) {
                // Already deleted (idempotent)
                return { deleted: true, transactionId };
            }

            const orphanTx = ledgerWithOrphan.transactions.find((t: any) => t.transactionId.toString() === transactionId.toString());
            if (!orphanTx) {
                return { deleted: true, transactionId };
            }

            transaction = {
                _id: transactionId,
                teacherId,
                type: orphanTx.type as any,
                category: orphanTx.category as any,
                paidAmount: orphanTx.paidAmount,
                date: orphanTx.time,
            } as any;
        }

        const tx = transaction!;
        const txDate = new Date(tx.date);
        const day = startOfDay(txDate);
        const { year, month } = getEgyptYearMonth(txDate);
        const amount = tx.paidAmount;

        await withTransaction(async (session) => {
            // 1. Delete the transaction document
            await TransactionModel.deleteOne({ _id: tx._id }, { session });

            // 2. Remove from DailyLedger and recompute exact positive totals
            const dailyLedger = await DailyLedgerModel.findOne({
                teacherId,
                $or: [
                    { date: day },
                    { 'transactions.transactionId': tx._id }
                ]
            }).session(session);

            if (dailyLedger) {
                const remainingTxs = (dailyLedger.transactions || []).filter(
                    (t: any) => t.transactionId.toString() !== tx._id.toString()
                );
                const computedIncome = remainingTxs
                    .filter((t: any) => t.type === TransactionType.INCOME)
                    .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
                const computedExpenses = remainingTxs
                    .filter((t: any) => t.type === TransactionType.EXPENSE)
                    .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);

                dailyLedger.transactions = remainingTxs;
                dailyLedger.totalIncome = Math.max(0, computedIncome);
                dailyLedger.totalExpenses = Math.max(0, computedExpenses);
                dailyLedger.netBalance = dailyLedger.totalIncome - dailyLedger.totalExpenses;
                await dailyLedger.save({ session });
            }

            // 3. Update MonthlyLedger
            const monthlyLedger = await MonthlyLedgerModel.findOne({ teacherId, year, month }).session(session);
            if (monthlyLedger) {
                if (dailyLedger) {
                    const summaryIdx = (monthlyLedger.dailySummaries || []).findIndex(
                        (ds: any) => new Date(ds.date).getTime() === new Date(dailyLedger.date).getTime()
                    );
                    if (summaryIdx >= 0) {
                        monthlyLedger.dailySummaries[summaryIdx] = {
                            date: dailyLedger.date,
                            totalIncome: dailyLedger.totalIncome,
                            totalExpenses: dailyLedger.totalExpenses,
                            netBalance: dailyLedger.netBalance,
                            transactionCount: dailyLedger.transactions.length,
                        } as any;
                    }
                }
                const newTotalIncome = (monthlyLedger.dailySummaries || []).reduce((s: number, d: any) => s + (d.totalIncome || 0), 0);
                const newTotalExpenses = (monthlyLedger.dailySummaries || []).reduce((s: number, d: any) => s + (d.totalExpenses || 0), 0);
                monthlyLedger.totalIncome = Math.max(0, newTotalIncome);
                monthlyLedger.totalExpenses = Math.max(0, newTotalExpenses);
                monthlyLedger.netBalance = monthlyLedger.totalIncome - monthlyLedger.totalExpenses;
                await monthlyLedger.save({ session });
            }

            // 4. If this was a subscription, revert the CycleEnrollment
            if (tx.category === TransactionCategory.SUBSCRIPTION && tx.studentId && tx.cycleNumber !== undefined) {
                const enrollment = await CycleEnrollmentModel.findOne({
                    studentId: tx.studentId,
                    cycleNumber: tx.cycleNumber
                }).session(session);

                if (enrollment) {
                    const amountToRevert = tx.paidAmount + (tx.discountAmount || 0);
                    enrollment.totalPaid = Math.max(0, enrollment.totalPaid - amountToRevert);
                    enrollment.remainingAmount += amountToRevert;

                    if (enrollment.remainingAmount >= enrollment.cycleCharge) {
                        enrollment.remainingAmount = enrollment.cycleCharge;
                        enrollment.status = CycleEnrollmentStatus.UNPAID;
                    } else if (enrollment.remainingAmount <= 0) {
                        enrollment.remainingAmount = 0;
                        enrollment.status = CycleEnrollmentStatus.PAID;
                    } else {
                        enrollment.status = CycleEnrollmentStatus.PARTIALLY_PAID;
                    }
                    
                    await enrollment.save({ session });
                }
            }

            // 5. If this transaction had a remaining amount, revert from student's total debt
            if (tx.remainingAmount && tx.remainingAmount > 0 && tx.studentId) {
                await StudentModel.findByIdAndUpdate(
                    tx.studentId,
                    { $inc: { totalDebt: -tx.remainingAmount } },
                    { session }
                );
            }

            // 6. If this transaction was a DEBT_PAYMENT itself, deleting it means the debt comes back
            if (tx.category === TransactionCategory.DEBT_PAYMENT && tx.studentId) {
                await StudentModel.findByIdAndUpdate(
                    tx.studentId,
                    { $inc: { totalDebt: amount } },
                    { session }
                );
            }
        });

        // Invalidate dashboard cache
        cache.del(CacheKeys.dashboard(teacherId));
        return { deleted: true, transactionId };
    }

    // ── Delete (Void) Batch Transactions ────────────────────────────
    /**
     * Permanently deletes multiple transactions in bulk and reverses their ledger effects in a single atomic transaction.
     */
    static async deleteBatchTransactions(teacherId: string, transactionIds: string[]) {
        if (!transactionIds || transactionIds.length === 0) {
            throw BadRequestException({ message: 'يجب تحديد المعاملات المراد مسحها' });
        }

        const uniqueTxIds = Array.from(new Set(transactionIds.map(id => id.toString())));
        const txObjectIds = uniqueTxIds.map(id => new mongoose.Types.ObjectId(id));

        // 1. Fetch all matching transactions in one query
        const transactions = await TransactionModel.find({
            _id: { $in: txObjectIds },
            teacherId
        }).lean();

        const foundTxIdSet = new Set(transactions.map(t => t._id.toString()));
        const missingTxIds = uniqueTxIds.filter(id => !foundTxIdSet.has(id));

        // 2. For any transactions missing from TransactionModel, check DailyLedger in one query
        let orphanTxs: any[] = [];
        if (missingTxIds.length > 0) {
            const ledgersWithOrphans = await DailyLedgerModel.find({
                teacherId,
                'transactions.transactionId': { $in: missingTxIds.map(id => new mongoose.Types.ObjectId(id)) }
            }).lean();

            for (const ledger of ledgersWithOrphans) {
                for (const t of (ledger.transactions || [])) {
                    if (missingTxIds.includes(t.transactionId.toString())) {
                        orphanTxs.push({
                            _id: t.transactionId.toString(),
                            teacherId,
                            type: t.type,
                            category: t.category,
                            paidAmount: t.paidAmount,
                            date: t.time,
                        });
                    }
                }
            }
        }

        const allTxsToDelete = [...transactions, ...orphanTxs];
        if (allTxsToDelete.length === 0) {
            return {
                deletedCount: 0,
                failedCount: 0,
                total: uniqueTxIds.length,
                results: uniqueTxIds.map(id => ({ transactionId: id, success: true }))
            };
        }

        const allDeletedIdSet = new Set(allTxsToDelete.map(t => t._id.toString()));
        const affectedDates = new Set<string>();
        const affectedYearMonths = new Set<string>();

        for (const tx of allTxsToDelete) {
            const txDate = new Date(tx.date);
            affectedDates.add(startOfDay(txDate).toISOString());
            const { year, month } = getEgyptYearMonth(txDate);
            affectedYearMonths.add(`${year}-${month}`);
        }

        // 3. Execute all deletions and ledger updates in ONE database transaction
        await withTransaction(async (session) => {
            // A. Bulk delete from TransactionModel
            await TransactionModel.deleteMany(
                { _id: { $in: Array.from(allDeletedIdSet).map(id => new mongoose.Types.ObjectId(id)) }, teacherId },
                { session }
            );

            // B. Update affected DailyLedgers
            const dateObjects = Array.from(affectedDates).map(d => new Date(d));
            const dailyLedgers = await DailyLedgerModel.find({
                teacherId,
                $or: [
                    { date: { $in: dateObjects } },
                    { 'transactions.transactionId': { $in: Array.from(allDeletedIdSet).map(id => new mongoose.Types.ObjectId(id)) } }
                ]
            }).session(session);

            for (const dailyLedger of dailyLedgers) {
                const remainingTxs = (dailyLedger.transactions || []).filter(
                    (t: any) => !allDeletedIdSet.has(t.transactionId.toString())
                );
                const computedIncome = remainingTxs
                    .filter((t: any) => t.type === TransactionType.INCOME)
                    .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);
                const computedExpenses = remainingTxs
                    .filter((t: any) => t.type === TransactionType.EXPENSE)
                    .reduce((sum: number, t: any) => sum + (t.paidAmount || 0), 0);

                dailyLedger.transactions = remainingTxs;
                dailyLedger.totalIncome = Math.max(0, computedIncome);
                dailyLedger.totalExpenses = Math.max(0, computedExpenses);
                dailyLedger.netBalance = dailyLedger.totalIncome - dailyLedger.totalExpenses;
                await dailyLedger.save({ session });
            }

            // C. Update affected MonthlyLedgers
            for (const ym of affectedYearMonths) {
                const [yStr, mStr] = ym.split('-');
                const y = parseInt(yStr!, 10);
                const m = parseInt(mStr!, 10);

                const monthlyLedger = await MonthlyLedgerModel.findOne({ teacherId, year: y, month: m }).session(session);
                if (monthlyLedger) {
                    for (const dailyLedger of dailyLedgers) {
                        const { year: dy, month: dm } = getEgyptYearMonth(new Date(dailyLedger.date));
                        if (dy === y && dm === m) {
                            const summaryIdx = (monthlyLedger.dailySummaries || []).findIndex(
                                (ds: any) => new Date(ds.date).getTime() === new Date(dailyLedger.date).getTime()
                            );
                            if (summaryIdx >= 0) {
                                monthlyLedger.dailySummaries[summaryIdx] = {
                                    date: dailyLedger.date,
                                    totalIncome: dailyLedger.totalIncome,
                                    totalExpenses: dailyLedger.totalExpenses,
                                    netBalance: dailyLedger.netBalance,
                                    transactionCount: dailyLedger.transactions.length,
                                } as any;
                            }
                        }
                    }
                    const newTotalIncome = (monthlyLedger.dailySummaries || []).reduce((s: number, d: any) => s + (d.totalIncome || 0), 0);
                    const newTotalExpenses = (monthlyLedger.dailySummaries || []).reduce((s: number, d: any) => s + (d.totalExpenses || 0), 0);
                    monthlyLedger.totalIncome = Math.max(0, newTotalIncome);
                    monthlyLedger.totalExpenses = Math.max(0, newTotalExpenses);
                    monthlyLedger.netBalance = monthlyLedger.totalIncome - monthlyLedger.totalExpenses;
                    await monthlyLedger.save({ session });
                }
            }

            // D. Handle Student & CycleEnrollment reversals
            for (const tx of allTxsToDelete) {
                if (tx.category === TransactionCategory.SUBSCRIPTION && tx.studentId && tx.cycleNumber !== undefined) {
                    const enrollment = await CycleEnrollmentModel.findOne({
                        studentId: tx.studentId,
                        cycleNumber: tx.cycleNumber
                    }).session(session);

                    if (enrollment) {
                        const amountToRevert = tx.paidAmount + (tx.discountAmount || 0);
                        enrollment.totalPaid = Math.max(0, enrollment.totalPaid - amountToRevert);
                        enrollment.remainingAmount += amountToRevert;

                        if (enrollment.remainingAmount >= enrollment.cycleCharge) {
                            enrollment.remainingAmount = enrollment.cycleCharge;
                            enrollment.status = CycleEnrollmentStatus.UNPAID;
                        } else if (enrollment.remainingAmount <= 0) {
                            enrollment.remainingAmount = 0;
                            enrollment.status = CycleEnrollmentStatus.PAID;
                        } else {
                            enrollment.status = CycleEnrollmentStatus.PARTIALLY_PAID;
                        }
                        
                        await enrollment.save({ session });
                    }
                }

                if (tx.remainingAmount && tx.remainingAmount > 0 && tx.studentId) {
                    await StudentModel.findByIdAndUpdate(
                        tx.studentId,
                        { $inc: { totalDebt: -tx.remainingAmount } },
                        { session }
                    );
                }

                if (tx.category === TransactionCategory.DEBT_PAYMENT && tx.studentId) {
                    await StudentModel.findByIdAndUpdate(
                        tx.studentId,
                        { $inc: { totalDebt: tx.paidAmount } },
                        { session }
                    );
                }
            }
        });

        cache.del(CacheKeys.dashboard(teacherId));

        return {
            deletedCount: allTxsToDelete.length,
            failedCount: uniqueTxIds.length - allTxsToDelete.length,
            total: uniqueTxIds.length,
            results: uniqueTxIds.map(id => ({ transactionId: id, success: true })),
        };
    }
}


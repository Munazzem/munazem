import mongoose from 'mongoose';
import { PriceSettingsModel } from '../../database/models/price-settings.model.js';
import { TransactionModel }   from '../../database/models/transaction.model.js';
import { DailyLedgerModel }   from '../../database/models/ledger.model.js';
import { MonthlyLedgerModel } from '../../database/models/ledger.model.js';
import { StudentModel }       from '../../database/models/student.model.js';
import { GroupModel }          from '../../database/models/group.model.js';
import { NotebookModel }      from '../../database/models/notebook.model.js';
import { NotebookReservationModel } from '../../database/models/notebook-reservation.model.js';
import { ReservationStatus } from '../../types/notebook-reservation.types.js';
import { TransactionType, TransactionCategory, GradeLevel } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import { cache, CacheKeys, CacheTTL } from '../../infrastructure/cache/cache.service.js';
import type { IPriceSetting } from '../../types/price-settings.types.js';

// ─── Helpers ─────────────────────────────────────────────────────

// Maps any timestamp to the midnight UTC of the day it falls on in Egypt.
// Example: 10 PM Egypt time (19:00 UTC) on May 18 → May 18 00:00:00 UTC.
// Example: 1 AM Egypt time (22:00 UTC) on May 19 → May 19 00:00:00 UTC.
// This perfectly aligns with existing data keys (which were saved exactly at 00:00:00 UTC).
function startOfDay(date: Date): Date {
    const EGYPT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const local = new Date(date.getTime() + EGYPT_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0));
}

// Resolves a transaction date string to a precise Date object.
// If it's today's date in Egypt, it uses the exact current time.
// If it's backdated, it defaults to 12:00 PM (Noon) Egypt time to avoid 3:00 AM weirdness.
export function resolveTransactionDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const EGYPT_OFFSET_MS = 3 * 60 * 60 * 1000;
        const now = new Date();
        const egyptNow = new Date(now.getTime() + EGYPT_OFFSET_MS);
        const todayStr = egyptNow.toISOString().split('T')[0];
        
        if (dateStr === todayStr) {
            return now; // exact current time
        } else {
            // Noon Egypt time (09:00 UTC)
            return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 9, 0, 0, 0));
        }
    }
    return new Date(dateStr);
}

// Atomically updates (upsert) the DailyLedger when a transaction occurs
async function updateDailyLedger(
    teacherId: string,
    date: Date,
    transaction: { transactionId: any; type: string; category: string; paidAmount: number; studentName?: string; description?: string; createdBy: any; time: Date },
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
    const year  = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
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
    static async upsertPriceSettings(teacherId: string, prices: IPriceSetting[]) {
        const result = await PriceSettingsModel.findOneAndUpdate(
            { teacherId },
            { teacherId, prices },
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
        data: { studentId: string; discountAmount?: number; description?: string; date?: string }
    ) {
        // Get student info
        const student = await StudentModel.findById(data.studentId, {
            studentName: 1, gradeLevel: 1, teacherId: 1
        }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (student.teacherId.toString() !== teacherId) {
            throw BadRequestException({ message: 'هذا الطالب لا ينتمي إلى هذا المعلم' });
        }

        // Get teacher's price for this grade
        const settings = await PriceSettingsModel.findOne({ teacherId }).lean();
        const priceSetting = settings?.prices.find(p => p.gradeLevel === student.gradeLevel);
        if (!priceSetting) {
            throw BadRequestException({ message: `لم يتم تحديد سعر للمرحلة: ${student.gradeLevel}` });
        }

        const discountAmount = data.discountAmount ?? 0;
        const originalAmount = priceSetting.amount;
        const paidAmount     = originalAmount - discountAmount;
        const txDate         = resolveTransactionDate(data.date);

        if (paidAmount < 0) throw BadRequestException({ message: 'الخصم لا يمكن أن يتجاوز السعر الأصلي' });

        // Get group quota info before transaction (read-only)
        const group = await GroupModel.findById(student.groupId, { schedule: 1 }).lean();
        const quota = (student as any).monthlySessionsQuota || (group?.schedule?.length ?? 2) * 4;

        // ── All mutations wrapped in a transaction (all-or-nothing) ──
        const transaction = await withTransaction(async (session) => {
            const [tx] = await TransactionModel.create([{
                teacherId,
                createdBy,
                type:           TransactionType.INCOME,
                category:       TransactionCategory.SUBSCRIPTION,
                studentId:      student._id,
                studentName:    student.studentName,
                gradeLevel:     student.gradeLevel,
                originalAmount,
                discountAmount,
                paidAmount,
                date:           txDate,
                ...(data.description ? { description: data.description } : {}),
            }], { session });

            await Promise.all([
                updateDailyLedger(teacherId, txDate, {
                    transactionId: tx!._id,
                    type:          TransactionType.INCOME,
                    category:      TransactionCategory.SUBSCRIPTION,
                    paidAmount,
                    studentName:   student.studentName,
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
            ]);

            await StudentModel.findByIdAndUpdate(data.studentId, {
                $set: { remainingSessions: quota }
            }, { session });

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
        data: { studentIds: string[]; discountAmount?: number; description?: string; date?: string }
    ) {
        if (!data.studentIds || data.studentIds.length === 0) {
            throw BadRequestException({ message: 'يجب اختيار طالب واحد على الأقل' });
        }

        const settings = await PriceSettingsModel.findOne({ teacherId }).lean();
        if (!settings) {
            throw BadRequestException({ message: 'لم يتم تحديد أسعار المراحل بعد — يرجى إعداد الأسعار أولاً' });
        }

        const txDate = resolveTransactionDate(data.date);
        const discountAmount = data.discountAmount ?? 0;

        const results: { studentId: string; studentName: string; paidAmount: number; status: 'success' | 'error'; error?: string }[] = [];

        // Batch fetch all students to avoid N+1 queries
        const studentDocs = await StudentModel.find(
            { _id: { $in: data.studentIds }, teacherId },
            { studentName: 1, gradeLevel: 1, teacherId: 1 }
        ).lean();
        const studentMap = new Map(studentDocs.map(s => [s._id.toString(), s]));

        for (const studentId of data.studentIds) {
            try {
                const student = studentMap.get(studentId);

                if (!student) {
                    results.push({ studentId, studentName: '', paidAmount: 0, status: 'error', error: 'الطالب غير موجود أو لا ينتمي إلى هذا المعلم' });
                    continue;
                }

                const priceSetting = settings.prices.find(p => p.gradeLevel === student.gradeLevel);
                if (!priceSetting) {
                    results.push({ studentId, studentName: student.studentName, paidAmount: 0, status: 'error', error: `لم يتم تحديد سعر للمرحلة: ${student.gradeLevel}` });
                    continue;
                }

                const originalAmount = priceSetting.amount;
                const paidAmount = Math.max(0, originalAmount - discountAmount);

                // ── Each student wrapped in its own transaction (atomic per student) ──
                await withTransaction(async (session) => {
                    const [tx] = await TransactionModel.create([{
                        teacherId,
                        createdBy,
                        type:           TransactionType.INCOME,
                        category:       TransactionCategory.SUBSCRIPTION,
                        studentId:      student._id,
                        studentName:    student.studentName,
                        gradeLevel:     student.gradeLevel,
                        originalAmount,
                        discountAmount,
                        paidAmount,
                        date:           txDate,
                        ...(data.description ? { description: data.description } : {}),
                    }], { session });

                    // Get group quota info
                    const group = await GroupModel.findById(student.groupId, { schedule: 1 }).session(session).lean();
                    const quota = (student as any).monthlySessionsQuota || (group?.schedule?.length ?? 2) * 4;

                    await Promise.all([
                        updateDailyLedger(teacherId, txDate, {
                            transactionId: tx!._id,
                            type:          TransactionType.INCOME,
                            category:      TransactionCategory.SUBSCRIPTION,
                            paidAmount,
                            studentName:   student.studentName,
                            createdBy,
                            time:          txDate,
                        }, true, session),
                        updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
                        StudentModel.findByIdAndUpdate(studentId, {
                            $set: { remainingSessions: quota }
                        }, { session }),
                    ]);
                });

                results.push({ studentId, studentName: student.studentName, paidAmount, status: 'success' });
            } catch (err: any) {
                results.push({ studentId, studentName: studentMap.get(studentId)?.studentName ?? '', paidAmount: 0, status: 'error', error: err?.message ?? 'خطأ غير متوقع' });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const totalPaid    = results.filter(r => r.status === 'success').reduce((sum, r) => sum + r.paidAmount, 0);

        // Invalidate dashboard cache after batch financial mutation
        if (successCount > 0) cache.del(CacheKeys.dashboard(teacherId));

        return { results, successCount, failCount: results.length - successCount, totalPaid };
    }

    // ── Record Notebook Sale ────────────────────────────────────────
    // notebookId is required — price is taken from the Notebook model,
    // and stock is decremented atomically with the ledger updates.
    static async recordNotebookSale(
        teacherId: string,
        createdBy: string,
        data: { studentId: string; notebookId: string; quantity?: number; discountAmount?: number; description?: string; date?: string }
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
        const paidAmount     = originalAmount - discountAmount;
        const txDate         = resolveTransactionDate(data.date);

        if (paidAmount < 0) throw BadRequestException({ message: 'الخصم لا يمكن أن يتجاوز السعر' });

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
                    createdBy,
                    time:          txDate,
                }, true, session),
                updateMonthlyLedger(teacherId, txDate, paidAmount, true, session),
            ]);

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

    // ── Get Daily Ledger ────────────────────────────────────────────
    static async getDailyLedger(teacherId: string, date: string) {
        const dayDate = new Date(date);
        const day = startOfDay(dayDate);
        const year = dayDate.getUTCFullYear();
        const month = dayDate.getUTCMonth() + 1;

        const [ledger, monthlyLedger] = await Promise.all([
            DailyLedgerModel.findOne({ teacherId, date: day }).lean(),
            MonthlyLedgerModel.findOne({ teacherId, year, month }, { totalIncome: 1, totalExpenses: 1 }).lean(),
        ]);

        const base = ledger || { date: day, transactions: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        
        return {
            ...base,
            monthlyIncome: monthlyLedger?.totalIncome ?? 0,
            monthlyExpenses: monthlyLedger?.totalExpenses ?? 0,
        };
    }

    // ── Get Monthly Ledger ──────────────────────────────────────────
    static async getMonthlyLedger(teacherId: string, year: number, month: number) {
        const ledger = await MonthlyLedgerModel.findOne({ teacherId, year, month }).lean();
        if (!ledger) return { year, month, dailySummaries: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        return ledger;
    }

    // ── Update Transaction (Teacher only) ───────────────────────────
    // Allowed fields: amount, category, description, date.
    // studentId is intentionally excluded to preserve audit integrity.
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
        if (data.date        !== undefined)   update['date']            = resolveTransactionDate(data.date);

        const updated = await TransactionModel.findByIdAndUpdate(
            transactionId,
            { $set: update },
            { new: true, runValidators: true }
        ).lean();

        return updated;
    }
}

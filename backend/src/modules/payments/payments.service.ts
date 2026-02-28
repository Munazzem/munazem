import { PriceSettingsModel } from '../../database/models/price-settings.model.js';
import { TransactionModel }   from '../../database/models/transaction.model.js';
import { DailyLedgerModel }   from '../../database/models/ledger.model.js';
import { MonthlyLedgerModel } from '../../database/models/ledger.model.js';
import { StudentModel }       from '../../database/models/student.model.js';
import { NotebookModel }      from '../../database/models/notebook.model.js';
import { TransactionType, TransactionCategory, GradeLevel } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';
import type { IPriceSetting } from '../../types/price-settings.types.js';

// ─── Helpers ─────────────────────────────────────────────────────

// Returns start-of-day UTC Date for a given date
function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

// Atomically updates (upsert) the DailyLedger when a transaction occurs
async function updateDailyLedger(
    teacherId: string,
    date: Date,
    transaction: { transactionId: any; type: string; category: string; paidAmount: number; studentName?: string; description?: string; createdBy: any; time: Date },
    isIncome: boolean
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
        { upsert: true }
    );
}

// Atomically updates (upsert) the MonthlyLedger when a transaction occurs.
// Two-step approach: try to $inc existing day entry, fall back to $push if day not yet in array.
async function updateMonthlyLedger(
    teacherId: string,
    date: Date,
    paidAmount: number,
    isIncome: boolean
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
        }
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
        { upsert: true }
    );
}


// ─── PaymentsService ─────────────────────────────────────────────
export class PaymentsService {

    // ── Price Settings ──────────────────────────────────────────────
    static async upsertPriceSettings(teacherId: string, prices: IPriceSetting[]) {
        return await PriceSettingsModel.findOneAndUpdate(
            { teacherId },
            { teacherId, prices },
            { upsert: true, new: true, runValidators: true }
        ).lean();
    }

    static async getPriceSettings(teacherId: string) {
        const settings = await PriceSettingsModel.findOne({ teacherId }).lean();
        if (!settings) throw NotFoundException({ message: 'لم يتم تحديد أسعار المراحل بعد' });
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
        const txDate         = data.date ? new Date(data.date) : new Date();

        if (paidAmount < 0) throw BadRequestException({ message: 'الخصم لا يمكن أن يتجاوز السعر الأصلي' });

        const transaction = await TransactionModel.create({
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
        });

        // Update both ledgers atomically
        await Promise.all([
            updateDailyLedger(teacherId, txDate, {
                transactionId: transaction._id,
                type:          TransactionType.INCOME,
                category:      TransactionCategory.SUBSCRIPTION,
                paidAmount,
                studentName:   student.studentName,
                createdBy,
                time:          txDate,
            }, true),
            updateMonthlyLedger(teacherId, txDate, paidAmount, true),
        ]);

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

        const txDate = data.date ? new Date(data.date) : new Date();
        const discountAmount = data.discountAmount ?? 0;

        const results: { studentId: string; studentName: string; paidAmount: number; status: 'success' | 'error'; error?: string }[] = [];

        for (const studentId of data.studentIds) {
            try {
                const student = await StudentModel.findById(studentId, {
                    studentName: 1, gradeLevel: 1, teacherId: 1
                }).lean();

                if (!student) {
                    results.push({ studentId, studentName: '', paidAmount: 0, status: 'error', error: 'الطالب غير موجود' });
                    continue;
                }

                if (student.teacherId.toString() !== teacherId) {
                    results.push({ studentId, studentName: student.studentName, paidAmount: 0, status: 'error', error: 'الطالب لا ينتمي إلى هذا المعلم' });
                    continue;
                }

                const priceSetting = settings.prices.find(p => p.gradeLevel === student.gradeLevel);
                if (!priceSetting) {
                    results.push({ studentId, studentName: student.studentName, paidAmount: 0, status: 'error', error: `لم يتم تحديد سعر للمرحلة: ${student.gradeLevel}` });
                    continue;
                }

                const originalAmount = priceSetting.amount;
                const paidAmount = Math.max(0, originalAmount - discountAmount);

                const transaction = await TransactionModel.create({
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
                });

                await Promise.all([
                    updateDailyLedger(teacherId, txDate, {
                        transactionId: transaction._id,
                        type:          TransactionType.INCOME,
                        category:      TransactionCategory.SUBSCRIPTION,
                        paidAmount,
                        studentName:   student.studentName,
                        createdBy,
                        time:          txDate,
                    }, true),
                    updateMonthlyLedger(teacherId, txDate, paidAmount, true),
                ]);

                results.push({ studentId, studentName: student.studentName, paidAmount, status: 'success' });
            } catch (err: any) {
                results.push({ studentId, studentName: '', paidAmount: 0, status: 'error', error: err?.message ?? 'خطأ غير متوقع' });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const totalPaid    = results.filter(r => r.status === 'success').reduce((sum, r) => sum + r.paidAmount, 0);

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
        const txDate         = data.date ? new Date(data.date) : new Date();

        if (paidAmount < 0) throw BadRequestException({ message: 'الخصم لا يمكن أن يتجاوز السعر' });

        const transaction = await TransactionModel.create({
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
        });

        // Decrement stock + update both ledgers — all in parallel
        await Promise.all([
            NotebookModel.findByIdAndUpdate(data.notebookId, { $inc: { stock: -quantity } }),
            updateDailyLedger(teacherId, txDate, {
                transactionId: transaction._id,
                type:          TransactionType.INCOME,
                category:      TransactionCategory.NOTEBOOK_SALE,
                paidAmount,
                studentName:   student.studentName,
                createdBy,
                time:          txDate,
            }, true),
            updateMonthlyLedger(teacherId, txDate, paidAmount, true),
        ]);

        return transaction;
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

        const txDate = data.date ? new Date(data.date) : new Date();
        const transaction = await TransactionModel.create({
            teacherId,
            createdBy,
            type:           TransactionType.EXPENSE,
            category:       data.category,
            originalAmount: data.amount,
            discountAmount: 0,
            paidAmount:     data.amount,
            date:           txDate,
            ...(data.description ? { description: data.description } : {}),
        });

        await Promise.all([
            updateDailyLedger(teacherId, txDate, {
                transactionId: transaction._id,
                type:          TransactionType.EXPENSE,
                category:      data.category,
                paidAmount:    data.amount,
                createdBy,
                time:          txDate,
                ...(data.description ? { description: data.description } : {}),
            }, false),
            updateMonthlyLedger(teacherId, txDate, data.amount, false),
        ]);

        return transaction;
    }

    // ── Get Daily Ledger ────────────────────────────────────────────
    static async getDailyLedger(teacherId: string, date: string) {
        const day = startOfDay(new Date(date));
        const ledger = await DailyLedgerModel.findOne({ teacherId, date: day }).lean();
        if (!ledger) return { date: day, transactions: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        return ledger;
    }

    // ── Get Monthly Ledger ──────────────────────────────────────────
    static async getMonthlyLedger(teacherId: string, year: number, month: number) {
        const ledger = await MonthlyLedgerModel.findOne({ teacherId, year, month }).lean();
        if (!ledger) return { year, month, dailySummaries: [], totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        return ledger;
    }
}

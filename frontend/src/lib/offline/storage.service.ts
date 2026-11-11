/**
 * frontend/src/lib/offline/storage.service.ts
 *
 * Dedicated offline storage service for local read-cache operations
 * on students, reports, groups, sessions, exams, financial ledgers, and generic mutations.
 */

import {
    STORES,
    getAllFromStore,
    getByIdFromStore,
    putManyInStore,
    putOneInStore,
    deleteFromStore,
    countStore,
    getKeyVal,
    setKeyVal,
    clearAllOfflineData as dbClearAll,
} from './db';
import { OutboxService } from './outbox.service';


export interface OfflineStorageStats {
    studentsCount: number;
    groupsCount: number;
    sessionsCount: number;
    examsCount: number;
    notebooksCount?: number;
    usersCount?: number;
    centerTeachersCount?: number;
    centerPackagesCount?: number;
    centerGroupsCount?: number;
    centerStudentsCount?: number;
    centerCheckInsCount?: number;
    pendingOutboxCount: number;
    pendingMutationsCount: number;
    pendingDeletionsCount?: number;
    lastPreloadAt: number | null;
}

export interface GenericOfflineMutation {
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data?: any;
    createdAt: number;
    status: 'QUEUED' | 'SYNCING' | 'RESOLVED' | 'FAILED';
    description?: string;
    retryCount?: number;
}

export class OfflineStorageService {
    // ── Students ─────────────────────────────────────────────────────────────

    /**
     * Cache a list of students into IndexedDB.
     * Also seeds baseline student reports so every student has an instant offline profile.
     */
    static async saveOfflineStudents(students: any[]): Promise<void> {
        if (!students || students.length === 0) return;
        await putManyInStore(STORES.STUDENTS, students);

        // Pre-generate baseline reports for offline viewing ONLY if not already cached with real data
        const existingReports = await getAllFromStore<any>(STORES.STUDENT_REPORTS);
        const existingMap = new Map(existingReports.map(r => [r.studentId, r]));

        const baselineReports: any[] = [];
        for (const st of students) {
            const existing = existingMap.get(st._id);
            // If existing report has real attendance, grades, or payments, preserve it!
            if (existing && existing.report && (
                (existing.report.attendance?.totalSessions > 0) ||
                (existing.report.grades?.total > 0) ||
                (existing.report.payments?.totalPaid > 0) ||
                (existing.report.payments?.subscriptions?.length > 0)
            )) {
                continue;
            }

            const groupName = typeof st.groupId === 'object' ? (st.groupId?.name || '—') : (st.groupDetails?.name || '—');
            baselineReports.push({
                studentId: st._id,
                report: {
                    student: {
                        ...st,
                        groupName,
                        monthlySessionsQuota: st.monthlySessionsQuota || 8,
                        remainingSessions: st.remainingSessions ?? 0,
                    },
                    attendance: {
                        totalSessions: 0,
                        presentCount: 0,
                        absentCount: 0,
                        attendanceRate: '100%',
                        history: [],
                        cycles: [],
                    },
                    payments: {
                        totalPaid: 0,
                        totalDiscount: 0,
                        subscriptionsCount: st.hasActiveSubscription ? 1 : 0,
                        notebookSalesCount: 0,
                        history: [],
                        subscriptions: [],
                        cycleEnrollments: [],
                        pastUnpaidCycles: [],
                        pastCyclesDebt: st.totalDebt || 0,
                        currentCycleNumber: 1,
                    },
                    grades: {
                        total: 0,
                        history: [],
                    },
                },
                updatedAt: Date.now(),
            });
        }

        if (baselineReports.length > 0) {
            await putManyInStore(STORES.STUDENT_REPORTS, baselineReports);
        }
    }

    /**
     * Save or update a single student.
     */
    static async saveOneOfflineStudent(student: any): Promise<void> {
        if (!student || !student._id) return;
        await putOneInStore(STORES.STUDENTS, student);
    }

    /**
     * Delete a student locally.
     */
    static async deleteOfflineStudent(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.STUDENTS, id);
    }

    /**
     * Get all cached students, optionally filtered by groupId, search term, or active status.
     */
    static async getOfflineStudents(params?: { groupId?: string; search?: string; isActive?: boolean | string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.STUDENTS);
        if (!params) return all;

        let filtered = all;
        if (params.groupId) {
            const targetGroupId = params.groupId.toString().trim();
            filtered = filtered.filter(s => {
                let sGid = '';
                if (s.groupId) {
                    if (typeof s.groupId === 'object') {
                        sGid = (s.groupId._id || s.groupId.id || '').toString().trim();
                    } else {
                        sGid = s.groupId.toString().trim();
                    }
                } else if (s.groupDetails) {
                    sGid = (s.groupDetails._id || s.groupDetails.id || '').toString().trim();
                }
                return sGid === targetGroupId;
            });
        }

        if (params.isActive !== undefined && params.isActive !== '') {
            const activeBool = params.isActive === true || params.isActive === 'true';
            filtered = filtered.filter(s => !!s.isActive === activeBool);
        }

        if (params.search) {
            const term = params.search.trim().toLowerCase();
            filtered = filtered.filter(s => {
                const name = (s.studentName || '').toLowerCase();
                const code = (s.studentCode || '').toString().toLowerCase();
                const phone = (s.studentPhone || '').toString().toLowerCase();
                const parentPhone = (s.parentPhone || '').toString().toLowerCase();
                const barcode = (s.barcode || '').toString().toLowerCase();
                return name.includes(term) || code.includes(term) || phone.includes(term) || parentPhone.includes(term) || barcode.includes(term);
            });
        }

        return filtered;
    }

    /**
     * Get a student by their unique MongoDB _id.
     */
    static async getOfflineStudentById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.STUDENTS, id);
    }

    /**
     * Find a student for attendance scanning (matches studentCode, barcode, phone, or _id).
     */
    static async findOfflineStudentByScan(scanInput: string): Promise<any | undefined> {
        if (!scanInput) return undefined;
        const trimmed = scanInput.trim().toLowerCase();
        const all = await getAllFromStore<any>(STORES.STUDENTS);

        return all.find(s => {
            const code = (s.studentCode || '').toString().trim().toLowerCase();
            const phone = (s.studentPhone || '').toString().trim().toLowerCase();
            const id = (s._id || '').toString().toLowerCase();
            const barcode = (s.barcode || '').toString().trim().toLowerCase();
            return code === trimmed || phone === trimmed || id === trimmed || barcode === trimmed;
        });
    }

    // ── Student Reports (Comprehensive Profile, Attendance, Payments, Grades) ──

    /**
     * Cache student report into IndexedDB.
     */
    static async saveOfflineStudentReport(studentId: string, report: any): Promise<void> {
        if (!studentId || !report) return;
        await putOneInStore(STORES.STUDENT_REPORTS, {
            studentId,
            report,
            updatedAt: Date.now(),
        });
    }

    /**
     * Cache batch student reports bundle into IndexedDB.
     */
    static async saveOfflineStudentReportsBundle(bundle: { studentId: string; report: any }[]): Promise<void> {
        if (!bundle || bundle.length === 0) return;
        const items = bundle.map(b => ({
            studentId: b.studentId,
            report: b.report,
            updatedAt: Date.now(),
        }));
        await putManyInStore(STORES.STUDENT_REPORTS, items);
    }

    /**
     * Retrieve cached student report by studentId.
     */
    static async getOfflineStudentReport(studentId: string): Promise<any | undefined> {
        const item = await getByIdFromStore<any>(STORES.STUDENT_REPORTS, studentId);
        return item?.report;
    }

    // ── Groups ───────────────────────────────────────────────────────────────

    /**
     * Cache groups into IndexedDB.
     */
    static async saveOfflineGroups(groups: any[]): Promise<void> {
        if (!groups || groups.length === 0) return;
        await putManyInStore(STORES.GROUPS, groups);
    }

    /**
     * Retrieve all cached groups.
     */
    static async getOfflineGroups(): Promise<any[]> {
        return await getAllFromStore<any>(STORES.GROUPS);
    }

    /**
     * Retrieve a group by _id.
     */
    static async getOfflineGroupById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.GROUPS, id);
    }

    // ── Sessions ─────────────────────────────────────────────────────────────

    /**
     * Cache sessions into IndexedDB.
     */
    static async saveOfflineSessions(sessions: any[]): Promise<void> {
        if (!sessions || sessions.length === 0) return;
        await putManyInStore(STORES.SESSIONS, sessions);
    }

    /**
     * Save a single session locally.
     */
    static async saveOneOfflineSession(session: any): Promise<void> {
        if (!session || !session._id) return;
        await putOneInStore(STORES.SESSIONS, session);
    }

    /**
     * Retrieve cached sessions, optionally filtered by groupId, date, or status.
     */
    static async getOfflineSessions(filters?: { groupId?: string; date?: string; status?: string } | string): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.SESSIONS);
        if (!filters) return all;

        const groupId = typeof filters === 'string' ? filters : filters.groupId;
        const date = typeof filters === 'object' ? filters.date : undefined;
        const status = typeof filters === 'object' ? filters.status : undefined;

        const targetGid = groupId ? groupId.toString().trim() : undefined;

        return all.filter(s => {
            if (targetGid) {
                let sGid = '';
                if (s.groupId) {
                    sGid = typeof s.groupId === 'object' && s.groupId._id ? s.groupId._id.toString().trim() : s.groupId.toString().trim();
                }
                if (sGid !== targetGid) return false;
            }

            if (status && s.status !== status) {
                return false;
            }

            if (date) {
                if (!s.date) return false;
                const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0];
                if (sDate !== date) return false;
            }

            return true;
        });
    }

    /**
     * Retrieve a session by _id.
     */
    static async getOfflineSessionById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.SESSIONS, id);
    }

    // ── Attendance Records ───────────────────────────────────────────────────

    /**
     * Cache attendance records into IndexedDB.
     */
    static async saveOfflineAttendanceRecords(records: any[]): Promise<void> {
        if (!records || records.length === 0) return;
        await putManyInStore(STORES.ATTENDANCE, records);
    }

    /**
     * Retrieve cached attendance records for a specific session.
     */
    static async getOfflineAttendanceRecords(sessionId: string): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.ATTENDANCE);
        return all.filter(r => {
            const rSessionId = typeof r.sessionId === 'object' ? r.sessionId?._id : r.sessionId;
            return rSessionId === sessionId;
        });
    }

    // ── Exams ────────────────────────────────────────────────────────────────

    /**
     * Cache exams into IndexedDB.
     */
    static async saveOfflineExams(exams: any[]): Promise<void> {
        if (!exams || exams.length === 0) return;
        await putManyInStore(STORES.EXAMS, exams);
    }

    /**
     * Retrieve cached exams, optionally filtered by gradeLevel and status.
     */
    static async getOfflineExams(params?: { gradeLevel?: string; status?: string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.EXAMS);
        if (!params) return all;

        let filtered = all;
        if (params.gradeLevel) {
            filtered = filtered.filter(e => e.gradeLevel === params.gradeLevel);
        }
        if (params.status) {
            filtered = filtered.filter(e => e.status === params.status);
        }
        return filtered;
    }

    /**
     * Retrieve an exam by _id.
     */
    static async getOfflineExamById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.EXAMS, id);
    }

    // ── Exam Results ─────────────────────────────────────────────────────────

    static async saveOfflineExamResults(examId: string, data: any): Promise<void> {
        if (!examId || !data) return;
        await putOneInStore(STORES.EXAM_RESULTS, {
            examId,
            data,
            updatedAt: Date.now(),
        });
    }

    static async getOfflineExamResults(examId: string): Promise<any | undefined> {
        const item = await getByIdFromStore<any>(STORES.EXAM_RESULTS, examId);
        return item?.data;
    }

    /**
     * Retrieve all exam grades for a specific student from cached exam results.
     */
    static async getOfflineStudentGrades(studentId: string): Promise<any[]> {
        const allExamResults = await getAllFromStore<any>(STORES.EXAM_RESULTS);
        const grades: any[] = [];
        for (const item of allExamResults) {
            const results = item.data?.results || [];
            const exam = item.data?.exam;
            const match = results.find((r: any) => (r.studentId?._id || r.studentId || '').toString() === studentId);
            if (match) {
                grades.push({
                    _id: match._id,
                    examId: item.examId,
                    examTitle: exam?.title || 'امتحان',
                    score: match.score,
                    totalMarks: match.totalMarks,
                    passingMarks: match.passingMarks,
                    percentage: match.percentage,
                    grade: match.grade,
                    passed: match.passed,
                    date: match.date || exam?.date,
                });
            }
        }
        return grades.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }

    // ── Financials & Daily Summary (Key-Value) ───────────────────────────────

    static async saveDailySummary(date: string, data: any): Promise<void> {
        await setKeyVal(`daily_summary_${date}`, data);
    }

    static async getDailySummary(date: string): Promise<any | undefined> {
        return await getKeyVal<any>(`daily_summary_${date}`);
    }

    static async saveDailyLedger(date: string, data: any): Promise<void> {
        await setKeyVal(`daily_ledger_${date}`, data);
    }

    static async getDailyLedger(date: string): Promise<any | undefined> {
        return await getKeyVal<any>(`daily_ledger_${date}`);
    }

    static async saveMonthlyLedger(year: number, month: number, data: any): Promise<void> {
        await setKeyVal(`monthly_ledger_${year}_${month}`, data);
    }

    static async getMonthlyLedger(year: number, month: number): Promise<any | undefined> {
        return await getKeyVal<any>(`monthly_ledger_${year}_${month}`);
    }

    static async savePriceSettings(data: any): Promise<void> {
        await setKeyVal('price_settings', data);
    }

    static async getPriceSettings(): Promise<any | undefined> {
        return await getKeyVal<any>('price_settings');
    }

    /**
     * Record a financial transaction offline into local Daily Ledger, Daily Summary, and student report/debt.
     */
    static async recordOfflineTransaction(params: {
        type: 'INCOME' | 'EXPENSE';
        category: string;
        paidAmount: number;
        studentId?: string;
        studentName?: string;
        description?: string;
        date?: string;
    }): Promise<any> {
        const today = new Date().toISOString().split('T')[0]!;
        const date = params.date || today;
        const tempTxId = `loc_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const nowTime = new Date().toISOString();
        const paidAmount = Number(params.paidAmount) || 0;

        let studentName = params.studentName;
        if (params.studentId && !studentName) {
            const student = await this.getOfflineStudentById(params.studentId);
            if (student) {
                studentName = student.studentName;
            }
        }

        const txItem: any = {
            transactionId: tempTxId,
            _id: tempTxId,
            type: params.type,
            category: params.category,
            paidAmount,
            studentId: params.studentId,
            studentName: studentName || '—',
            description: params.description || '',
            createdBy: 'أوفلاين (محلي)',
            time: nowTime,
            date,
            createdAt: nowTime,
            isPendingSync: true,
            offlinePending: true,
        };

        // 1. Update Daily Ledger
        const ledger = (await this.getDailyLedger(date)) || {
            date,
            transactions: [],
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            monthlyIncome: 0,
            monthlyExpenses: 0,
        };

        if (!Array.isArray(ledger.transactions)) {
            ledger.transactions = [];
        }
        ledger.transactions.unshift(txItem);

        if (params.type === 'INCOME') {
            ledger.totalIncome = (ledger.totalIncome || 0) + paidAmount;
        } else {
            ledger.totalExpenses = (ledger.totalExpenses || 0) + paidAmount;
        }
        ledger.netBalance = (ledger.totalIncome || 0) - (ledger.totalExpenses || 0);

        await this.saveDailyLedger(date, ledger);

        // 2. Update Daily Summary
        const summary = (await this.getDailySummary(date)) || {
            date,
            totalAttendance: 0,
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            sessions: [],
            transactions: [],
            stats: {
                totalIncome: 0,
                totalExpenses: 0,
                netBalance: 0,
                subscriptionsCount: 0,
                subscriptionsRevenue: 0,
                notebooksSoldQuantity: 0,
                notebooksRevenue: 0,
            },
        };

        if (params.type === 'INCOME') {
            summary.totalIncome = (summary.totalIncome || 0) + paidAmount;
            if (summary.stats) {
                summary.stats.totalIncome = (summary.stats.totalIncome || 0) + paidAmount;
                if (params.category === 'SUBSCRIPTION') {
                    summary.stats.subscriptionsCount = (summary.stats.subscriptionsCount || 0) + 1;
                    summary.stats.subscriptionsRevenue = (summary.stats.subscriptionsRevenue || 0) + paidAmount;
                } else if (params.category === 'NOTEBOOK_SALE' || params.category === 'NOTEBOOK_RESERVATION') {
                    summary.stats.notebooksSoldQuantity = (summary.stats.notebooksSoldQuantity || 0) + 1;
                    summary.stats.notebooksRevenue = (summary.stats.notebooksRevenue || 0) + paidAmount;
                }
            }
        } else {
            summary.totalExpenses = (summary.totalExpenses || 0) + paidAmount;
            if (summary.stats) {
                summary.stats.totalExpenses = (summary.stats.totalExpenses || 0) + paidAmount;
            }
        }
        summary.netBalance = (summary.totalIncome || 0) - (summary.totalExpenses || 0);
        if (summary.stats) {
            summary.stats.netBalance = summary.netBalance;
        }

        await this.saveDailySummary(date, summary);

        // 3. Update Student Debt & Cached Report (if studentId exists)
        if (params.studentId) {
            try {
                const student = await this.getOfflineStudentById(params.studentId);
                if (student) {
                    if (params.category === 'SUBSCRIPTION') {
                        student.hasActiveSubscription = true;
                    }
                    if (student.totalDebt && paidAmount > 0) {
                        student.totalDebt = Math.max(0, student.totalDebt - paidAmount);
                    }
                    await this.saveOneOfflineStudent(student);
                }

                const cachedReport = await this.getOfflineStudentReport(params.studentId);
                if (cachedReport) {
                    if (!Array.isArray(cachedReport.payments)) {
                        cachedReport.payments = [];
                    }
                    cachedReport.payments.unshift({
                        _id: tempTxId,
                        type: params.type,
                        category: params.category,
                        paidAmount,
                        date,
                        description: params.description,
                        isPendingSync: true,
                    });
                    if (cachedReport.summary) {
                        if (params.type === 'INCOME') {
                            cachedReport.summary.totalPaid = (cachedReport.summary.totalPaid || 0) + paidAmount;
                        }
                        if (cachedReport.summary.remainingDebt) {
                            cachedReport.summary.remainingDebt = Math.max(0, cachedReport.summary.remainingDebt - paidAmount);
                        }
                    }
                    await this.saveOfflineStudentReport(params.studentId, cachedReport);
                }
            } catch (err) {
                console.warn('[OfflineStorageService] Error updating offline student report:', err);
            }
        }

        // 4. Notify app via CustomEvent
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-transaction-recorded', {
                detail: { date, ledger, transaction: txItem },
            }));
        }

        return txItem;
    }

    /**
     * Delete a local offline transaction from the Daily Ledger.
     */
    static async deleteOfflineTransaction(transactionId: string, date?: string): Promise<boolean> {
        const today = new Date().toISOString().split('T')[0]!;
        const targetDate = date || today;
        const ledger = await this.getDailyLedger(targetDate);
        if (!ledger || !Array.isArray(ledger.transactions)) return false;

        const txIndex = ledger.transactions.findIndex((t: any) => t.transactionId === transactionId || t._id === transactionId);
        if (txIndex === -1) return false;

        const removedTx = ledger.transactions[txIndex];
        ledger.transactions.splice(txIndex, 1);

        if (removedTx.type === 'INCOME') {
            ledger.totalIncome = Math.max(0, (ledger.totalIncome || 0) - (removedTx.paidAmount || 0));
        } else {
            ledger.totalExpenses = Math.max(0, (ledger.totalExpenses || 0) - (removedTx.paidAmount || 0));
        }
        ledger.netBalance = (ledger.totalIncome || 0) - (ledger.totalExpenses || 0);

        await this.saveDailyLedger(targetDate, ledger);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-transaction-deleted', {
                detail: { date: targetDate, ledger, transactionId },
            }));
        }

        return true;
    }

    // ── Pending Deletion Markers (معلق للحذف حتى الاتصال بالسيرفر) ───────────
    /**
     * Mark a transaction as pending deletion on server, or delete immediately if local.
     */
    static async markTransactionPendingDelete(transactionId: string, date?: string): Promise<{ isLocal: boolean }> {
        const today = new Date().toISOString().split('T')[0]!;
        const targetDate = date || today;
        const ledger = await this.getDailyLedger(targetDate);

        if (transactionId.startsWith('loc_tx_')) {
            await this.deleteOfflineTransaction(transactionId, targetDate);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m: any) => m.data?._id === transactionId || m.description?.includes(transactionId));
            if (match) {
                await this.removeGenericMutation(match.id);
            }
            return { isLocal: true };
        }

        if (ledger && Array.isArray(ledger.transactions)) {
            const tx = ledger.transactions.find((t: any) => t.transactionId === transactionId || t._id === transactionId);
            if (tx) {
                tx.isPendingDelete = true;
                tx.offlinePending = true;

                if (tx.type === 'INCOME') {
                    ledger.totalIncome = Math.max(0, (ledger.totalIncome || 0) - (tx.paidAmount || 0));
                } else {
                    ledger.totalExpenses = Math.max(0, (ledger.totalExpenses || 0) - (tx.paidAmount || 0));
                }
                ledger.netBalance = (ledger.totalIncome || 0) - (ledger.totalExpenses || 0);

                await this.saveDailyLedger(targetDate, ledger);
            }
        }

        await this.queueGenericMutation({
            url: `/payments/${transactionId}`,
            method: 'DELETE',
            description: `مسح معاملة مالية: ${transactionId} (سيتم الحذف نهائياً فور الاتصال)`,
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-transaction-deleted', {
                detail: { date: targetDate, ledger, transactionId, isPendingDelete: true },
            }));
        }

        return { isLocal: false };
    }

    /**
     * Undo pending transaction deletion and restore balance.
     */
    static async undoTransactionPendingDelete(transactionId: string, date?: string): Promise<boolean> {
        const today = new Date().toISOString().split('T')[0]!;
        const targetDate = date || today;
        const ledger = await this.getDailyLedger(targetDate);
        if (!ledger || !Array.isArray(ledger.transactions)) return false;

        const tx = ledger.transactions.find((t: any) => t.transactionId === transactionId || t._id === transactionId);
        if (!tx || !tx.isPendingDelete) return false;

        tx.isPendingDelete = false;

        if (tx.type === 'INCOME') {
            ledger.totalIncome = (ledger.totalIncome || 0) + (tx.paidAmount || 0);
        } else {
            ledger.totalExpenses = (ledger.totalExpenses || 0) + (tx.paidAmount || 0);
        }
        ledger.netBalance = (ledger.totalIncome || 0) - (ledger.totalExpenses || 0);

        await this.saveDailyLedger(targetDate, ledger);

        const allMut = await this.getPendingGenericMutations();
        const deleteMut = allMut.find((m: any) => m.url === `/payments/${transactionId}` && m.method === 'DELETE');
        if (deleteMut) {
            await this.removeGenericMutation(deleteMut.id);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-transaction-recorded', {
                detail: { date: targetDate, ledger, transactionId },
            }));
        }

        return true;
    }

    // ── Exam Results Pending Deletions (معلق للحذف حتى الاتصال بالسيرفر) ──────
    static async markExamResultPendingDelete(examId: string, resultId: string): Promise<{ isLocal: boolean; studentName?: string }> {
        const cached = await this.getOfflineExamResults(examId);
        let studentName = '';
        let isLocal = resultId.startsWith('loc_res_');

        if (cached && Array.isArray(cached.results)) {
            const index = cached.results.findIndex((r: any) => r._id === resultId || r.resultId === resultId);
            if (index !== -1) {
                const target = cached.results[index];
                studentName = target.studentName || '';
                isLocal = isLocal || Boolean(target.isOfflineCreated);

                if (isLocal) {
                    cached.results.splice(index, 1);
                    const allMut = await this.getPendingGenericMutations();
                    const match = allMut.find((m: any) => m.data?._id === resultId || m.description?.includes(resultId));
                    if (match) await this.removeGenericMutation(match.id);
                } else {
                    target.isPendingDelete = true;
                }
                await this.saveOfflineExamResults(examId, cached);
            }
        }

        if (!isLocal) {
            await this.queueGenericMutation({
                url: `/exams/${examId}/results/${resultId}`,
                method: 'DELETE',
                description: `حذف درجة الامتحان للطالب: ${studentName || resultId}`,
            });
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-exam-result-deleted', {
                detail: { examId, resultId, isLocal, studentName },
            }));
        }

        return { isLocal, studentName };
    }

    static async undoExamResultPendingDelete(examId: string, resultId: string): Promise<boolean> {
        const cached = await this.getOfflineExamResults(examId);
        if (!cached || !Array.isArray(cached.results)) return false;

        const target = cached.results.find((r: any) => r._id === resultId || r.resultId === resultId);
        if (!target || !target.isPendingDelete) return false;

        target.isPendingDelete = false;
        await this.saveOfflineExamResults(examId, cached);

        const allMut = await this.getPendingGenericMutations();
        const deleteMut = allMut.find((m: any) => m.url === `/exams/${examId}/results/${resultId}` && m.method === 'DELETE');
        if (deleteMut) {
            await this.removeGenericMutation(deleteMut.id);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-exam-result-restored', {
                detail: { examId, resultId },
            }));
        }

        return true;
    }

    // ── Notebooks & Store (المتجر والمذكرات) ──────────────────────────────────
    static async saveOfflineNotebooks(notebooks: any[]): Promise<void> {
        if (!notebooks || notebooks.length === 0) return;
        await putManyInStore(STORES.NOTEBOOKS, notebooks);
    }

    static async getOfflineNotebooks(params?: { search?: string; gradeLevel?: string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.NOTEBOOKS);
        let filtered = all;
        if (params?.gradeLevel) {
            filtered = filtered.filter(nb => nb.gradeLevel === params.gradeLevel);
        }
        if (params?.search) {
            const term = params.search.trim().toLowerCase();
            filtered = filtered.filter(nb => (nb.name || '').toLowerCase().includes(term));
        }
        return filtered;
    }

    static async getOfflineNotebookById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.NOTEBOOKS, id);
    }

    static async saveOneOfflineNotebook(notebook: any): Promise<void> {
        if (!notebook || !notebook._id) return;
        await putOneInStore(STORES.NOTEBOOKS, notebook);
    }

    static async deleteOfflineNotebook(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.NOTEBOOKS, id);
    }

    static async markNotebookPendingDelete(notebookId: string): Promise<{ isLocal: boolean; name?: string }> {
        const isLocal = notebookId.startsWith('loc_nb_');
        const existing = await this.getOfflineNotebookById(notebookId);
        const name = existing?.name || '';

        if (isLocal) {
            await this.deleteOfflineNotebook(notebookId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m: any) => m.data?._id === notebookId || m.description?.includes(notebookId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true, name };
        }

        if (existing) {
            existing.isPendingDelete = true;
            await this.saveOneOfflineNotebook(existing);
        }

        await this.queueGenericMutation({
            url: `/notebooks/${notebookId}`,
            method: 'DELETE',
            description: `حذف المذكرة من السيرفر: ${name || notebookId}`,
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-notebook-deleted', {
                detail: { notebookId, name },
            }));
        }

        return { isLocal: false, name };
    }

    static async undoNotebookPendingDelete(notebookId: string): Promise<boolean> {
        const existing = await this.getOfflineNotebookById(notebookId);
        if (!existing || !existing.isPendingDelete) return false;

        existing.isPendingDelete = false;
        await this.saveOneOfflineNotebook(existing);

        const allMut = await this.getPendingGenericMutations();
        const deleteMut = allMut.find((m: any) => m.url === `/notebooks/${notebookId}` && m.method === 'DELETE');
        if (deleteMut) {
            await this.removeGenericMutation(deleteMut.id);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-notebook-restored', {
                detail: { notebookId },
            }));
        }

        return true;
    }

    // ── Notebook Reservations (حجوزات المذكرات) ──────────────────────────────
    static async saveOfflineReservations(reservations: any[]): Promise<void> {
        if (!reservations || reservations.length === 0) return;
        await putManyInStore(STORES.NOTEBOOK_RESERVATIONS, reservations);
    }

    static async getOfflineReservations(params?: { status?: string; studentId?: string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.NOTEBOOK_RESERVATIONS);
        let filtered = all;
        if (params?.status) {
            filtered = filtered.filter(r => r.status === params.status);
        }
        if (params?.studentId) {
            filtered = filtered.filter(r => r.studentId === params.studentId);
        }
        return filtered;
    }

    static async saveOneOfflineReservation(reservation: any): Promise<void> {
        if (!reservation || !reservation._id) return;
        await putOneInStore(STORES.NOTEBOOK_RESERVATIONS, reservation);
    }

    // ── Users & Assistants (المساعدين والمستخدمين) ───────────────────────────
    static async saveOfflineUsers(users: any[]): Promise<void> {
        if (!users || users.length === 0) return;
        await putManyInStore(STORES.USERS, users);
    }

    static async getOfflineUsers(params?: { search?: string; role?: string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.USERS);
        let filtered = all;
        if (params?.role) {
            filtered = filtered.filter(u => u.role === params.role);
        }
        if (params?.search) {
            const term = params.search.trim().toLowerCase();
            filtered = filtered.filter(u =>
                (u.name || '').toLowerCase().includes(term) ||
                (u.phone || '').toLowerCase().includes(term) ||
                (u.email || '').toLowerCase().includes(term)
            );
        }
        return filtered;
    }

    static async getOfflineUserById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.USERS, id);
    }

    static async saveOneOfflineUser(user: any): Promise<void> {
        if (!user || !user._id) return;
        await putOneInStore(STORES.USERS, user);
    }

    static async deleteOfflineUser(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.USERS, id);
    }

    static async markUserPendingDelete(userId: string): Promise<{ isLocal: boolean; name?: string }> {
        const isLocal = userId.startsWith('loc_usr_');
        const existing = await this.getOfflineUserById(userId);
        const name = existing?.name || '';

        if (isLocal) {
            await this.deleteOfflineUser(userId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m: any) => m.data?._id === userId || m.description?.includes(userId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true, name };
        }

        if (existing) {
            existing.isPendingDelete = true;
            await this.saveOneOfflineUser(existing);
        }

        await this.queueGenericMutation({
            url: `/users/${userId}`,
            method: 'DELETE',
            description: `حذف المساعد من السيرفر: ${name || userId}`,
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-user-deleted', {
                detail: { userId, name },
            }));
        }

        return { isLocal: false, name };
    }

    static async undoUserPendingDelete(userId: string): Promise<boolean> {
        const existing = await this.getOfflineUserById(userId);
        if (!existing || !existing.isPendingDelete) return false;

        existing.isPendingDelete = false;
        await this.saveOneOfflineUser(existing);

        const allMut = await this.getPendingGenericMutations();
        const deleteMut = allMut.find((m: any) => m.url === `/users/${userId}` && m.method === 'DELETE');
        if (deleteMut) {
            await this.removeGenericMutation(deleteMut.id);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('munazem:offline-user-restored', {
                detail: { userId },
            }));
        }

        return true;
    }

    // ── Dashboard & Unpaid Students Caching ──────────────────────────────────
    static async saveOfflineDashboardStats(stats: any): Promise<void> {
        await setKeyVal('cached_dashboard_stats', stats);
    }

    static async getOfflineDashboardStats(): Promise<any | null> {
        return await getKeyVal<any>('cached_dashboard_stats');
    }

    static async saveOfflineUnpaidStudents(data: any): Promise<void> {
        await setKeyVal('cached_unpaid_students', data);
    }

    static async getOfflineUnpaidStudents(): Promise<any | null> {
        return await getKeyVal<any>('cached_unpaid_students');
    }

    // ── Centers & Branches (السناتر والفروع) ─────────────────────────────────
    static async saveOfflineCenters(centers: any[]): Promise<void> {
        if (!centers || centers.length === 0) return;
        await putManyInStore(STORES.CENTERS, centers);
    }

    static async getOfflineCenters(): Promise<any[]> {
        return await getAllFromStore<any>(STORES.CENTERS);
    }

    static async getOfflineCenterById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.CENTERS, id);
    }

    // ── Center Teachers (مدرسي السنتر) ───────────────────────────────────────
    static async saveOfflineCenterTeachers(teachers: any[]): Promise<void> {
        if (!teachers || teachers.length === 0) return;
        await putManyInStore(STORES.CENTER_TEACHERS, teachers);
    }

    static async saveOneOfflineCenterTeacher(teacher: any): Promise<void> {
        if (!teacher || !teacher._id) return;
        await putOneInStore(STORES.CENTER_TEACHERS, teacher);
    }

    static async getOfflineCenterTeachers(params?: { search?: string; subject?: string; isActive?: boolean | string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.CENTER_TEACHERS);
        if (!params) return all;

        return all.filter((t) => {
            if (params.isActive !== undefined && params.isActive !== '') {
                const activeBool = String(params.isActive) === 'true';
                if (t.isActive !== activeBool) return false;
            }
            if (params.subject && t.subject && !t.subject.toLowerCase().includes(params.subject.toLowerCase())) {
                return false;
            }
            if (params.search) {
                const s = params.search.trim().toLowerCase();
                const nameMatches = t.name && t.name.toLowerCase().includes(s);
                const phoneMatches = t.phone && t.phone.includes(s);
                const subMatches = t.subject && t.subject.toLowerCase().includes(s);
                if (!nameMatches && !phoneMatches && !subMatches) return false;
            }
            return true;
        });
    }

    static async getOfflineCenterTeacherById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.CENTER_TEACHERS, id);
    }

    static async deleteOfflineCenterTeacher(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.CENTER_TEACHERS, id);
    }

    static async markCenterTeacherPendingDelete(teacherId: string): Promise<{ isLocal: boolean }> {
        if (teacherId.startsWith('loc_ct_')) {
            await this.deleteOfflineCenterTeacher(teacherId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m) => m.data?._id === teacherId || m.url.includes(teacherId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true };
        }

        const teacher = await this.getOfflineCenterTeacherById(teacherId);
        if (teacher) {
            teacher.isPendingDelete = true;
            teacher.offlinePending = true;
            await this.saveOneOfflineCenterTeacher(teacher);
        }

        await this.queueGenericMutation({
            url: `/centers/teachers/${teacherId}`,
            method: 'DELETE',
            description: `حذف مدرس السنتر: ${teacher?.name || teacherId} (سيتم الحذف فور الاتصال)`,
        });

        return { isLocal: false };
    }

    static async undoCenterTeacherPendingDelete(teacherId: string): Promise<boolean> {
        const teacher = await this.getOfflineCenterTeacherById(teacherId);
        if (!teacher || !teacher.isPendingDelete) return false;

        teacher.isPendingDelete = false;
        await this.saveOneOfflineCenterTeacher(teacher);

        const allMut = await this.getPendingGenericMutations();
        const match = allMut.find((m) => m.url === `/centers/teachers/${teacherId}` && m.method === 'DELETE');
        if (match) await this.removeGenericMutation(match.id);

        return true;
    }

    // ── Center Packages (باقات السنتر) ───────────────────────────────────────
    static async saveOfflineCenterPackages(packages: any[]): Promise<void> {
        if (!packages || packages.length === 0) return;
        await putManyInStore(STORES.CENTER_PACKAGES, packages);
    }

    static async saveOneOfflineCenterPackage(pkg: any): Promise<void> {
        if (!pkg || !pkg._id) return;
        await putOneInStore(STORES.CENTER_PACKAGES, pkg);
    }

    static async getOfflineCenterPackages(params?: { gradeLevel?: string; isActive?: boolean | string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.CENTER_PACKAGES);
        if (!params) return all;

        return all.filter((p) => {
            if (params.isActive !== undefined && params.isActive !== '') {
                const activeBool = String(params.isActive) === 'true';
                if (p.isActive !== activeBool) return false;
            }
            if (params.gradeLevel && p.gradeLevel !== params.gradeLevel) return false;
            return true;
        });
    }

    static async getOfflineCenterPackageById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.CENTER_PACKAGES, id);
    }

    static async deleteOfflineCenterPackage(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.CENTER_PACKAGES, id);
    }

    static async markCenterPackagePendingDelete(packageId: string): Promise<{ isLocal: boolean }> {
        if (packageId.startsWith('loc_cp_')) {
            await this.deleteOfflineCenterPackage(packageId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m) => m.data?._id === packageId || m.url.includes(packageId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true };
        }

        const pkg = await this.getOfflineCenterPackageById(packageId);
        if (pkg) {
            pkg.isPendingDelete = true;
            pkg.offlinePending = true;
            await this.saveOneOfflineCenterPackage(pkg);
        }

        await this.queueGenericMutation({
            url: `/centers/packages/${packageId}`,
            method: 'DELETE',
            description: `حذف باقة السنتر: ${pkg?.name || packageId} (سيتم الحذف فور الاتصال)`,
        });

        return { isLocal: false };
    }

    static async undoCenterPackagePendingDelete(packageId: string): Promise<boolean> {
        const pkg = await this.getOfflineCenterPackageById(packageId);
        if (!pkg || !pkg.isPendingDelete) return false;

        pkg.isPendingDelete = false;
        await this.saveOneOfflineCenterPackage(pkg);

        const allMut = await this.getPendingGenericMutations();
        const match = allMut.find((m) => m.url === `/centers/packages/${packageId}` && m.method === 'DELETE');
        if (match) await this.removeGenericMutation(match.id);

        return true;
    }

    // ── Center Groups (مجموعات السنتر) ───────────────────────────────────────
    static async saveOfflineCenterGroups(groups: any[]): Promise<void> {
        if (!groups || groups.length === 0) return;
        await putManyInStore(STORES.CENTER_GROUPS, groups);
    }

    static async saveOneOfflineCenterGroup(group: any): Promise<void> {
        if (!group || !group._id) return;
        await putOneInStore(STORES.CENTER_GROUPS, group);
    }

    static async getOfflineCenterGroups(params?: {
        centerTeacherId?: string;
        gradeLevel?: string;
        groupType?: string;
        isActive?: boolean | string;
    }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.CENTER_GROUPS);
        if (!params) return all;

        return all.filter((g) => {
            if (params.isActive !== undefined && params.isActive !== '') {
                const activeBool = String(params.isActive) === 'true';
                if (g.isActive !== activeBool) return false;
            }
            if (params.gradeLevel && g.gradeLevel !== params.gradeLevel) return false;
            if (params.groupType && params.groupType !== 'ALL' && g.groupType !== params.groupType) return false;
            if (params.centerTeacherId && params.centerTeacherId !== 'ALL') {
                const tid = typeof g.centerTeacherId === 'object' ? g.centerTeacherId?._id : g.centerTeacherId;
                if (tid !== params.centerTeacherId) return false;
            }
            return true;
        });
    }

    static async getOfflineCenterGroupById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.CENTER_GROUPS, id);
    }

    static async deleteOfflineCenterGroup(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.CENTER_GROUPS, id);
    }

    static async markCenterGroupPendingDelete(groupId: string): Promise<{ isLocal: boolean }> {
        if (groupId.startsWith('loc_cg_')) {
            await this.deleteOfflineCenterGroup(groupId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m) => m.data?._id === groupId || m.url.includes(groupId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true };
        }

        const grp = await this.getOfflineCenterGroupById(groupId);
        if (grp) {
            grp.isPendingDelete = true;
            grp.offlinePending = true;
            await this.saveOneOfflineCenterGroup(grp);
        }

        await this.queueGenericMutation({
            url: `/centers/groups/${groupId}`,
            method: 'DELETE',
            description: `حذف مجموعة السنتر: ${grp?.name || groupId} (سيتم الحذف فور الاتصال)`,
        });

        return { isLocal: false };
    }

    static async undoCenterGroupPendingDelete(groupId: string): Promise<boolean> {
        const grp = await this.getOfflineCenterGroupById(groupId);
        if (!grp || !grp.isPendingDelete) return false;

        grp.isPendingDelete = false;
        await this.saveOneOfflineCenterGroup(grp);

        const allMut = await this.getPendingGenericMutations();
        const match = allMut.find((m) => m.url === `/centers/groups/${groupId}` && m.method === 'DELETE');
        if (match) await this.removeGenericMutation(match.id);

        return true;
    }

    // ── Center Students (طلاب السنتر) ────────────────────────────────────────
    static async saveOfflineCenterStudents(students: any[]): Promise<void> {
        if (!students || students.length === 0) return;
        await putManyInStore(STORES.CENTER_STUDENTS, students);
    }

    static async saveOneOfflineCenterStudent(student: any): Promise<void> {
        if (!student || !student._id) return;
        await putOneInStore(STORES.CENTER_STUDENTS, student);
    }

    static async getOfflineCenterStudents(params?: {
        search?: string;
        gradeLevel?: string;
        stage?: string;
        isActive?: boolean | string;
        page?: number;
        limit?: number;
    }): Promise<any> {
        const all = await getAllFromStore<any>(STORES.CENTER_STUDENTS);

        const stageCounts = {
            total: all.length,
            secondary: all.filter((s) => s.gradeLevel && (s.gradeLevel.includes('الثانوي') || s.gradeLevel.startsWith('SEC'))).length,
            preparatory: all.filter((s) => s.gradeLevel && (s.gradeLevel.includes('الإعدادي') || s.gradeLevel.startsWith('PREP'))).length,
            primary: all.filter((s) => s.gradeLevel && (s.gradeLevel.includes('الابتدائي') || s.gradeLevel.startsWith('PRIM'))).length,
        };

        let filtered = all;
        if (params) {
            if (params.isActive !== undefined && params.isActive !== '') {
                const activeBool = String(params.isActive) === 'true';
                filtered = filtered.filter((s) => s.isActive === activeBool);
            }
            if (params.gradeLevel && params.gradeLevel !== 'ALL') {
                filtered = filtered.filter((s) => s.gradeLevel === params.gradeLevel);
            }
            if (params.stage && params.stage !== 'ALL') {
                filtered = filtered.filter((s) => {
                    const g = s.gradeLevel || '';
                    if (params.stage === 'SECONDARY') return g.includes('الثانوي') || g.startsWith('SEC');
                    if (params.stage === 'PREPARATORY') return g.includes('الإعدادي') || g.startsWith('PREP');
                    if (params.stage === 'PRIMARY') return g.includes('الابتدائي') || g.startsWith('PRIM');
                    return true;
                });
            }
            if (params.search) {
                const q = params.search.trim().toLowerCase();
                filtered = filtered.filter((s) => {
                    return (
                        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
                        (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
                        (s.barcode && s.barcode.toLowerCase().includes(q)) ||
                        (s.studentPhone && s.studentPhone.includes(q)) ||
                        (s.parentPhone && s.parentPhone.includes(q))
                    );
                });
            }
        }

        const total = filtered.length;
        const page = params?.page ? Number(params.page) : 1;
        const limit = params?.limit ? Number(params.limit) : total;
        const start = (page - 1) * limit;
        const pagedData = filtered.slice(start, start + limit);

        return {
            data: pagedData,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / (limit || 1)) || 1,
            stageCounts,
        };
    }

    static async getOfflineCenterStudentById(id: string): Promise<any | undefined> {
        return await getByIdFromStore<any>(STORES.CENTER_STUDENTS, id);
    }

    static async getOfflineCenterStudentByCodeOrBarcode(query: string): Promise<any | undefined> {
        if (!query) return undefined;
        const q = query.trim().toLowerCase();
        const all = await getAllFromStore<any>(STORES.CENTER_STUDENTS);
        return all.find((s) => {
            const matchesId = s._id === query;
            const matchesCode = s.studentCode && s.studentCode.trim().toLowerCase() === q;
            const matchesBarcode = s.barcode && s.barcode.trim().toLowerCase() === q;
            const matchesPhone = s.studentPhone && s.studentPhone.trim() === query.trim();
            return matchesId || matchesCode || matchesBarcode || matchesPhone;
        });
    }

    static async deleteOfflineCenterStudent(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.CENTER_STUDENTS, id);
    }

    static async markCenterStudentPendingDelete(studentId: string): Promise<{ isLocal: boolean }> {
        if (studentId.startsWith('loc_cs_')) {
            await this.deleteOfflineCenterStudent(studentId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m) => m.data?._id === studentId || m.url.includes(studentId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true };
        }

        const stu = await this.getOfflineCenterStudentById(studentId);
        if (stu) {
            stu.isPendingDelete = true;
            stu.offlinePending = true;
            await this.saveOneOfflineCenterStudent(stu);
        }

        await this.queueGenericMutation({
            url: `/centers/students/${studentId}`,
            method: 'DELETE',
            description: `حذف طالب السنتر: ${stu?.studentName || studentId} (سيتم الحذف فور الاتصال)`,
        });

        return { isLocal: false };
    }

    static async undoCenterStudentPendingDelete(studentId: string): Promise<boolean> {
        const stu = await this.getOfflineCenterStudentById(studentId);
        if (!stu || !stu.isPendingDelete) return false;

        stu.isPendingDelete = false;
        await this.saveOneOfflineCenterStudent(stu);

        const allMut = await this.getPendingGenericMutations();
        const match = allMut.find((m) => m.url === `/centers/students/${studentId}` && m.method === 'DELETE');
        if (match) await this.removeGenericMutation(match.id);

        return true;
    }

    // ── Center Enrollments (اشتراكات طلاب السنتر) ────────────────────────────
    static async saveOfflineCenterEnrollments(enrollments: any[]): Promise<void> {
        if (!enrollments || enrollments.length === 0) return;
        await putManyInStore(STORES.CENTER_ENROLLMENTS, enrollments);
    }

    static async saveOneOfflineCenterEnrollment(enrollment: any): Promise<void> {
        if (!enrollment || !enrollment._id) return;
        await putOneInStore(STORES.CENTER_ENROLLMENTS, enrollment);
    }

    static async getOfflineCenterEnrollments(params?: { type?: string; packageId?: string; isActive?: boolean | string }): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.CENTER_ENROLLMENTS);
        if (!params) return all;

        return all.filter((e) => {
            if (params.isActive !== undefined && params.isActive !== '') {
                const activeBool = String(params.isActive) === 'true';
                if (e.isActive !== activeBool) return false;
            }
            if (params.type && e.type !== params.type) return false;
            if (params.packageId && e.packageId !== params.packageId) return false;
            return true;
        });
    }

    static async getOfflineStudentEnrollment(studentId: string): Promise<any | undefined> {
        const all = await getAllFromStore<any>(STORES.CENTER_ENROLLMENTS);
        return all.find((e) => {
            const sid = typeof e.studentId === 'object' ? e.studentId?._id : e.studentId;
            return sid === studentId;
        });
    }

    // ── Center Attendance & Gate Check-Ins ───────────────────────────────────
    static async saveOfflineCenterAttendance(records: any[]): Promise<void> {
        if (!records || records.length === 0) return;
        await putManyInStore(STORES.CENTER_ATTENDANCE, records);
    }

    static async saveOneOfflineCenterAttendance(record: any): Promise<void> {
        if (!record || !record._id) return;
        await putOneInStore(STORES.CENTER_ATTENDANCE, record);
    }

    static async getOfflineGroupAttendance(groupId: string, date: string): Promise<any[]> {
        const all = await getAllFromStore<any>(STORES.CENTER_ATTENDANCE);
        return all.filter((r) => {
            const gid = typeof r.groupId === 'object' ? r.groupId?._id : r.groupId;
            const rDate = r.date ? r.date.split('T')[0] : '';
            return gid === groupId && rDate === date;
        });
    }

    static async saveOfflineCenterCheckIns(checkIns: any[]): Promise<void> {
        if (!checkIns || checkIns.length === 0) return;
        await putManyInStore(STORES.CENTER_CHECKINS, checkIns);
    }

    static async saveOneOfflineCenterCheckIn(checkIn: any): Promise<void> {
        if (!checkIn || !checkIn._id) return;
        await putOneInStore(STORES.CENTER_CHECKINS, checkIn);
    }

    static async getOfflineCenterCheckIns(params?: { date?: string; search?: string }): Promise<{ checkIns: any[]; totalCheckIns: number }> {
        const all = await getAllFromStore<any>(STORES.CENTER_CHECKINS);
        const targetDate = params?.date || new Date().toISOString().split('T')[0];

        let filtered = all.filter((ci) => {
            const ciDate = ci.date ? ci.date.split('T')[0] : '';
            return ciDate === targetDate;
        });

        if (params?.search) {
            const q = params.search.trim().toLowerCase();
            filtered = filtered.filter((ci) => {
                const s = ci.studentId || {};
                return (
                    (s.studentName && s.studentName.toLowerCase().includes(q)) ||
                    (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
                    (s.barcode && s.barcode.toLowerCase().includes(q)) ||
                    (s.phone && s.phone.includes(q))
                );
            });
        }

        return {
            checkIns: filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
            totalCheckIns: filtered.length,
        };
    }

    /**
     * Record an offline gate entrance check-in seamlessly without network.
     */
    static async recordOfflineGateCheckIn(data: {
        studentIdOrCode: string;
        date?: string;
        groupIds?: string[];
        source?: string;
        notes?: string;
    }): Promise<any> {
        const targetDate = data.date || new Date().toISOString().split('T')[0];
        const student = await this.getOfflineCenterStudentByCodeOrBarcode(data.studentIdOrCode);

        if (!student) {
            throw new Error('لم يتم العثور على طالب بهذا الكود أو الباركود في الذاكرة المحلية');
        }

        const enrollment = await this.getOfflineStudentEnrollment(student._id);
        const allGroups = await this.getOfflineCenterGroups();

        // Determine scheduled groups and other enrolled groups
        const enrolledGroupIds: string[] = [];
        if (enrollment) {
            if (Array.isArray(enrollment.packageGroupIds)) {
                enrolledGroupIds.push(...enrollment.packageGroupIds);
            }
            if (Array.isArray(enrollment.privateTeachers)) {
                for (const pt of enrollment.privateTeachers) {
                    if (pt.groupId) enrolledGroupIds.push(pt.groupId);
                }
            }
        }

        const studentGroups = allGroups.filter((g) => enrolledGroupIds.includes(g._id));

        // Check if existing check-in exists for today
        const existingCheckIns = await this.getOfflineCenterCheckIns({ date: targetDate });
        const existing = existingCheckIns.checkIns.find((ci) => {
            const sid = typeof ci.studentId === 'object' ? ci.studentId?._id : ci.studentId;
            return sid === student._id;
        });

        const isNewCheckIn = !existing;
        const checkInId = existing?._id || `loc_ci_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const checkInRecord = {
            _id: checkInId,
            date: targetDate,
            studentId: {
                _id: student._id,
                studentName: student.studentName,
                studentCode: student.studentCode,
                barcode: student.barcode,
                gradeLevel: student.gradeLevel,
                phone: student.studentPhone || student.phone,
                parentPhone: student.parentPhone,
            },
            centerId: student.centerId,
            source: data.source || 'BARCODE',
            checkInTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            attendedGroupIds: data.groupIds || existing?.attendedGroupIds || [],
            scheduledTodayGroups: studentGroups.map((g) => ({
                _id: g._id,
                name: g.name,
                teacherName: typeof g.centerTeacherId === 'object' ? g.centerTeacherId?.name : 'المدرس',
                subject: typeof g.centerTeacherId === 'object' ? g.centerTeacherId?.subject : '',
                time: g.schedule?.[0]?.time || '14:00',
                isAttended: (data.groupIds || []).includes(g._id),
            })),
            otherEnrolledGroups: [],
            financialStatus: {
                hasDebt: (student.totalDebt || 0) > 0,
                debtAmount: student.totalDebt || 0,
                hasPaidCurrentMonth: student.hasActiveSubscription || false,
            },
            isOfflineCreated: true,
            createdAt: Date.now(),
        };

        await this.saveOneOfflineCenterCheckIn(checkInRecord);

        // Queue mutation for server sync
        await this.queueGenericMutation({
            url: '/centers/attendance/check-in',
            method: 'POST',
            data,
            description: `تسجيل حضور طالب السنتر: ${student.studentName}`,
        });

        return {
            isNewCheckIn,
            student: checkInRecord.studentId,
            financialStatus: checkInRecord.financialStatus,
            scheduledTodayGroups: checkInRecord.scheduledTodayGroups,
            otherEnrolledGroups: checkInRecord.otherEnrolledGroups,
            attendedGroupIds: checkInRecord.attendedGroupIds,
            checkInRecord,
        };
    }

    // ── Center Financials (الجارد والماليات بالسنتر) ──────────────────────────
    static async saveOfflineCenterFinancialSummary(summary: any): Promise<void> {
        if (!summary) return;
        await putOneInStore(STORES.CENTER_FINANCIALS, { key: 'financial_summary', value: summary });
    }

    static async getOfflineCenterFinancialSummary(): Promise<any | null> {
        const rec = await getByIdFromStore<any>(STORES.CENTER_FINANCIALS, 'financial_summary');
        return rec ? rec.value : null;
    }

    static async saveOfflineCenterDailyTally(date: string, tally: any): Promise<void> {
        if (!tally) return;
        await putOneInStore(STORES.CENTER_FINANCIALS, { key: `daily_tally_${date}`, value: tally });
    }

    static async getOfflineCenterDailyTally(date: string): Promise<any | null> {
        const rec = await getByIdFromStore<any>(STORES.CENTER_FINANCIALS, `daily_tally_${date}`);
        return rec ? rec.value : null;
    }

    static async saveOfflineCenterMonthlyTally(year: number, month: number, tally: any): Promise<void> {
        if (!tally) return;
        await putOneInStore(STORES.CENTER_FINANCIALS, { key: `monthly_tally_${year}_${month}`, value: tally });
    }

    static async getOfflineCenterMonthlyTally(year: number, month: number): Promise<any | null> {
        const rec = await getByIdFromStore<any>(STORES.CENTER_FINANCIALS, `monthly_tally_${year}_${month}`);
        return rec ? rec.value : null;
    }

    static async recordOfflineCenterPayment(payment: any): Promise<any> {
        const today = new Date().toISOString().split('T')[0];
        const currentTally = (await this.getOfflineCenterDailyTally(today)) || {
            date: today,
            totalIncome: 0,
            packageRevenue: 0,
            privateRevenue: 0,
            totalDebtCollected: 0,
            totalExpenses: 0,
            netBalance: 0,
            transactions: [],
        };

        const tx = {
            _id: `loc_ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            amount: Number(payment.amount) || 0,
            category: payment.category || 'PACKAGE',
            description: payment.notes || payment.description || 'معاملة مالية محلياً',
            date: today,
            studentId: payment.studentId,
            isOfflineCreated: true,
            createdAt: new Date().toISOString(),
        };

        currentTally.transactions = [tx, ...(currentTally.transactions || [])];
        currentTally.totalIncome = (currentTally.totalIncome || 0) + tx.amount;
        currentTally.netBalance = (currentTally.netBalance || 0) + tx.amount;
        await this.saveOfflineCenterDailyTally(today, currentTally);

        await this.queueGenericMutation({
            url: '/centers/financials/payment',
            method: 'POST',
            data: payment,
            description: `تسجيل دفعة سنتر بمبلغ ${payment.amount || 0} ج`,
        });

        return tx;
    }

    // ── Center Supervisors (مشرفي السنتر) ────────────────────────────────────
    static async saveOfflineCenterSupervisors(supervisors: any[]): Promise<void> {
        if (!supervisors || supervisors.length === 0) return;
        await putManyInStore(STORES.CENTER_SUPERVISORS, supervisors);
    }

    static async saveOneOfflineCenterSupervisor(supervisor: any): Promise<void> {
        if (!supervisor || !supervisor._id) return;
        await putOneInStore(STORES.CENTER_SUPERVISORS, supervisor);
    }

    static async getOfflineCenterSupervisors(): Promise<any[]> {
        return await getAllFromStore<any>(STORES.CENTER_SUPERVISORS);
    }

    static async deleteOfflineCenterSupervisor(id: string): Promise<void> {
        if (!id) return;
        await deleteFromStore(STORES.CENTER_SUPERVISORS, id);
    }

    static async markCenterSupervisorPendingDelete(supervisorId: string): Promise<{ isLocal: boolean }> {
        if (supervisorId.startsWith('loc_csu_')) {
            await this.deleteOfflineCenterSupervisor(supervisorId);
            const allMut = await this.getPendingGenericMutations();
            const match = allMut.find((m) => m.data?._id === supervisorId || m.url.includes(supervisorId));
            if (match) await this.removeGenericMutation(match.id);
            return { isLocal: true };
        }

        const sup = await getByIdFromStore<any>(STORES.CENTER_SUPERVISORS, supervisorId);
        if (sup) {
            sup.isPendingDelete = true;
            sup.offlinePending = true;
            await this.saveOneOfflineCenterSupervisor(sup);
        }

        await this.queueGenericMutation({
            url: `/centers/supervisors/${supervisorId}`,
            method: 'DELETE',
            description: `حذف مشرف السنتر: ${sup?.name || supervisorId} (سيتم الحذف فور الاتصال)`,
        });

        return { isLocal: false };
    }

    static async undoCenterSupervisorPendingDelete(supervisorId: string): Promise<boolean> {
        const sup = await getByIdFromStore<any>(STORES.CENTER_SUPERVISORS, supervisorId);
        if (!sup || !sup.isPendingDelete) return false;

        sup.isPendingDelete = false;
        await this.saveOneOfflineCenterSupervisor(sup);

        const allMut = await this.getPendingGenericMutations();
        const match = allMut.find((m) => m.url === `/centers/supervisors/${supervisorId}` && m.method === 'DELETE');
        if (match) await this.removeGenericMutation(match.id);

        return true;
    }

    // ── Generic Offline Mutations Outbox (CRUD Operations) ────────────────────

    static async queueGenericMutation(mutation: Omit<GenericOfflineMutation, 'id' | 'createdAt' | 'status'>): Promise<string> {
        // NEVER queue authentication or authorization requests
        if (mutation.url && (mutation.url.startsWith('/auth') || mutation.url.includes('/auth/'))) {
            return '';
        }
        const id = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const record: GenericOfflineMutation = {
            ...mutation,
            id,
            createdAt: Date.now(),
            status: 'QUEUED',
            retryCount: 0,
        };
        await putOneInStore(STORES.MUTATIONS, record);
        return id;
    }

    static async getPendingGenericMutations(): Promise<GenericOfflineMutation[]> {
        const all = await getAllFromStore<GenericOfflineMutation>(STORES.MUTATIONS);
        const valid = all.filter(m => {
            // Clean up any stray auth mutations that should never have been queued
            if (m.url && (m.url.startsWith('/auth') || m.url.includes('/auth/'))) {
                this.removeGenericMutation(m.id).catch(() => {});
                return false;
            }
            return m.status === 'QUEUED' || (m.status === 'FAILED' && (m.retryCount || 0) < 5);
        });
        return valid.sort((a, b) => a.createdAt - b.createdAt);
    }

    static async removeGenericMutation(id: string): Promise<void> {
        await deleteFromStore(STORES.MUTATIONS, id);
    }

    static async markGenericMutationFailed(id: string, errorMsg?: string): Promise<void> {
        const item = await getByIdFromStore<GenericOfflineMutation>(STORES.MUTATIONS, id);
        if (item) {
            item.status = 'FAILED';
            item.retryCount = (item.retryCount || 0) + 1;
            item.description = errorMsg || item.description;
            await putOneInStore(STORES.MUTATIONS, item);
        }
    }

    static async getGenericMutationsCount(): Promise<number> {
        return await countStore(STORES.MUTATIONS);
    }

    // ── Preload Metadata & Health Stats ──────────────────────────────────────

    static async setLastPreloadTime(timestamp = Date.now()): Promise<void> {
        await setKeyVal('last_preload_timestamp', timestamp);
    }

    static async getLastPreloadTime(): Promise<number | null> {
        const ts = await getKeyVal<number>('last_preload_timestamp');
        return ts || null;
    }

    // ── Cross-Tenant Cache Protection ─────────────────────────────────────────

    /**
     * Store which user currently "owns" this device's offline cache.
     * Used to detect account switches and purge stale cross-tenant data.
     */
    static async setCurrentUserId(userId: string): Promise<void> {
        await setKeyVal('_current_cache_owner_id', userId);
    }

    static async getCurrentUserId(): Promise<string | null> {
        return await getKeyVal<string>('_current_cache_owner_id') ?? null;
    }

    /**
     * Full wipe of all offline data (except pending outbox mutations by default).
     * Called on logout and when a different userId is detected on login.
     * Preserves attendance outbox and generic mutations to avoid losing pending writes.
     */
    static async clearAllOfflineData(preserveOutbox = true): Promise<void> {
        await dbClearAll(preserveOutbox);
    }

    /**
     * Aggregate health metrics for offline dashboard status.
     */
    static async getOfflineStorageStats(): Promise<OfflineStorageStats> {

        const [
            students,
            groups,
            sessions,
            exams,
            notebooks,
            users,
            centerTeachers,
            centerPackages,
            centerGroups,
            centerStudents,
            centerCheckIns,
            pendingOutbox,
            pendingMutations,
            lastPreloadAt,
        ] = await Promise.all([
            getAllFromStore(STORES.STUDENTS),
            getAllFromStore(STORES.GROUPS),
            getAllFromStore(STORES.SESSIONS),
            getAllFromStore(STORES.EXAMS),
            getAllFromStore(STORES.NOTEBOOKS),
            getAllFromStore(STORES.USERS),
            getAllFromStore(STORES.CENTER_TEACHERS),
            getAllFromStore(STORES.CENTER_PACKAGES),
            getAllFromStore(STORES.CENTER_GROUPS),
            getAllFromStore(STORES.CENTER_STUDENTS),
            getAllFromStore(STORES.CENTER_CHECKINS),
            OutboxService.getPendingCount(),
            this.getGenericMutationsCount(),
            this.getLastPreloadTime(),
        ]);

        const allMut = await getAllFromStore<GenericOfflineMutation>(STORES.MUTATIONS);
        const pendingDeletionsCount = allMut.filter(m => m.method === 'DELETE' && m.status === 'QUEUED').length;

        return {
            studentsCount: students.length,
            groupsCount: groups.length,
            sessionsCount: sessions.length,
            examsCount: exams.length,
            notebooksCount: notebooks.length,
            usersCount: users.length,
            centerTeachersCount: centerTeachers.length,
            centerPackagesCount: centerPackages.length,
            centerGroupsCount: centerGroups.length,
            centerStudentsCount: centerStudents.length,
            centerCheckInsCount: centerCheckIns.length,
            pendingOutboxCount: pendingOutbox,
            pendingMutationsCount: pendingMutations,
            pendingDeletionsCount,
            lastPreloadAt,
        };
    }
}

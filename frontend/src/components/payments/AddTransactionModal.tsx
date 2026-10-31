'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    recordSubscription,
    recordNotebookSale,
    recordExpense,
    updateTransaction,
    reserveNotebook,
    getPriceSettings,
    payDebt,
    payCycleDebt,
    payAllPastCycles,
} from '@/lib/api/payments';
import { fetchStudentReport } from '@/lib/api/reports';
import { fetchStudents } from '@/lib/api/students';
import { toast } from 'sonner';
import {
    Plus,
    Loader2,
    User,
    BookOpen,
    TrendingDown,
    Search,
    Bookmark,
    Check,
    Printer,
    CreditCard,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QK } from '@/lib/query-keys';
import { useAuthStore } from '@/lib/store/auth.store';
import { generateReceiptHtml, type ReceiptData } from '@/lib/utils/receiptHtml';
import { printHtmlContent } from '@/lib/utils/print';
import type { ITransaction } from '@/types/payment.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES, CATEGORY_LABELS, type TransactionCategory } from '@/types/payment.types';

type TxMode = 'subscription' | 'notebook' | 'notebook_reservation' | 'pay_debt' | 'expense';

const MODE_LABELS: Record<TxMode, string> = {
    subscription: 'اشتراك طالب',
    notebook:     'بيع مذكرة',
    notebook_reservation: 'حجز مذكرة',
    pay_debt:     'سداد باقي مصاريف',
    expense:      'مصروف',
};

const MODE_ICONS: Record<TxMode, React.ReactNode> = {
    subscription: <User className="h-4 w-4" />,
    notebook:     <BookOpen className="h-4 w-4" />,
    notebook_reservation: <Bookmark className="h-4 w-4" />,
    pay_debt:     <User className="h-4 w-4" />,
    expense:      <TrendingDown className="h-4 w-4" />,
};

// ─── Props ────────────────────────────────────────────────────────
interface AddTransactionModalProps {
    onSuccess?: () => void;
    // Edit mode — when provided the modal opens pre-filled for editing
    transactionId?: string;
    initialData?: {
        mode: TxMode;
        studentName?: string;
        amount?: number;
        category?: TransactionCategory;
        description?: string;
        date?: string;
    };
    // Controlled open state — used by the edit trigger in the table
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
}

export function AddTransactionModal({
    onSuccess,
    transactionId,
    initialData,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: AddTransactionModalProps) {
    const isEditMode = Boolean(transactionId && initialData);

    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = (v: boolean) => {
        if (controlledOnOpenChange) controlledOnOpenChange(v);
        else setInternalOpen(v);
    };

    const [mode, setMode] = useState<TxMode>(initialData?.mode ?? 'subscription');
    const [successTransaction, setSuccessTransaction] = useState<ITransaction | null>(null);
    const queryClient = useQueryClient();
    const user = useAuthStore(s => s.user);

    // Shared fields
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedStudentName, setSelectedStudentName] = useState(initialData?.studentName ?? '');
    const [selectedStudentDebt, setSelectedStudentDebt] = useState(0);
    const [selectedOptionKey, setSelectedOptionKey] = useState<string>('');
    const [isSettlementPending, setIsSettlementPending] = useState(false);
    const [discountAmount, setDiscountAmount] = useState('');
    const [description, setDescription] = useState(initialData?.description ?? '');
    const [date, setDate] = useState(
        initialData?.date
            ? initialData.date.split('T')[0]!
            : new Date().toISOString().split('T')[0]!
    );
    const [paidAmount, setPaidAmount] = useState('');
    const [isCustomQuota, setIsCustomQuota] = useState(false);
    const [customSessionsQuota, setCustomSessionsQuota] = useState('4');

    // Notebook-specific
    const [notebookId, setNotebookId] = useState('');
    const [quantity, setQuantity] = useState('1');

    // Expense-specific
    const [expenseCategory, setExpenseCategory] = useState<TransactionCategory>(
        (initialData?.category as TransactionCategory) ?? 'SALARY'
    );
    // Used for expense amount in expense mode, and for the editable paid amount in edit mode
    const [expenseAmount, setExpenseAmount] = useState(
        initialData?.amount !== undefined ? String(initialData.amount) : ''
    );

    // Sync initialData when edit modal opens (controlled)
    useEffect(() => {
        if (open && isEditMode && initialData) {
            setMode(initialData.mode);
            setSelectedStudentName(initialData.studentName ?? '');
            setSelectedStudentId('__edit_locked__'); // sentinel — not sent to backend
            setDescription(initialData.description ?? '');
            setDate(
                initialData.date
                    ? initialData.date.split('T')[0]!
                    : new Date().toISOString().split('T')[0]!
            );
            setExpenseCategory((initialData.category as TransactionCategory) ?? 'SALARY');
            setExpenseAmount(initialData.amount !== undefined ? String(initialData.amount) : '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const { data: studentsData } = useQuery({
        queryKey: QK.payments.searchForPayment(studentSearch),
        queryFn: () => fetchStudents({ search: studentSearch, limit: 8 }),
        enabled: open && !isEditMode && studentSearch.length >= 1 && (mode === 'subscription' || mode === 'notebook' || mode === 'notebook_reservation' || mode === 'pay_debt'),
    });
    const rawStudents = studentsData as any;
    const students = Array.isArray(rawStudents?.data?.data)
        ? rawStudents.data.data
        : Array.isArray(rawStudents?.data)
            ? rawStudents.data
            : [];

    // Price Settings (for center discounts)
    const { data: settings } = useQuery({
        queryKey: QK.payments.priceSettings,
        queryFn: getPriceSettings,
        enabled: open && (mode === 'subscription' || mode === 'pay_debt') && !isEditMode,
    });
    const centerDiscounts = settings?.centerDiscounts || [];

    // Fetch full report for the selected student to get cycle breakdown
    const { data: studentReport, isLoading: isReportLoading } = useQuery({
        queryKey: QK.students.report(selectedStudentId || ''),
        queryFn: () => fetchStudentReport(selectedStudentId!),
        enabled: Boolean(selectedStudentId && selectedStudentId !== '__edit_locked__' && open && (mode === 'subscription' || mode === 'pay_debt')),
        staleTime: 30 * 1000,
    });

    // ── Build Cycle & Debt Options for Selected Student ────────────────
    const paymentOptions = useMemo(() => {
        if (!selectedStudentId || isEditMode) return [];

        const options: Array<{
            key: string;
            label: string;
            badge?: string;
            type: 'CURRENT_CYCLE' | 'SPECIFIC_CYCLE' | 'ALL_PAST_CYCLES' | 'HISTORICAL_DEBT' | 'FULL_SETTLEMENT';
            cycleNumber?: number;
            amountDue: number;
        }> = [];

        // All enrollments from report
        const cycleEnrollments: any[] = studentReport?.payments?.cycleEnrollments || [];

        // 1. Unpaid Past Cycles from report or cycleEnrollments
        const rawPastCycles = studentReport?.payments?.pastUnpaidCycles || cycleEnrollments.filter((c: any) => c.isPastCycle);
        const pastUnpaidCycles: any[] = (rawPastCycles || [])
            .filter((c: any) => !c.isWaived && ((c.remainingAmount != null ? c.remainingAmount > 0 : (c.cycleCharge - (c.totalPaid || 0)) > 0) || c.status !== 'PAID'))
            .sort((a: any, b: any) => (a.cycleNumber || 0) - (b.cycleNumber || 0));

        // 2. Current Cycle Info
        const currentCycleEnrollment = studentReport?.payments?.currentCycleEnrollment || cycleEnrollments.find((c: any) => c.isCurrentCycle);
        const currentCycleNumber = currentCycleEnrollment?.cycleNumber || studentReport?.payments?.currentCycleNumber || studentReport?.group?.currentCycleNumber || 1;

        // Is Current Cycle Paid?
        const isCurrentCyclePaid = currentCycleEnrollment
            ? currentCycleEnrollment.status === 'PAID'
            : Boolean(studentReport?.payments?.hasActiveSubscription ?? studentReport?.student?.hasActiveSubscription);

        const currentCyclePrice = currentCycleEnrollment?.cycleCharge || studentReport?.group?.customPrice || 0;
        const currentCycleDue = currentCycleEnrollment
            ? (currentCycleEnrollment.remainingAmount > 0
                ? currentCycleEnrollment.remainingAmount
                : (isCurrentCyclePaid ? 0 : (currentCycleEnrollment.cycleCharge || currentCyclePrice)))
            : (isCurrentCyclePaid ? 0 : currentCyclePrice);

        // Option A: Current Cycle Subscription
        const currentCycleDueDisplay = currentCycleDue > 0 ? currentCycleDue : (currentCyclePrice > 0 ? currentCyclePrice : 0);
        options.push({
            key: 'CURRENT_CYCLE',
            label: `اشتراك الدورة الحالية (دورة رقم ${currentCycleNumber})`,
            badge: isCurrentCyclePaid ? 'مسدد بالكامل' : (currentCycleDueDisplay > 0 ? `مطلوب ${currentCycleDueDisplay} ج.م` : undefined),
            type: 'CURRENT_CYCLE',
            cycleNumber: currentCycleNumber,
            amountDue: isCurrentCyclePaid ? 0 : currentCycleDueDisplay,
        });

        // Option B: Each Specific Past Unpaid Cycle (Individual Cycle Debt)
        for (const cycle of pastUnpaidCycles) {
            const due = cycle.remainingAmount > 0 ? cycle.remainingAmount : Math.max(0, cycle.cycleCharge - (cycle.totalPaid || 0));
            if (due > 0) {
                options.push({
                    key: `CYCLE_${cycle.cycleNumber}`,
                    label: `مديونية دورة رقم ${cycle.cycleNumber} (سابقة)`,
                    badge: `متبقي ${due} ج.م`,
                    type: 'SPECIFIC_CYCLE',
                    cycleNumber: cycle.cycleNumber,
                    amountDue: due,
                });
            }
        }

        // Past cycles debt sum
        const pastCyclesTotal = pastUnpaidCycles.reduce(
            (sum, c) => sum + (c.remainingAmount > 0 ? c.remainingAmount : Math.max(0, c.cycleCharge - (c.totalPaid || 0))),
            0
        );

        // Non-cycle debt (legacy notes, general historical debts)
        const totalStudentDebt = Number(studentReport?.student?.totalDebt ?? selectedStudentDebt ?? 0);
        const totalCyclesAccounted = pastCyclesTotal + (!isCurrentCyclePaid ? currentCycleDue : 0);
        const trueNonCycleDebt = Math.max(0, totalStudentDebt - totalCyclesAccounted);

        if (trueNonCycleDebt > 0) {
            options.push({
                key: 'HISTORICAL_DEBT',
                label: `مديونية مستحقات سابقة / مذكرات`,
                badge: `${trueNonCycleDebt} ج.م`,
                type: 'HISTORICAL_DEBT',
                amountDue: trueNonCycleDebt,
            });
        }

        // Option C: Pay All Past Cycles (if more than 1 past cycle)
        if (pastUnpaidCycles.length > 1 && pastCyclesTotal > 0) {
            options.push({
                key: 'ALL_PAST_CYCLES',
                label: `سداد كافة الدورات السابقة دفعة واحدة (${pastUnpaidCycles.length} دورات)`,
                badge: `إجمالي ${pastCyclesTotal} ج.م`,
                type: 'ALL_PAST_CYCLES',
                amountDue: pastCyclesTotal,
            });
        }

        // Option D: Full Settlement (Current Cycle + Past Debts)
        const grandTotalDue = totalCyclesAccounted + trueNonCycleDebt;
        if (options.length > 1 && grandTotalDue > 0) {
            options.push({
                key: 'FULL_SETTLEMENT',
                label: `سداد شامل لكافة المستحقات (الدورة الحالية + كل المديونيات)`,
                badge: `إجمالي ${grandTotalDue} ج.م`,
                type: 'FULL_SETTLEMENT',
                cycleNumber: currentCycleNumber,
                amountDue: grandTotalDue,
            });
        }

        return options;
    }, [selectedStudentId, studentReport, selectedStudentDebt, isEditMode]);

    const pastUnpaidCyclesCount = useMemo(() => {
        return paymentOptions.filter((o) => o.type === 'SPECIFIC_CYCLE').length;
    }, [paymentOptions]);

    const activeOption = useMemo(() => {
        return paymentOptions.find((o) => o.key === selectedOptionKey) || paymentOptions[0] || null;
    }, [paymentOptions, selectedOptionKey]);

    useEffect(() => {
        if (paymentOptions.length > 0) {
            const currentExists = paymentOptions.some((o) => o.key === selectedOptionKey);
            if (!currentExists) {
                let targetOpt = paymentOptions[0];
                if (mode === 'pay_debt') {
                    const firstDebt = paymentOptions.find(
                        (o) => o.type === 'SPECIFIC_CYCLE' || o.type === 'HISTORICAL_DEBT' || o.type === 'ALL_PAST_CYCLES'
                    );
                    if (firstDebt) targetOpt = firstDebt;
                } else if (mode === 'subscription') {
                    const currentOpt = paymentOptions.find((o) => o.type === 'CURRENT_CYCLE');
                    if (currentOpt && currentOpt.amountDue > 0) {
                        targetOpt = currentOpt;
                    } else {
                        const firstPastCycle = paymentOptions.find((o) => o.type === 'SPECIFIC_CYCLE');
                        if (firstPastCycle) targetOpt = firstPastCycle;
                    }
                }
                setSelectedOptionKey(targetOpt.key);
                setPaidAmount(targetOpt.amountDue > 0 ? String(targetOpt.amountDue) : '');
                setDiscountAmount('');
            }
        } else {
            setSelectedOptionKey('');
        }
    }, [paymentOptions, mode, selectedOptionKey]);

    const handleDiscountChange = (newDiscountStr: string) => {
        setDiscountAmount(newDiscountStr);
        const discNum = parseFloat(newDiscountStr) || 0;
        const base = activeOption?.amountDue ?? 0;
        if (base > 0) {
            const net = Math.max(0, base - discNum);
            setPaidAmount(String(net));
        }
    };

    const handleOptionChange = (key: string) => {
        setSelectedOptionKey(key);
        const opt = paymentOptions.find((o) => o.key === key);
        if (opt) {
            const discNum = parseFloat(discountAmount) || 0;
            const net = Math.max(0, opt.amountDue - discNum);
            setPaidAmount(opt.amountDue > 0 ? String(net) : '');
        }
    };

    // Notebooks list
    const { data: notebooksData } = useQuery({
        queryKey: QK.notebooks.listForModal,
        queryFn: async () => {
            const { apiClient } = await import('@/lib/api/axios');
            const res = await apiClient.get('/notebooks?limit=100');
            return (res as any).data;
        },
        enabled: open && (mode === 'notebook' || mode === 'notebook_reservation'),
    });
    const rawNotebooks = notebooksData as any;
    const notebooks = Array.isArray(rawNotebooks?.data?.data)
        ? rawNotebooks.data.data
        : Array.isArray(rawNotebooks?.data)
            ? rawNotebooks.data
            : [];

    const resetForm = () => {
        setStudentSearch('');
        setSelectedStudentId('');
        setSelectedStudentName('');
        setSelectedStudentDebt(0);
        setSelectedOptionKey('');
        setDiscountAmount('');
        setPaidAmount('');
        setIsCustomQuota(false);
        setCustomSessionsQuota('4');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]!);
        setNotebookId('');
        setQuantity('1');
        setExpenseCategory('SALARY');
        setExpenseAmount('');
    };

    const invalidateAndClose = () => {
        queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
        queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
        setOpen(false);
        setSuccessTransaction(null);
        if (!isEditMode) resetForm();
        onSuccess?.();
    };

    // ── Add mutations ────────────────────────────────────────────────
    const subscriptionMutation = useMutation({
        mutationFn: recordSubscription,
        onSuccess: (data) => { 
            toast.success('تم تسجيل الاشتراك بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            setSuccessTransaction(data);
        },
    });

    const notebookMutation = useMutation({
        mutationFn: recordNotebookSale,
        onSuccess: (data) => { 
            toast.success('تم تسجيل بيع المذكرة بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            setSuccessTransaction(data);
        },
    });

    const reservationMutation = useMutation({
        mutationFn: reserveNotebook,
        onSuccess: (data) => { 
            toast.success('تم حجز المذكرة بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            setSuccessTransaction(data?.transaction || data); // Just in case backend wraps it
        },
    });

    const expenseMutation = useMutation({
        mutationFn: recordExpense,
        onSuccess: () => { toast.success('تم تسجيل المصروف بنجاح'); invalidateAndClose(); },
    });

    const payDebtMutation = useMutation({
        mutationFn: payDebt,
        onSuccess: (data) => { 
            toast.success('تم سداد المديونية بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            setSuccessTransaction(data);
        },
    });

    const payCycleDebtMutation = useMutation({
        mutationFn: payCycleDebt,
        onSuccess: (data: any) => { 
            toast.success('تم سداد مديونية الدورة بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            const tx = data?.transaction || data;
            setSuccessTransaction(tx);
        },
    });

    const payAllPastCyclesMutation = useMutation({
        mutationFn: payAllPastCycles,
        onSuccess: (data: any) => { 
            toast.success(data?.message || 'تم سداد كافة المديونيات السابقة بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            const firstTx = data?.transactions?.[0];
            setSuccessTransaction(firstTx || {
                _id: 'batch_' + Date.now(),
                studentName: selectedStudentName,
                paidAmount: parseFloat(paidAmount) || data?.totalPaid || 0,
                description: description || 'سداد كافة مديونيات الدورات السابقة',
                date,
                category: 'SUBSCRIPTION',
            });
        },
    });

    // ── Edit mutation ────────────────────────────────────────────────
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTransaction>[1] }) =>
            updateTransaction(id, data),
        onSuccess: () => { toast.success('تم حفظ التعديلات بنجاح'); invalidateAndClose(); },
    });

    const isPending =
        subscriptionMutation.isPending ||
        notebookMutation.isPending ||
        reservationMutation.isPending ||
        expenseMutation.isPending ||
        payDebtMutation.isPending ||
        payCycleDebtMutation.isPending ||
        payAllPastCyclesMutation.isPending ||
        isSettlementPending ||
        updateMutation.isPending;

    const handleFullSettlementSubmit = async (totalPaid: number, discVal?: number) => {
        setIsSettlementPending(true);
        try {
            const pastUnpaidCycles: any[] = (studentReport?.payments?.pastUnpaidCycles || []).filter(
                (c: any) => !c.isWaived && (c.remainingAmount > 0 || c.status !== 'PAID')
            );
            const currentCycleEnrollment = studentReport?.payments?.cycleEnrollments?.find((c: any) => c.isCurrentCycle);
            const isCurrentCyclePaid = currentCycleEnrollment
                ? currentCycleEnrollment.status === 'PAID'
                : Boolean(studentReport?.payments?.hasActiveSubscription ?? studentReport?.student?.hasActiveSubscription);
            const currentCyclePrice = currentCycleEnrollment?.cycleCharge || studentReport?.group?.customPrice || 0;
            const currentCycleDue = currentCycleEnrollment
                ? (currentCycleEnrollment.remainingAmount > 0 ? currentCycleEnrollment.remainingAmount : (isCurrentCyclePaid ? 0 : currentCyclePrice))
                : (isCurrentCyclePaid ? 0 : currentCyclePrice);

            let remaining = totalPaid;
            let lastTx: any = null;

            // A. Settle current cycle first if unpaid
            if (!isCurrentCyclePaid && currentCycleDue > 0 && remaining > 0) {
                const payCurrent = Math.min(remaining, currentCycleDue);
                const res = await recordSubscription({
                    studentId: selectedStudentId,
                    paidAmount: payCurrent,
                    discountAmount: discVal,
                    description: description || `سداد اشتراك الدورة الحالية - تسوية شاملة`,
                    date,
                });
                lastTx = res;
                remaining -= payCurrent;
            }

            // B. Settle past cycles
            if (remaining > 0 && pastUnpaidCycles.length > 0) {
                const pastTotal = pastUnpaidCycles.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
                const payPast = Math.min(remaining, pastTotal);
                const res = await payAllPastCycles({
                    studentId: selectedStudentId,
                    paidAmount: payPast,
                    description: description || 'سداد مديونيات الدورات السابقة - تسوية شاملة',
                    date,
                });
                if (res?.transactions?.length) lastTx = res.transactions[0];
                remaining -= payPast;
            }

            // C. Remaining historical debt
            if (remaining > 0) {
                const res = await payDebt({
                    studentId: selectedStudentId,
                    amount: remaining,
                    description: description || 'سداد متبقي مديونية سابقة - تسوية شاملة',
                    date,
                });
                lastTx = res;
            }

            toast.success('تم تسجيل التسوية الشاملة بنجاح');
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            queryClient.invalidateQueries({ queryKey: QK.students.reports });
            setSuccessTransaction(lastTx || {
                _id: 'full_' + Date.now(),
                studentName: selectedStudentName,
                paidAmount: totalPaid,
                description: description || 'تسوية شاملة',
                date,
                category: 'SUBSCRIPTION',
            });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء إجراء التسوية الشاملة');
        } finally {
            setIsSettlementPending(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // ── Edit mode ─────────────────────────────────────────────────
        if (isEditMode && transactionId) {
            const patch: Parameters<typeof updateTransaction>[1] = {};
            if (expenseAmount) patch.amount = parseFloat(expenseAmount);
            if (mode === 'expense') patch.category = expenseCategory;
            patch.description = description || undefined;
            patch.date = date;
            updateMutation.mutate({ id: transactionId, data: patch });
            return;
        }

        // ── Add mode ──────────────────────────────────────────────────
        if (mode === 'subscription' || mode === 'pay_debt') {
            if (!selectedStudentId) return toast.error('اختر طالباً');

            const opt = activeOption;
            const paidVal = paidAmount ? parseFloat(paidAmount) : undefined;
            const discVal = discountAmount ? parseFloat(discountAmount) : undefined;

            if (opt?.type === 'SPECIFIC_CYCLE' && opt.cycleNumber) {
                if (paidVal !== undefined && paidVal <= 0 && (!discVal || discVal <= 0)) {
                    return toast.error('أدخل مبلغ السداد بشكل صحيح');
                }
                payCycleDebtMutation.mutate({
                    studentId: selectedStudentId,
                    cycleNumber: opt.cycleNumber,
                    paidAmount: paidVal,
                    discountAmount: discVal,
                    description: description || `سداد مديونية دورة رقم ${opt.cycleNumber}`,
                    date,
                });
            } else if (opt?.type === 'ALL_PAST_CYCLES') {
                if (!paidVal || paidVal <= 0) return toast.error('أدخل مبلغ السداد بشكل صحيح');
                payAllPastCyclesMutation.mutate({
                    studentId: selectedStudentId,
                    paidAmount: paidVal,
                    description: description || 'سداد كافة مديونيات الدورات السابقة',
                    date,
                });
            } else if (opt?.type === 'HISTORICAL_DEBT') {
                if (!paidVal || paidVal <= 0) return toast.error('أدخل مبلغ السداد بشكل صحيح');
                payDebtMutation.mutate({
                    studentId: selectedStudentId,
                    amount: paidVal,
                    description: description || 'سداد مديونية سابقة',
                    date,
                });
            } else if (opt?.type === 'FULL_SETTLEMENT') {
                if (!paidVal || paidVal <= 0) return toast.error('أدخل مبلغ السداد بشكل صحيح');
                handleFullSettlementSubmit(paidVal, discVal);
            } else {
                // CURRENT_CYCLE
                subscriptionMutation.mutate({
                    studentId: selectedStudentId,
                    paidAmount: paidVal,
                    discountAmount: discVal,
                    description: description || undefined,
                    date,
                    customSessionsQuota: isCustomQuota && customSessionsQuota ? parseInt(customSessionsQuota) : undefined,
                });
            }
        } else if (mode === 'notebook') {
            if (!selectedStudentId) return toast.error('اختر طالباً');
            if (!notebookId) return toast.error('اختر مذكرة');
            notebookMutation.mutate({
                studentId: selectedStudentId,
                notebookId,
                quantity: quantity ? parseInt(quantity) : 1,
                discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
                paidAmount: paidAmount ? parseFloat(paidAmount) : undefined,
                description: description || undefined,
                date,
            });
        } else if (mode === 'notebook_reservation') {
            if (!selectedStudentId) return toast.error('اختر طالباً');
            if (!notebookId) return toast.error('اختر مذكرة');
            reservationMutation.mutate({
                studentId: selectedStudentId,
                notebookId,
                quantity: quantity ? parseInt(quantity) : 1,
                paidAmount: expenseAmount ? parseFloat(expenseAmount) : 0, // Using expenseAmount state for the deposit
                description: description || undefined,
            });
        } else {
            if (!expenseAmount) return toast.error('أدخل المبلغ');
            expenseMutation.mutate({
                category: expenseCategory,
                amount: parseFloat(expenseAmount),
                description: description || undefined,
                date,
            });
        }
    };

    const dialogTitle = isEditMode ? 'تعديل المعاملة' : 'تسجيل معاملة جديدة';

    if (successTransaction && !isEditMode) {
        return (
            <Dialog open={open} onOpenChange={(v) => { if (!v) invalidateAndClose(); }}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[400px]" dir="rtl">
                    <DialogTitle className="sr-only">تم التسجيل بنجاح</DialogTitle>
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <Check className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">تم تسجيل المعاملة بنجاح</h2>
                        <p className="text-sm text-gray-500 mb-6">يمكنك الآن طباعة إيصال الاستلام للطالب.</p>
                        
                        <div className="flex gap-3 w-full">
                            <Button className="flex-1" variant="outline" onClick={invalidateAndClose}>
                                إغلاق
                            </Button>
                            <Button 
                                className="flex-1 gap-2" 
                                onClick={() => {
                                    const receiptData: ReceiptData = {
                                        teacherName: user?.name || 'السنتر',
                                        studentName: successTransaction.studentName || selectedStudentName,
                                        amount: successTransaction.paidAmount || (expenseAmount ? parseFloat(expenseAmount) : 0),
                                        description: successTransaction.description || CATEGORY_LABELS[successTransaction.category] || MODE_LABELS[mode],
                                        date: successTransaction.date || date || new Date().toISOString(),
                                        transactionId: successTransaction._id,
                                    };
                                    printHtmlContent(generateReceiptHtml(receiptData));
                                }}
                            >
                                <Printer className="w-4 h-4" />
                                طباعة الإيصال
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
            {/* Trigger only shown in add mode */}
            {!isEditMode && (
                <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة معاملة
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                className="w-[calc(100vw-1.25rem)] sm:max-w-[500px] max-h-[92dvh] flex flex-col p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl gap-2.5 sm:gap-3 overflow-hidden"
                dir="rtl"
            >
                <DialogHeader className="shrink-0 pb-1 border-b border-gray-100 sm:border-0 sm:pb-0">
                    <DialogTitle className="text-base sm:text-lg font-bold">{dialogTitle}</DialogTitle>
                </DialogHeader>

                {/* Mode Selector — hidden in edit mode */}
                {!isEditMode && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 mb-0.5 shrink-0">
                        {(Object.keys(MODE_LABELS) as TxMode[]).map((m, idx) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); resetForm(); setDate(new Date().toISOString().split('T')[0]!); }}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-[11px] sm:text-xs font-semibold transition-all',
                                    idx === 4 ? 'col-span-2 sm:col-span-1' : '',
                                    mode === m
                                        ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50/60'
                                )}
                            >
                                {MODE_ICONS[m]}
                                <span className="leading-tight text-center">{MODE_LABELS[m]}</span>
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 pt-1 overflow-y-auto flex-1 pr-0.5 overscroll-contain">
                    {/* Student (subscription, notebook & reservation) */}
                    {(mode === 'subscription' || mode === 'notebook' || mode === 'notebook_reservation' || mode === 'pay_debt') && (
                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">الطالب</label>
                            {/* In edit mode: always show locked student chip */}
                            {(selectedStudentId || isEditMode) ? (
                                <div className="flex items-center justify-between gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs sm:text-sm font-semibold text-primary truncate">{selectedStudentName}</span>
                                        {selectedStudentDebt > 0 && (
                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0">
                                                مديونية: {selectedStudentDebt} ج
                                            </span>
                                        )}
                                    </div>
                                    {!isEditMode ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudentId('');
                                                setSelectedStudentName('');
                                                setSelectedStudentDebt(0);
                                                setSelectedOptionKey('');
                                                setPaidAmount('');
                                                setDiscountAmount('');
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-800 font-medium shrink-0 underline"
                                        >
                                            تغيير
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-gray-400 shrink-0">لا يمكن تغيير الطالب</span>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                                    <Input
                                        placeholder="ابحث عن طالب..."
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        className="pr-9 h-10 rounded-xl text-base sm:text-sm"
                                    />
                                    {students?.length > 0 && (
                                        <div className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
                                            {students?.map((s: any) => (
                                                <button
                                                    key={s._id}
                                                    type="button"
                                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm hover:bg-gray-50 transition-colors text-right"
                                                    onClick={() => {
                                                        setSelectedStudentId(s._id);
                                                        setSelectedStudentName(s.studentName);
                                                        setSelectedStudentDebt(s.totalDebt || 0);
                                                        setStudentSearch('');
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-medium truncate">{s.studentName}</span>
                                                        {(s.totalDebt || 0) > 0 && (
                                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full shrink-0">
                                                                عليه {s.totalDebt} ج
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 shrink-0 mr-2">{s.gradeLevel}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notebook Select — add mode only */}
                    {(mode === 'notebook' || mode === 'notebook_reservation') && !isEditMode && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">المذكرة</label>
                                <Select value={notebookId} onValueChange={setNotebookId}>
                                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                        <SelectValue placeholder="اختر مذكرة..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {notebooks?.map((nb: any) => (
                                            <SelectItem key={nb._id} value={nb._id}>
                                                {nb.name || nb.title} — {nb.price} ج
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">الكمية</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="h-10 rounded-xl text-base sm:text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Expense Fields */}
                    {mode === 'expense' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">الفئة</label>
                                <Select value={expenseCategory} onValueChange={(v) => setExpenseCategory(v as TransactionCategory)}>
                                    <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EXPENSE_CATEGORIES.map((c) => (
                                            <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">المبلغ (ج)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    className="h-10 rounded-xl text-base sm:text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Cycle & Debt Option Selector Dropdown for Subscription & Pay Debt */}
                    {(mode === 'subscription' || mode === 'pay_debt') && !isEditMode && selectedStudentId && (
                        <>
                            {isReportLoading ? (
                                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                    <span>جاري فحص مديونيات واشتراكات الطالب...</span>
                                </div>
                            ) : (
                                <div className="space-y-2 p-2.5 sm:p-3 rounded-xl bg-slate-50/90 border border-slate-200/90">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span>ماذا يريد الطالب سداده الآن؟</span> <span className="text-red-500">*</span>
                                        </label>
                                        {activeOption?.badge && (
                                            <span className="text-[10px] sm:text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                                                {activeOption.badge}
                                            </span>
                                        )}
                                    </div>

                                    <Select value={selectedOptionKey} onValueChange={handleOptionChange}>
                                        <SelectTrigger className="w-full bg-white text-xs sm:text-sm font-medium border-slate-200 h-10 shadow-xs rounded-xl">
                                            <SelectValue placeholder="اختر الدورة أو البند المطلوب سداده..." />
                                        </SelectTrigger>
                                        <SelectContent align="end" className="text-right max-h-56" dir="rtl">
                                            {paymentOptions.map((opt) => (
                                                <SelectItem key={opt.key} value={opt.key} className="text-xs sm:text-sm py-2">
                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                        <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">{opt.label}</span>
                                                        {opt.badge && (
                                                            <span className="text-[10px] sm:text-[11px] font-bold text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                                {opt.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Notice if student has past unpaid cycles but active selection is current cycle */}
                                    {pastUnpaidCyclesCount > 0 && activeOption?.type === 'CURRENT_CYCLE' && (
                                        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg p-2.5 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                                            <div className="leading-relaxed">
                                                <span className="font-bold">تنبيه:</span> على هذا الطالب مديونية في{' '}
                                                <span className="font-bold underline">{pastUnpaidCyclesCount} دورة سابقة</span>. يمكنك فتح القائمة أعلاه لاختيار سداد مديونية دورة محددة بدلاً من اشتراك الدورة الحالية.
                                            </div>
                                        </div>
                                    )}

                                    {/* Notice if student is fully settled */}
                                    {paymentOptions.length === 1 && paymentOptions[0].amountDue === 0 && !isReportLoading && (
                                        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg p-2 flex items-center gap-1.5">
                                            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                                            <span>الطالب مسدد اشتراك الدورة الحالية بالكامل وليس عليه أي مديونيات سابقة.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Paid Amount Field for Subscription & Pay Debt */}
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                                    المبلغ (ج) <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder={activeOption?.amountDue ? `المطلوب: ${activeOption.amountDue} ج` : 'أدخل المبلغ'}
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(e.target.value)}
                                    required
                                    className="h-10 text-base sm:text-sm font-semibold rounded-xl"
                                />
                            </div>
                        </>
                    )}

                    {/* Discount — add mode only, subscription or specific cycle debt */}
                    {(mode === 'subscription' || mode === 'pay_debt') &&
                        !isEditMode &&
                        (activeOption?.type === 'CURRENT_CYCLE' || activeOption?.type === 'SPECIFIC_CYCLE' || activeOption?.type === 'FULL_SETTLEMENT') && (
                            <div>
                                <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                                    خصم (ج) <span className="text-gray-400 font-normal">— اختياري</span>
                                </label>
                                <div className="flex gap-2">
                                    {centerDiscounts.length > 0 && (
                                        <Select 
                                            onValueChange={(val) => {
                                                const center = centerDiscounts.find(c => c.centerName === val);
                                                if (center) {
                                                    handleDiscountChange(center.discountAmount.toString());
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-[110px] px-2 h-10 rounded-xl text-xs sm:text-sm shrink-0">
                                                <SelectValue placeholder="خصم سنتر" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {centerDiscounts.map(c => (
                                                    <SelectItem key={c.centerName} value={c.centerName}>
                                                        {c.centerName} ({c.discountAmount} ج)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={discountAmount}
                                        onChange={(e) => handleDiscountChange(e.target.value)}
                                        className="flex-1 h-10 rounded-xl text-base sm:text-sm"
                                    />
                                </div>
                            </div>
                        )}

                    {/* Custom Quota - Add mode only, current cycle subscription */}
                    {(mode === 'subscription' || mode === 'pay_debt') && !isEditMode && activeOption?.type === 'CURRENT_CYCLE' && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="isCustomQuota"
                                    checked={isCustomQuota}
                                    onChange={(e) => setIsCustomQuota(e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                />
                                <label htmlFor="isCustomQuota" className="text-xs sm:text-sm font-medium text-gray-700 cursor-pointer">
                                    تخصيص عدد الحصص (اشتراك نصف شهر مثلاً)
                                </label>
                            </div>
                            {isCustomQuota && (
                                <div className="pr-6">
                                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">عدد الحصص المقررة</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={customSessionsQuota}
                                        onChange={(e) => setCustomSessionsQuota(e.target.value)}
                                        className="h-9 text-base sm:text-sm w-full rounded-xl"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Deposit for reservation */}
                    {mode === 'notebook_reservation' && !isEditMode && (
                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                                المبلغ المدفوع (عربون) <span className="text-gray-400 font-normal">— اختياري</span>
                            </label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                className="h-10 rounded-xl text-base sm:text-sm"
                            />
                        </div>
                    )}

                    {/* Editable amount — edit mode, subscription & notebook */}
                    {isEditMode && (mode === 'subscription' || mode === 'notebook') && (
                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">المبلغ المدفوع (ج)</label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                className="h-10 rounded-xl text-base sm:text-sm"
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">
                            ملاحظة <span className="text-gray-400 font-normal">— اختياري</span>
                        </label>
                        <Input
                            placeholder="ملاحظة..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-10 rounded-xl text-base sm:text-sm"
                        />
                    </div>

                    {/* Date (Not available for reservation since reservation tracks current date) */}
                    {mode !== 'notebook_reservation' && (
                        <div>
                            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">التاريخ</label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl text-base sm:text-sm" />
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-gray-100 mt-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isPending}
                            className="w-full sm:w-auto h-11 sm:h-10 rounded-xl text-xs font-semibold"
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full sm:w-auto h-11 sm:h-10 rounded-xl text-sm sm:text-xs font-bold"
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            {isEditMode ? 'حفظ التعديلات' : 'تسجيل المعاملة'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordSubscription, recordNotebookSale, recordExpense, updateTransaction, reserveNotebook, getPriceSettings, payDebt } from '@/lib/api/payments';
import { fetchStudents } from '@/lib/api/students';
import { toast } from 'sonner';
import { Plus, Loader2, User, BookOpen, TrendingDown, Search, Bookmark, Check, Printer } from 'lucide-react';
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
    const [discountAmount, setDiscountAmount] = useState('');
    const [description, setDescription] = useState(initialData?.description ?? '');
    const [date, setDate] = useState(
        initialData?.date
            ? initialData.date.split('T')[0]!
            : new Date().toISOString().split('T')[0]!
    );
    const [paidAmount, setPaidAmount] = useState('');

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
        enabled: open && mode === 'subscription' && !isEditMode,
    });
    const centerDiscounts = settings?.centerDiscounts || [];

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
        setDiscountAmount('');
        setPaidAmount('');
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
            setSuccessTransaction(data);
        },
    });

    const notebookMutation = useMutation({
        mutationFn: recordNotebookSale,
        onSuccess: (data) => { 
            toast.success('تم تسجيل بيع المذكرة بنجاح'); 
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
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
            setSuccessTransaction(data);
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
        updateMutation.isPending;

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
        if (mode === 'subscription') {
            if (!selectedStudentId) return toast.error('اختر طالباً');
            subscriptionMutation.mutate({
                studentId: selectedStudentId,
                discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
                paidAmount: paidAmount ? parseFloat(paidAmount) : undefined,
                description: description || undefined,
                date,
            });
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
        } else if (mode === 'pay_debt') {
            if (!selectedStudentId) return toast.error('اختر طالباً');
            if (!paidAmount || parseFloat(paidAmount) <= 0) return toast.error('أدخل مبلغ السداد بشكل صحيح');
            if (parseFloat(paidAmount) > selectedStudentDebt) return toast.error('المبلغ المدفوع أكبر من المديونية الحالية');
            
            payDebtMutation.mutate({
                studentId: selectedStudentId,
                amount: parseFloat(paidAmount),
                description: description || undefined,
                date,
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
                <DialogContent className="sm:max-w-[400px]" dir="rtl">
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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && !isEditMode) resetForm(); }}>
            {/* Trigger only shown in add mode */}
            {!isEditMode && (
                <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة معاملة
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[480px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                </DialogHeader>

                {/* Mode Selector — hidden in edit mode */}
                {!isEditMode && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-1">
                        {(Object.keys(MODE_LABELS) as TxMode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); resetForm(); setDate(new Date().toISOString().split('T')[0]!); }}
                                className={cn(
                                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                                    mode === m
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                )}
                            >
                                {MODE_ICONS[m]}
                                {MODE_LABELS[m]}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                    {/* Student (subscription, notebook & reservation) */}
                    {(mode === 'subscription' || mode === 'notebook' || mode === 'notebook_reservation' || mode === 'pay_debt') && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">الطالب</label>
                            {/* In edit mode: always show locked student chip */}
                            {(selectedStudentId || isEditMode) ? (
                                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-primary">{selectedStudentName}</span>
                                        {selectedStudentDebt > 0 && (
                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                                مديونية: {selectedStudentDebt} ج
                                            </span>
                                        )}
                                    </div>
                                    {!isEditMode ? (
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedStudentId(''); setSelectedStudentName(''); setSelectedStudentDebt(0); }}
                                            className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                            تغيير
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-gray-400">لا يمكن تغيير الطالب</span>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="ابحث عن طالب..."
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        className="pr-9"
                                    />
                                    {students?.length > 0 && (
                                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                                            {students?.map((s: any) => (
                                                <button
                                                    key={s._id}
                                                    type="button"
                                                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors text-right"
                                                    onClick={() => {
                                                        setSelectedStudentId(s._id);
                                                        setSelectedStudentName(s.studentName);
                                                        setSelectedStudentDebt(s.totalDebt || 0);
                                                        if (mode === 'pay_debt') {
                                                            setPaidAmount(String(s.totalDebt || 0));
                                                        }
                                                        setStudentSearch('');
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{s.studentName}</span>
                                                        {(s.totalDebt || 0) > 0 && (
                                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                                                عليه {s.totalDebt} ج
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400">{s.gradeLevel}</span>
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
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">المذكرة</label>
                                <Select value={notebookId} onValueChange={setNotebookId}>
                                    <SelectTrigger>
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
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">الكمية</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Expense Fields */}
                    {mode === 'expense' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">الفئة</label>
                                <Select value={expenseCategory} onValueChange={(v) => setExpenseCategory(v as TransactionCategory)}>
                                    <SelectTrigger>
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
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ (ج)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Discount — add mode only, subscription & notebook */}
                    {(mode === 'subscription' || mode === 'notebook') && !isEditMode && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                    خصم (ج) <span className="text-gray-400 font-normal">— اختياري</span>
                                </label>
                                <div className="flex gap-2">
                                    {centerDiscounts.length > 0 && mode === 'subscription' && (
                                        <Select 
                                            onValueChange={(val) => {
                                                const center = centerDiscounts.find(c => c.centerName === val);
                                                if (center) setDiscountAmount(center.discountAmount.toString());
                                            }}
                                        >
                                            <SelectTrigger className="w-[80px] sm:w-[100px] px-2">
                                                <SelectValue placeholder="سنتر" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {centerDiscounts.map(c => (
                                                    <SelectItem key={c.centerName} value={c.centerName}>
                                                        {c.centerName} ({c.discountAmount})
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
                                        onChange={(e) => setDiscountAmount(e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                    المدفوع (ج) <span className="text-gray-400 font-normal">— اختياري</span>
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="المبلغ كاملاً"
                                    value={paidAmount}
                                    onChange={(e) => setPaidAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Pay Debt */}
                    {mode === 'pay_debt' && !isEditMode && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ المراد سداده (ج)</label>
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder={`المديونية الحالية: ${selectedStudentDebt} ج`}
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    {/* Deposit for reservation */}
                    {mode === 'notebook_reservation' && !isEditMode && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                المبلغ المدفوع (عربون) <span className="text-gray-400 font-normal">— اختياري</span>
                            </label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Editable amount — edit mode, subscription & notebook */}
                    {isEditMode && (mode === 'subscription' || mode === 'notebook') && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ المدفوع (ج)</label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                            ملاحظة <span className="text-gray-400 font-normal">— اختياري</span>
                        </label>
                        <Input
                            placeholder="ملاحظة..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Date (Not available for reservation since reservation tracks current date) */}
                    {mode !== 'notebook_reservation' && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">التاريخ</label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            {isEditMode ? 'حفظ التعديلات' : 'تسجيل'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordSubscription, recordNotebookSale, recordExpense } from '@/lib/api/payments';
import { fetchStudents } from '@/lib/api/students';
import { toast } from 'sonner';
import { Plus, Loader2, User, BookOpen, TrendingDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type TxMode = 'subscription' | 'notebook' | 'expense';

const MODE_LABELS: Record<TxMode, string> = {
    subscription: 'اشتراك طالب',
    notebook:     'بيع مذكرة',
    expense:      'مصروف',
};

const MODE_ICONS: Record<TxMode, React.ReactNode> = {
    subscription: <User className="h-4 w-4" />,
    notebook:     <BookOpen className="h-4 w-4" />,
    expense:      <TrendingDown className="h-4 w-4" />,
};

interface AddTransactionModalProps {
    onSuccess?: () => void;
}

export function AddTransactionModal({ onSuccess }: AddTransactionModalProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<TxMode>('subscription');
    const queryClient = useQueryClient();

    // Shared fields
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [discountAmount, setDiscountAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);

    // Notebook-specific
    const [notebookId, setNotebookId] = useState('');
    const [quantity, setQuantity] = useState('1');

    // Expense-specific
    const [expenseCategory, setExpenseCategory] = useState<TransactionCategory>('SALARY');
    const [expenseAmount, setExpenseAmount] = useState('');

    // Student search
    const { data: studentsData } = useQuery({
        queryKey: ['students-search-payment', studentSearch],
        queryFn: () => fetchStudents({ search: studentSearch, limit: 8 }),
        enabled: open && studentSearch.length >= 1 && (mode === 'subscription' || mode === 'notebook'),
    });
    const rawStudents = studentsData as any;
    const students = Array.isArray(rawStudents?.data?.data)
        ? rawStudents.data.data
        : Array.isArray(rawStudents?.data)
            ? rawStudents.data
            : [];

    // Notebooks list
    const { data: notebooksData } = useQuery({
        queryKey: ['notebooks-list'],
        queryFn: async () => {
            const { apiClient } = await import('@/lib/api/axios');
            const res = await apiClient.get('/notebooks?limit=100');
            return (res as any).data;
        },
        enabled: open && mode === 'notebook',
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
        setDiscountAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]!);
        setNotebookId('');
        setQuantity('1');
        setExpenseCategory('SALARY');
        setExpenseAmount('');
    };

    const invalidateAndClose = () => {
        queryClient.invalidateQueries({ queryKey: ['daily-ledger'] });
        queryClient.invalidateQueries({ queryKey: ['monthly-ledger'] });
        setOpen(false);
        resetForm();
        onSuccess?.();
    };

    const subscriptionMutation = useMutation({
        mutationFn: recordSubscription,
        onSuccess: () => { toast.success('تم تسجيل الاشتراك بنجاح'); invalidateAndClose(); },
        
    });

    const notebookMutation = useMutation({
        mutationFn: recordNotebookSale,
        onSuccess: () => { toast.success('تم تسجيل بيع المذكرة بنجاح'); invalidateAndClose(); },
        
    });

    const expenseMutation = useMutation({
        mutationFn: recordExpense,
        onSuccess: () => { toast.success('تم تسجيل المصروف بنجاح'); invalidateAndClose(); },
        
    });

    const isPending = subscriptionMutation.isPending || notebookMutation.isPending || expenseMutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'subscription') {
            if (!selectedStudentId) return toast.error('اختر طالباً');
            subscriptionMutation.mutate({
                studentId: selectedStudentId,
                discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
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

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة معاملة
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تسجيل معاملة جديدة</DialogTitle>
                </DialogHeader>

                {/* Mode Selector */}
                <div className="grid grid-cols-3 gap-2 mb-1">
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

                <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                    {/* Student Search (subscription & notebook) */}
                    {(mode === 'subscription' || mode === 'notebook') && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">الطالب</label>
                            {selectedStudentId ? (
                                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                                    <span className="text-sm font-medium text-primary">{selectedStudentName}</span>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedStudentId(''); setSelectedStudentName(''); }}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        تغيير
                                    </button>
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
                                                        setStudentSearch('');
                                                    }}
                                                >
                                                    <span className="font-medium">{s.studentName}</span>
                                                    <span className="text-xs text-gray-400">{s.gradeLevel}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notebook Select */}
                    {mode === 'notebook' && (
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

                    {/* Discount (subscription & notebook) */}
                    {(mode === 'subscription' || mode === 'notebook') && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                خصم (ج) <span className="text-gray-400 font-normal">— اختياري</span>
                            </label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(e.target.value)}
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

                    {/* Date */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">التاريخ</label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            تسجيل
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

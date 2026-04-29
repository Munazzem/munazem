'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { fetchNotebooks } from '@/lib/api/notebooks';
import { reserveNotebook } from '@/lib/api/payments';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BookOpen, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentWithGroup } from '@/types/student.types';
import type { INotebook } from '@/types/notebook.types';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

export function QuickNotebookSaleModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();

    const [search,          setSearch]          = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);
    const [notebookId,      setNotebookId]      = useState('');
    const [quantity,        setQuantity]        = useState('1');
    const [paidAmount,      setPaidAmount]      = useState('');

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setSearch('');
                setDebouncedSearch('');
                setSelectedStudent(null);
                setNotebookId('');
                setQuantity('1');
                setPaidAmount('');
            }, 300);
        }
    }, [open]);

    // Student search results
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: ['quickSale_students', debouncedSearch],
        queryFn: () => fetchStudents({ search: debouncedSearch, limit: 10, isActive: true }),
        enabled: debouncedSearch.length >= 2 && !selectedStudent,
        staleTime: 30 * 1000,
    });
    const rawStudents = studentsData as any;
    const studentResults: StudentWithGroup[] = Array.isArray(rawStudents?.data?.data)
        ? rawStudents.data.data
        : Array.isArray(rawStudents?.data)
            ? rawStudents.data
            : [];

    // Notebooks filtered by student grade level
    const { data: notebooksData, isLoading: notebooksLoading } = useQuery({
        queryKey: ['quickSale_notebooks', selectedStudent?.gradeLevel],
        queryFn: () => fetchNotebooks({ gradeLevel: selectedStudent!.gradeLevel, limit: 100 }),
        enabled: !!selectedStudent,
        staleTime: 5 * 60 * 1000,
    });
    const rawNotebooks = notebooksData as any;
    const notebooks: INotebook[] = Array.isArray(rawNotebooks?.data?.data)
        ? rawNotebooks.data.data
        : Array.isArray(rawNotebooks?.data)
            ? rawNotebooks.data
            : [];

    const selectedNotebook = notebooks.find(n => n._id === notebookId);
    const fullPrice = selectedNotebook ? selectedNotebook.price * Number(quantity || 1) : 0;
    const remaining = Math.max(0, fullPrice - Number(paidAmount || 0));

    const mutation = useMutation({
        mutationFn: () =>
            reserveNotebook({
                studentId:   selectedStudent!._id,
                notebookId,
                quantity:    Number(quantity) || 1,
                paidAmount:  Number(paidAmount) || 0, // In this context, the second input will be "Paid Amount"
            }),
        onSuccess: () => {
            toast.success(`تم تسجيل حجز المذكرة لـ ${selectedStudent?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dailySummary'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            
        },
    });

    const canSubmit =
        !!selectedStudent &&
        !!notebookId &&
        Number(quantity) >= 1 &&
        !mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden gap-0" dir="rtl">
                {/* Accent bar */}
                <div className="h-1 w-full bg-linear-to-r from-purple-500 to-indigo-400" />

                <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-600" />
                        حجز مذكرة جديد
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5 space-y-5">

                    {/* Step 1 — Student search */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1.5">
                            الطالب
                        </label>

                        {selectedStudent ? (
                            /* Selected student pill */
                            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-primary">
                                        {selectedStudent.studentName.charAt(0)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm truncate">{selectedStudent.studentName}</p>
                                    <p className="text-xs text-gray-400">{selectedStudent.gradeLevel}</p>
                                </div>
                                <button
                                    onClick={() => { setSelectedStudent(null); setNotebookId(''); setSearch(''); }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            /* Search input + dropdown */
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="ابحث بالاسم أو الكود..."
                                    className="pr-10"
                                    autoFocus
                                />
                                {/* Dropdown */}
                                        {(studentsLoading || (studentResults?.length ?? 0) > 0) && (
                                            <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
                                                {studentsLoading ? (
                                                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                                                        <Loader2 className="h-4 w-4 animate-spin" /> جاري البحث...
                                                    </div>
                                                ) : (
                                                    studentResults?.map(s => (
                                                <button
                                                    key={s._id}
                                                    onClick={() => { setSelectedStudent(s); setSearch(''); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-right"
                                                >
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-primary">{s.studentName.charAt(0)}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{s.studentName}</p>
                                                        <p className="text-xs text-gray-400">{s.gradeLevel}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step 2 — Notebook select (only after student selected) */}
                    {selectedStudent && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                المذكرة
                            </label>
                            {notebooksLoading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المذكرات...
                                </div>
                            ) : notebooks.length === 0 ? (
                                <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                                    لا توجد مذكرات لمرحلة {selectedStudent.gradeLevel}
                                </p>
                            ) : (
                                <Select value={notebookId} onValueChange={setNotebookId}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="اختر مذكرة..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {notebooks?.map(n => (
                                            <SelectItem
                                                key={n._id}
                                                value={n._id}
                                                disabled={n.stock === 0}
                                            >
                                                <span>{n.name}</span>
                                                <span className={cn(
                                                    'text-xs mr-2',
                                                    n.stock === 0 ? 'text-red-400' : 'text-gray-400'
                                                )}>
                                                    {n.stock === 0 ? '(نفدت)' : `${n.price} ج · مخزون: ${n.stock}`}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    {/* Step 3 — Quantity & discount */}
                    {selectedStudent && notebookId && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">الكمية</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                        المبلغ المدفوع حالياً <span className="text-gray-400 font-normal">(عربون)</span>
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={paidAmount}
                                        onChange={e => setPaidAmount(e.target.value)}
                                        placeholder="0"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* Total preview */}
                            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500">إجمالي الحجز</span>
                                    <span className="text-sm font-bold text-gray-700">{fullPrice.toLocaleString('ar-EG')} ج.م</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-gray-500">المبلغ المتبقي</span>
                                    <span className="text-xl font-bold text-purple-700">
                                        {remaining.toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            </div>
                            {Number(paidAmount) > 0 && (
                                <div className="text-xs text-center text-gray-500 mt-1">
                                    سيتم تسجيل {Number(paidAmount)} ج.م كعربون في الخزنة
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                        إلغاء
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={!canSubmit}
                        className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        تأكيد الحجز
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

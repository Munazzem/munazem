'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { fetchNotebooks } from '@/lib/api/notebooks';
import { recordBatchNotebookSale, recordBatchNotebookReservation, type IBatchNotebookSaleResult } from '@/lib/api/payments';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { BookOpen, BookMarked, Check, X, Loader2, CheckSquare, Square, AlertTriangle, Search, Calendar } from 'lucide-react';
import { QK } from '@/lib/query-keys';
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

// Stage → gradeLevel prefix mapping
const STAGE_OPTIONS = [
    { value: 'PRIMARY',     label: 'ابتدائي' },
    { value: 'PREPARATORY', label: 'إعدادي' },
    { value: 'SECONDARY',   label: 'ثانوي' },
] as const;

const STAGE_TO_GRADE_PREFIX: Record<string, string> = {
    PRIMARY:     'ابتدائي',
    PREPARATORY: 'إعدادي',
    SECONDARY:   'ثانوي',
};

interface Student {
    _id: string;
    studentName: string;
    gradeLevel: string;
}

interface BatchNotebookActionModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function BatchNotebookActionModal({
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    trigger,
}: BatchNotebookActionModalProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (v: boolean) => {
        if (controlledOnOpenChange) controlledOnOpenChange(v);
        else setInternalOpen(v);
    };

    // Operation mode: 'sale' (بيع فوري) or 'reservation' (حجز مسبق)
    const [mode, setMode] = useState<'sale' | 'reservation'>('sale');
    const [stageFilter, setStageFilter] = useState('');
    const [groupId, setGroupId] = useState('');
    const [notebookId, setNotebookId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [quantity, setQuantity] = useState(1);
    const [discount, setDiscount] = useState(0);
    const [depositPaid, setDepositPaid] = useState<number | ''>('');
    const [studentSearch, setStudentSearch] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
    const [results, setResults] = useState<IBatchNotebookSaleResult[] | null>(null);

    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);

    const allowedStages = STAGE_OPTIONS.filter(stage =>
        allowedGrades.some(g => g.includes(STAGE_TO_GRADE_PREFIX[stage.value]!))
    );

    // Reset group & students when stage changes
    useEffect(() => {
        setGroupId('');
        setSelectedIds(new Set());
    }, [stageFilter]);

    // Reset students when group changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [groupId]);

    // Groups list
    const { data: groupsData } = useQuery({
        queryKey: [...QK.groups.forBulkSub, stageFilter],
        queryFn: () => fetchGroups({ limit: 200 }),
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const allGroups = groupsData?.data ?? [];

    const filteredGroups = useMemo(() => {
        if (!stageFilter) return allGroups;
        const prefix = STAGE_TO_GRADE_PREFIX[stageFilter];
        return allGroups.filter(g => g.gradeLevel.includes(prefix!));
    }, [allGroups, stageFilter]);

    // Notebooks list
    const { data: notebooksData } = useQuery({
        queryKey: ['notebooks', 'all-for-batch'],
        queryFn: () => fetchNotebooks({ limit: 100 }),
        enabled: open,
    });
    const notebooks = notebooksData?.data ?? [];

    // Filter notebooks by grade level if stage is selected, or show all
    const filteredNotebooks = useMemo(() => {
        if (!stageFilter) return notebooks;
        const prefix = STAGE_TO_GRADE_PREFIX[stageFilter];
        return notebooks.filter(nb => !nb.gradeLevel || nb.gradeLevel.includes(prefix!));
    }, [notebooks, stageFilter]);

    const selectedNotebook = useMemo(() => {
        return notebooks.find(nb => nb._id === notebookId);
    }, [notebooks, notebookId]);

    // Students of selected group
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: QK.payments.bulkSubStudents(groupId),
        queryFn: () => fetchStudents({ groupId, limit: 300, isActive: true }),
        enabled: !!groupId,
    });
    const students: Student[] = studentsData?.data ?? [];

    // Auto-select all students when group loads
    useEffect(() => {
        if (students.length > 0) {
            setSelectedIds(new Set(students.map(s => s._id)));
        }
    }, [students.length, groupId]);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        return students.filter(s => s.studentName.toLowerCase().includes(studentSearch.toLowerCase()));
    }, [students, studentSearch]);

    const saleMutation = useMutation({
        mutationFn: recordBatchNotebookSale,
        onSuccess: (data) => {
            setResults(data.results);
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            queryClient.removeQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            if (data.failCount === 0) {
                toast.success(`تم تسجيل بيع المذكرات لـ ${data.successCount} طالب بنجاح — إجمالي: ${data.totalPaid.toLocaleString()} ج`);
            } else {
                toast.warning(`${data.successCount} نجح — ${data.failCount} فشل`);
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء تسجيل بيع المذكرات');
        },
    });

    const reservationMutation = useMutation({
        mutationFn: recordBatchNotebookReservation,
        onSuccess: (data) => {
            setResults(data.results);
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            if (data.failCount === 0) {
                toast.success(`تم حجز المذكرات لـ ${data.successCount} طالب بنجاح — إجمالي العربون: ${data.totalPaid.toLocaleString()} ج`);
            } else {
                toast.warning(`${data.successCount} نجح — ${data.failCount} فشل`);
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء حجز المذكرات');
        },
    });

    const isPending = saleMutation.isPending || reservationMutation.isPending;

    const toggleStudent = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.has(s._id));
    const toggleAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                filteredStudents.forEach(s => next.delete(s._id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                filteredStudents.forEach(s => next.add(s._id));
                return next;
            });
        }
    };

    const totalRequiredStock = selectedIds.size * quantity;
    const isStockInsufficient = mode === 'sale' && selectedNotebook ? totalRequiredStock > selectedNotebook.stock : false;

    const unitPrice = selectedNotebook?.price ?? 0;
    const pricePerStudent = mode === 'sale'
        ? Math.max(0, (unitPrice * quantity) - discount)
        : (unitPrice * quantity);
    const totalExpectedAmount = mode === 'sale'
        ? pricePerStudent * selectedIds.size
        : (Number(depositPaid) || 0) * selectedIds.size;

    const handleSubmit = () => {
        if (!notebookId) {
            toast.error('يرجى اختيار المذكرة أولاً');
            return;
        }
        if (selectedIds.size === 0) {
            toast.error('اختر طالباً واحداً على الأقل');
            return;
        }
        if (isStockInsufficient) {
            toast.error(`الكمية في المخزن (${selectedNotebook?.stock}) لا تكفي للطلاب المحددين (${totalRequiredStock})`);
            return;
        }

        if (mode === 'sale') {
            saleMutation.mutate({
                notebookId,
                studentIds: Array.from(selectedIds),
                quantity,
                discountAmount: discount > 0 ? discount : undefined,
                date,
            });
        } else {
            reservationMutation.mutate({
                notebookId,
                studentIds: Array.from(selectedIds),
                quantity,
                paidAmount: Number(depositPaid) > 0 ? Number(depositPaid) : undefined,
                date,
            });
        }
    };

    const handleClose = (val: boolean) => {
        if (!val && results) {
            setStageFilter('');
            setGroupId('');
            setNotebookId('');
            setSelectedIds(new Set());
            setQuantity(1);
            setDiscount(0);
            setDepositPaid('');
            setStudentSearch('');
            setDate(new Date().toISOString().split('T')[0]!);
            setResults(null);
        }
        setOpen(val);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm rounded-xl h-10 px-4">
                            <BookOpen size={16} />
                            <span>بيع / حجز جماعي</span>
                        </Button>
                    )}
                </DialogTrigger>
            )}

            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
                <DialogHeader className="p-5 pb-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                                mode === 'sale' ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600"
                            )}>
                                {mode === 'sale' ? <BookOpen size={20} /> : <BookMarked size={20} />}
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-gray-900">
                                    {mode === 'sale' ? 'تسجيل بيع مذكرات جماعي' : 'تسجيل حجز مذكرات جماعي'}
                                </DialogTitle>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {mode === 'sale' ? 'صرف وبيع المذكرة لطلاب مجموعة محددة فوراً مع خصم المخزون' : 'تسجيل حجز مسبق للمذكرة لطلاب مجموعة محددة مع إمكانية دفع عربون'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div className="flex bg-gray-200/70 p-1 rounded-xl gap-1 mt-3">
                        <button
                            type="button"
                            onClick={() => setMode('sale')}
                            className={cn(
                                'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                                mode === 'sale' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <BookOpen size={14} />
                            بيع فوري (تسليم فوري)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('reservation')}
                            className={cn(
                                'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                                mode === 'reservation' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <BookMarked size={14} />
                            حجز مسبق (تسجيل حجز)
                        </button>
                    </div>
                </DialogHeader>

                {/* ── Results Screen ── */}
                {results ? (
                    <div className="p-6 flex flex-col flex-1 overflow-y-auto space-y-4">
                        <div className="text-center py-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-2">
                                <Check size={24} />
                            </div>
                            <h3 className="text-base font-bold text-gray-900">
                                {mode === 'sale' ? 'تم تسجيل بيع المذكرات بنجاح' : 'تم تسجيل حجز المذكرات بنجاح'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                نجح: <span className="font-bold text-green-600">{results.filter(r => r.status === 'success').length}</span>
                                {results.some(r => r.status === 'error') && (
                                    <> — فشل: <span className="font-bold text-red-600">{results.filter(r => r.status === 'error').length}</span></>
                                )}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-60 border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {results.map((r, i) => (
                                <div key={i} className="flex items-center justify-between p-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        {r.status === 'success' ? (
                                            <Check size={16} className="text-green-600" />
                                        ) : (
                                            <X size={16} className="text-red-600" />
                                        )}
                                        <span className="font-medium text-gray-800">{r.studentName || r.studentId}</span>
                                    </div>
                                    <div className="text-left">
                                        {r.status === 'success' ? (
                                            <span className="font-bold text-gray-900">{r.paidAmount.toLocaleString()} ج</span>
                                        ) : (
                                            <span className="text-xs text-red-500">{r.error}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <Button
                                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-11"
                                onClick={() => handleClose(false)}
                            >
                                إغلاق
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ── Form Screen ── */
                    <div className="flex flex-col flex-1 overflow-y-auto">
                        <div className="p-5 space-y-4 flex-1">
                            {/* Step 1: Select Notebook */}
                            <div className={cn(
                                "p-4 rounded-xl border space-y-3 transition-colors",
                                mode === 'sale' ? "bg-indigo-50/50 border-indigo-100" : "bg-purple-50/50 border-purple-100"
                            )}>
                                <label className={cn(
                                    "text-xs font-bold block",
                                    mode === 'sale' ? "text-indigo-900" : "text-purple-900"
                                )}>
                                    ١. اختر المذكرة
                                </label>
                                <Select value={notebookId} onValueChange={setNotebookId} dir="rtl">
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="اختر المذكرة..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {filteredNotebooks.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-gray-400">لا توجد مذكرات مضافة</div>
                                        ) : (
                                            filteredNotebooks.map(nb => (
                                                <SelectItem key={nb._id} value={nb._id}>
                                                    {nb.name} — {nb.price} ج (المتاح: {nb.stock} نسخة · المحجوز: {nb.reservedCount || 0})
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>

                                {selectedNotebook && (
                                    <div className="flex items-center justify-between text-xs text-gray-700 pt-1 border-t border-gray-200/60">
                                        <span>سعر النسخة: <strong className="text-sm text-gray-900">{selectedNotebook.price} ج</strong></span>
                                        <span>المخزون المتاح: <strong className="text-sm text-indigo-700">{selectedNotebook.stock} نسخة</strong></span>
                                        <span>المحجوز مسبقاً: <strong className="text-sm text-purple-700">{selectedNotebook.reservedCount || 0} نسخة</strong></span>
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700">المرحلة الدراسية</label>
                                    <Select value={stageFilter} onValueChange={setStageFilter} dir="rtl">
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="كل المراحل" />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="">كل المراحل</SelectItem>
                                            {allowedStages.map(s => (
                                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700">المجموعة</label>
                                    <Select value={groupId} onValueChange={setGroupId} dir="rtl">
                                        <SelectTrigger className="w-full bg-white">
                                            <SelectValue placeholder="اختر المجموعة..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {filteredGroups.map(g => (
                                                <SelectItem key={g._id} value={g._id}>{g.name} ({g.gradeLevel})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Step 3: Quantity & Discount / Deposit & Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700">الكمية لكل طالب</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="bg-white"
                                    />
                                </div>

                                {mode === 'sale' ? (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">خصم لكل طالب (ج.م)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={discount || ''}
                                            onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                                            placeholder="0"
                                            className="bg-white"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-700">عربون الحجز لكل طالب (اختياري)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={depositPaid}
                                            onChange={(e) => setDepositPaid(e.target.value ? Math.max(0, parseFloat(e.target.value)) : '')}
                                            placeholder="0 (بدون عربون)"
                                            className="bg-white"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <Calendar size={12} className="text-primary" />
                                        تاريخ المعاملة (اليوم أو سابق)
                                    </label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                            </div>

                            {/* Step 4: Students Selection List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-gray-800">
                                            قائمة الطلاب ({students.length})
                                        </label>
                                        {selectedIds.size > 0 && (
                                            <span className={cn(
                                                "text-[11px] font-bold px-2 py-0.5 rounded-md",
                                                mode === 'sale' ? "text-indigo-600 bg-indigo-50" : "text-purple-600 bg-purple-50"
                                            )}>
                                                محدد: {selectedIds.size}
                                            </span>
                                        )}
                                    </div>
                                    {students.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleAll}
                                            className="h-7 text-xs text-gray-600 hover:text-indigo-600 gap-1.5"
                                        >
                                            {allFilteredSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                                            {allFilteredSelected ? 'إلغاء تحديد المعروض' : 'تحديد المعروض'}
                                        </Button>
                                    )}
                                </div>

                                {students.length > 5 && (
                                    <div className="relative">
                                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="بحث باسم الطالب..."
                                            value={studentSearch}
                                            onChange={(e) => setStudentSearch(e.target.value)}
                                            className="pr-9 h-9 text-xs bg-white"
                                        />
                                    </div>
                                )}

                                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-50 bg-white">
                                    {!groupId ? (
                                        <div className="p-8 text-center text-xs text-gray-400">
                                            اختر المجموعة لعرض قائمة الطلاب
                                        </div>
                                    ) : studentsLoading ? (
                                        <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> جاري تحميل الطلاب...
                                        </div>
                                    ) : filteredStudents.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">
                                            لا يوجد طلاب يطابقون البحث
                                        </div>
                                    ) : (
                                        filteredStudents.map((s) => {
                                            const isSelected = selectedIds.has(s._id);
                                            return (
                                                <div
                                                    key={s._id}
                                                    onClick={() => toggleStudent(s._id)}
                                                    className={cn(
                                                        "px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs select-none",
                                                        isSelected ? (mode === 'sale' ? "bg-indigo-50/40 hover:bg-indigo-50/70" : "bg-purple-50/40 hover:bg-purple-50/70") : "hover:bg-gray-50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}} // Handled by div click
                                                            className={cn(
                                                                "rounded border-gray-300 h-4 w-4 pointer-events-none",
                                                                mode === 'sale' ? "text-indigo-600 focus:ring-indigo-600" : "text-purple-600 focus:ring-purple-600"
                                                            )}
                                                        />
                                                        <span className={cn("font-medium", isSelected ? (mode === 'sale' ? "text-indigo-900 font-bold" : "text-purple-900 font-bold") : "text-gray-700")}>
                                                            {s.studentName}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-gray-400 font-mono">
                                                        {s.gradeLevel}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Stock Warning Alert if insufficient in Sale mode */}
                            {isStockInsufficient && selectedNotebook && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                                    <span>
                                        تحذير: الكمية المطلوبة (<strong>{totalRequiredStock}</strong> نسخة) تتجاوز المخزون المتاح في المخزن (<strong>{selectedNotebook.stock}</strong> نسخة).
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer Summary & Action */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">
                                    المحدد: <strong className="text-gray-900">{selectedIds.size}</strong> طالب
                                </p>
                                <p className={cn(
                                    "text-xs font-bold mt-0.5",
                                    mode === 'sale' ? "text-indigo-700" : "text-purple-700"
                                )}>
                                    {mode === 'sale' ? `إجمالي المبيعات: ${totalExpectedAmount.toLocaleString()} ج.م` : `إجمالي العربون المحصل: ${totalExpectedAmount.toLocaleString()} ج.م`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleClose(false)}
                                    disabled={isPending}
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isPending || selectedIds.size === 0 || !notebookId || isStockInsufficient}
                                    className={cn(
                                        "text-white font-bold gap-2",
                                        mode === 'sale' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-purple-600 hover:bg-purple-700"
                                    )}
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" /> جاري التنفيذ...
                                        </>
                                    ) : (
                                        mode === 'sale' ? `تسجيل البيع (${selectedIds.size})` : `تسجيل الحجز (${selectedIds.size})`
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

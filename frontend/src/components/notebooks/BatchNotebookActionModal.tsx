'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { fetchNotebooks } from '@/lib/api/notebooks';
import { recordBatchNotebookSale, recordBatchNotebookReservation } from '@/lib/api/payments';
import type { INotebook } from '@/types/notebook.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import {
    BookOpen,
    BookMarked,
    Check,
    X,
    Loader2,
    CheckSquare,
    Square,
    AlertTriangle,
    Search,
    Calendar,
    Layers,
    Plus,
    Minus
} from 'lucide-react';
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

interface SelectedNotebookConfig {
    notebookId: string;
    notebookName: string;
    price: number;
    stock: number;
    reservedCount: number;
    quantity: number;
    discount: number;
    deposit: number;
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

    // Mode: 'sale' (بيع فوري) or 'reservation' (حجز مسبق)
    const [mode, setMode] = useState<'sale' | 'reservation'>('sale');
    const [stageFilter, setStageFilter] = useState('');
    const [groupId, setGroupId] = useState('');
    const [notebookSearch, setNotebookSearch] = useState('');
    const [selectedNotebookConfigs, setSelectedNotebookConfigs] = useState<Map<string, SelectedNotebookConfig>>(new Map());
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [studentSearch, setStudentSearch] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
    const [results, setResults] = useState<{
        notebookName: string;
        successCount: number;
        failCount: number;
        totalPaid: number;
    }[] | null>(null);

    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);

    const allowedStages = STAGE_OPTIONS.filter(stage =>
        allowedGrades.some(g => g.includes(STAGE_TO_GRADE_PREFIX[stage.value]!))
    );

    // Reset group & students when stage changes
    useEffect(() => {
        setGroupId('');
        setSelectedStudentIds(new Set());
    }, [stageFilter]);

    // Reset students when group changes
    useEffect(() => {
        setSelectedStudentIds(new Set());
    }, [groupId]);

    // Groups list
    const { data: groupsData } = useQuery({
        queryKey: [...QK.groups.forBulkSub, stageFilter],
        queryFn: () => fetchGroups({ limit: 200 }),
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const allGroups = (groupsData as any)?.data ?? [];

    const filteredGroups = useMemo(() => {
        if (!stageFilter) return allGroups;
        const prefix = STAGE_TO_GRADE_PREFIX[stageFilter];
        return allGroups.filter((g: any) => g.gradeLevel?.includes(prefix!));
    }, [allGroups, stageFilter]);

    // Notebooks list with bulletproof normalization
    const { data: notebooksData, isLoading: notebooksLoading } = useQuery({
        queryKey: ['notebooks', 'all-for-batch'],
        queryFn: () => fetchNotebooks({ limit: 200 }),
        enabled: open,
    });

    const allNotebooks: INotebook[] = useMemo(() => {
        const raw = notebooksData as any;
        if (Array.isArray(raw?.data?.data)) return raw.data.data;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw)) return raw;
        return [];
    }, [notebooksData]);

    // Filter notebooks by grade level if stage is selected
    const filteredNotebooks = useMemo(() => {
        let list = allNotebooks;
        if (stageFilter) {
            const prefix = STAGE_TO_GRADE_PREFIX[stageFilter];
            list = list.filter(nb => !nb.gradeLevel || nb.gradeLevel.includes(prefix!));
        }
        if (notebookSearch.trim()) {
            list = list.filter(nb => nb.name.toLowerCase().includes(notebookSearch.toLowerCase()));
        }
        return list;
    }, [allNotebooks, stageFilter, notebookSearch]);

    // Students of selected group
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: QK.payments.bulkSubStudents(groupId),
        queryFn: () => fetchStudents({ groupId, limit: 300, isActive: true }),
        enabled: !!groupId,
    });
    const students: Student[] = (studentsData as any)?.data ?? [];

    // Auto-select all students when group loads
    useEffect(() => {
        if (students.length > 0) {
            setSelectedStudentIds(new Set(students.map(s => s._id)));
        }
    }, [students.length, groupId]);

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        return students.filter(s => s.studentName.toLowerCase().includes(studentSearch.toLowerCase()));
    }, [students, studentSearch]);

    // Toggle Notebook Selection
    const toggleNotebook = (nb: INotebook) => {
        setSelectedNotebookConfigs(prev => {
            const next = new Map(prev);
            if (next.has(nb._id)) {
                next.delete(nb._id);
            } else {
                next.set(nb._id, {
                    notebookId: nb._id,
                    notebookName: nb.name,
                    price: nb.price,
                    stock: nb.stock,
                    reservedCount: nb.reservedCount || 0,
                    quantity: 1,
                    discount: 0,
                    deposit: 0,
                });
            }
            return next;
        });
    };

    const updateNotebookConfig = (id: string, updates: Partial<SelectedNotebookConfig>) => {
        setSelectedNotebookConfigs(prev => {
            const next = new Map(prev);
            const current = next.get(id);
            if (current) {
                next.set(id, { ...current, ...updates });
            }
            return next;
        });
    };

    // Toggle Student Selection
    const toggleStudent = (id: string) => {
        setSelectedStudentIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allFilteredStudentsSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s._id));
    const toggleAllStudents = () => {
        if (allFilteredStudentsSelected) {
            setSelectedStudentIds(prev => {
                const next = new Set(prev);
                filteredStudents.forEach(s => next.delete(s._id));
                return next;
            });
        } else {
            setSelectedStudentIds(prev => {
                const next = new Set(prev);
                filteredStudents.forEach(s => next.add(s._id));
                return next;
            });
        }
    };

    // Calculations & Validation
    const selectedNotebooksList = Array.from(selectedNotebookConfigs.values());

    const stockDeficits = useMemo(() => {
        if (mode !== 'sale') return [];
        const studentCount = selectedStudentIds.size;
        return selectedNotebooksList.filter(nb => {
            const required = nb.quantity * studentCount;
            return required > nb.stock;
        });
    }, [mode, selectedNotebooksList, selectedStudentIds.size]);

    const isStockInsufficient = stockDeficits.length > 0;

    const totalCostPerStudent = selectedNotebooksList.reduce((sum, nb) => {
        if (mode === 'sale') {
            const price = Math.max(0, (nb.price * nb.quantity) - nb.discount);
            return sum + price;
        } else {
            return sum + (nb.deposit > 0 ? nb.deposit : 0);
        }
    }, 0);

    const totalGrandExpected = totalCostPerStudent * selectedStudentIds.size;

    // Mutation
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecute = async () => {
        if (selectedNotebooksList.length === 0) {
            toast.error('يرجى اختيار مذكرة واحدة على الأقل');
            return;
        }
        if (selectedStudentIds.size === 0) {
            toast.error('يرجى اختيار طالب واحد على الأقل');
            return;
        }
        if (isStockInsufficient) {
            toast.error('الكمية المطلوبة تتجاوز المخزون لبعض المذكرات المحددة');
            return;
        }

        setIsExecuting(true);
        const studentIdsArray = Array.from(selectedStudentIds);
        const batchResults: {
            notebookName: string;
            successCount: number;
            failCount: number;
            totalPaid: number;
        }[] = [];

        try {
            for (const nb of selectedNotebooksList) {
                if (mode === 'sale') {
                    const res = await recordBatchNotebookSale({
                        notebookId: nb.notebookId,
                        studentIds: studentIdsArray,
                        quantity: nb.quantity,
                        discountAmount: nb.discount > 0 ? nb.discount : undefined,
                        date,
                    });
                    batchResults.push({
                        notebookName: nb.notebookName,
                        successCount: res.successCount,
                        failCount: res.failCount,
                        totalPaid: res.totalPaid,
                    });
                } else {
                    const res = await recordBatchNotebookReservation({
                        notebookId: nb.notebookId,
                        studentIds: studentIdsArray,
                        quantity: nb.quantity,
                        paidAmount: nb.deposit > 0 ? nb.deposit : undefined,
                        date,
                    });
                    batchResults.push({
                        notebookName: nb.notebookName,
                        successCount: res.successCount,
                        failCount: res.failCount,
                        totalPaid: res.totalPaid,
                    });
                }
            }

            setResults(batchResults);
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
            queryClient.removeQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });

            const totalSuccess = batchResults.reduce((s, r) => s + r.successCount, 0);
            const totalPaid = batchResults.reduce((s, r) => s + r.totalPaid, 0);
            toast.success(`تم تسجيل العملية بنجاح — إجمالي: ${totalPaid.toLocaleString()} ج`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء تنفيذ العملية');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleClose = (val: boolean) => {
        if (!val && results) {
            setStageFilter('');
            setGroupId('');
            setSelectedNotebookConfigs(new Map());
            setSelectedStudentIds(new Set());
            setStudentSearch('');
            setNotebookSearch('');
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
                            <Layers size={16} />
                            <span>بيع / حجز مذكرات جماعي</span>
                        </Button>
                    )}
                </DialogTrigger>
            )}

            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
                <DialogHeader className="p-5 pb-4 border-b border-gray-100 bg-gray-50/70">
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
                                    {mode === 'sale' ? 'بيع مذكرات متعددة للطلاب' : 'حجز مذكرات متعددة للطلاب'}
                                </DialogTitle>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {mode === 'sale' ? 'اختيار مذكرة أو أكثر وصرفها لطلاب مجموعة محددة دفعة واحدة' : 'تسجيل حجز مسبق لمذكرة أو أكثر لطلاب مجموعة محددة مع إمكانية تحصيل عربون'}
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
                                'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                                mode === 'sale' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <BookOpen size={14} />
                            بيع وتسليم فوري
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('reservation')}
                            className={cn(
                                'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                                mode === 'reservation' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            )}
                        >
                            <BookMarked size={14} />
                            حجز مسبق (Pre-order)
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
                                إجمالي المبالغ المسجلة في الخزينة:{' '}
                                <span className="font-bold text-green-600">
                                    {results.reduce((s, r) => s + r.totalPaid, 0).toLocaleString()} ج.م
                                </span>
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-60 border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {results.map((r, i) => (
                                <div key={i} className="flex items-center justify-between p-3.5 text-sm">
                                    <div className="flex items-center gap-2.5">
                                        <BookOpen size={16} className="text-indigo-600 shrink-0" />
                                        <span className="font-bold text-gray-800">{r.notebookName}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-left">
                                        <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md">
                                            نجح: {r.successCount}
                                        </span>
                                        {r.failCount > 0 && (
                                            <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                                                فشل: {r.failCount}
                                            </span>
                                        )}
                                        <span className="font-bold text-gray-900 font-mono">
                                            {r.totalPaid.toLocaleString()} ج
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <Button
                                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-11 font-bold"
                                onClick={() => handleClose(false)}
                            >
                                إغلاق
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ── Form Screen ── */
                    <div className="flex flex-col flex-1 overflow-y-auto">
                        <div className="p-5 space-y-5 flex-1">
                            {/* Step 1: Select Multiple Notebooks */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-600" />
                                        ١. اختر المذكرات المطلوبة ({allNotebooks.length})
                                    </label>
                                    {selectedNotebooksList.length > 0 && (
                                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                                            محدد: {selectedNotebooksList.length} مذكرة
                                        </span>
                                    )}
                                </div>

                                {/* Notebook Search Filter */}
                                {allNotebooks.length > 4 && (
                                    <div className="relative">
                                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="بحث باسم المذكرة..."
                                            value={notebookSearch}
                                            onChange={(e) => setNotebookSearch(e.target.value)}
                                            className="pr-9 h-9 text-xs bg-white"
                                        />
                                    </div>
                                )}

                                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-50 bg-white">
                                    {notebooksLoading ? (
                                        <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> جاري تحميل المذكرات...
                                        </div>
                                    ) : filteredNotebooks.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-gray-400">
                                            لا توجد مذكرات مضافة
                                        </div>
                                    ) : (
                                        filteredNotebooks.map((nb) => {
                                            const isSelected = selectedNotebookConfigs.has(nb._id);
                                            const config = selectedNotebookConfigs.get(nb._id);
                                            return (
                                                <div
                                                    key={nb._id}
                                                    className={cn(
                                                        "p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors text-xs",
                                                        isSelected ? "bg-indigo-50/40" : "hover:bg-gray-50/60"
                                                    )}
                                                >
                                                    <div
                                                        onClick={() => toggleNotebook(nb)}
                                                        className="flex items-center gap-2.5 cursor-pointer flex-1 select-none"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4 pointer-events-none"
                                                        />
                                                        <div>
                                                            <p className={cn("font-bold", isSelected ? "text-indigo-950" : "text-gray-800")}>
                                                                {nb.name}
                                                            </p>
                                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                                السعر: <strong className="text-gray-800">{nb.price} ج</strong> · المتاح بالمخزن: <strong className="text-indigo-600">{nb.stock}</strong> · المحجوز: <strong className="text-purple-600">{nb.reservedCount || 0}</strong>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Config inputs for selected notebook */}
                                                    {isSelected && config && (
                                                        <div className="flex items-center gap-2 shrink-0 bg-white p-1.5 rounded-lg border border-indigo-100 shadow-sm animate-in fade-in">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-gray-500">الكمية:</span>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={config.quantity}
                                                                    onChange={(e) => updateNotebookConfig(nb._id, {
                                                                        quantity: Math.max(1, parseInt(e.target.value) || 1)
                                                                    })}
                                                                    className="w-14 h-7 text-xs text-center p-1 font-bold"
                                                                />
                                                            </div>

                                                            {mode === 'sale' ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-gray-500">خصم:</span>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        placeholder="0"
                                                                        value={config.discount || ''}
                                                                        onChange={(e) => updateNotebookConfig(nb._id, {
                                                                            discount: Math.max(0, parseFloat(e.target.value) || 0)
                                                                        })}
                                                                        className="w-14 h-7 text-xs text-center p-1"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-gray-500">عربون:</span>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        placeholder="0"
                                                                        value={config.deposit || ''}
                                                                        onChange={(e) => updateNotebookConfig(nb._id, {
                                                                            deposit: Math.max(0, parseFloat(e.target.value) || 0)
                                                                        })}
                                                                        className="w-16 h-7 text-xs text-center p-1"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Stage & Group Selection & Transaction Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                            {filteredGroups.map((g: any) => (
                                                <SelectItem key={g._id} value={g._id}>{g.name} ({g.gradeLevel})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <Calendar size={12} className="text-primary" />
                                        تاريخ المعاملة
                                    </label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="bg-white text-xs h-10"
                                    />
                                </div>
                            </div>

                            {/* Step 3: Students Selection List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-gray-800">
                                            قائمة الطلاب ({students.length})
                                        </label>
                                        {selectedStudentIds.size > 0 && (
                                            <span className={cn(
                                                "text-[11px] font-bold px-2 py-0.5 rounded-md",
                                                mode === 'sale' ? "text-indigo-600 bg-indigo-50" : "text-purple-600 bg-purple-50"
                                            )}>
                                                محدد: {selectedStudentIds.size}
                                            </span>
                                        )}
                                    </div>
                                    {students.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleAllStudents}
                                            className="h-7 text-xs text-gray-600 hover:text-indigo-600 gap-1.5"
                                        >
                                            {allFilteredStudentsSelected ? <Square size={14} /> : <CheckSquare size={14} />}
                                            {allFilteredStudentsSelected ? 'إلغاء تحديد المعروض' : 'تحديد المعروض'}
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

                                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50 bg-white">
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
                                            const isSelected = selectedStudentIds.has(s._id);
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
                                                            onChange={() => {}}
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
                            {isStockInsufficient && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="font-bold">المخزون غير كافٍ لبعض المذكرات المحددة:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                                            {stockDeficits.map(nb => (
                                                <li key={nb.notebookId}>
                                                    <strong>{nb.notebookName}</strong>: مطلوب {nb.quantity * selectedStudentIds.size} نسخة (المتاح: {nb.stock} نسخة).
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Summary & Action */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">
                                    المحدد: <strong className="text-gray-900">{selectedStudentIds.size}</strong> طالب · <strong className="text-gray-900">{selectedNotebooksList.length}</strong> مذكرات
                                </p>
                                <p className={cn(
                                    "text-xs font-bold mt-0.5",
                                    mode === 'sale' ? "text-indigo-700" : "text-purple-700"
                                )}>
                                    {mode === 'sale' ? `إجمالي المبيعات: ${totalGrandExpected.toLocaleString()} ج.م` : `إجمالي العربون المحصل: ${totalGrandExpected.toLocaleString()} ج.م`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleClose(false)}
                                    disabled={isExecuting}
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    onClick={handleExecute}
                                    disabled={isExecuting || selectedStudentIds.size === 0 || selectedNotebooksList.length === 0 || isStockInsufficient}
                                    className={cn(
                                        "text-white font-bold gap-2",
                                        mode === 'sale' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-purple-600 hover:bg-purple-700"
                                    )}
                                >
                                    {isExecuting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" /> جاري التنفيذ...
                                        </>
                                    ) : (
                                        mode === 'sale'
                                            ? `تسجيل بيع (${selectedNotebooksList.length} مذكرات لـ ${selectedStudentIds.size} طالب)`
                                            : `تسجيل حجز (${selectedNotebooksList.length} مذكرات لـ ${selectedStudentIds.size} طالب)`
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

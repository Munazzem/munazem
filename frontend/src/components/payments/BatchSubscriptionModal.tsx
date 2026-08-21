'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { recordBatchSubscription, type IBatchSubscriptionResult, getPriceSettings } from '@/lib/api/payments';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Users, Check, X, Loader2, CheckSquare, Square, Printer, CreditCard } from 'lucide-react';
import { QK } from '@/lib/query-keys';
import { generateBatchReceiptsHtml } from '@/lib/utils/receiptHtml';
import { printHtmlContent } from '@/lib/utils/print';
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
    hasActiveSubscription?: boolean;
}

interface BatchSubscriptionModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
}

export function BatchSubscriptionModal({
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    trigger,
}: BatchSubscriptionModalProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (v: boolean) => {
        if (controlledOnOpenChange) controlledOnOpenChange(v);
        else setInternalOpen(v);
    };

    const [stageFilter, setStageFilter] = useState('');
    const [groupId, setGroupId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discount, setDiscount] = useState(0);
    const [isCustomQuota, setIsCustomQuota] = useState(false);
    const [customSessionsQuota, setCustomSessionsQuota] = useState('4');
    const [customAmount, setCustomAmount] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
    const [results, setResults] = useState<IBatchSubscriptionResult[] | null>(null);

    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);

    // Derive which stages are available for this teacher
    const allowedStages = STAGE_OPTIONS.filter(stage =>
        allowedGrades.some(g => g.includes(STAGE_TO_GRADE_PREFIX[stage.value]!))
    );

    // Reset when stage changes
    useEffect(() => {
        setGroupId('');
        setSelectedIds(new Set());
    }, [stageFilter]);

    // Reset students when group changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [groupId]);

    // Groups list
    const { data: groupsData, isLoading: groupsLoading } = useQuery({
        queryKey: [...QK.groups.forBulkSub, stageFilter],
        queryFn: () => fetchGroups({ limit: 200 }),
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const allGroups = groupsData?.data ?? [];

    // Filter groups by selected stage
    const filteredGroups = useMemo(() => {
        if (!stageFilter) return allGroups;
        const prefix = STAGE_TO_GRADE_PREFIX[stageFilter];
        return allGroups.filter(g => g.gradeLevel.includes(prefix!));
    }, [allGroups, stageFilter]);

    // Students of selected group
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: QK.payments.bulkSubStudents(groupId),
        queryFn: () => fetchStudents({ groupId, limit: 300, isActive: true }),
        enabled: !!groupId,
    });
    const students: Student[] = studentsData?.data ?? [];

    // Auto-select students without active subscription when students load
    useEffect(() => {
        if (students.length > 0) {
            const unsubscribed = students
                .filter(s => !s.hasActiveSubscription)
                .map(s => s._id);
            setSelectedIds(new Set(unsubscribed));
        }
    }, [students.length, groupId]); // eslint-disable-line

    // Price settings for center discounts
    const { data: settings } = useQuery({
        queryKey: QK.payments.priceSettings,
        queryFn: getPriceSettings,
        enabled: open,
    });
    const centerDiscounts = settings?.centerDiscounts || [];

    const mutation = useMutation({
        mutationFn: recordBatchSubscription,
        onSuccess: (data) => {
            setResults(data.results);
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.bulkSubStudents(groupId) });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            if (data.failCount === 0) {
                toast.success(`تم تسجيل ${data.successCount} اشتراك بنجاح — إجمالي: ${data.totalPaid.toLocaleString()} ج`);
            } else {
                toast.warning(`${data.successCount} نجح — ${data.failCount} فشل`);
            }
        },
        onError: () => {},
    });

    const toggleStudent = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allSelected = students.length > 0 && selectedIds.size === students.length;
    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(students.map((s) => s._id)));
        }
    };

    const handleSubmit = () => {
        if (selectedIds.size === 0) {
            toast.error('اختر طالباً واحداً على الأقل');
            return;
        }
        mutation.mutate({
            studentIds: Array.from(selectedIds),
            discountAmount: discount > 0 ? discount : undefined,
            customSessionsQuota: isCustomQuota && customSessionsQuota ? parseInt(customSessionsQuota) : undefined,
            customAmount: customAmount ? parseFloat(customAmount) : undefined,
            date,
        });
    };

    const handleClose = (val: boolean) => {
        // Only reset the form if it was closed from the success results screen.
        // If it was closed by mistake while filling data, preserve the state.
        if (!val && results) {
            setStageFilter('');
            setGroupId('');
            setSelectedIds(new Set());
            setDiscount(0);
            setIsCustomQuota(false);
            setCustomSessionsQuota('4');
            setCustomAmount('');
            setDate(new Date().toISOString().split('T')[0]!);
            setResults(null);
        }
        setOpen(val);
    };

    const paidCount   = students.filter(s => s.hasActiveSubscription).length;
    const unpaidCount = students.length - paidCount;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm rounded-xl h-10 px-4">
                            <Users size={16} />
                            <span>دفع اشتراك متعدد</span>
                        </Button>
                    )}
                </DialogTrigger>
            )}

            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                className="sm:max-w-[640px] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl shadow-xl border border-gray-100"
                dir="rtl"
            >
                {/* Fixed Header */}
                <DialogHeader className="p-5 pb-4 border-b border-gray-100 shrink-0">
                    <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <span>دفع اشتراك متعدد للطلاب</span>
                            <p className="text-xs text-gray-400 font-normal mt-0.5">تسجيل اشتراكات الشهر لمجموعة من الطلاب دفعة واحدة</p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {results ? (
                    /* ── Results screen ── */
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                                    <p className="text-2xl font-black text-emerald-700">{results.filter(r => r.status === 'success').length}</p>
                                    <p className="text-xs text-emerald-600 font-medium mt-0.5">تم بنجاح</p>
                                </div>
                                <div className="bg-red-50/70 border border-red-100 rounded-xl p-3">
                                    <p className="text-2xl font-black text-red-600">{results.filter(r => r.status === 'error').length}</p>
                                    <p className="text-xs text-red-500 font-medium mt-0.5">فشل</p>
                                </div>
                                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3">
                                    <p className="text-xl font-black text-blue-700">
                                        {results.filter(r => r.status === 'success').reduce((s, r) => s + r.paidAmount, 0).toLocaleString('ar-EG')}
                                    </p>
                                    <p className="text-xs text-blue-600 font-medium mt-0.5">إجمالي المدفوع (ج)</p>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 bg-gray-50/30 p-1">
                                {results.map((r) => (
                                    <div key={r.studentId} className={cn(
                                        "flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors",
                                        r.status === 'success' ? "bg-white" : "bg-red-50/50"
                                    )}>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                                                r.status === 'success' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                                            )}>
                                                {r.status === 'success' ? <Check size={13} /> : <X size={13} />}
                                            </div>
                                            <span className="font-semibold text-gray-800 truncate">{r.studentName || r.studentId}</span>
                                        </div>
                                        {r.status === 'success' ? (
                                            <span className="text-emerald-700 font-black text-sm shrink-0">{r.paidAmount.toLocaleString('ar-EG')} ج</span>
                                        ) : (
                                            <span className="text-red-500 text-xs shrink-0">{r.error}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Results Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setResults(null); setSelectedIds(new Set()); }}
                                className="text-xs font-semibold rounded-xl"
                            >
                                تسجيل اشتراكات أخرى
                            </Button>
                            <div className="flex items-center gap-2">
                                {results.some(r => r.status === 'success') && (
                                    <Button
                                        size="sm"
                                        className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                                        onClick={() => {
                                            const successfulReceipts = results.filter(r => r.status === 'success').map(r => ({
                                                teacherName: user?.name || 'السنتر',
                                                studentName: r.studentName || r.studentId,
                                                amount: r.paidAmount,
                                                description: 'اشتراك شهر',
                                                date: new Date().toISOString(),
                                            }));
                                            printHtmlContent(generateBatchReceiptsHtml(successfulReceipts));
                                        }}
                                    >
                                        <Printer size={15} />
                                        طباعة الوصلات
                                    </Button>
                                )}
                                <Button size="sm" onClick={() => handleClose(false)} className="text-xs font-semibold rounded-xl">
                                    إغلاق
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Selection screen ── */
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            
                            {/* Step 1 & 2: Stage & Group Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                        المرحلة الدراسية
                                    </label>
                                    <Select
                                        value={stageFilter}
                                        onValueChange={setStageFilter}
                                        dir="rtl"
                                    >
                                        <SelectTrigger className="h-10 bg-gray-50/70 border-gray-200 text-sm rounded-xl">
                                            <SelectValue placeholder="اختر المرحلة..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {allowedStages.map(s => (
                                                <SelectItem key={s.value} value={s.value}>
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                        المجموعة
                                    </label>
                                    {groupsLoading ? (
                                        <div className="h-10 flex items-center gap-2 px-3 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري تحميل المجموعات...
                                        </div>
                                    ) : (
                                        <Select
                                            value={groupId}
                                            onValueChange={v => setGroupId(v)}
                                            disabled={!stageFilter || filteredGroups.length === 0}
                                            dir="rtl"
                                        >
                                            <SelectTrigger className="h-10 bg-gray-50/70 border-gray-200 text-sm rounded-xl disabled:opacity-50">
                                                <SelectValue placeholder={!stageFilter ? "اختر المرحلة أولاً" : filteredGroups.length === 0 ? "لا توجد مجموعات" : "اختر المجموعة..."} />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                {filteredGroups.map(g => (
                                                    <SelectItem key={g._id} value={g._id}>
                                                        {g.name}
                                                        <span className="text-gray-400 text-xs mr-2">({g.gradeLevel})</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Students list */}
                            {groupId && (
                                <div className="bg-gray-50/40 border border-gray-200/80 rounded-2xl p-3.5 space-y-2.5">
                                    {/* List Header */}
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <Users size={15} className="text-emerald-600" />
                                            <span className="text-xs font-bold text-gray-800">
                                                الطلاب في المجموعة
                                            </span>
                                            {students.length > 0 && (
                                                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                                    {students.length} طالب ({paidCount} دافع — {unpaidCount} غير دافع)
                                                </span>
                                            )}
                                        </div>
                                        {students.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={toggleAll}
                                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors"
                                            >
                                                {allSelected
                                                    ? <><CheckSquare size={15} className="text-emerald-600" /> إلغاء تحديد الكل</>
                                                    : <><Square size={15} /> تحديد الكل</>}
                                            </button>
                                        )}
                                    </div>

                                    {/* Student rows */}
                                    <div className="max-h-48 overflow-y-auto bg-white border border-gray-200/60 rounded-xl divide-y divide-gray-50 shadow-inner">
                                        {studentsLoading ? (
                                            <div className="flex justify-center items-center h-28 text-gray-400">
                                                <Loader2 className="animate-spin h-5 w-5" />
                                            </div>
                                        ) : students.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-gray-400">لا يوجد طلاب نشطين في هذه المجموعة</div>
                                        ) : (
                                            students.map((s) => {
                                                const checked = selectedIds.has(s._id);
                                                const hasSub  = s.hasActiveSubscription;
                                                return (
                                                    <label
                                                        key={s._id}
                                                        className={cn(
                                                            'w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors',
                                                            hasSub
                                                                ? 'bg-gray-50/50 cursor-default opacity-60'
                                                                : cn('cursor-pointer', checked ? 'bg-emerald-50/60 font-semibold' : 'hover:bg-gray-50/60')
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleStudent(s._id)}
                                                                disabled={!!hasSub}
                                                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                            <span className={cn(
                                                                'truncate',
                                                                hasSub ? 'text-gray-400' : 'text-gray-800'
                                                            )}>
                                                                {s.studentName}
                                                            </span>
                                                        </div>
                                                        {hasSub ? (
                                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                                                                <Check size={10} />
                                                                دافع ✓
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-medium shrink-0">
                                                                لم يدفع
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Selection badge info */}
                                    {students.length > 0 && (
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-0.5">
                                            <span>تم تحديد: <strong className="text-emerald-700">{selectedIds.size}</strong> طالب للدفع</span>
                                            <span>متبقي بدون دفع: <strong className="text-red-600">{unpaidCount}</strong></span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Row: Date & Discount Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                        تاريخ تسجيل المعاملة
                                    </label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="h-10 bg-gray-50/70 border-gray-200 text-sm rounded-xl"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                        خصم إضافي (ج) <span className="text-gray-400 font-normal">— اختياري</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {centerDiscounts.length > 0 && (
                                            <Select
                                                onValueChange={(val) => {
                                                    const center = centerDiscounts.find(c => c.centerName === val);
                                                    if (center) setDiscount(center.discountAmount);
                                                }}
                                            >
                                                <SelectTrigger className="h-10 flex-1 bg-gray-50/70 border-gray-200 text-xs rounded-xl">
                                                    <SelectValue placeholder="خصم سنتر..." />
                                                </SelectTrigger>
                                                <SelectContent dir="rtl">
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
                                            min={0}
                                            placeholder="0"
                                            value={discount === 0 ? '' : discount}
                                            onChange={(e) => setDiscount(Number(e.target.value))}
                                            className="h-10 w-24 bg-gray-50/70 border-gray-200 text-sm rounded-xl text-center font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Custom Quota Card */}
                            <div className="bg-gray-50/60 border border-gray-200/70 rounded-2xl p-3.5 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isCustomQuotaBatch"
                                        checked={isCustomQuota}
                                        onChange={(e) => setIsCustomQuota(e.target.checked)}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 h-4 w-4 cursor-pointer"
                                    />
                                    <label htmlFor="isCustomQuotaBatch" className="text-xs font-bold text-gray-700 cursor-pointer">
                                        تخصيص عدد الحصص والمبلغ (اشتراك نصف شهر مثلاً)
                                    </label>
                                </div>
                                {isCustomQuota && (
                                    <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-1">
                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">عدد الحصص المقررة</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={customSessionsQuota}
                                                onChange={(e) => setCustomSessionsQuota(e.target.value)}
                                                className="h-9 text-xs bg-white rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block">مبلغ الاشتراك (للطالب)</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="السعر المخصص (اختياري)"
                                                value={customAmount}
                                                onChange={(e) => setCustomAmount(e.target.value)}
                                                className="h-9 text-xs bg-white rounded-xl"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Fixed Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2.5 shrink-0">
                            <Button
                                variant="outline"
                                onClick={() => handleClose(false)}
                                disabled={mutation.isPending}
                                className="h-10 text-xs font-semibold rounded-xl"
                            >
                                إلغاء
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={mutation.isPending || selectedIds.size === 0}
                                className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl gap-2 shadow-sm"
                            >
                                {mutation.isPending ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</>
                                ) : (
                                    <>
                                        <Check size={15} />
                                        تسجيل اشتراك {selectedIds.size > 0 ? `(${selectedIds.size} طالب)` : ''}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

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

export function BatchSubscriptionModal() {
    const [open, setOpen] = useState(false);
    const [stageFilter, setStageFilter] = useState('');
    const [groupId, setGroupId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discount, setDiscount] = useState(0);
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
        staleTime: 2 * 60 * 1000,
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
        });
    };

    const handleClose = (val: boolean) => {
        setOpen(val);
        if (!val) {
            setStageFilter('');
            setGroupId('');
            setSelectedIds(new Set());
            setDiscount(0);
            setResults(null);
        }
    };

    const paidCount   = students.filter(s => s.hasActiveSubscription).length;
    const unpaidCount = students.length - paidCount;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <Users size={16} />
                    دفع اشتراك متعدد
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[680px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-4 flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                        دفع اشتراك لأكثر من طالب
                    </DialogTitle>
                </DialogHeader>

                {results ? (
                    /* ── Results screen ── */
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-green-50 rounded-xl p-3">
                                <p className="text-2xl font-bold text-green-700">{results.filter(r => r.status === 'success').length}</p>
                                <p className="text-xs text-green-600 mt-1">نجح</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-3">
                                <p className="text-2xl font-bold text-red-600">{results.filter(r => r.status === 'error').length}</p>
                                <p className="text-xs text-red-500 mt-1">فشل</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3">
                                <p className="text-2xl font-bold text-blue-700">
                                    {results.filter(r => r.status === 'success').reduce((s, r) => s + r.paidAmount, 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-blue-600 mt-1">إجمالي (ج)</p>
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1.5">
                            {results.map((r) => (
                                <div key={r.studentId} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${r.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <div className="flex items-center gap-2">
                                        {r.status === 'success'
                                            ? <Check size={14} className="text-green-600 shrink-0" />
                                            : <X size={14} className="text-red-500 shrink-0" />}
                                        <span className="font-medium text-gray-800">{r.studentName || r.studentId}</span>
                                    </div>
                                    {r.status === 'success'
                                        ? <span className="text-green-700 font-bold">{r.paidAmount.toLocaleString()} ج</span>
                                        : <span className="text-red-500 text-xs">{r.error}</span>}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t">
                            <Button variant="outline" onClick={() => { setResults(null); setSelectedIds(new Set()); }}>
                                دفع اشتراكات أخرى
                            </Button>
                            {results.some(r => r.status === 'success') && (
                                <Button
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
                                    <Printer size={16} />
                                    طباعة الوصلات
                                </Button>
                            )}
                            <Button onClick={() => handleClose(false)}>إغلاق</Button>
                        </div>
                    </div>
                ) : (
                    /* ── Selection screen ── */
                    <div className="space-y-4">

                        {/* Step 1: Stage filter */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                المرحلة الدراسية
                            </label>
                            <Select
                                value={stageFilter}
                                onValueChange={setStageFilter}
                                dir="rtl"
                            >
                                <SelectTrigger className="h-10 bg-gray-50 border-gray-200 text-gray-700">
                                    <SelectValue placeholder="اختر المرحلة أولاً..." />
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

                        {/* Step 2: Group selector (filtered by stage) */}
                        {stageFilter && (
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                    المجموعة
                                </label>
                                {groupsLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المجموعات...
                                    </div>
                                ) : filteredGroups.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-2">لا توجد مجموعات لهذه المرحلة</p>
                                ) : (
                                    <Select
                                        value={groupId}
                                        onValueChange={v => setGroupId(v)}
                                        dir="rtl"
                                    >
                                        <SelectTrigger className="h-10 bg-gray-50 border-gray-200 text-gray-700">
                                            <SelectValue placeholder="اختر مجموعة..." />
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
                        )}

                        {/* Step 3: Student list */}
                        {groupId && (
                            <div>
                                {/* Header row */}
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Users size={15} className="text-primary" />
                                        الطلاب
                                        {students.length > 0 && (
                                            <span className="text-gray-400 font-normal text-xs">
                                                ({students.length} طالب — {paidCount} دافع — {unpaidCount} غير دافع)
                                            </span>
                                        )}
                                    </span>
                                    {students.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={toggleAll}
                                            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                                        >
                                            {allSelected
                                                ? <CheckSquare size={16} className="text-primary" />
                                                : <Square size={16} />}
                                            {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                                        </button>
                                    )}
                                </div>

                                {/* Student list */}
                                <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                                    {studentsLoading ? (
                                        <div className="flex justify-center items-center h-32 text-gray-400">
                                            <Loader2 className="animate-spin h-6 w-6" />
                                        </div>
                                    ) : students.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-gray-400">لا يوجد طلاب نشطين</div>
                                    ) : (
                                        students.map((s) => {
                                            const checked = selectedIds.has(s._id);
                                            const hasSub  = s.hasActiveSubscription;
                                            return (
                                                <label
                                                    key={s._id}
                                                    className={cn(
                                                        'w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors',
                                                        hasSub
                                                            ? 'bg-green-50/60 cursor-default'
                                                            : cn('cursor-pointer', checked ? 'bg-blue-50' : 'hover:bg-gray-50')
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleStudent(s._id)}
                                                            disabled={!!hasSub}
                                                            className="h-4 w-4 rounded accent-primary shrink-0 disabled:opacity-40"
                                                        />
                                                        <span className={cn(
                                                            'font-medium',
                                                            hasSub ? 'text-gray-400' : 'text-gray-800'
                                                        )}>
                                                            {s.studentName}
                                                        </span>
                                                    </div>
                                                    {hasSub ? (
                                                        <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full shrink-0 font-bold flex items-center gap-1">
                                                            <Check size={10} />
                                                            دافع ✓
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] bg-red-50 text-red-500 px-2.5 py-0.5 rounded-full shrink-0 font-medium">
                                                            لم يدفع
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Selected count */}
                                {students.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-2 text-center">
                                        {selectedIds.size} طالب محدد للدفع
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Discount field */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                خصم (ج) <span className="text-gray-400 font-normal">— ينطبق على جميع الطلاب المحددين</span>
                            </label>
                            <div className="flex items-center gap-2">
                                {centerDiscounts.length > 0 && (
                                    <Select
                                        onValueChange={(val) => {
                                            const center = centerDiscounts.find(c => c.centerName === val);
                                            if (center) setDiscount(center.discountAmount);
                                        }}
                                    >
                                        <SelectTrigger className="w-[160px] bg-gray-50 border-gray-200">
                                            <SelectValue placeholder="خصم سنتر..." />
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
                                    min={0}
                                    value={discount}
                                    onChange={(e) => setDiscount(Number(e.target.value))}
                                    className="w-32 bg-gray-50 border-gray-200"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <Button variant="outline" onClick={() => handleClose(false)} disabled={mutation.isPending}>
                                إلغاء
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={mutation.isPending || selectedIds.size === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {mutation.isPending
                                    ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</>
                                    : `تسجيل اشتراك ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

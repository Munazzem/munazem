'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api/groups';
import { fetchStudents } from '@/lib/api/students';
import { recordBatchSubscription } from '@/lib/api/payments';
import { toast } from 'sonner';
import { QK } from '@/lib/query-keys';
import { useAuthStore } from '@/lib/store/auth.store';
import { generateBatchReceiptsHtml } from '@/lib/utils/receiptHtml';
import { printHtmlContent } from '@/lib/utils/print';
import { getAllowedGrades } from '@/lib/utils/grades';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CreditCard,
    Loader2,
    CheckCircle2,
    XCircle,
    Users,
    Printer,
    CheckSquare,
    Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentWithGroup } from '@/types/student.types';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

type Phase = 'select' | 'result';

// Stage → gradeLevel mapping
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

export function BulkSubscriptionModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const user = useAuthStore(s => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);

    // Derive which stages are available for this teacher
    const allowedStages = STAGE_OPTIONS.filter(stage =>
        allowedGrades.some(g => g.includes(STAGE_TO_GRADE_PREFIX[stage.value]!))
    );

    const [stageFilter, setStageFilter] = useState('');
    const [groupId,     setGroupId]     = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [phase,       setPhase]       = useState<Phase>('select');
    const [results,     setResults]     = useState<any[]>([]);
    const [summary,     setSummary]     = useState({ successCount: 0, failCount: 0, totalPaid: 0 });

    // Reset on open/close
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStageFilter('');
                setGroupId('');
                setSelectedIds(new Set());
                setPhase('select');
                setResults([]);
            }, 300);
        }
    }, [open]);

    // Reset group when stage changes
    useEffect(() => {
        setGroupId('');
        setSelectedIds(new Set());
    }, [stageFilter]);

    // Reset students selection when group changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [groupId]);

    // ── Groups list (filtered by stage's gradeLevel) ──────────────────
    // We fetch all groups then filter client-side by stage prefix
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

    // ── Students of selected group ────────────────────────────────────
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: QK.payments.bulkSubStudents(groupId),
        queryFn: () => fetchStudents({ groupId, limit: 300, isActive: true }),
        enabled: !!groupId,
        staleTime: 2 * 60 * 1000,
    });
    const students: StudentWithGroup[] = studentsData?.data ?? [];

    // Auto-select students without active subscription when students load
    useEffect(() => {
        if (students.length > 0) {
            const unsubscribed = students
                .filter(s => !s.hasActiveSubscription)
                .map(s => s._id);
            setSelectedIds(new Set(unsubscribed));
        }
    }, [students.length, groupId]); // eslint-disable-line

    const toggleStudent = (id: string) => {
        setSelectedIds(prev => {
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
            setSelectedIds(new Set(students.map(s => s._id)));
        }
    };

    const mutation = useMutation({
        mutationFn: () =>
            recordBatchSubscription({ studentIds: Array.from(selectedIds) }),
        onSuccess: (data) => {
            setResults(data.results);
            setSummary({ successCount: data.successCount, failCount: data.failCount, totalPaid: data.totalPaid });
            setPhase('result');
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.dailySummary() });
            // Invalidate so paid status updates when reopening
            queryClient.invalidateQueries({ queryKey: QK.payments.bulkSubStudents(groupId) });
            if (data.successCount > 0) {
                toast.success(`تم تسجيل ${data.successCount} اشتراك بنجاح`);
            }
        },
        onError: () => {},
    });

    // Counts
    const paidCount   = students.filter(s => s.hasActiveSubscription).length;
    const unpaidCount = students.length - paidCount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-0 overflow-hidden gap-0" dir="rtl">
                {/* Accent bar */}
                <div className="h-1 w-full bg-linear-to-r from-primary to-blue-400" />

                <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        دفع اشتراك جماعي
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {phase === 'select' ? (
                        <>
                            {/* ── Step 1: Stage filter ── */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                    المرحلة الدراسية
                                </label>
                                <Select value={stageFilter} onValueChange={setStageFilter}>
                                    <SelectTrigger className="h-10">
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

                            {/* ── Step 2: Group selector ── */}
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
                                        >
                                            <SelectTrigger className="h-10">
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

                            {/* ── Step 3: Students list ── */}
                            {groupId && (
                                <div>
                                    {/* Header row */}
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <Users className="h-4 w-4 text-primary" />
                                            الطلاب
                                            {students.length > 0 && (
                                                <span className="text-gray-400 font-normal text-xs">
                                                    ({students.length} طالب — {paidCount} دافع — {unpaidCount} غير دافع)
                                                </span>
                                            )}
                                        </label>
                                        {students.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={toggleAll}
                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                            >
                                                {allSelected
                                                    ? <><CheckSquare className="h-3.5 w-3.5" /> إلغاء الكل</>
                                                    : <><Square className="h-3.5 w-3.5" /> تحديد الكل</>}
                                            </button>
                                        )}
                                    </div>

                                    {studentsLoading ? (
                                        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span className="text-sm">جاري تحميل الطلاب...</span>
                                        </div>
                                    ) : students.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            <Users className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                                            لا يوجد طلاب نشطين في هذه المجموعة
                                        </div>
                                    ) : (
                                        <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                                            {students.map(s => {
                                                const checked = selectedIds.has(s._id);
                                                const hasSub  = s.hasActiveSubscription;
                                                return (
                                                    <label
                                                        key={s._id}
                                                        className={cn(
                                                            'flex items-center gap-3 px-4 py-3 transition-colors',
                                                            hasSub
                                                                ? 'bg-green-50/50 cursor-default'
                                                                : cn('cursor-pointer', checked ? 'bg-primary/5' : 'hover:bg-gray-50/70')
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleStudent(s._id)}
                                                            disabled={hasSub}
                                                            className="h-4 w-4 rounded accent-primary shrink-0 disabled:opacity-40"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                'text-sm font-medium truncate',
                                                                hasSub ? 'text-gray-500' : 'text-gray-900'
                                                            )}>
                                                                {s.studentName}
                                                            </p>
                                                            <p className="text-xs text-gray-400 truncate">{s.gradeLevel}</p>
                                                        </div>
                                                        {hasSub ? (
                                                            <span className="text-[11px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full shrink-0 font-bold flex items-center gap-1">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                دافع ✓
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] bg-red-50 text-red-500 px-2.5 py-0.5 rounded-full shrink-0 font-medium">
                                                                لم يدفع
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Selected count summary */}
                                    {students.length > 0 && (
                                        <p className="text-xs text-gray-400 mt-2 text-center">
                                            {selectedIds.size} طالب محدد للدفع
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Results phase */
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold text-green-700">{summary.successCount}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">تم بنجاح</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold text-red-600">{summary.failCount}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">فشل</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-primary">{summary.totalPaid.toLocaleString('ar-EG')}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">إجمالي ج.م</p>
                                </div>
                            </div>

                            {/* Per-student results */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                                {results.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                        {r.status === 'success'
                                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                            : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                        }
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{r.studentName}</p>
                                            {r.error && <p className="text-xs text-red-500 truncate">{r.error}</p>}
                                        </div>
                                        {r.status === 'success' && (
                                            <span className="text-xs font-bold text-green-700 shrink-0">
                                                {r.paidAmount.toLocaleString('ar-EG')} ج
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
                    {phase === 'select' ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                                إلغاء
                            </Button>
                            <Button
                                onClick={() => mutation.mutate()}
                                disabled={selectedIds.size === 0 || mutation.isPending}
                                className="flex-1 gap-2"
                            >
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                دفع لـ {selectedIds.size > 0 ? selectedIds.size : ''} طالب
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => { setPhase('select'); setGroupId(''); setStageFilter(''); }} className="flex-1">
                                دفعة جديدة
                            </Button>
                            {results.some(r => r.status === 'success') && (
                                <Button
                                    className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
                            <Button onClick={() => onOpenChange(false)} className="flex-1">
                                إغلاق
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

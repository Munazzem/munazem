'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api/groups';
import { fetchStudents } from '@/lib/api/students';
import { recordBatchSubscription } from '@/lib/api/payments';
import { toast } from 'sonner';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudentWithGroup } from '@/types/student.types';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

type Phase = 'select' | 'result';

export function BulkSubscriptionModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();

    const [groupId,     setGroupId]     = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [phase,       setPhase]       = useState<Phase>('select');
    const [results,     setResults]     = useState<any[]>([]);
    const [summary,     setSummary]     = useState({ successCount: 0, failCount: 0, totalPaid: 0 });

    // Reset on open/close
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setGroupId('');
                setSelectedIds(new Set());
                setPhase('select');
                setResults([]);
            }, 300);
        }
    }, [open]);

    // Groups list
    const { data: groupsData, isLoading: groupsLoading } = useQuery({
        queryKey: ['bulkSub_groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const groups = groupsData?.data ?? [];

    // Students of selected group
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: ['bulkSub_students', groupId],
        queryFn: () => fetchStudents({ groupId, limit: 200, isActive: true }),
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

    const toggleAll = () => {
        if (selectedIds.size === students.length) {
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
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dailySummary'] });
            if (data.successCount > 0) {
                toast.success(`تم تسجيل ${data.successCount} اشتراك بنجاح`);
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء تسجيل الاشتراكات');
        },
    });

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
                            {/* Group selector */}
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                                    اختر المجموعة
                                </label>
                                {groupsLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل المجموعات...
                                    </div>
                                ) : (
                                    <Select value={groupId} onValueChange={v => { setGroupId(v); setSelectedIds(new Set()); }}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="اختر مجموعة..." />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {groups.map(g => (
                                                <SelectItem key={g._id} value={g._id}>
                                                    {g.name}
                                                    <span className="text-gray-400 text-xs mr-2">({g.gradeLevel})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Students list */}
                            {groupId && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            الطلاب
                                            {students.length > 0 && (
                                                <span className="text-gray-400 font-normal mr-1">
                                                    ({selectedIds.size} محدد من {students.length})
                                                </span>
                                            )}
                                        </label>
                                        {students.length > 0 && (
                                            <button
                                                onClick={toggleAll}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                {selectedIds.size === students.length ? 'إلغاء الكل' : 'تحديد الكل'}
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
                                                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                                                            checked ? 'bg-primary/5' : 'hover:bg-gray-50/70'
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleStudent(s._id)}
                                                            className="h-4 w-4 rounded accent-primary shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">{s.studentName}</p>
                                                            <p className="text-xs text-gray-400 truncate">{s.gradeLevel}</p>
                                                        </div>
                                                        {hasSub ? (
                                                            <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0 font-medium">
                                                                مشترك ✓
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full shrink-0 font-medium">
                                                                غير مشترك
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
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
                            <Button variant="outline" onClick={() => { setPhase('select'); setGroupId(''); }} className="flex-1">
                                دفعة جديدة
                            </Button>
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

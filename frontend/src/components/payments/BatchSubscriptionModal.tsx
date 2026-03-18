'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { recordBatchSubscription, type IBatchSubscriptionResult } from '@/lib/api/payments';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Users, Check, X, Loader2, CheckSquare, Square, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

interface Student {
    _id: string;
    studentName: string;
    gradeLevel: string;
}

export function BatchSubscriptionModal() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [discount, setDiscount] = useState(0);
    const [results, setResults] = useState<IBatchSubscriptionResult[] | null>(null);

    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stage);

    const { data: studentsData, isLoading } = useQuery({
        queryKey: ['batchStudents', search],
        queryFn: () => fetchStudents({ limit: 200, search }),
        enabled: open,
    });

    const students: Student[] = useMemo(() => {
        const all = (studentsData as any)?.data ?? (studentsData as any) ?? [];
        if (!Array.isArray(all)) return [];
        return gradeFilter
            ? all.filter((s: Student) => s.gradeLevel === gradeFilter)
            : all.filter((s: Student) => allowedGrades.includes(s.gradeLevel));
    }, [studentsData, gradeFilter, allowedGrades]);

    const mutation = useMutation({
        mutationFn: recordBatchSubscription,
        onSuccess: (data) => {
            setResults(data.results);
            queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
            queryClient.invalidateQueries({ queryKey: ['monthlyLedger'] });
            if (data.failCount === 0) {
                toast.success(`تم تسجيل ${data.successCount} اشتراك بنجاح — إجمالي: ${data.totalPaid.toLocaleString()} ج`);
            } else {
                toast.warning(`${data.successCount} نجح — ${data.failCount} فشل`);
            }
        },
        onError: (err: any) => {
            
        },
    });

    const toggleStudent = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === students.length && students.length > 0) {
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
            setSearch('');
            setGradeFilter('');
            setSelectedIds(new Set());
            setDiscount(0);
            setResults(null);
        }
    };

    const allSelected = students.length > 0 && selectedIds.size === students.length;

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
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-4">
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
                            <Button onClick={() => handleClose(false)}>إغلاق</Button>
                        </div>
                    </div>
                ) : (
                    /* ── Selection screen ── */
                    <div className="space-y-4">
                        {/* Filters row */}
                        <div className="flex gap-3">
                            <Input
                                placeholder="ابحث باسم الطالب..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-gray-50 border-gray-200"
                            />
                            <Select
                                value={gradeFilter}
                                onValueChange={(v) => setGradeFilter(v === 'ALL' ? '' : v)}
                                dir="rtl"
                            >
                                <SelectTrigger className="w-44 bg-gray-50 border-gray-200 text-gray-700">
                                    <ChevronDown size={14} className="ml-1 text-gray-400" />
                                    <SelectValue placeholder="كل المراحل" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="ALL">كل المراحل</SelectItem>
                                    {allowedGrades.map((g) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Select all + count */}
                        <div className="flex items-center justify-between px-1">
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
                            >
                                {allSelected
                                    ? <CheckSquare size={16} className="text-primary" />
                                    : <Square size={16} />}
                                {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                            </button>
                            <Badge variant="secondary">{selectedIds.size} محدد من {students.length}</Badge>
                        </div>

                        {/* Student list */}
                        <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-32 text-gray-400">
                                    <Loader2 className="animate-spin h-6 w-6" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-400">لا يوجد طلاب</div>
                            ) : (
                                students.map((s) => {
                                    const checked = selectedIds.has(s._id);
                                    return (
                                        <button
                                            key={s._id}
                                            type="button"
                                            onClick={() => toggleStudent(s._id)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {checked
                                                    ? <CheckSquare size={16} className="text-primary shrink-0" />
                                                    : <Square size={16} className="text-gray-300 shrink-0" />}
                                                <span className="font-medium text-gray-800">{s.studentName}</span>
                                            </div>
                                            <Badge variant="outline" className="text-xs text-gray-500">{s.gradeLevel}</Badge>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Discount field */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">خصم (ج):</label>
                            <Input
                                type="number"
                                min={0}
                                value={discount}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                                className="w-32 bg-gray-50 border-gray-200"
                                dir="ltr"
                            />
                            <p className="text-xs text-gray-400">ينطبق على جميع الطلاب المحددين</p>
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

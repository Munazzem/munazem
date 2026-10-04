'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { recordSubscription, waiveDebt } from '@/lib/api/payments';
import { QK } from '@/lib/query-keys';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, BookOpen, UserX, Receipt, CreditCard, ArrowRight, Clock, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { StudentWithGroup } from '@/types/student.types';

type GroupedStudents = Record<string, Record<string, StudentWithGroup[]>>;

export default function StudentAffairsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // ─── Queries (Fetching max 5000 to group locally) ───
    const { data: lateData, isLoading: lateLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'late_subs' }),
        queryFn: () => fetchStudents({ limit: 5000, hasNoActiveSubscription: true }),
    });

    const { data: pastCycleDebtsData, isLoading: pastCycleDebtsLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'past_cycle_debts' }),
        queryFn: () => fetchStudents({ limit: 5000, hasPastCycleDebt: true }),
    });

    const { data: dropoutsData, isLoading: dropoutsLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'dropouts' }),
        queryFn: () => fetchStudents({ limit: 5000, isDroppedOut: true }),
    });

    const lateStudents = Array.isArray(lateData?.data) ? lateData.data : [];
    const pastCycleDebtsStudents = Array.isArray(pastCycleDebtsData?.data) ? pastCycleDebtsData.data : [];
    const dropoutsStudents = Array.isArray(dropoutsData?.data) ? dropoutsData.data : [];

    // ─── Grouping Helper ───
    const groupStudents = (students: StudentWithGroup[]): GroupedStudents => {
        const grouped: GroupedStudents = {};
        students.forEach(student => {
            const stage = student.gradeLevel || 'غير محدد';
            const groupName = typeof student.groupId === 'object' && student.groupId !== null 
                ? (student.groupId as any).name 
                : 'بدون مجموعة';

            if (!grouped[stage]) grouped[stage] = {};
            if (!grouped[stage]![groupName]) grouped[stage]![groupName] = [];
            grouped[stage]![groupName]!.push(student);
        });
        return grouped;
    };

    const lateGrouped = useMemo(() => groupStudents(lateStudents), [lateStudents]);
    const pastCycleDebtsGrouped = useMemo(() => groupStudents(pastCycleDebtsStudents), [pastCycleDebtsStudents]);
    const dropoutsGrouped = useMemo(() => groupStudents(dropoutsStudents), [dropoutsStudents]);

    // ─── Quick Actions State & Mutations ───
    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);

    // Subscribe Dialog
    const [confirmSubscribeOpen, setConfirmSubscribeOpen] = useState(false);

    const subscribeMutation = useMutation({
        mutationFn: () => recordSubscription({ 
            studentId: selectedStudent!._id, 
            date: new Date().toISOString() 
        }),
        onSuccess: () => {
            toast.success('تم تسجيل الاشتراك بنجاح');
            setConfirmSubscribeOpen(false);
            setSelectedStudent(null);
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
        },
    });

    const handleSubscribe = (student: StudentWithGroup) => {
        setSelectedStudent(student);
        setConfirmSubscribeOpen(true);
    };

    // Waive Debt Dialog State & Mutation
    const [waiveStudent, setWaiveStudent] = useState<StudentWithGroup | null>(null);
    const [waiveReason, setWaiveReason] = useState('');
    const [waiveModalOpen, setWaiveModalOpen] = useState(false);

    const waiveMutation = useMutation({
        mutationFn: () => waiveDebt({
            studentId: waiveStudent!._id,
            reason: waiveReason.trim() || undefined,
        }),
        onSuccess: (res) => {
            toast.success(res?.message || `تم حذف وإسقاط مديونية ${waiveStudent?.studentName} بنجاح`);
            setWaiveModalOpen(false);
            setWaiveStudent(null);
            setWaiveReason('');
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.payments.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء حذف المديونية');
        },
    });

    const handleOpenWaiveDebt = (student: StudentWithGroup) => {
        setWaiveStudent(student);
        setWaiveReason('');
        setWaiveModalOpen(true);
    };

    // ─── Render Helper for Grouped Lists ───
    const renderGroupedList = (
        grouped: GroupedStudents, 
        emptyMessage: string, 
        renderAction: (student: StudentWithGroup) => React.ReactNode,
        extraInfo?: (student: StudentWithGroup) => React.ReactNode
    ) => {
        const stages = Object.keys(grouped);
        if (stages.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-500 font-medium">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {stages.map(stage => (
                    <div key={stage} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-primary/5 px-4 py-3 border-b border-gray-100">
                            <h2 className="font-bold text-primary text-lg">{stage}</h2>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {Object.keys(grouped[stage]!).map(groupName => (
                                <div key={groupName} className="p-4">
                                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        {groupName}
                                    </h3>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {grouped[stage]![groupName]!.map(student => (
                                            <div key={student._id} className="flex flex-col p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-colors group">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <div className="font-bold text-sm text-gray-900 group-hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/students/${student._id}`)}>
                                                            {student.studentName}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{student.studentPhone}</div>
                                                    </div>
                                                    {extraInfo && extraInfo(student)}
                                                </div>
                                                <div className="mt-auto pt-2 flex justify-end">
                                                    {renderAction(student)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-primary" />
                        شئون الطلاب
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">متابعة الاشتراكات المتأخرة، مديونيات الدورات السابقة، والطلاب المنقطعين.</p>
                </div>
            </div>

            <Tabs defaultValue="late_subs" className="w-full">
                <TabsList className="mb-6 bg-white border border-gray-100 shadow-sm p-1 rounded-xl flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="late_subs" className="flex-1 min-w-[140px] rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-bold py-2.5">
                        <BookOpen className="h-4 w-4 ml-2" /> اشتراكات متأخرة ({lateStudents.length})
                    </TabsTrigger>
                    <TabsTrigger value="past_cycle_debts" className="flex-1 min-w-[140px] rounded-lg data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 font-bold py-2.5">
                        <Clock className="h-4 w-4 ml-2 text-amber-600" /> مديونيات دورات سابقة ({pastCycleDebtsStudents.length})
                    </TabsTrigger>
                    <TabsTrigger value="dropouts" className="flex-1 min-w-[140px] rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-700 font-bold py-2.5">
                        <UserX className="h-4 w-4 ml-2" /> المنقطعين ({dropoutsStudents.length})
                    </TabsTrigger>
                </TabsList>

                {/* 1. Late Subscriptions Tab */}
                <TabsContent value="late_subs" className="mt-0 focus-visible:outline-none">
                    {lateLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        renderGroupedList(
                            lateGrouped,
                            'لا يوجد طلاب متأخرين عن سداد الدورة الحالية.',
                            (student) => (
                                <Button size="sm" className="h-8 text-xs font-bold bg-[#0f4c81] hover:bg-[#0f4c81]/90 w-full" onClick={() => handleSubscribe(student)}>
                                    <CreditCard className="h-3.5 w-3.5 ml-1.5" /> تسجيل اشتراك الشهر
                                </Button>
                            ),
                            () => (
                                <Badge className="bg-red-50 text-red-600 border border-red-100 shadow-xs px-2 text-[10px]">
                                    لم يسدد الدورة الحالية
                                </Badge>
                            )
                        )
                    )}
                </TabsContent>

                {/* 2. Past Cycle Debts Tab */}
                <TabsContent value="past_cycle_debts" className="mt-0 focus-visible:outline-none">
                    {pastCycleDebtsLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        renderGroupedList(
                            pastCycleDebtsGrouped,
                            'لا يوجد طلاب لديهم مديونيات من دورات سابقة.',
                            (student) => (
                                <div className="flex items-center gap-1.5 w-full">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-xs font-bold text-amber-800 border-amber-300 bg-amber-50/50 hover:bg-amber-100 flex-1" 
                                        onClick={() => router.push(`/students/${student._id}`)}
                                    >
                                        <Receipt className="h-3.5 w-3.5 ml-1" /> التفاصيل والسداد
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-xs font-bold text-rose-700 border-rose-200 bg-rose-50/60 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 transition-colors shrink-0" 
                                        onClick={() => handleOpenWaiveDebt(student)}
                                        title="حذف وإسقاط المديونية بدون دفع"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 ml-1" /> حذف المديونية
                                    </Button>
                                </div>
                            ),
                            (student) => (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0 shadow-sm px-2 text-[10px]">
                                    مستحق: {student.totalDebt} ج
                                </Badge>
                            )
                        )
                    )}
                </TabsContent>

                {/* 3. Dropouts Tab */}
                <TabsContent value="dropouts" className="mt-0 focus-visible:outline-none">
                    {dropoutsLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        renderGroupedList(
                            dropoutsGrouped,
                            'لا يوجد طلاب منقطعين (تغيبوا 3 مرات متتالية أو أكثر).',
                            (student) => (
                                <Button size="sm" variant="outline" className="h-8 text-xs font-bold w-full" onClick={() => router.push(`/students/${student._id}`)}>
                                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" /> فتح الملف والتواصل
                                </Button>
                            ),
                            (student) => (
                                <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-0 shadow-sm px-2 text-[10px]">
                                    غاب {student.consecutiveAbsences} حصص متتالية
                                </Badge>
                            )
                        )
                    )}
                </TabsContent>
            </Tabs>

            {/* Subscribe Dialog */}
            <ConfirmDialog
                open={confirmSubscribeOpen}
                onOpenChange={setConfirmSubscribeOpen}
                title="تسجيل اشتراك جديد؟"
                description={`هل تريد بالفعل تسجيل اشتراك الشهر الحالي للطالب ${selectedStudent?.studentName}؟`}
                confirmLabel="تأكيد التسجيل"
                onConfirm={() => subscribeMutation.mutate()}
            />

            {/* Waive Debt Dialog */}
            <Dialog open={waiveModalOpen} onOpenChange={(v) => { setWaiveModalOpen(v); if (!v) { setWaiveStudent(null); setWaiveReason(''); } }}>
                <DialogContent className="sm:max-w-[440px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-rose-600" />
                            حذف وإسقاط مديونية الطالب
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 pt-1">
                            سيتم تصفير وإسقاط المديونية المسجلة دون تحصيل أي مبالغ نقدية في الخزينة.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 py-2">
                        <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex justify-between items-center text-gray-700">
                                <span className="font-semibold">اسم الطالب:</span>
                                <span className="font-bold text-gray-900">{waiveStudent?.studentName}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-700">
                                <span className="font-semibold">إجمالي المديونية المستحقة:</span>
                                <span className="font-extrabold text-sm">{waiveStudent?.totalDebt || 0} ج.م</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700 block">
                                سبب الإسقاط / ملاحظة (اختياري)
                            </label>
                            <Input
                                placeholder="مثال: إعفاء من المعلم، ظرف عائلي، تسوية سابقة..."
                                value={waiveReason}
                                onChange={(e) => setWaiveReason(e.target.value)}
                                className="text-xs h-9 bg-white"
                            />
                        </div>

                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <span>
                                تنبيه: تأكيد هذه العملية سيقوم بتصفير المديونية وإغلاق الدورات السابقة كـ (مسددة بالكامل بعد الإعفاء) ولن يضاف أي إيراد للخزينة.
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-gray-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setWaiveModalOpen(false)}
                            disabled={waiveMutation.isPending}
                            className="text-xs font-semibold"
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="button"
                            onClick={() => waiveMutation.mutate()}
                            disabled={waiveMutation.isPending}
                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                        >
                            {waiveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            تأكيد حذف المديونية
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

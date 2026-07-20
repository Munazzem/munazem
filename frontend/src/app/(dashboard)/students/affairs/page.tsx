'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { recordSubscription, payDebt } from '@/lib/api/payments';
import { QK } from '@/lib/query-keys';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Wallet, BookOpen, UserX, Receipt, CreditCard, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import type { StudentWithGroup } from '@/types/student.types';

type GroupedStudents = Record<string, Record<string, StudentWithGroup[]>>;

export default function StudentAffairsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // ─── Queries (Fetching max 5000 to group locally) ───
    const { data: debtsData, isLoading: debtsLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'debts' }),
        queryFn: () => fetchStudents({ limit: 5000, hasDebt: true }),
    });

    const { data: lateData, isLoading: lateLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'late_subs' }),
        queryFn: () => fetchStudents({ limit: 5000, hasNoActiveSubscription: true }),
    });

    const { data: dropoutsData, isLoading: dropoutsLoading } = useQuery({
        queryKey: QK.students.list({ affairs: 'dropouts' }),
        queryFn: () => fetchStudents({ limit: 5000, isDroppedOut: true }),
    });

    const debtsStudents = Array.isArray(debtsData?.data) ? debtsData.data : [];
    const lateStudents = Array.isArray(lateData?.data) ? lateData.data : [];
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

    const debtsGrouped = useMemo(() => groupStudents(debtsStudents), [debtsStudents]);
    const lateGrouped = useMemo(() => groupStudents(lateStudents), [lateStudents]);
    const dropoutsGrouped = useMemo(() => groupStudents(dropoutsStudents), [dropoutsStudents]);

    // ─── Quick Actions State & Mutations ───
    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);

    // Pay Debt Dialog
    const [payDebtOpen, setPayDebtOpen] = useState(false);
    const [payDebtAmount, setPayDebtAmount] = useState('');

    const payDebtMutation = useMutation({
        mutationFn: payDebt,
        onSuccess: () => {
            toast.success('تم سداد باقي المصاريف بنجاح');
            setPayDebtOpen(false);
            setPayDebtAmount('');
            setSelectedStudent(null);
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
        },
    });

    const handlePayDebt = (student: StudentWithGroup) => {
        setSelectedStudent(student);
        setPayDebtAmount(String(student.totalDebt || 0));
        setPayDebtOpen(true);
    };

    const submitPayDebt = () => {
        if (!selectedStudent || !payDebtAmount) return;
        payDebtMutation.mutate({
            studentId: selectedStudent._id,
            amount: parseFloat(payDebtAmount),
            date: new Date().toISOString(),
        });
    };

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
        },
    });

    const handleSubscribe = (student: StudentWithGroup) => {
        setSelectedStudent(student);
        setConfirmSubscribeOpen(true);
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
                    <p className="text-gray-500 text-sm mt-1">متابعة المديونيات، الاشتراكات المتأخرة، والطلاب المنقطعين.</p>
                </div>
            </div>

            <Tabs defaultValue="debts" className="w-full">
                <TabsList className="mb-6 bg-white border border-gray-100 shadow-sm p-1 rounded-xl flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="debts" className="flex-1 min-w-[120px] rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-bold py-2.5">
                        <Wallet className="h-4 w-4 ml-2" /> المديونيات
                    </TabsTrigger>
                    <TabsTrigger value="late_subs" className="flex-1 min-w-[120px] rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-bold py-2.5">
                        <BookOpen className="h-4 w-4 ml-2" /> اشتراكات متأخرة
                    </TabsTrigger>
                    <TabsTrigger value="dropouts" className="flex-1 min-w-[120px] rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-700 font-bold py-2.5">
                        <UserX className="h-4 w-4 ml-2" /> المنقطعين
                    </TabsTrigger>
                </TabsList>

                {/* 1. Debts Tab */}
                <TabsContent value="debts" className="mt-0 focus-visible:outline-none">
                    {debtsLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        renderGroupedList(
                            debtsGrouped,
                            'لا يوجد طلاب لديهم مديونيات حالياً.',
                            (student) => (
                                <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 w-full" onClick={() => handlePayDebt(student)}>
                                    <Receipt className="h-3.5 w-3.5 ml-1.5" /> سداد المديونية
                                </Button>
                            ),
                            (student) => (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 shadow-sm px-2 text-[10px]">
                                    عليه {student.totalDebt} ج
                                </Badge>
                            )
                        )
                    )}
                </TabsContent>

                {/* 2. Late Subscriptions Tab */}
                <TabsContent value="late_subs" className="mt-0 focus-visible:outline-none">
                    {lateLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        renderGroupedList(
                            lateGrouped,
                            'لا يوجد طلاب متأخرين عن السداد حالياً.',
                            (student) => (
                                <Button size="sm" className="h-8 text-xs font-bold bg-[#0f4c81] hover:bg-[#0f4c81]/90 w-full" onClick={() => handleSubscribe(student)}>
                                    <CreditCard className="h-3.5 w-3.5 ml-1.5" /> تسجيل اشتراك الشهر
                                </Button>
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

            {/* Quick Action Dialogs */}
            
            {/* Pay Debt Dialog */}
            <Dialog open={payDebtOpen} onOpenChange={(v) => { setPayDebtOpen(v); if(!v) setPayDebtAmount(''); }}>
                <DialogContent className="sm:max-w-[400px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>سداد باقي المصاريف</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-semibold flex items-center justify-between">
                            <span>المديونية الخاصة بـ {selectedStudent?.studentName}:</span>
                            <span>{selectedStudent?.totalDebt} ج</span>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ المراد سداده (ج)</label>
                            <Input
                                type="number"
                                min="1"
                                max={selectedStudent?.totalDebt}
                                placeholder="المبلغ..."
                                value={payDebtAmount}
                                onChange={(e) => setPayDebtAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setPayDebtOpen(false)} disabled={payDebtMutation.isPending}>
                                إلغاء
                            </Button>
                            <Button 
                                type="button" 
                                disabled={!payDebtAmount || payDebtMutation.isPending || parseFloat(payDebtAmount) <= 0 || parseFloat(payDebtAmount) > (selectedStudent?.totalDebt || 0)}
                                onClick={submitPayDebt}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {payDebtMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد السداد'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Subscribe Dialog */}
            <ConfirmDialog
                open={confirmSubscribeOpen}
                onOpenChange={setConfirmSubscribeOpen}
                title="تسجيل اشتراك جديد؟"
                description={`هل تريد بالفعل تسجيل اشتراك الشهر الحالي للطالب ${selectedStudent?.studentName}؟`}
                confirmLabel="تأكيد التسجيل"
                onConfirm={() => subscribeMutation.mutate()}
            />
        </div>
    );
}

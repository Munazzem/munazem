import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen, AlertTriangle, CheckCircle2, Wallet, Calendar, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { payCycleDebt, payAllPastCycles } from '@/lib/api/payments';
import { QK } from '@/lib/query-keys';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ICycleEnrollmentInfo } from '@/types/report.types';

interface Props {
    reportLoading: boolean;
    report: any;
    studentId: string;
    canWrite?: boolean;
}

export function StudentSubscriptionsTab({ reportLoading, report, studentId, canWrite = true }: Props) {
    const queryClient = useQueryClient();

    // ── Pay Specific Cycle Modal State ──
    const [selectedCycle, setSelectedCycle] = useState<ICycleEnrollmentInfo | null>(null);
    const [cyclePaidAmount, setCyclePaidAmount] = useState('');
    const [cycleDiscountAmount, setCycleDiscountAmount] = useState('0');
    const [cycleDate, setCycleDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [cycleDescription, setCycleDescription] = useState('');

    // ── Pay All Past Cycles Modal State ──
    const [payAllOpen, setPayAllOpen] = useState(false);
    const [allPaidAmount, setAllPaidAmount] = useState('');
    const [allDate, setAllDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [allDescription, setAllDescription] = useState('');

    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: QK.students.detail(studentId) });
        queryClient.invalidateQueries({ queryKey: QK.students.report(studentId) });
        queryClient.invalidateQueries({ queryKey: QK.students.all });
        queryClient.invalidateQueries({ queryKey: QK.payments.all });
        queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
    };

    // Pay specific cycle mutation
    const payCycleMutation = useMutation({
        mutationFn: payCycleDebt,
        onSuccess: (tx) => {
            toast.success(`تم سداد مديونية الدورة رقم (${selectedCycle?.cycleNumber}) بنجاح`);
            setSelectedCycle(null);
            refreshData();
        },
    });

    // Pay all past cycles mutation
    const payAllMutation = useMutation({
        mutationFn: payAllPastCycles,
        onSuccess: (res) => {
            toast.success(res.message || 'تم سداد كافة المديونيات السابقة بنجاح');
            setPayAllOpen(false);
            refreshData();
        },
    });

    const openPayCycleModal = (cycle: ICycleEnrollmentInfo) => {
        setSelectedCycle(cycle);
        setCyclePaidAmount(String(cycle.remainingAmount));
        setCycleDiscountAmount('0');
        setCycleDate(new Date().toISOString().split('T')[0]);
        setCycleDescription(`سداد مديونية الدورة رقم ${cycle.cycleNumber}`);
    };

    const handleConfirmPayCycle = () => {
        if (!selectedCycle || !cyclePaidAmount) return;
        const paid = parseFloat(cyclePaidAmount);
        const discount = parseFloat(cycleDiscountAmount) || 0;
        if (paid < 0 || isNaN(paid)) return toast.error('المبلغ المدفوع غير صحيح');
        if (discount < 0 || isNaN(discount)) return toast.error('الخصم غير صحيح');
        if (paid + discount > selectedCycle.remainingAmount) {
            return toast.error('المبلغ والخصم أكبر من المطلوب سداده للدورة');
        }

        payCycleMutation.mutate({
            studentId,
            cycleNumber: selectedCycle.cycleNumber,
            paidAmount: paid,
            discountAmount: discount > 0 ? discount : undefined,
            date: cycleDate,
            description: cycleDescription,
        });
    };

    const openPayAllModal = () => {
        const total = report?.payments?.pastCyclesDebt || 0;
        setAllPaidAmount(String(total));
        setAllDate(new Date().toISOString().split('T')[0]);
        setAllDescription('سداد كافة مديونيات الدورات السابقة');
        setPayAllOpen(true);
    };

    const handleConfirmPayAll = () => {
        if (!allPaidAmount) return;
        const paid = parseFloat(allPaidAmount);
        if (paid <= 0 || isNaN(paid)) return toast.error('المبلغ المدفوع يجب أن يكون أكبر من صفر');

        payAllMutation.mutate({
            studentId,
            paidAmount: paid,
            date: allDate,
            description: allDescription,
        });
    };

    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    const pastUnpaidCycles: ICycleEnrollmentInfo[] = report?.payments?.pastUnpaidCycles || [];
    const pastCyclesDebt: number = report?.payments?.pastCyclesDebt || 0;
    const allCycleEnrollments: ICycleEnrollmentInfo[] = report?.payments?.cycleEnrollments || [];
    const subscriptions = report?.payments?.subscriptions || [];

    return (
        <div className="space-y-6">

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 1. PAST CYCLES DEBTS SECTION (المديونيات السابقة) */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {pastUnpaidCycles.length > 0 ? (
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300/60 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/60">
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-amber-950">
                                    مديونيات واشتراكات دورات سابقة مستحقة ({pastUnpaidCycles.length})
                                </h3>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    إجمالي المستحق من الدورات السابقة: <span className="font-extrabold text-amber-900 text-sm">{pastCyclesDebt.toLocaleString('ar-EG')} ج.م</span>
                                </p>
                            </div>
                        </div>

                        {canWrite && (
                            <Button
                                size="sm"
                                onClick={openPayAllModal}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5 shadow-sm rounded-xl h-9 self-start sm:self-auto"
                            >
                                <Wallet className="h-3.5 w-3.5" />
                                سداد كل الدورات السابقة ({pastCyclesDebt} ج)
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                        {pastUnpaidCycles.map((cycle) => (
                            <div
                                key={cycle._id || cycle.cycleNumber}
                                className="bg-white/90 border border-amber-200/70 rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3 hover:border-amber-300 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-bold">
                                            الدورة {cycle.cycleNumber}
                                        </Badge>
                                        <span className="text-[11px] text-gray-500">
                                            {cycle.cycleCapacity} حصص
                                        </span>
                                    </div>
                                    <Badge className={cn('text-[10px] font-bold border-0', cycle.status === 'PARTIALLY_PAID' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700')}>
                                        {cycle.status === 'PARTIALLY_PAID' ? 'مسدد جزئياً' : 'غير مسدد'}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5 text-center bg-gray-50/80 rounded-lg p-2 text-xs">
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-medium">سعر الدورة</p>
                                        <p className="font-bold text-gray-700 mt-0.5">{cycle.cycleCharge} ج</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-medium">المدفوع</p>
                                        <p className="font-bold text-green-600 mt-0.5">{cycle.totalPaid} ج</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-red-500 font-medium">المتبقي</p>
                                        <p className="font-extrabold text-red-600 mt-0.5">{cycle.remainingAmount} ج</p>
                                    </div>
                                </div>

                                {canWrite && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openPayCycleModal(cycle)}
                                        className="w-full text-xs font-bold h-8 border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100/80 gap-1"
                                    >
                                        <Wallet className="h-3 w-3 text-amber-700" />
                                        سداد الدورة ({cycle.remainingAmount} ج)
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 2. ALL CYCLES LOG (سجل الدورات السابقة والحالية) */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {allCycleEnrollments.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-bold text-gray-800">سجل اشتراكات الدورات</h4>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {allCycleEnrollments.map((cycle) => {
                            const isPaid = cycle.status === 'PAID';
                            const isPartial = cycle.status === 'PARTIALLY_PAID';
                            return (
                                <div
                                    key={cycle._id || cycle.cycleNumber}
                                    className={cn(
                                        "bg-white border rounded-xl p-3 shadow-xs flex items-center justify-between transition-colors",
                                        cycle.isCurrentCycle ? "border-blue-200 bg-blue-50/20 ring-1 ring-blue-100" : "border-gray-100"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                                            isPaid ? "bg-green-100 text-green-700" : isPartial ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                                        )}>
                                            {cycle.cycleNumber}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-bold text-gray-800">
                                                    الدورة {cycle.cycleNumber}
                                                </p>
                                                {cycle.isCurrentCycle && (
                                                    <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0 py-0 px-1.5">
                                                        الحالية
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                المطلوب: {cycle.cycleCharge} ج · المدفوع: {cycle.totalPaid} ج
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-left flex flex-col items-end gap-1">
                                        <Badge className={cn("text-[10px] font-bold border-0", isPaid ? "bg-green-100 text-green-700" : isPartial ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700")}>
                                            {isPaid ? "خالصة ✓" : isPartial ? `متبقي ${cycle.remainingAmount} ج` : "غير مسدد"}
                                        </Badge>
                                        {!isPaid && canWrite && (
                                            <button
                                                onClick={() => openPayCycleModal(cycle)}
                                                className="text-[10px] text-primary font-bold hover:underline"
                                            >
                                                سداد
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 3. TRANSACTIONS / PAYMENTS LOG */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-bold text-gray-700">
                        سجل عمليات السداد والتحصيل <span className="text-gray-400 font-normal">({subscriptions.length})</span>
                    </p>
                </div>

                {subscriptions.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                        <p className="text-xs font-medium">لا توجد عمليات سداد مسجلة للطالب</p>
                    </div>
                ) : (
                    <div className="grid gap-2.5">
                        {subscriptions.map((sub: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-xs hover:border-gray-200 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold text-gray-800">
                                            {new Date(sub.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                        {sub.cycleNumber && (
                                            <Badge variant="outline" className="text-[10px] text-gray-600 bg-gray-50 py-0">
                                                دورة {sub.cycleNumber}
                                            </Badge>
                                        )}
                                    </div>
                                    {sub.description && (
                                        <p className="text-[11px] text-gray-500 mt-1 font-medium bg-gray-50 inline-block px-2 py-0.5 rounded-md">
                                            {sub.description}
                                        </p>
                                    )}
                                </div>
                                <div className="text-left bg-green-50/60 px-3 py-1.5 rounded-xl border border-green-100">
                                    <p className="text-xs font-bold text-green-700">{sub.paidAmount.toLocaleString('ar-EG')} ج.م</p>
                                    {sub.discountAmount > 0 && (
                                        <p className="text-[10px] text-green-600/80 font-medium">خصم {sub.discountAmount.toLocaleString('ar-EG')}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODAL: PAY SPECIFIC CYCLE DEBT */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <Dialog open={!!selectedCycle} onOpenChange={(open) => !open && setSelectedCycle(null)}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Wallet className="h-5 w-5 text-amber-600" />
                            سداد مديونية الدورة رقم ({selectedCycle?.cycleNumber})
                        </DialogTitle>
                    </DialogHeader>

                    {selectedCycle && (
                        <div className="space-y-4 py-2">
                            {/* Summary strip */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5 text-amber-900">
                                <div className="flex justify-between">
                                    <span>سعر الدورة المطلوب:</span>
                                    <span className="font-bold">{selectedCycle.cycleCharge} ج.م</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>المسدد مسبقاً:</span>
                                    <span className="font-bold text-green-700">{selectedCycle.totalPaid} ج.م</span>
                                </div>
                                <div className="flex justify-between border-t border-amber-200/80 pt-1 text-amber-950 font-bold">
                                    <span>المتبقي المستحق:</span>
                                    <span className="text-red-600 font-extrabold text-sm">{selectedCycle.remainingAmount} ج.م</span>
                                </div>
                            </div>

                            {/* Paid Amount */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">المبلغ المدفوع (ج.م) *</label>
                                <Input
                                    type="number"
                                    min="0"
                                    max={selectedCycle.remainingAmount}
                                    value={cyclePaidAmount}
                                    onChange={(e) => setCyclePaidAmount(e.target.value)}
                                    placeholder="أدخل المبلغ المدفوع"
                                    className="font-bold"
                                />
                            </div>

                            {/* Discount Amount */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">مبلغ الخصم / الإعفاء (إن وجد)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={cycleDiscountAmount}
                                    onChange={(e) => setCycleDiscountAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            {/* Date Picker */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">تاريخ المعاملة</label>
                                <Input
                                    type="date"
                                    value={cycleDate}
                                    onChange={(e) => setCycleDate(e.target.value)}
                                />
                            </div>

                            {/* Description / Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">ملاحظات أو بيان السداد</label>
                                <Input
                                    value={cycleDescription}
                                    onChange={(e) => setCycleDescription(e.target.value)}
                                    placeholder="ملاحظات اختيارية..."
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedCycle(null)}
                            disabled={payCycleMutation.isPending}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleConfirmPayCycle}
                            disabled={payCycleMutation.isPending || !cyclePaidAmount}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                            {payCycleMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري السداد...</>
                            ) : (
                                'تأكيد السداد'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODAL: PAY ALL PAST CYCLES DEBT */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <Dialog open={payAllOpen} onOpenChange={setPayAllOpen}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Wallet className="h-5 w-5 text-amber-600" />
                            سداد كافة مديونيات الدورات السابقة
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5 text-amber-900">
                            <p className="font-medium">
                                سيتم توزيع المبلغ المدفوع تلقائياً لتسوية وإقفال مديونيات الدورات السابقة من الأقدم إلى الأحدث ({pastUnpaidCycles.length} دورات).
                            </p>
                            <div className="flex justify-between pt-1 border-t border-amber-200 text-amber-950 font-bold">
                                <span>إجمالي المتبقي من الدورات السابقة:</span>
                                <span className="text-red-600 font-extrabold text-sm">{pastCyclesDebt.toLocaleString('ar-EG')} ج.م</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700">المبلغ المراد سداده (ج.م) *</label>
                            <Input
                                type="number"
                                min="1"
                                max={pastCyclesDebt}
                                value={allPaidAmount}
                                onChange={(e) => setAllPaidAmount(e.target.value)}
                                className="font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700">تاريخ المعاملة</label>
                            <Input
                                type="date"
                                value={allDate}
                                onChange={(e) => setAllDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700">ملاحظات</label>
                            <Input
                                value={allDescription}
                                onChange={(e) => setAllDescription(e.target.value)}
                                placeholder="سداد شامل لمديونيات الدورات السابقة"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setPayAllOpen(false)}
                            disabled={payAllMutation.isPending}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleConfirmPayAll}
                            disabled={payAllMutation.isPending || !allPaidAmount}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                            {payAllMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري السداد...</>
                            ) : (
                                'تأكيد السداد الشامل'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

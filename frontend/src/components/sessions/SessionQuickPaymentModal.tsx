'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CreditCard,
    Search,
    CheckCircle2,
    AlertTriangle,
    User,
    Loader2,
    Printer,
    Receipt,
    Wallet,
    Calendar,
    ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QK } from '@/lib/query-keys';
import {
    recordSubscription,
    payDebt,
    payCycleDebt,
    payAllPastCycles,
} from '@/lib/api/payments';
import { fetchStudentReport } from '@/lib/api/reports';
import { soundEffects } from '@/lib/utils/sound';
import { printHtmlContent } from '@/lib/utils/print';
import type { IAttendanceRecord } from '@/types/session.types';

export interface AttendedStudentPaymentInfo {
    studentId: string;
    studentName: string;
    studentCode?: string;
    studentPhone?: string;
    gradeLevel?: string;
    totalDebt: number;
    hasActiveSubscription: boolean;
    hasDues: boolean;
}

interface SessionQuickPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    groupId: string;
    defaultPrice?: number;
    attendanceRecords: IAttendanceRecord[];
    subscriptionMap: Map<string, boolean>;
    groupStudents?: any[];
    initialStudentId?: string | null;
    onPaymentSuccess?: () => void;
}

export function SessionQuickPaymentModal({
    isOpen,
    onClose,
    sessionId,
    groupId,
    defaultPrice = 0,
    attendanceRecords,
    subscriptionMap,
    groupStudents = [],
    initialStudentId = null,
    onPaymentSuccess,
}: SessionQuickPaymentModalProps) {
    const queryClient = useQueryClient();

    // Search & Selected Student State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId);

    // Selected Payment Option Key (e.g. 'CURRENT_CYCLE', 'CYCLE_1', 'CYCLE_2', 'ALL_PAST_CYCLES', 'FULL_SETTLEMENT')
    const [selectedOptionKey, setSelectedOptionKey] = useState<string>('');

    // Payment Form States
    const [paidAmountInput, setPaidAmountInput] = useState<string>('');
    const [discountAmountInput, setDiscountAmountInput] = useState<string>('0');
    const [notes, setNotes] = useState<string>('');
    const [lastReceiptData, setLastReceiptData] = useState<any | null>(null);

    // Build unified attended students list with computed financial status
    const attendedStudents: AttendedStudentPaymentInfo[] = useMemo(() => {
        const groupStudentsMap = new Map<string, any>(
            groupStudents.map((s) => [s._id?.toString(), s])
        );

        const list: AttendedStudentPaymentInfo[] = [];
        const seenIds = new Set<string>();

        for (const record of attendanceRecords) {
            if (record.status !== 'PRESENT' && record.status !== 'LATE') continue;

            const st = record.studentId as any;
            const sid = st?._id?.toString?.() || st?._id || '';
            if (!sid || seenIds.has(sid)) continue;
            seenIds.add(sid);

            const studentDoc = groupStudentsMap.get(sid);
            const totalDebt = Number(
                (record as any).financialStatus?.debtAmount ||
                (record as any).financialStatus?.totalDebt ||
                studentDoc?.totalDebt ||
                st?.totalDebt ||
                0
            );

            // Active subscription check
            const hasActiveSubscription =
                subscriptionMap.has(sid)
                    ? subscriptionMap.get(sid) === true
                    : (studentDoc?.hasActiveSubscription ?? true);

            const hasDues = totalDebt > 0 || !hasActiveSubscription;

            list.push({
                studentId: sid,
                studentName: st?.studentName || studentDoc?.studentName || 'طالب',
                studentCode: st?.studentCode || studentDoc?.studentCode || '',
                studentPhone: st?.studentPhone || studentDoc?.studentPhone || '',
                gradeLevel: st?.gradeLevel || studentDoc?.gradeLevel || '',
                totalDebt,
                hasActiveSubscription,
                hasDues,
            });
        }

        // Sort: Students with dues first, then alphabetically
        return list.sort((a, b) => {
            if (a.hasDues && !b.hasDues) return -1;
            if (!a.hasDues && b.hasDues) return 1;
            return a.studentName.localeCompare(b.studentName, 'ar');
        });
    }, [attendanceRecords, groupStudents, subscriptionMap]);

    // Filter students by search
    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return attendedStudents;
        const q = searchQuery.trim().toLowerCase();
        return attendedStudents.filter(
            (s) =>
                s.studentName.toLowerCase().includes(q) ||
                (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
                (s.studentPhone && s.studentPhone.includes(q))
        );
    }, [attendedStudents, searchQuery]);

    // Active selected student basic info
    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return attendedStudents.find((s) => s.studentId === selectedStudentId) || null;
    }, [attendedStudents, selectedStudentId]);

    // Fetch full report for the selected student to get precise cycle-by-cycle breakdown
    const { data: studentReport, isLoading: isReportLoading } = useQuery({
        queryKey: QK.students.report(selectedStudentId || ''),
        queryFn: () => fetchStudentReport(selectedStudentId!),
        enabled: !!selectedStudentId && isOpen,
        staleTime: 30 * 1000,
    });

    // When modal opens or initialStudentId changes, select it
    useEffect(() => {
        if (isOpen) {
            setLastReceiptData(null);
            if (initialStudentId) {
                setSelectedStudentId(initialStudentId);
            } else if (!selectedStudentId && attendedStudents.length > 0) {
                const firstWithDues = attendedStudents.find((s) => s.hasDues);
                if (firstWithDues) {
                    setSelectedStudentId(firstWithDues.studentId);
                }
            }
        }
    }, [isOpen, initialStudentId, attendedStudents]);

    // ── Build Precise Cycle Options for Selected Student ────────────────────
    const paymentOptions = useMemo(() => {
        if (!selectedStudent) return [];

        const options: Array<{
            key: string;
            label: string;
            badge?: string;
            type: 'CURRENT_CYCLE' | 'SPECIFIC_CYCLE' | 'ALL_PAST_CYCLES' | 'HISTORICAL_DEBT' | 'FULL_SETTLEMENT';
            cycleNumber?: number;
            amountDue: number;
        }> = [];

        // All enrollments from report
        const cycleEnrollments: any[] = studentReport?.payments?.cycleEnrollments || [];

        // 1. Unpaid Past Cycles from report or cycleEnrollments
        const rawPastCycles = studentReport?.payments?.pastUnpaidCycles || cycleEnrollments.filter((c: any) => c.isPastCycle);
        const pastUnpaidCycles: any[] = (rawPastCycles || [])
            .filter((c: any) => !c.isWaived && ((c.remainingAmount != null ? c.remainingAmount > 0 : (c.cycleCharge - (c.totalPaid || 0)) > 0) || c.status !== 'PAID'))
            .sort((a: any, b: any) => (a.cycleNumber || 0) - (b.cycleNumber || 0));

        // 2. Current Cycle Info
        const currentCycleEnrollment = studentReport?.payments?.currentCycleEnrollment || cycleEnrollments.find((c: any) => c.isCurrentCycle);
        const currentCycleNumber = currentCycleEnrollment?.cycleNumber || studentReport?.payments?.currentCycleNumber || studentReport?.group?.currentCycleNumber || 1;
        
        // Is Current Cycle Paid?
        const isCurrentCyclePaid = currentCycleEnrollment
            ? currentCycleEnrollment.status === 'PAID'
            : (studentReport?.student?.hasActiveSubscription ?? selectedStudent.hasActiveSubscription);

        const currentCyclePrice = currentCycleEnrollment?.cycleCharge || studentReport?.group?.customPrice || defaultPrice || 0;
        const currentCycleDue = currentCycleEnrollment
            ? (currentCycleEnrollment.remainingAmount > 0
                ? currentCycleEnrollment.remainingAmount
                : (isCurrentCyclePaid ? 0 : (currentCycleEnrollment.cycleCharge || currentCyclePrice)))
            : (isCurrentCyclePaid ? 0 : currentCyclePrice);

        // Add Option A: Current Cycle Subscription (if unpaid and > 0)
        if (!isCurrentCyclePaid && currentCycleDue > 0) {
            options.push({
                key: 'CURRENT_CYCLE',
                label: `اشتراك الدورة الحالية (دورة رقم ${currentCycleNumber})`,
                badge: `مطلوب ${currentCycleDue} ج.م`,
                type: 'CURRENT_CYCLE',
                cycleNumber: currentCycleNumber,
                amountDue: currentCycleDue,
            });
        }

        // Add Option B: Each Specific Past Unpaid Cycle (Individual Cycle Debt)
        for (const cycle of pastUnpaidCycles) {
            const due = cycle.remainingAmount > 0 ? cycle.remainingAmount : Math.max(0, cycle.cycleCharge - (cycle.totalPaid || 0));
            if (due > 0) {
                options.push({
                    key: `CYCLE_${cycle.cycleNumber}`,
                    label: `مديونية دورة رقم ${cycle.cycleNumber} (سابقة)`,
                    badge: `متبقي ${due} ج.م`,
                    type: 'SPECIFIC_CYCLE',
                    cycleNumber: cycle.cycleNumber,
                    amountDue: due,
                });
            }
        }

        // Past cycles debt sum
        const pastCyclesTotal = pastUnpaidCycles.reduce(
            (sum, c) => sum + (c.remainingAmount > 0 ? c.remainingAmount : Math.max(0, c.cycleCharge - (c.totalPaid || 0))),
            0
        );

        // Non-cycle debt calculation (notebooks or legacy debts not tied to any cycle enrollment):
        // Total debt from student profile / database
        const totalStudentDebt = Number(studentReport?.student?.totalDebt ?? selectedStudent.totalDebt ?? 0);
        // All debt that is already accounted for by cycle enrollments
        const totalCyclesAccounted = pastCyclesTotal + (!isCurrentCyclePaid ? currentCycleDue : 0);
        // Only if total debt exceeds all cycles combined is there true non-cycle debt
        const trueNonCycleDebt = Math.max(0, totalStudentDebt - totalCyclesAccounted);

        if (trueNonCycleDebt > 0) {
            options.push({
                key: 'HISTORICAL_DEBT',
                label: `مديونية مستحقات سابقة / مذكرات`,
                badge: `${trueNonCycleDebt} ج.م`,
                type: 'HISTORICAL_DEBT',
                amountDue: trueNonCycleDebt,
            });
        }

        // Add Option C: Pay All Past Cycles (if more than 1 past cycle exists)
        if (pastUnpaidCycles.length > 1 && pastCyclesTotal > 0) {
            options.push({
                key: 'ALL_PAST_CYCLES',
                label: `سداد كافة الدورات السابقة دفعة واحدة (${pastUnpaidCycles.length} دورات)`,
                badge: `إجمالي ${pastCyclesTotal} ج.م`,
                type: 'ALL_PAST_CYCLES',
                amountDue: pastCyclesTotal,
            });
        }

        // Add Option D: Full Settlement (Current Cycle + Past Debts)
        const grandTotalDue = totalCyclesAccounted + trueNonCycleDebt;
        if (options.length > 1 && grandTotalDue > 0) {
            options.push({
                key: 'FULL_SETTLEMENT',
                label: `سداد شامل لكافة المستحقات (الدورة الحالية + كل المديونيات)`,
                badge: `إجمالي ${grandTotalDue} ج.م`,
                type: 'FULL_SETTLEMENT',
                cycleNumber: currentCycleNumber,
                amountDue: grandTotalDue,
            });
        }

        return options;
    }, [selectedStudent, studentReport, defaultPrice]);

    // Student has ANY actual dues?
    const studentActuallyOwesMoney = paymentOptions.length > 0;

    // Automatically set default selected option whenever student or options change
    useEffect(() => {
        if (paymentOptions.length > 0) {
            const defaultOpt = paymentOptions[0];
            setSelectedOptionKey(defaultOpt.key);
            setPaidAmountInput(String(defaultOpt.amountDue));
            setDiscountAmountInput('0');
        } else {
            setSelectedOptionKey('');
            setPaidAmountInput('0');
            setDiscountAmountInput('0');
        }
        setNotes('');
    }, [paymentOptions]);

    // Current active option
    const activeOption = useMemo(() => {
        return paymentOptions.find((o) => o.key === selectedOptionKey) || paymentOptions[0] || null;
    }, [paymentOptions, selectedOptionKey]);

    const handleDiscountChange = (newDiscountStr: string) => {
        setDiscountAmountInput(newDiscountStr);
        const discNum = parseFloat(newDiscountStr) || 0;
        const base = activeOption?.amountDue ?? 0;
        if (base > 0) {
            const net = Math.max(0, base - discNum);
            setPaidAmountInput(String(net));
        }
    };

    // When user changes option from dropdown or chip, update the input amount to match
    const handleOptionChange = (key: string) => {
        setSelectedOptionKey(key);
        const opt = paymentOptions.find((o) => o.key === key);
        if (opt) {
            const discNum = parseFloat(discountAmountInput) || 0;
            const net = Math.max(0, opt.amountDue - discNum);
            setPaidAmountInput(String(net));
        }
    };

    // Amount computations
    const inputPaidNum = parseFloat(paidAmountInput) || 0;
    const inputDiscNum = parseFloat(discountAmountInput) || 0;
    const finalEffectivePaid = Math.max(0, inputPaidNum);

    // Mutation Submitting
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirmPayment = async () => {
        if (!selectedStudent || !activeOption) return;
        if (!studentActuallyOwesMoney) {
            toast.info('هذا الطالب مسدد بالكامل وليس عليه أي مديونيات أو اشتراكات مستحقة.');
            return;
        }

        if (finalEffectivePaid <= 0 && inputDiscNum <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح للتحصيل.');
            return;
        }

        setIsSubmitting(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const studentId = selectedStudent.studentId;

            // 1. SPECIFIC PAST CYCLE
            if (activeOption.type === 'SPECIFIC_CYCLE' && activeOption.cycleNumber) {
                await payCycleDebt({
                    studentId,
                    cycleNumber: activeOption.cycleNumber,
                    paidAmount: finalEffectivePaid,
                    discountAmount: inputDiscNum > 0 ? inputDiscNum : undefined,
                    date: todayStr,
                    description: notes.trim() || `سداد مديونية الدورة رقم ${activeOption.cycleNumber} من داخل الحصة`,
                });
            }
            // 2. ALL PAST CYCLES
            else if (activeOption.type === 'ALL_PAST_CYCLES') {
                await payAllPastCycles({
                    studentId,
                    paidAmount: finalEffectivePaid,
                    date: todayStr,
                    description: notes.trim() || 'سداد كافة مديونيات الدورات السابقة من داخل الحصة',
                });
            }
            // 3. CURRENT CYCLE SUBSCRIPTION
            else if (activeOption.type === 'CURRENT_CYCLE') {
                await recordSubscription({
                    studentId,
                    paidAmount: finalEffectivePaid,
                    discountAmount: inputDiscNum > 0 ? inputDiscNum : undefined,
                    date: todayStr,
                    description: notes.trim() || `اشتراك الدورة الحالية (${activeOption.cycleNumber || 1}) من داخل الحصة`,
                });
            }
            // 4. HISTORICAL GENERAL / NOTEBOOK DEBT
            else if (activeOption.type === 'HISTORICAL_DEBT') {
                await payDebt({
                    studentId,
                    amount: finalEffectivePaid,
                    date: todayStr,
                    description: notes.trim() || 'سداد مستحقات سابقة من داخل الحصة',
                });
            }
            // 5. FULL SETTLEMENT (CURRENT CYCLE + ALL PAST CYCLES / DEBTS)
            else if (activeOption.type === 'FULL_SETTLEMENT') {
                const pastUnpaidCycles: any[] = (studentReport?.payments?.pastUnpaidCycles || []).filter(
                    (c: any) => !c.isWaived && (c.remainingAmount > 0 || c.status !== 'PAID')
                );
                const currentCycleEnrollment = studentReport?.payments?.cycleEnrollments?.find((c: any) => c.isCurrentCycle);
                const isCurrentCyclePaid = currentCycleEnrollment
                    ? currentCycleEnrollment.status === 'PAID'
                    : selectedStudent.hasActiveSubscription;
                const currentCyclePrice = currentCycleEnrollment?.cycleCharge || studentReport?.group?.customPrice || defaultPrice || 0;
                const currentCycleDue = currentCycleEnrollment
                    ? (currentCycleEnrollment.remainingAmount > 0 ? currentCycleEnrollment.remainingAmount : (isCurrentCyclePaid ? 0 : currentCyclePrice))
                    : (isCurrentCyclePaid ? 0 : currentCyclePrice);

                let remainingPayment = finalEffectivePaid;

                // Step A: Settle current cycle first if unpaid
                if (!isCurrentCyclePaid && currentCycleDue > 0 && remainingPayment > 0) {
                    const payForCurrent = Math.min(remainingPayment, currentCycleDue);
                    await recordSubscription({
                        studentId,
                        paidAmount: payForCurrent,
                        date: todayStr,
                        description: notes.trim() || `سداد اشتراك الدورة الحالية (${activeOption.cycleNumber || 1}) - تسوية شاملة`,
                    });
                    remainingPayment -= payForCurrent;
                }

                // Step B: Settle past cycles if remaining payment > 0 and past cycles exist
                if (remainingPayment > 0 && pastUnpaidCycles.length > 0) {
                    const pastTotalDue = pastUnpaidCycles.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);
                    const payForPast = Math.min(remainingPayment, pastTotalDue);
                    await payAllPastCycles({
                        studentId,
                        paidAmount: payForPast,
                        date: todayStr,
                        description: notes.trim() || 'سداد مديونيات الدورات السابقة - تسوية شاملة',
                    });
                    remainingPayment -= payForPast;
                }

                // Step C: If still remaining payment and general historical debt exists
                if (remainingPayment > 0) {
                    await payDebt({
                        studentId,
                        amount: remainingPayment,
                        date: todayStr,
                        description: notes.trim() || 'سداد مديونية سابقة - تسوية شاملة',
                    });
                }
            }

            soundEffects.playSuccess();
            toast.success(`✅ تم تحصيل ${finalEffectivePaid} ج.م بنجاح للطالب: ${selectedStudent.studentName}`);

            // Prepare receipt data
            setLastReceiptData({
                studentName: selectedStudent.studentName,
                studentCode: selectedStudent.studentCode,
                itemLabel: activeOption.label,
                totalPaid: finalEffectivePaid,
                discount: inputDiscNum,
                date: new Date().toLocaleDateString('ar-EG'),
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            });

            // Update queries
            queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
            queryClient.invalidateQueries({ queryKey: QK.students.list({ groupId, limit: 200 }) });
            queryClient.invalidateQueries({ queryKey: QK.students.report(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.payments.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });

            if (onPaymentSuccess) {
                onPaymentSuccess();
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'حدث خطأ أثناء تسجيل السداد';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintReceipt = () => {
        if (!lastReceiptData) return;
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8" />
                <title>إيصال استلام نقدية</title>
                <style>
                    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 15px; font-size: 13px; max-width: 320px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 8px; margin-bottom: 12px; }
                    .header h2 { margin: 0; font-size: 16px; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
                    .total { border-top: 2px dashed #333; padding-top: 8px; font-weight: bold; font-size: 15px; }
                    .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>إيصال تحصيل داخل الحصة</h2>
                    <p style="margin: 3px 0; font-size: 11px;">${lastReceiptData.date} - ${lastReceiptData.time}</p>
                </div>
                <div class="row"><span>الطالب:</span><strong>${lastReceiptData.studentName}</strong></div>
                ${lastReceiptData.studentCode ? `<div class="row"><span>الكود:</span><strong>${lastReceiptData.studentCode}</strong></div>` : ''}
                <div class="row"><span>البند:</span><span>${lastReceiptData.itemLabel}</span></div>
                ${lastReceiptData.discount > 0 ? `<div class="row"><span>الخصم:</span><span>${lastReceiptData.discount} ج.م</span></div>` : ''}
                <div class="row total"><span>المبلغ المدفوع:</span><span>${lastReceiptData.totalPaid} ج.م</span></div>
                <div class="footer"><p>شكراً لكم • مع تمنياتنا بالتوفيق والنجاح</p></div>
            </body>
            </html>
        `;
        printHtmlContent(html);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-xl max-h-[92dvh] flex flex-col gap-0 p-3.5 sm:p-6 overflow-hidden font-sans text-right rounded-2xl" dir="rtl">
                <DialogHeader className="shrink-0 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 truncate">
                                تحصيل مصاريف الحاضرين
                            </DialogTitle>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">
                                سداد اشتراك الدورة الحالية أو مديونية دورة سابقة مباشرة
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Scrollable Body Container with iOS Touch Momentum */}
                <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 py-1 pr-0.5 pl-0.5">
                    {/* Step 1: Select Attended Student */}
                    <div className="space-y-2 pt-1">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                اختر الطالب الحاضر أو ابحث بالاسم / الكود:
                            </label>
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ابحث باسم الطالب أو الكود..."
                                    className="pr-9 text-base sm:text-xs rounded-xl border-gray-200 h-10"
                                />
                            </div>
                        </div>

                        {/* Students Quick Selector Cards */}
                        <div className="max-h-32 sm:max-h-36 overflow-y-auto overscroll-contain space-y-1.5 p-1 border rounded-xl bg-gray-50/50">
                            {filteredStudents.length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400">
                                    لا يوجد طلاب مطابقين في قائمة الحضور
                                </div>
                            ) : (
                                filteredStudents.map((st) => {
                                    const isSelected = selectedStudentId === st.studentId;
                                    return (
                                        <div
                                            key={st.studentId}
                                            onClick={() => {
                                                setSelectedStudentId(st.studentId);
                                                setLastReceiptData(null);
                                            }}
                                            className={cn(
                                                "flex items-center justify-between p-2 sm:p-2.5 rounded-lg border text-xs cursor-pointer transition-all gap-2",
                                                isSelected
                                                    ? "bg-primary/5 border-primary text-primary font-bold shadow-2xs"
                                                    : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                                    isSelected ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                                                )}>
                                                    {st.studentName.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="truncate block font-bold text-xs">{st.studentName}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono truncate block">
                                                        {st.studentCode ? `كود: ${st.studentCode}` : ''}
                                                        {st.gradeLevel ? ` • ${st.gradeLevel}` : ''}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-1">
                                                {st.hasDues ? (
                                                    <div className="flex items-center gap-1">
                                                        {!st.hasActiveSubscription && st.totalDebt <= 0 && (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold px-1.5 py-0.5">
                                                                غير مشترك
                                                            </Badge>
                                                        )}
                                                        {!st.hasActiveSubscription && st.totalDebt > 0 && (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold px-1.5 py-0.5">
                                                                مستحق {st.totalDebt} ج
                                                            </Badge>
                                                        )}
                                                        {st.hasActiveSubscription && st.totalDebt > 0 && (
                                                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] font-bold px-1.5 py-0.5">
                                                                مديونية {st.totalDebt} ج
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold px-1.5 py-0.5">
                                                        خالص ✓
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Step 2: Payment Details Form for Selected Student */}
                    {selectedStudent && (
                        <div className="space-y-3 pt-2 border-t">
                            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-gray-100 shadow-2xs flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[11px] text-gray-400 block font-medium">الطالب المحدد:</span>
                                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{selectedStudent.studentName}</h4>
                                </div>
                                <div className="shrink-0 text-left flex items-center gap-1.5">
                                    {isReportLoading ? (
                                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>فحص الدورات...</span>
                                        </div>
                                    ) : studentActuallyOwesMoney ? (
                                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                            ⚠️ مطلوب مستحقات
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                            ✓ مسدد بالكامل
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* CASE 1: LOADING REPORT */}
                            {isReportLoading ? (
                                <div className="p-6 rounded-xl bg-gray-50/70 border border-gray-200 text-center space-y-2 animate-in fade-in">
                                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                                    <p className="text-xs font-bold text-gray-700">جاري فحص مديونيات ودورات الطالب...</p>
                                    <p className="text-[11px] text-gray-400">يتم التدقيق في سجل اشتراكات الدورات الحالية والسابقة</p>
                                </div>
                            ) : !studentActuallyOwesMoney ? (
                                /* CASE 2: STUDENT HAS NO DUES AT ALL (Strict Guarantee) */
                                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center space-y-1.5 animate-in fade-in">
                                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                                    <h4 className="font-bold text-emerald-900 text-sm">
                                        الطالب خالص تماماً!
                                    </h4>
                                    <p className="text-xs text-emerald-700 leading-relaxed">
                                        اشتراك الدورة الحالية مسدد، ولا توجد أي مديونيات أو دورات سابقة متأخرة على هذا الطالب.
                                    </p>
                                </div>
                            ) : (
                                /* CASE 3: STUDENT HAS DUES - CLEAN SELECT DROPDOWN */
                                <div className="space-y-3 animate-in fade-in">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                            ماذا يريد الطالب سداده الآن؟ (اختر الدورة المطلوبة) *
                                        </label>
                                        <Select
                                            value={selectedOptionKey}
                                            onValueChange={handleOptionChange}
                                            dir="rtl"
                                        >
                                            <SelectTrigger className="w-full h-11 bg-white border-gray-200 text-sm font-bold text-gray-800 rounded-xl shadow-2xs focus:ring-2 focus:ring-primary/20">
                                                <SelectValue placeholder="اختر الدورة أو البند المطلوب سداده...">
                                                    {activeOption ? `${activeOption.label} — (${activeOption.badge})` : undefined}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent dir="rtl" position="popper" className="z-[9999] rounded-xl border border-gray-200 bg-white shadow-xl max-h-60 w-[var(--radix-select-trigger-width)]">
                                                {paymentOptions.map((opt) => (
                                                    <SelectItem
                                                        key={opt.key}
                                                        value={opt.key}
                                                        className="py-2.5 text-xs font-bold cursor-pointer hover:bg-gray-50 focus:bg-primary/5 focus:text-primary"
                                                    >
                                                        <div className="flex items-center justify-between w-full gap-2 text-xs">
                                                            <span className="truncate">{opt.label}</span>
                                                            <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 font-mono text-[10px] font-bold shrink-0">
                                                                {opt.badge}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Active Option Summary Banner */}
                                    {activeOption && (
                                        <div className="p-2.5 sm:p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between text-xs gap-2">
                                            <div className="min-w-0">
                                                <span className="text-blue-900 font-bold block truncate">{activeOption.label}</span>
                                                <span className="text-[11px] text-blue-700 block">
                                                    المبلغ المستحق لهذا البند: <strong className="font-mono">{activeOption.amountDue} ج.م</strong>
                                                </span>
                                            </div>
                                            <Badge variant="outline" className="bg-white text-blue-800 border-blue-200 font-mono font-bold text-xs shrink-0">
                                                {activeOption.badge}
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Amount Paid & Discount Inputs */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                                المبلغ المدفوع الآن (ج.م) *
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={paidAmountInput}
                                                    onChange={(e) => setPaidAmountInput(e.target.value)}
                                                    className="bg-white text-base sm:text-sm font-bold font-mono pl-10 rounded-xl h-10"
                                                    placeholder="المبلغ المدفوع"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج.م</span>
                                            </div>
                                            {activeOption && inputPaidNum < activeOption.amountDue && inputPaidNum > 0 && (
                                                <span className="text-[10px] text-amber-700 mt-1 block">
                                                    ⚠️ سداد جزئي (سيتبقى على الطالب {activeOption.amountDue - inputPaidNum} ج.م)
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                                خصم إضافي (اختياري)
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={discountAmountInput}
                                                    onChange={(e) => handleDiscountChange(e.target.value)}
                                                    className="bg-white text-base sm:text-sm font-bold font-mono pl-10 rounded-xl h-10"
                                                    placeholder="0"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج.م</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Optional Notes */}
                                    <div>
                                        <Input
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="ملاحظات على الإيصال (اختياري)..."
                                            className="text-base sm:text-xs rounded-xl bg-gray-50/50 h-10"
                                        />
                                    </div>

                                    {/* Total Calculation Banner */}
                                    <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="text-xs text-emerald-900 block font-bold">إجمالي المحصّل الآن:</span>
                                            <span className="text-[10px] text-emerald-700">تسجيل فوري بالخزينة وتحديث الدورة</span>
                                        </div>
                                        <div className="text-lg sm:text-xl font-black text-emerald-800 font-mono">
                                            {finalEffectivePaid} <span className="text-xs font-bold font-sans">ج.م</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Success Receipt Action Banner */}
                    {lastReceiptData && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in gap-2">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-bold min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="truncate">تم تحصيل {lastReceiptData.totalPaid} ج بنجاح!</span>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePrintReceipt}
                                className="h-8 gap-1 text-xs font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 shrink-0"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>طباعة إيصال</span>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Fixed Non-collapsing Footer */}
                <DialogFooter className="shrink-0 gap-2 pt-3 border-t bg-white flex flex-row items-center justify-between sm:justify-start">
                    {studentActuallyOwesMoney && (
                        <Button
                            onClick={handleConfirmPayment}
                            disabled={isSubmitting || finalEffectivePaid <= 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl gap-2 flex-1 sm:flex-initial h-10"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CreditCard className="w-4 h-4" />
                            )}
                            <span>تأكيد السداد ({finalEffectivePaid} ج.م)</span>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="text-xs rounded-xl h-10 px-4"
                    >
                        إغلاق
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

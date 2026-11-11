'use client';

import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import type { StudentWithGroup } from '@/types/student.types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { recordSubscription, payDebt, waiveDebt } from '@/lib/api/payments';
import { fetchStudentReport, fetchStudentReportHtml } from '@/lib/api/reports';
import { fetchStudentById } from '@/lib/api/students';
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';
import { StudentProfileTab } from '@/components/students/profile/StudentProfileTab';
import { StudentAttendanceTab } from '@/components/students/profile/StudentAttendanceTab';
import { StudentSubscriptionsTab } from '@/components/students/profile/StudentSubscriptionsTab';
import { StudentPaymentsTab } from '@/components/students/profile/StudentPaymentsTab';
import { StudentGradesTab } from '@/components/students/profile/StudentGradesTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    QrCode,
    CreditCard,
    Loader2,
    User,
    Printer,
    AlertCircle,
    Receipt,
    Calendar,
    BookOpen,
    ArrowRight,
    GraduationCap,
    Trash2,
    Wallet,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { QK } from '@/lib/query-keys';

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.studentId as string;

    const [activeTab, setActiveTab] = useState<string>('profile');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const user = useAuthStore((s) => s.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const queryClient = useQueryClient();
    const [confirmSubscribeOpen, setConfirmSubscribeOpen] = useState(false);
    
    // Pay Debt Modal State
    const [payDebtOpen, setPayDebtOpen] = useState(false);
    const [payDebtAmount, setPayDebtAmount] = useState('');

    // Fetch full student report
    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: QK.students.report(studentId),
        queryFn: () => fetchStudentReport(studentId),
        enabled: !!studentId,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    // Fetch the single student
    const { data, isLoading: studentLoading } = useQuery({
        queryKey: QK.students.detail(studentId),
        queryFn: () => fetchStudentById(studentId),
        enabled: !!studentId,
        staleTime: 0,
        refetchOnMount: 'always',
    });
    
    // fetchStudentById returns the Response wrapper (which has .data), or the student directly, with fallback to report?.student
    const student = ((data as any)?.studentName ? (data as StudentWithGroup) : ((data as any)?.data as StudentWithGroup | undefined))
        || (report?.student as unknown as StudentWithGroup | undefined);

    useEffect(() => {
        if (!student) return;
        const qrValue = student.barcode || student.studentCode || student._id;
        QRCode.toDataURL(qrValue, {
            width: 180,
            margin: 1,
            color: { dark: '#0f4c81', light: '#f0f6ff' },
            errorCorrectionLevel: 'H',
        }).then(url => setQrDataUrl(url));
    }, [student]);

    // Tabs Horizontal Scroll Controls
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Check tabs horizontal scroll capacity
    const updateScrollIndicators = () => {
        const el = tabsContainerRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll <= 5) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }
        const currentScroll = Math.abs(scrollLeft);
        setCanScrollLeft(currentScroll > 8);
        setCanScrollRight(currentScroll < maxScroll - 8);
    };

    useEffect(() => {
        const el = tabsContainerRef.current;
        if (!el) return;
        updateScrollIndicators();
        const timer = setTimeout(updateScrollIndicators, 200);
        el.addEventListener('scroll', updateScrollIndicators, { passive: true });
        window.addEventListener('resize', updateScrollIndicators);
        return () => {
            clearTimeout(timer);
            el.removeEventListener('scroll', updateScrollIndicators);
            window.removeEventListener('resize', updateScrollIndicators);
        };
    }, [reportLoading, studentLoading]);

    useEffect(() => {
        if (!tabsContainerRef.current) return;
        const activeTrigger = tabsContainerRef.current.querySelector('[data-state="active"]') as HTMLElement | null;
        if (activeTrigger) {
            activeTrigger.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeTab]);

    // وظيفة سهم اليسار: الرجوع للتبويبات السابقة يساراً
    const handleScrollLeft = () => {
        const el = tabsContainerRef.current;
        if (!el) return;
        el.scrollBy({ left: -200, behavior: 'smooth' });
    };

    // وظيفة سهم اليمين: التقدم نحو التبويبات التالية يميناً
    const handleScrollRight = () => {
        const el = tabsContainerRef.current;
        if (!el) return;
        el.scrollBy({ left: 200, behavior: 'smooth' });
    };

    const subscribeMutation = useMutation({
        mutationFn: () => recordSubscription({ studentId: studentId }),
        onSuccess: () => {
            toast.success(`تم تسجيل اشتراك ${student?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: QK.students.detail(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.students.report(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.payments.all });
        },
        onError: (err: any) => {
            // Error is handled by global axios interceptor
        },
    });

    const payDebtMutation = useMutation({
        mutationFn: (amount: number) => payDebt({ studentId: studentId, amount }),
        onSuccess: () => {
            toast.success(`تم سداد مديونية ${student?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: QK.students.detail(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.students.report(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.payments.all });
            setPayDebtOpen(false);
            setPayDebtAmount('');
        },
        onError: (err: any) => {
            toast.error(err?.message || 'حدث خطأ أثناء السداد');
        },
    });

    // Waive Debt Modal State & Mutation
    const [waiveDebtOpen, setWaiveDebtOpen] = useState(false);
    const [waiveDebtAmount, setWaiveDebtAmount] = useState('');
    const [waiveAllDebt, setWaiveAllDebt] = useState(true);
    const [waiveDebtReason, setWaiveDebtReason] = useState('');

    const waiveDebtMutation = useMutation({
        mutationFn: () => waiveDebt({
            studentId,
            amount: waiveAllDebt ? undefined : (parseFloat(waiveDebtAmount) || undefined),
            reason: waiveDebtReason.trim() || undefined,
        }),
        onSuccess: (res) => {
            toast.success(res?.message || `تم حذف وإسقاط مديونية ${student?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: QK.students.detail(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.students.report(studentId) });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.payments.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            setWaiveDebtOpen(false);
            setWaiveDebtAmount('');
            setWaiveDebtReason('');
            setWaiveAllDebt(true);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء حذف المديونية');
        },
    });

    const [pdfLoading, setPdfLoading] = useState(false);
    const handleDownloadPdf = async () => {
        if (!studentId) return;
        setPdfLoading(true);
        try {
            const html = await fetchStudentReportHtml(studentId);
            printHtmlContent(html);
        } catch {
            // Handled globally
        } finally {
            setPdfLoading(false);
        }
    };

    const [cardLoading, setCardLoading] = useState(false);
    const handlePrintCard = async () => {
        if (!student) return;
        setCardLoading(true);
        try {
            const html = await generateIdCardsHtml([student], user?.centerName, user?.logoUrl);
            printHtmlContent(html);
        } catch {
            // Handled globally
        } finally {
            setCardLoading(false);
        }
    };


    if (studentLoading && !student) {
        return (
            <div className="min-h-screen bg-gray-50/30 p-4 sm:p-6 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            const gId = typeof student?.groupId === 'object' && student?.groupId !== null
                ? (student.groupId as any)._id
                : student?.groupId;
            router.push(gId ? `/students?groupId=${gId}` : '/students');
        }
    };

    if (!student) {
        return (
            <div className="min-h-screen bg-gray-50/30 p-4 sm:p-6 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500 font-medium">الطالب غير موجود.</p>
                <Button variant="outline" onClick={handleBack}>العودة للطلاب</Button>
            </div>
        );
    }

    const groupName =
        typeof student.groupId === 'object' && student.groupId !== null
            ? (student.groupId as { name: string }).name
            : student.groupDetails?.name || '—';

    const qrValue = student.barcode || student.studentCode || student._id;
    const hasActiveSub = report?.student?.hasActiveSubscription ?? student.hasActiveSubscription;
    const totalDebtAmount = Math.max(student?.totalDebt || 0, report?.payments?.pastCyclesDebt || 0);

    // Quick Contacts
    const parentPhone = student?.parentPhone || (student as any)?.phone;

    const formatWhatsAppUrl = (phone?: string, name?: string) => {
        if (!phone) return '#';
        let clean = phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '2' + clean;
        const text = encodeURIComponent(`السلام عليكم، بخصوص الطالب ${name || ''}: `);
        return `https://wa.me/${clean}?text=${text}`;
    };

    // Bento Pulse Metrics
    const recentSessions = (
        report?.attendance?.history?.length
            ? report.attendance.history
            : (report?.attendance?.cycles?.[0]?.sessions || report?.student?.monthlySessions || [])
    ).slice(0, 5);
    const attendanceRate = report?.attendance?.attendanceRate || '—';
    const presentCount = report?.attendance?.presentCount ?? 0;
    const totalSessions = report?.attendance?.totalSessions ?? 0;

    const gradesHistory: any[] = report?.grades?.history || report?.grades?.gradesHistory || [];
    const examsCount = report?.grades?.total ?? gradesHistory.length;
    const passedCount = gradesHistory.filter((g: any) => g.passed).length;
    const failedCount = gradesHistory.length - passedCount;
    const latestExam = gradesHistory[0];

    return (
        <div className="space-y-4 max-w-5xl mx-auto" dir="rtl">
            {/* ── 1. Top Command Bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-gray-100 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="outline" size="icon" onClick={handleBack} className="h-9 w-9 shrink-0 rounded-xl border-gray-200 hover:bg-gray-100" title="رجوع">
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                    <div className="h-10 w-10 rounded-xl bg-[#0f4c81]/10 border border-[#0f4c81]/15 flex items-center justify-center shrink-0">
                        <span className="text-base font-extrabold text-[#0f4c81]">
                            {student?.studentName?.charAt(0) || '؟'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight truncate">{student?.studentName || '—'}</h1>
                            <Badge className={cn('text-[10px] font-bold px-1.5 py-0.2 border-0', student.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
                                {student.isActive ? 'نشط' : 'موقوف'}
                            </Badge>
                            {hasActiveSub === true ? (
                                <Badge className="text-[10px] font-bold px-1.5 py-0.2 border-0 bg-blue-100 text-blue-700">
                                    مشترك
                                </Badge>
                            ) : (
                                <Badge className="text-[10px] font-bold px-1.5 py-0.2 border-0 bg-red-100 text-red-600">
                                    غير مشترك
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                            {student.gradeLevel || 'غير محدد'} • مجموعة: <strong className="text-gray-700 font-semibold">{groupName}</strong>
                            {student.studentCode && ` • كود: ${student.studentCode}`}
                        </p>
                    </div>
                </div>

                {/* Instant Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {parentPhone && (
                        <a
                            href={formatWhatsAppUrl(parentPhone, student?.studentName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8.5 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all"
                            title="مراسلة ولي الأمر عبر واتساب"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>واتساب</span>
                        </a>
                    )}

                    {canWrite && hasActiveSub === false && (
                        <Button
                            size="sm"
                            className="h-8.5 text-xs gap-1.5 bg-[#0f4c81] hover:bg-[#0f4c81]/90 text-white font-bold shadow-xs px-3 rounded-xl transition-all"
                            disabled={subscribeMutation.isPending}
                            onClick={() => setConfirmSubscribeOpen(true)}
                        >
                            {subscribeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                            <span>تسجيل اشتراك</span>
                        </Button>
                    )}

                    <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100 shadow-xs" title="خيارات إضافية">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 text-right p-1.5">
                            <DropdownMenuItem
                                onClick={handlePrintCard}
                                disabled={cardLoading || !studentId}
                                className="cursor-pointer gap-2 py-2 px-2.5 text-xs font-semibold rounded-lg"
                            >
                                {cardLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <QrCode className="h-3.5 w-3.5 text-gray-500" />}
                                <span>طباعة كارت الطالب (QR)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading || !studentId}
                                className="cursor-pointer gap-2 py-2 px-2.5 text-xs font-semibold rounded-lg"
                            >
                                {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Printer className="h-3.5 w-3.5 text-gray-500" />}
                                <span>طباعة التقرير الشامل</span>
                            </DropdownMenuItem>

                            {canWrite && totalDebtAmount > 0 && (
                                <>
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem
                                        onClick={() => setPayDebtOpen(true)}
                                        className="cursor-pointer gap-2 py-2 px-2.5 text-xs font-semibold text-amber-800 focus:text-amber-900 focus:bg-amber-50 rounded-lg"
                                    >
                                        <Wallet className="h-3.5 w-3.5 text-amber-600" />
                                        <span>سداد مديونية ({totalDebtAmount} ج)</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setWaiveAllDebt(true);
                                            setWaiveDebtAmount('');
                                            setWaiveDebtOpen(true);
                                        }}
                                        className="cursor-pointer gap-2 py-2 px-2.5 text-xs font-semibold text-rose-600 focus:text-rose-700 focus:bg-rose-50 rounded-lg"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                        <span>حذف المديونية بالكامل</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ── 2. The 3 Bento Pulse Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Bento Card 1: Attendance Pulse */}
                <div
                    onClick={() => setActiveTab('attendance')}
                    className={cn(
                        "group cursor-pointer bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-md",
                        activeTab === 'attendance' ? "border-emerald-400 ring-2 ring-emerald-50" : "border-gray-100"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-500">نبض الحضور</h3>
                                <p className="text-sm font-extrabold text-gray-900">{presentCount} من {totalSessions} حصة</p>
                            </div>
                        </div>
                        <span className="text-xl font-black text-emerald-600">{attendanceRate}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 text-[11px] text-gray-500">
                        <span>آخر 5 حصص:</span>
                        <div className="flex items-center gap-1.5" dir="ltr">
                            {recentSessions.length > 0 ? (
                                recentSessions.map((s: any, idx: number) => {
                                    const isPresent = s.status === 'PRESENT' || s.status === 'LATE';
                                    const isAbsent = s.status === 'ABSENT';
                                    const isExcused = s.status === 'EXCUSED';
                                    return (
                                        <span
                                            key={idx}
                                            title={`${s.date ? new Date(s.date).toLocaleDateString('ar-EG') : ''}: ${isPresent ? 'حاضر' : isAbsent ? 'غائب' : isExcused ? 'مستأذن' : s.status}`}
                                            className={cn(
                                                "h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125",
                                                isPresent && "bg-emerald-500 shadow-2xs",
                                                isAbsent && "bg-rose-500 shadow-2xs",
                                                isExcused && "bg-amber-400 shadow-2xs",
                                                !isPresent && !isAbsent && !isExcused && "bg-blue-400"
                                            )}
                                        />
                                    );
                                })
                            ) : (
                                <span className="text-[10px] text-gray-400">لا توجد حصص مسجلة</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bento Card 2: Financial Health */}
                <div
                    onClick={() => setActiveTab('subscriptions')}
                    className={cn(
                        "group cursor-pointer bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-md",
                        activeTab === 'subscriptions' || activeTab === 'payments' ? "border-blue-400 ring-2 ring-blue-50" : "border-gray-100"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center font-bold border",
                                hasActiveSub ? "bg-blue-50 text-[#0f4c81] border-blue-100" : "bg-red-50 text-red-600 border-red-100"
                            )}>
                                <CreditCard className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-500">الدورة الحالية</h3>
                                <p className="text-sm font-extrabold text-gray-900">
                                    {hasActiveSub ? 'مشترك بالدورة' : 'غير مشترك'}
                                </p>
                            </div>
                        </div>
                        <Badge className={cn(
                            "text-[10px] font-bold px-2 py-0.5 border-0 shadow-2xs",
                            hasActiveSub ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                        )}>
                            {hasActiveSub ? 'مسدد بالكامل ✅' : 'مستحق الاشتراك ⚠️'}
                        </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 text-[11px]">
                        {totalDebtAmount > 0 ? (
                            <div className="flex items-center justify-between w-full text-amber-900 font-bold">
                                <span>مديونية دورات سابقة:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-amber-700 font-black">{totalDebtAmount} ج</span>
                                    {canWrite && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPayDebtOpen(true);
                                            }}
                                            className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold"
                                        >
                                            سداد
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full text-gray-400 font-medium">
                                <span>المديونية السابقة:</span>
                                <span className="text-emerald-600 font-bold">خالي من المديونية (0 ج)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bento Card 3: Academic Pulse */}
                <div
                    onClick={() => setActiveTab('grades')}
                    className={cn(
                        "group cursor-pointer bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-md",
                        activeTab === 'grades' ? "border-purple-400 ring-2 ring-purple-50" : "border-gray-100"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold border border-purple-100">
                                <GraduationCap className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-500">سجل الاختبارات</h3>
                                <p className="text-sm font-extrabold text-gray-900">
                                    {examsCount > 0 ? `${examsCount} اختبارات` : 'لا توجد اختبارات'}
                                </p>
                            </div>
                        </div>
                        {examsCount > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] shadow-2xs">
                                    {passedCount} ناجح
                                </span>
                                {failedCount > 0 && (
                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[11px] shadow-2xs">
                                        {failedCount} راسب
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 text-[11px] text-gray-500">
                        <span className="shrink-0">آخر اختبار:</span>
                        {latestExam ? (
                            <span className="font-bold text-gray-800 truncate min-w-0 flex-1 text-left mr-2" title={`${latestExam.examTitle} (${latestExam.score}/${latestExam.totalMarks})`}>
                                {latestExam.examTitle} ({latestExam.score}/{latestExam.totalMarks})
                                {latestExam.grade && ` • ${latestExam.grade}`}
                            </span>
                        ) : (
                            <span className="text-gray-400">لم يسجل بعد</span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 3. Tabs Navigation & Hub Content ── */}
            <div className="bg-white rounded-2xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.06)] overflow-hidden border border-gray-100 flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full flex-1 flex flex-col min-h-[420px]">
                    <div className="relative w-full border-b border-gray-100 bg-gray-50/70 p-1 sm:p-1.5">
                        {/* Left Arrow */}
                        <button
                            type="button"
                            onClick={handleScrollLeft}
                            disabled={!canScrollLeft}
                            className={cn(
                                "absolute left-0 top-0 bottom-0 z-20 w-8 flex items-center justify-center bg-gradient-to-r from-gray-50 via-gray-50/90 to-transparent transition-opacity duration-200",
                                canScrollLeft ? "text-gray-700 hover:text-primary cursor-pointer opacity-100" : "opacity-0 pointer-events-none"
                            )}
                            title="الرجوع للتبويبات السابقة يساراً"
                        >
                            <div className="w-6 h-6 rounded-full bg-white shadow-xs border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                <ChevronLeft className="h-3.5 w-3.5 text-gray-600" />
                            </div>
                        </button>

                        {/* Native Scrollable Container with guaranteed ref */}
                        <div
                            ref={tabsContainerRef}
                            onScroll={updateScrollIndicators}
                            className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center"
                        >
                            <TabsList className="w-full sm:w-auto flex justify-between sm:justify-start gap-1 p-0 bg-transparent h-auto">
                                <TabsTrigger
                                    value="profile"
                                    className="flex-1 sm:flex-initial text-xs gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0f4c81] data-[state=active]:shadow-xs rounded-lg font-bold transition-all shrink-0 justify-center"
                                >
                                    <User className="h-3.5 w-3.5" />
                                    <span>البيانات</span>
                                </TabsTrigger>
                                {canWrite && (
                                    <TabsTrigger
                                        value="attendance"
                                        className="flex-1 sm:flex-initial text-xs gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0f4c81] data-[state=active]:shadow-xs rounded-lg font-bold transition-all shrink-0 justify-center"
                                    >
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>الحضور</span>
                                    </TabsTrigger>
                                )}
                                {canWrite && (
                                    <TabsTrigger
                                        value="subscriptions"
                                        className="flex-1 sm:flex-initial text-xs gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0f4c81] data-[state=active]:shadow-xs rounded-lg font-bold transition-all shrink-0 justify-center"
                                    >
                                        <BookOpen className="h-3.5 w-3.5" />
                                        <span>الاشتراك</span>
                                    </TabsTrigger>
                                )}
                                {canWrite && (
                                    <TabsTrigger
                                        value="payments"
                                        className="flex-1 sm:flex-initial text-xs gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0f4c81] data-[state=active]:shadow-xs rounded-lg font-bold transition-all shrink-0 justify-center"
                                    >
                                        <Receipt className="h-3.5 w-3.5" />
                                        <span>المالية</span>
                                    </TabsTrigger>
                                )}
                                {canWrite && (
                                    <TabsTrigger
                                        value="grades"
                                        className="flex-1 sm:flex-initial text-xs gap-1 py-1.5 sm:py-2 px-1.5 sm:px-3.5 data-[state=active]:bg-white data-[state=active]:text-[#0f4c81] data-[state=active]:shadow-xs rounded-lg font-bold transition-all shrink-0 justify-center"
                                    >
                                        <GraduationCap className="h-3.5 w-3.5" />
                                        <span>الدرجات</span>
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </div>

                        {/* Right Arrow */}
                        <button
                            type="button"
                            onClick={handleScrollRight}
                            disabled={!canScrollRight}
                            className={cn(
                                "absolute right-0 top-0 bottom-0 z-20 w-8 flex items-center justify-center bg-gradient-to-l from-gray-50 via-gray-50/90 to-transparent transition-opacity duration-200",
                                canScrollRight ? "text-primary hover:text-primary/80 cursor-pointer opacity-100" : "opacity-0 pointer-events-none"
                            )}
                            title="المزيد من التبويبات يميناً"
                        >
                            <div className="w-6 h-6 rounded-full bg-white shadow-xs border border-primary/30 flex items-center justify-center hover:bg-gray-100 text-primary">
                                <ChevronRight className="h-3.5 w-3.5 text-primary" />
                            </div>
                        </button>
                    </div>

                    {/* ── Tab 1: Profile + QR ── */}
                    <TabsContent value="profile" className="m-0 flex-1">
                        <StudentProfileTab
                            studentId={studentId}
                            student={student}
                            report={report}
                            canWrite={canWrite}
                            qrDataUrl={qrDataUrl}
                            qrValue={qrValue}
                            groupName={groupName}
                        />
                    </TabsContent>

                    {/* ── Tab 2: Attendance ── */}
                    {canWrite && (
                        <TabsContent value="attendance" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentAttendanceTab
                                reportLoading={reportLoading}
                                report={report}
                                studentId={studentId}
                                studentName={student?.studentName}
                                canWrite={canWrite}
                            />
                        </TabsContent>
                    )}

                    {/* ── Tab 3: Subscriptions ── */}
                    {canWrite && (
                        <TabsContent value="subscriptions" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentSubscriptionsTab reportLoading={reportLoading} report={report} studentId={studentId} canWrite={canWrite} />
                        </TabsContent>
                    )}

                    {/* ── Tab 4: Payments ── */}
                    {canWrite && (
                        <TabsContent value="payments" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentPaymentsTab reportLoading={reportLoading} report={report} />
                        </TabsContent>
                    )}

                    {/* ── Tab 5: Grades ── */}
                    {canWrite && (
                        <TabsContent value="grades" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentGradesTab reportLoading={reportLoading} report={report} />
                        </TabsContent>
                    )}
                </Tabs>
            </div>

            <ConfirmDialog
                open={confirmSubscribeOpen}
                onOpenChange={setConfirmSubscribeOpen}
                title="تسجيل اشتراك جديد؟"
                description={`هل تريد تسجيل اشتراك جديد للطالب ${student?.studentName}؟`}
                confirmLabel="تسجيل"
                onConfirm={() => {
                    subscribeMutation.mutate();
                    setConfirmSubscribeOpen(false);
                }}
            />

            <Dialog open={payDebtOpen} onOpenChange={(v) => { setPayDebtOpen(v); if(!v) setPayDebtAmount(''); }}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[400px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>سداد باقي المصاريف</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-semibold flex items-center justify-between">
                            <span>إجمالي المديونية الحالية:</span>
                            <span>{student?.totalDebt} ج</span>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ المراد سداده (ج)</label>
                            <Input
                                type="number"
                                min="1"
                                max={student?.totalDebt}
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
                                disabled={!payDebtAmount || payDebtMutation.isPending || parseFloat(payDebtAmount) <= 0 || parseFloat(payDebtAmount) > (student?.totalDebt || 0)}
                                onClick={() => {
                                    if (payDebtAmount) payDebtMutation.mutate(parseFloat(payDebtAmount));
                                }}
                            >
                                {payDebtMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                تأكيد السداد
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Waive Debt Modal */}
            <Dialog open={waiveDebtOpen} onOpenChange={(v) => { setWaiveDebtOpen(v); if (!v) { setWaiveDebtAmount(''); setWaiveDebtReason(''); setWaiveAllDebt(true); } }}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[440px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-rose-600" />
                            حذف وإسقاط مديونية الطالب
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 pt-1">
                            إسقاط وتصفير المبلغ المستحق دون تسجيل أي تحصيل نقدي في الخزينة.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm space-y-1.5">
                            <div className="flex justify-between items-center text-gray-700 font-semibold text-xs">
                                <span>اسم الطالب:</span>
                                <span className="font-bold text-gray-900">{student?.studentName}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-800 font-bold">
                                <span>إجمالي المديونية المستحقة:</span>
                                <span className="text-base font-extrabold">{totalDebtAmount} ج.م</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-700 block">نوع الإسقاط</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setWaiveAllDebt(true)}
                                    className={cn(
                                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-center",
                                        waiveAllDebt
                                            ? "border-rose-400 bg-rose-50 text-rose-800 shadow-xs"
                                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    )}
                                >
                                    حذف كامل المديونية
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setWaiveAllDebt(false);
                                        setWaiveDebtAmount(String(totalDebtAmount));
                                    }}
                                    className={cn(
                                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-center",
                                        !waiveAllDebt
                                            ? "border-rose-400 bg-rose-50 text-rose-800 shadow-xs"
                                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                    )}
                                >
                                    حذف مبلغ محدد
                                </button>
                            </div>
                        </div>

                        {!waiveAllDebt && (
                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">المبلغ المراد حذفه (ج.م)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max={totalDebtAmount}
                                    placeholder="المبلغ..."
                                    value={waiveDebtAmount}
                                    onChange={(e) => setWaiveDebtAmount(e.target.value)}
                                    className="text-xs h-9 bg-white"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                سبب الإسقاط / ملاحظة (اختياري)
                            </label>
                            <Input
                                placeholder="مثال: إعفاء بقرار المعلم، ظرف عائلي، تسوية خاصة..."
                                value={waiveDebtReason}
                                onChange={(e) => setWaiveDebtReason(e.target.value)}
                                className="text-xs h-9 bg-white"
                            />
                        </div>

                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <span>
                                تنبيه: لن يتم تسجيل أي إيراد نقدي في تقارير الدخل أو الخزينة، وسيتم اعتبار المديونية معفاة بالكامل.
                            </span>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={() => setWaiveDebtOpen(false)} disabled={waiveDebtMutation.isPending} className="text-xs font-semibold">
                                إلغاء
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    waiveDebtMutation.isPending ||
                                    (!waiveAllDebt && (!waiveDebtAmount || parseFloat(waiveDebtAmount) <= 0 || parseFloat(waiveDebtAmount) > totalDebtAmount))
                                }
                                onClick={() => waiveDebtMutation.mutate()}
                                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                            >
                                {waiveDebtMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                تأكيد حذف المديونية
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

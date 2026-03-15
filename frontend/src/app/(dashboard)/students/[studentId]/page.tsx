'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import type { StudentWithGroup } from '@/types/student.types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { recordSubscription } from '@/lib/api/payments';
import { fetchStudentReport, fetchStudentReportHtml } from '@/lib/api/reports';
import { fetchGroups } from '@/lib/api/groups';
import { updateStudent, fetchStudentById } from '@/lib/api/students';
import { recordManualAttendance } from '@/lib/api/attendance';
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Check,
    QrCode,
    CreditCard,
    Loader2,
    Phone,
    User,
    Hash,
    Printer,
    AlertCircle,
    Receipt,
    History,
    FileText,
    ArrowRightLeft,
    TrendingUp,
    Calendar,
    BookOpen,
    ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.studentId as string;

    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const user = useAuthStore((s) => s.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const queryClient = useQueryClient();

    // Fetch the single student (we use fetchStudents with search by ID for now, or just trust the report)
    // Actually, report brings back student data anyway, but let's fetch students list filtered by ID.
    const { data, isLoading: studentLoading } = useQuery({
        queryKey: ['student_detail', studentId],
        queryFn: () => fetchStudentById(studentId),
        enabled: !!studentId,
    });
    
    // fetchStudentById returns the Response wrapper (which has .data), or the student directly depending on interceptor
    const student = (data as any)?.studentName ? (data as StudentWithGroup) : (data as any)?.data as StudentWithGroup | undefined;

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

    // Fetch full student report
    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['studentReport', studentId],
        queryFn: () => fetchStudentReport(studentId),
        enabled: !!studentId,
        staleTime: 2 * 60 * 1000,
    });

    const subscribeMutation = useMutation({
        mutationFn: () => recordSubscription({ studentId: studentId }),
        onSuccess: () => {
            toast.success(`تم تسجيل اشتراك ${student?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['student_detail', studentId] });
            queryClient.invalidateQueries({ queryKey: ['studentReport', studentId] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء تسجيل الاشتراك');
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
            toast.error('فشل تحميل التقرير');
        } finally {
            setPdfLoading(false);
        }
    };

    const [cardLoading, setCardLoading] = useState(false);
    const handlePrintCard = async () => {
        if (!student) return;
        setCardLoading(true);
        try {
            const html = await generateIdCardsHtml([student]);
            printHtmlContent(html);
        } catch {
            toast.error('فشل توليد الكارت الخاص بالطالب');
        } finally {
            setCardLoading(false);
        }
    };

    // ── Group change (assistant only) ─────────────────────────────
    const currentGroupId =
        typeof student?.groupId === 'object' && student?.groupId !== null
            ? ((student.groupId as any)._id as string | undefined) ?? ''
            : typeof student?.groupId === 'string'
                ? student.groupId
                : '';

    const [isChangingGroup, setIsChangingGroup] = useState(false);
    const [newGroupId, setNewGroupId] = useState<string>('');

    useEffect(() => {
        setNewGroupId(currentGroupId);
    }, [currentGroupId]);

    const { data: groupsData } = useQuery({
        queryKey: ['teacherGroups_reassignStudent', student?.gradeLevel],
        queryFn: () => fetchGroups({ limit: 100, gradeLevel: student?.gradeLevel }),
        enabled: canWrite && !!student?.gradeLevel,
        staleTime: 5 * 60 * 1000,
    });

    const changeGroupMutation = useMutation({
        mutationFn: async () => {
            if (!newGroupId || newGroupId === currentGroupId || !studentId) return null;
            return await updateStudent(studentId, { groupId: newGroupId });
        },
        onSuccess: (updated) => {
            if (updated) {
                toast.success('تم نقل الطالب إلى المجموعة الجديدة بنجاح');
                queryClient.invalidateQueries({ queryKey: ['student_detail', studentId] });
                queryClient.invalidateQueries({ queryKey: ['studentReport', studentId] });
            }
            setIsChangingGroup(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء نقل الطالب للمجموعة الجديدة');
        },
    });

    const recordManualMutation = useMutation({
        mutationFn: () => recordManualAttendance(studentId),
        onSuccess: () => {
            toast.success('تم تسجيل الحصة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['studentReport', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student_detail', studentId] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء تسجيل الحصة');
        },
    });

    const [editingQuota, setEditingQuota] = useState(false);
    const [tempQuota, setTempQuota] = useState(8);

    useEffect(() => {
        if (student) setTempQuota(student.monthlySessionsQuota || 8);
    }, [student]);

    const updateQuotaMutation = useMutation({
        mutationFn: (val: number) => updateStudent(studentId, { monthlySessionsQuota: val }),
        onSuccess: () => {
            toast.success('تم تحديث عدد الحصص بنجاح');
            queryClient.invalidateQueries({ queryKey: ['student_detail', studentId] });
            setEditingQuota(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء تحديث عدد الحصص');
        },
    });

    if (studentLoading) {
        return (
            <div className="min-h-screen bg-gray-50/30 p-4 sm:p-6 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="min-h-screen bg-gray-50/30 p-4 sm:p-6 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500 font-medium">الطالب غير موجود.</p>
                <Button variant="outline" onClick={() => router.push('/students')}>العودة للطلاب</Button>
            </div>
        );
    }

    const groupName =
        typeof student.groupId === 'object' && student.groupId !== null
            ? (student.groupId as { name: string }).name
            : student.groupDetails?.name || '—';

    const qrValue = student.barcode || student.studentCode || student._id;
    const hasActiveSub = report?.student?.hasActiveSubscription ?? student.hasActiveSubscription;

    const InfoItem = ({ icon: Icon, label, value, ltr = false }: any) => (
        <div className="flex flex-col gap-1 p-3 bg-gray-50/80 rounded-xl border border-gray-100/50">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" /> {label}
            </span>
            <span className={cn('text-[13px] sm:text-[15px] font-bold text-gray-800', ltr && 'text-left')} dir={ltr ? 'ltr' : 'rtl'}>
                {value || '—'}
            </span>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50/30 p-3 sm:p-4 lg:p-6" dir="rtl">
            <div className="mb-4 sm:mb-6 max-w-4xl mx-auto flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => router.push('/students')} className="shrink-0">
                    <ArrowRight className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">ملف الطالب</h1>
                    <p className="text-sm text-gray-500">{student?.studentName || '—'}</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100 flex flex-col">
                {/* Header Section */}
                <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-[#f0f6ff]/40">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#0f4c81]/10 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
                            <span className="text-xl sm:text-2xl font-extrabold text-[#0f4c81] drop-shadow-sm">
                                {student?.studentName?.charAt(0) || '؟'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-[#0f4c81] tracking-tight">{student?.studentName || '—'}</h2>
                            <div className="flex items-center gap-2 mt-1 sm:mt-1.5 flex-wrap">
                                <Badge className={cn('text-[10px] sm:text-xs font-bold px-2.5 py-0.5 border-0 shadow-sm', student.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                                    {student.isActive ? 'نشط' : 'موقوف'}
                                </Badge>
                                <span className="text-[11px] sm:text-xs font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                                    {student.gradeLevel}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none h-9 text-xs gap-1.5 text-gray-700 bg-white border-gray-200 hover:bg-gray-50 font-bold shadow-sm"
                            disabled={cardLoading || !studentId}
                            onClick={handlePrintCard}
                        >
                            {cardLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                            طباعة الكارت
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none h-9 text-xs gap-1.5 text-[#0f4c81] border-blue-200 hover:bg-blue-50 font-bold shadow-sm"
                            disabled={pdfLoading || !studentId}
                            onClick={handleDownloadPdf}
                        >
                            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                            طباعة التقرير
                        </Button>

                        {canWrite && hasActiveSub === false && (
                            <Button
                                className="flex-1 sm:flex-none h-9 text-xs gap-1.5 bg-[#0f4c81] hover:bg-[#0f4c81]/90 font-bold shadow-md"
                                disabled={subscribeMutation.isPending}
                                onClick={() => {
                                    if (window.confirm('تأكيد تسجيل الاشتراك لهذا الطالب؟')) {
                                        subscribeMutation.mutate();
                                    }
                                }}
                            >
                                {subscribeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                                تسجيل اشتراك
                            </Button>
                        )}
                        {hasActiveSub === false && (
                            <Badge className="text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1 bg-red-50 text-red-600">
                                <AlertCircle className="h-3 w-3" /> غير مشترك
                            </Badge>
                        )}
                        {hasActiveSub === true && (
                            <Badge className="text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1 bg-blue-50 text-blue-700">
                                <CreditCard className="h-3 w-3" /> مشترك
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="profile" className="w-full flex-1 flex flex-col min-h-[400px]">
                    <TabsList className="w-full rounded-none border-b border-gray-100 bg-gray-50/50 px-4 h-auto flex flex-wrap justify-start gap-1 py-1">
                        <TabsTrigger value="profile" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2">
                            <User className="h-3.5 w-3.5" /> البيانات الأساسية
                        </TabsTrigger>
                        {canWrite && (
                            <TabsTrigger value="attendance" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2">
                                <Calendar className="h-3.5 w-3.5" /> الحضور والغياب
                            </TabsTrigger>
                        )}
                        {canWrite && (
                            <TabsTrigger value="subscriptions" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2">
                                <BookOpen className="h-3.5 w-3.5" /> الاشتراكات
                            </TabsTrigger>
                        )}
                        {canWrite && (
                            <TabsTrigger value="payments" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md py-2">
                                <Receipt className="h-3.5 w-3.5" /> المدفوعات للمنصة
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* ── Tab 1: Profile + QR ── */}
                    <TabsContent value="profile" className="m-0 flex-1">
                        <div className="flex flex-col sm:flex-row h-full">
                            {/* QR Panel */}
                            <div className="w-full sm:w-[240px] shrink-0 bg-[#f0f6ff] flex flex-col items-center justify-center gap-4 p-6 border-b sm:border-b-0 sm:border-l border-blue-100">
                                <div className="flex items-center gap-1.5 text-[#0f4c81]">
                                    <QrCode className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wide">كود الحضور</span>
                                </div>
                                <div className="rounded-2xl overflow-hidden shadow-lg border-4 border-white bg-white">
                                    {qrDataUrl ? (
                                        <img src={qrDataUrl} alt="QR Code" className="w-[160px] h-[160px]" />
                                    ) : (
                                        <div className="w-[160px] h-[160px] bg-white/60 flex items-center justify-center">
                                            <QrCode className="h-8 w-8 text-[#0f4c81]/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-center w-full px-2">
                                    <p className="text-[10px] text-gray-400 mb-1">امسح للتسجيل</p>
                                    <p className="font-mono text-[11px] font-bold text-[#0f4c81] bg-white px-2 py-1.5 rounded-lg border border-blue-100 truncate w-full" dir="ltr">
                                        {qrValue}
                                    </p>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="flex-1 p-4 sm:p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1 p-3 bg-gray-50/80 rounded-xl border border-gray-100/50">
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 flex items-center justify-between uppercase tracking-wide">
                                            <span className="flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 text-primary" /> المجموعة
                                            </span>
                                            {canWrite && !isChangingGroup && (
                                                <button
                                                    onClick={() => setIsChangingGroup(true)}
                                                    className="text-primary hover:underline text-[10px]"
                                                >
                                                    تغيير
                                                </button>
                                            )}
                                        </span>
                                        {!isChangingGroup ? (
                                            <span className="text-[13px] sm:text-[15px] font-bold text-gray-800">
                                                {groupName}
                                            </span>
                                        ) : (
                                            <div className="mt-1 flex items-center gap-2">
                                                <Select value={newGroupId} onValueChange={setNewGroupId}>
                                                    <SelectTrigger className="h-8 text-xs bg-white">
                                                        <SelectValue placeholder="اختر مجموعة" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {groupsData?.data?.map((g: any) => (
                                                            <SelectItem key={g._id} value={g._id} className="text-xs">{g.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex shrink-0">
                                                    <Button
                                                        type="button"
                                                        size="xs"
                                                        className="h-8 px-3 text-[11px]"
                                                        disabled={changeGroupMutation.isPending || newGroupId === currentGroupId}
                                                        onClick={() => changeGroupMutation.mutate()}
                                                    >
                                                        {changeGroupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'حفظ'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="xs"
                                                        variant="ghost"
                                                        className="h-8 px-3 text-[11px] text-gray-500"
                                                        onClick={() => {
                                                            setIsChangingGroup(false);
                                                            setNewGroupId(currentGroupId);
                                                        }}
                                                    >
                                                        إلغاء
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <InfoItem icon={Phone} label="هاتف الطالب" value={student.studentPhone} ltr />
                                    <InfoItem icon={Phone} label="هاتف الأسرة" value={student.parentPhone} ltr />
                                    {student.studentCode && (
                                        <InfoItem icon={Hash} label="الكود" value={student.studentCode} ltr />
                                    )}
                                </div>

                                {/* Monthly Session Quota */}
                                <div className="pt-2 mt-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                                                <TrendingUp className="h-3.5 w-3.5 text-[#0f4c81]" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">متابعة الحصص الشهرية</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingQuota ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="w-12 h-7 text-xs border rounded px-1 text-center bg-white"
                                                        value={tempQuota}
                                                        onChange={(e) => setTempQuota(parseInt(e.target.value) || 0)}
                                                    />
                                                    <Button size="xs" onClick={() => updateQuotaMutation.mutate(tempQuota)}>حفظ</Button>
                                                    <Button size="xs" variant="ghost" onClick={() => setEditingQuota(false)}>إلغاء</Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    className="h-6 text-[10px] text-blue-600 hover:text-blue-700"
                                                    onClick={() => {
                                                        setTempQuota(student.monthlySessionsQuota);
                                                        setEditingQuota(true);
                                                    }}
                                                >
                                                    تعديل الإجمالي
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Grid */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs text-gray-500 font-medium">
                                                تم حضور {report?.student?.usedSessionsThisMonth ?? student.usedSessionsThisMonth ?? 0} من {report?.student?.monthlySessionsQuota ?? student.monthlySessionsQuota ?? 8} حصص
                                            </span>
                                            <span className="text-xs font-bold text-[#0f4c81]">
                                                {Math.round(((report?.student?.usedSessionsThisMonth ?? student.usedSessionsThisMonth ?? 0) / (report?.student?.monthlySessionsQuota ?? student.monthlySessionsQuota ?? 8)) * 100)}%
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2.5">
                                            {/* 1. Real Scheduled Sessions */}
                                            {report?.student?.monthlySessions?.map((s: { sessionId: string; date: string; status: string }, i: number) => {
                                                const isPresent = s.status === 'PRESENT' || s.status === 'LATE';
                                                const dateStr = s.date ? new Date(s.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '—';

                                                return (
                                                    <div
                                                        key={`session-${s.sessionId}-${i}`}
                                                        title={`${dateStr} - ${isPresent ? 'حاضر' : 'غائب'}`}
                                                        className={cn(
                                                            "w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all relative group",
                                                            isPresent
                                                                ? "bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20"
                                                                : "bg-gray-50 border-gray-200 text-gray-400 hover:border-[#0f4c81] hover:text-[#0f4c81]"
                                                        )}
                                                        onClick={() => {
                                                            if (!isPresent && window.confirm(`تسجيل حضور حصة يوم ${dateStr}؟`)) {
                                                                recordManualMutation.mutate();
                                                            }
                                                        }}
                                                    >
                                                        {isPresent ? (
                                                            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                                                        ) : (
                                                            <span className="text-xs sm:text-sm font-bold">{i + 1}</span>
                                                        )}

                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                                            {dateStr}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* 2. Extra Manual Slots (if quota > sessions) */}
                                            {Array.from({ length: Math.max(0, (report?.student?.monthlySessionsQuota ?? student.monthlySessionsQuota ?? 8) - (report?.student?.monthlySessions?.length ?? 0)) }).map((_, i) => {
                                                const realIndex = (report?.student?.monthlySessions?.length ?? 0) + i;
                                                const isManualFilled = i < (report?.student?.manualRecordsCount ?? 0);

                                                return (
                                                    <div
                                                        key={`manual-${i}`}
                                                        title={isManualFilled ? 'حصة إضافية مسجلة يدوياً' : 'مكان شاغر لحصة'}
                                                        className={cn(
                                                            "w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all",
                                                            isManualFilled
                                                                ? "bg-green-100 border-green-500 text-green-700 shadow-sm"
                                                                : "bg-gray-50 border-gray-200 text-gray-300 hover:border-[#0f4c81] hover:text-[#0f4c81]"
                                                        )}
                                                        onClick={() => {
                                                            if (!isManualFilled && window.confirm('تسجيل حضور حصة إضافية؟')) {
                                                                recordManualMutation.mutate();
                                                            }
                                                        }}
                                                    >
                                                        {isManualFilled ? (
                                                            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                                                        ) : (
                                                            <span className="text-xs sm:text-sm">{realIndex + 1}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── Tab 2: Attendance ── */}
                    {canWrite && (
                        <TabsContent value="attendance" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            {reportLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
                                </div>
                            ) : report ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-green-50/80 rounded-2xl p-4 text-center border border-green-100">
                                            <p className="text-2xl sm:text-3xl font-extrabold text-green-700">{report.attendance.presentCount}</p>
                                            <p className="text-xs text-gray-600 mt-1 font-medium">حاضر</p>
                                        </div>
                                        <div className="bg-red-50/80 rounded-2xl p-4 text-center border border-red-100">
                                            <p className="text-2xl sm:text-3xl font-extrabold text-red-600">{report.attendance.absentCount}</p>
                                            <p className="text-xs text-gray-600 mt-1 font-medium">غائب</p>
                                        </div>
                                        <div className="bg-blue-50/80 rounded-2xl p-4 text-center border border-blue-100">
                                            <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 drop-shadow-sm">{report.attendance.attendanceRate}</p>
                                            <p className="text-xs text-gray-600 mt-1 font-medium">نسبة الحضور</p>
                                        </div>
                                    </div>
                                    
                                    {report.attendance.history?.length > 0 && (
                                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-2 mb-4">
                                                <History className="h-4 w-4 text-gray-400" />
                                                <p className="text-sm font-bold text-gray-700">سجل آخر {report.attendance.history.length} حصة</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2.5">
                                                {report.attendance.history.map((h: any, i: number) => {
                                                    const isPresent = h.status === 'PRESENT';
                                                    const isAbsent = h.status === 'ABSENT';
                                                    return (
                                                        <div
                                                            key={i}
                                                            title={new Date(h.date).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                            className={cn(
                                                                'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 transition-all cursor-help',
                                                                isPresent ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' :
                                                                isAbsent  ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' :
                                                                'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                                            )}
                                                        >
                                                            {isPresent ? <Check className="h-5 w-5" /> : isAbsent ? <AlertCircle className="h-4 w-4" /> : '—'}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
                                                <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium"><div className="w-2.5 h-2.5 rounded-full bg-green-400"></div> حاضر</span>
                                                <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> غائب</span>
                                                <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto mr-auto">(من اليمين: الأحدث)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <FileText className="h-10 w-10 mb-3 text-gray-200" />
                                    <p className="font-medium">لا توجد رسوم أو بيانات حضور</p>
                                </div>
                            )}
                        </TabsContent>
                    )}

                    {/* ── Tab 3: Subscriptions ── */}
                    {canWrite && (
                        <TabsContent value="subscriptions" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            {reportLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
                                </div>
                            ) : report?.payments?.subscriptions?.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BookOpen className="h-5 w-5 text-gray-400" />
                                        <p className="text-sm font-bold text-gray-700">سجل الاشتراكات المشتراة <span className="text-gray-400 font-normal">({report.payments.subscriptionsCount})</span></p>
                                    </div>
                                    <div className="grid gap-3">
                                        {report.payments.subscriptions.map((sub: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:border-gray-200 transition-colors">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {new Date(sub.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </p>
                                                    {sub.description && (
                                                        <p className="text-xs text-gray-500 mt-1 font-medium bg-gray-50 inline-block px-2 py-0.5 rounded-md">{sub.description}</p>
                                                    )}
                                                </div>
                                                <div className="text-left bg-green-50/50 px-4 py-2 rounded-xl border border-green-50">
                                                    <p className="text-sm font-bold text-green-700">{sub.paidAmount.toLocaleString('ar-EG')} ج.م</p>
                                                    {sub.discountAmount > 0 && (
                                                        <p className="text-xs text-green-600/70 font-medium">خصم {sub.discountAmount.toLocaleString('ar-EG')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <BookOpen className="h-10 w-10 mb-3 text-gray-200" />
                                    <p className="font-medium">لا توجد اشتراكات مسجلة</p>
                                </div>
                            )}
                        </TabsContent>
                    )}

                    {/* ── Tab 4: Payments ── */}
                    {canWrite && (
                        <TabsContent value="payments" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            {reportLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
                                </div>
                            ) : report?.payments?.history?.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-5 border border-green-100 relative overflow-hidden">
                                            <div className="absolute left-[-10px] bottom-[-10px] opacity-10"><Receipt className="w-24 h-24" /></div>
                                            <div className="relative z-10">
                                                <p className="text-2xl sm:text-3xl font-extrabold text-green-700 drop-shadow-sm">
                                                    {report.payments.totalPaid.toLocaleString('ar-EG')} <span className="text-sm font-bold opacity-70">ج.م</span>
                                                </p>
                                                <p className="text-xs text-green-800/70 mt-1 font-bold">إجمالي المدفوعات للمنصة</p>
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-5 border border-orange-100 relative overflow-hidden">
                                            <div className="absolute left-[-10px] bottom-[-10px] opacity-10"><TrendingUp className="w-24 h-24" /></div>
                                            <div className="relative z-10">
                                                <p className="text-2xl sm:text-3xl font-extrabold text-orange-600 drop-shadow-sm">
                                                    {report.payments.totalDiscount.toLocaleString('ar-EG')} <span className="text-sm font-bold opacity-70">ج.م</span>
                                                </p>
                                                <p className="text-xs text-orange-800/70 mt-1 font-bold">إجمالي الخصومات</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-700 mb-4 px-1">سجل المعاملات</h3>
                                        <div className="grid gap-3">
                                            {report.payments.history.map((tx: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn(
                                                            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border',
                                                            tx.category === 'SUBSCRIPTION' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-purple-50 border-purple-100 text-purple-600'
                                                        )}>
                                                            {tx.category === 'SUBSCRIPTION'
                                                                ? <CreditCard className="h-5 w-5" />
                                                                : <BookOpen className="h-5 w-5" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-800">
                                                                {tx.category === 'SUBSCRIPTION' ? 'اشتراك منصة' : 'شراء مذكرة'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                                                {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[15px] font-bold text-gray-900">{tx.paidAmount.toLocaleString('ar-EG')} ج</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Receipt className="h-10 w-10 mb-3 text-gray-200" />
                                    <p className="font-medium">لا توجد مدفوعات مسجلة</p>
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}

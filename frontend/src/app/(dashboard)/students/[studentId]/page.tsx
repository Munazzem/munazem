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
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';
import { StudentProfileTab } from '@/components/students/profile/StudentProfileTab';
import { StudentAttendanceTab } from '@/components/students/profile/StudentAttendanceTab';
import { StudentSubscriptionsTab } from '@/components/students/profile/StudentSubscriptionsTab';
import { StudentPaymentsTab } from '@/components/students/profile/StudentPaymentsTab';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.studentId as string;

    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const user = useAuthStore((s) => s.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const queryClient = useQueryClient();
    const [confirmSubscribeOpen, setConfirmSubscribeOpen] = useState(false);

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
            const html = await generateIdCardsHtml([student], user?.centerName, user?.logoUrl);
            printHtmlContent(html);
        } catch {
            toast.error('فشل توليد الكارت الخاص بالطالب');
        } finally {
            setCardLoading(false);
        }
    };


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

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
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
                                onClick={() => setConfirmSubscribeOpen(true)}
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
                            <StudentAttendanceTab reportLoading={reportLoading} report={report} />
                        </TabsContent>
                    )}

                    {/* ── Tab 3: Subscriptions ── */}
                    {canWrite && (
                        <TabsContent value="subscriptions" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentSubscriptionsTab reportLoading={reportLoading} report={report} />
                        </TabsContent>
                    )}

                    {/* ── Tab 4: Payments ── */}
                    {canWrite && (
                        <TabsContent value="payments" className="m-0 flex-1 p-4 sm:p-6 bg-gray-50/20">
                            <StudentPaymentsTab reportLoading={reportLoading} report={report} />
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
        </div>
    );
}

'use client';

import { useState, useRef, use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    CalendarCheck,
    ArrowRight,
    QrCode,
    Camera,
    X,
    Clock,
    Users,
    CheckCheck,
    AlertTriangle,
    History,
    DollarSign,
    Search,
    Loader2,
    Volume2,
    VolumeX,
    Printer,
} from 'lucide-react';
import {
    fetchCenterSessionById,
    recordCenterSessionAttendance,
    completeCenterSession,
    recordCenterPayment,
} from '@/lib/api/centers';
import {
    CenterSessionDetailResponse,
    CenterSessionAttendanceResponse,
} from '@/types/center.types';
import { soundEffects } from '@/lib/utils/sound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

const QrScanner = dynamic(
    () => import('@/components/scanner/QrScanner').then((m) => m.QrScanner),
    { ssr: false }
);

interface PageProps {
    params: Promise<{ groupId: string }>;
}

export default function CenterClassAttendancePage({ params }: PageProps) {
    const resolvedParams = use(params);
    const groupId = resolvedParams.groupId;
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();

    const paramDate = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState<string>(
        paramDate || new Date().toISOString().split('T')[0]
    );

    const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
    const [classBarcodeInput, setClassBarcodeInput] = useState('');
    const classBarcodeInputRef = useRef<HTMLInputElement>(null);
    const [showClassCamera, setShowClassCamera] = useState(false);
    const [lastClassScan, setLastClassScan] = useState<CenterSessionAttendanceResponse | null>(null);
    const [classStudentSearch, setClassStudentSearch] = useState('');
    const [classStatusFilter, setClassStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HAS_DEBT'>('ALL');
    const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
    const [sendNotificationsOnComplete, setSendNotificationsOnComplete] = useState(true);

    // ── Payment Modal State ───────────────────────────────────────────────────
    const [paymentModalStudent, setPaymentModalStudent] = useState<{
        studentId: string;
        studentName: string;
        studentCode?: string;
        gradeLevel?: string;
        totalRemainingDebt: number;
    } | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'INSTAPAY' | 'VODAFONE_CASH' | 'BANK_TRANSFER'>('CASH');
    const [paymentNotes, setPaymentNotes] = useState<string>('');

    const handleToggleMute = () => {
        const next = !isMuted;
        setIsMuted(next);
        soundEffects.setMuted(next);
    };

    // ── Query: Session Detail ────────────────────────────────────────────────
    const { data: sessionDetail, isLoading: loadingSessionDetail } = useQuery<CenterSessionDetailResponse>({
        queryKey: ['center', 'session-detail', groupId, selectedDate],
        queryFn: () => fetchCenterSessionById(groupId, selectedDate),
        enabled: !!groupId && !!selectedDate,
    });

    // ── Mutations: Attendance & Completion ───────────────────────────────────
    const recordSessionAttMutation = useMutation({
        mutationFn: (payload: {
            studentId?: string;
            studentIdOrCode?: string;
            status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
            source?: 'MANUAL' | 'QR_SCAN' | 'BARCODE';
        }) =>
            recordCenterSessionAttendance(groupId, {
                ...payload,
                date: selectedDate,
            }),
        onSuccess: (data, variables) => {
            if (variables.source === 'QR_SCAN' || variables.source === 'BARCODE') {
                setLastClassScan(data);
                if (data.financialStatus?.hasDebt) {
                    soundEffects.playWarning();
                } else {
                    soundEffects.playSuccess();
                }
                toast.success(
                    data.isPostCompletionEdit
                        ? `✅ تم تحديث حضور الطالب (${data.student.studentName}) وإرسال تصحيح لولي الأمر`
                        : `✅ تم تحضير الطالب: ${data.student.studentName}`
                );
                setClassBarcodeInput('');
                if (classBarcodeInputRef.current) classBarcodeInputRef.current.focus();
            } else {
                if (data.isPostCompletionEdit) {
                    toast.success(`تم تعديل حالة الطالب ${data.student.studentName} وتحديث السناب شوت وإشعار ولي الأمر`);
                }
            }
            queryClient.invalidateQueries({
                queryKey: ['center', 'session-detail', groupId, selectedDate],
            });
            queryClient.invalidateQueries({
                queryKey: ['center', 'today-sessions'],
            });
        },
        onError: (err: any) => {
            soundEffects.playWarning();
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل حضور الحصة');
        },
    });

    const completeSessionMutation = useMutation({
        mutationFn: () =>
            completeCenterSession(groupId, {
                date: selectedDate,
                sendParentNotifications: sendNotificationsOnComplete,
            }),
        onSuccess: (res) => {
            soundEffects.playSuccess();
            toast.success(
                `✅ تم إنهاء الحصة وحفظ السناب شوت (${res.stats.presentCount} حاضر / ${res.stats.absentCount} غائب)` +
                (sendNotificationsOnComplete
                    ? ` — تم إرسال ${res.notifications.sent} إشعار لأولياء الأمور`
                    : '')
            );
            setIsCompleteDialogOpen(false);
            queryClient.invalidateQueries({
                queryKey: ['center', 'session-detail', groupId, selectedDate],
            });
            queryClient.invalidateQueries({
                queryKey: ['center', 'today-sessions'],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنهاء الحصة');
        },
    });

    const collectPaymentMutation = useMutation({
        mutationFn: recordCenterPayment,
        onSuccess: () => {
            toast.success(`✅ تم تحصيل المصاريف للطالب ${paymentModalStudent?.studentName} بنجاح`);
            soundEffects.playSuccess();
            const paidAmount = Number(paymentAmount) || 0;

            if (lastClassScan && paymentModalStudent && lastClassScan.student._id === paymentModalStudent.studentId) {
                const newRem = Math.max(0, (lastClassScan.financialStatus.totalRemainingDebt || 0) - paidAmount);
                setLastClassScan({
                    ...lastClassScan,
                    financialStatus: {
                        ...lastClassScan.financialStatus,
                        totalPaid: (lastClassScan.financialStatus.totalPaid || 0) + paidAmount,
                        totalRemainingDebt: newRem,
                        hasDebt: newRem > 0,
                    },
                });
            }

            setPaymentModalStudent(null);
            queryClient.invalidateQueries({ queryKey: ['center', 'session-detail'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'today-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'financials'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تحصيل المصاريف');
        },
    });

    const handleClassBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = classBarcodeInput.trim();
        if (!code || !groupId) return;
        recordSessionAttMutation.mutate({
            studentIdOrCode: code,
            status: 'PRESENT',
            source: 'BARCODE',
        });
    };

    const handleSetClassStudentStatus = (
        studentId: string,
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
    ) => {
        if (!groupId) return;
        recordSessionAttMutation.mutate({
            studentId,
            status,
            source: 'MANUAL',
        });
    };

    const handleOpenPaymentModal = (studentInfo: {
        studentId: string;
        studentName: string;
        studentCode?: string;
        gradeLevel?: string;
        totalRemainingDebt: number;
    }) => {
        setPaymentModalStudent(studentInfo);
        setPaymentAmount(studentInfo.totalRemainingDebt > 0 ? String(studentInfo.totalRemainingDebt) : '');
        setPaymentMethod('CASH');
        setPaymentNotes(`تحصيل مصاريف من كشف الحصة (${selectedDate})`);
    };

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentModalStudent) return;
        const amt = Number(paymentAmount);
        if (!amt || amt <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح أكبر من صفر');
            return;
        }
        const debtAmt = paymentModalStudent.totalRemainingDebt || amt;
        collectPaymentMutation.mutate({
            studentId: paymentModalStudent.studentId,
            category: 'CENTER_PACKAGE',
            originalAmount: debtAmt,
            discountAmount: 0,
            paidAmount: amt,
            remainingAmount: Math.max(0, debtAmt - amt),
            description: paymentNotes.trim() || `تحصيل مصروفات من كشف الحصة (${paymentMethod})`,
        });
    };

    // ── Filtered Students ────────────────────────────────────────────────────
    const sessionStudents = sessionDetail?.students || [];
    const filteredSessionStudents = sessionStudents.filter((st) => {
        if (classStatusFilter === 'PRESENT' && st.status !== 'PRESENT' && st.status !== 'LATE') {
            return false;
        }
        if (classStatusFilter === 'ABSENT' && st.status !== 'ABSENT') {
            return false;
        }
        if (classStatusFilter === 'HAS_DEBT' && !st.financialStatus.hasDebt) {
            return false;
        }
        if (classStudentSearch.trim()) {
            const q = classStudentSearch.trim().toLowerCase();
            return (
                (st.studentName || '').toLowerCase().includes(q) ||
                (st.studentCode || '').toLowerCase().includes(q) ||
                (st.studentPhone || '').includes(q)
            );
        }
        return true;
    });

    const isSessionCompleted = sessionDetail?.session?.status === 'COMPLETED';

    return (
        <div className="space-y-5 pb-16" dir="rtl">
            {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
                <div className="flex items-center gap-3">
                    <Link href={`/center/attendance?date=${selectedDate}`}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-gray-200 hover:bg-gray-100 h-9 px-3 gap-1.5 text-xs font-black text-gray-700"
                        >
                            <ArrowRight className="w-4 h-4 ml-0.5 text-gray-500" />
                            <span>العودة لجدول الحصص</span>
                        </Button>
                    </Link>

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-gray-900">
                                {sessionDetail?.group?.name || 'كشف حضور الحصة'}
                            </h1>
                            {sessionDetail?.group?.gradeLevel && (
                                <Badge variant="outline" className="text-[10px] font-bold bg-indigo-50 text-indigo-900 border-indigo-200">
                                    {sessionDetail.group.gradeLevel}
                                </Badge>
                            )}
                        </div>
                        {sessionDetail?.teacher && (
                            <p className="text-xs text-gray-500 font-bold mt-0.5">
                                أ/ {sessionDetail.teacher.name} ({sessionDetail.teacher.subject})
                                {sessionDetail.session?.scheduledTime ? ` — ${sessionDetail.session.scheduledTime}` : ''}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-xl border border-gray-200">
                        <span className="text-[11px] font-bold text-gray-600">التاريخ:</span>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-8 w-34 rounded-lg border-gray-200 text-xs font-bold bg-white"
                        />
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleToggleMute}
                        className="rounded-xl border-gray-200 h-9 px-2.5 text-xs font-bold text-gray-600"
                    >
                        {isMuted ? (
                            <VolumeX className="w-4 h-4 text-rose-500" />
                        ) : (
                            <Volume2 className="w-4 h-4 text-emerald-600" />
                        )}
                    </Button>

                    <Link href="/center/reports">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                        >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">طباعة كشف</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {loadingSessionDetail ? (
                <div className="py-20 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-gray-100 p-8 shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <span className="text-sm font-bold text-gray-600">جاري تحميل بيانات الحصة والطلاب...</span>
                </div>
            ) : !sessionDetail ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-dashed border-gray-200 p-8">
                    <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-sm font-bold text-gray-700">لم يتم العثور على بيانات هذه الحصة</p>
                    <Link href={`/center/attendance?date=${selectedDate}`}>
                        <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs font-bold">
                            العودة للحصص
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Snapshot Banner if Session is Completed */}
                    {isSessionCompleted && (
                        <div className="bg-emerald-50 border-2 border-emerald-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                    <History className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm sm:text-base font-black text-emerald-950">
                                            تم إنهاء هذه الحصة وحفظ السناب شوت (Snapshot)
                                        </h3>
                                        {sessionDetail.session.completedAt && (
                                            <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                                وقت الإنهاء:{' '}
                                                {new Date(sessionDetail.session.completedAt).toLocaleTimeString('ar-EG', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-emerald-800 mt-0.5">
                                        يمكنك تعديل حالة الغياب أو الحضور لأي طالب بالأسفل في أي وقت — سيتم تحديث السناب شوت وإرسال إشعار <strong>[تصحيح]</strong> لولي الأمر.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Badge className="bg-emerald-700 text-white text-xs px-3 py-1 font-bold">
                                    حضر: {sessionDetail.stats.presentCount + sessionDetail.stats.lateCount}
                                </Badge>
                                <Badge className="bg-rose-600 text-white text-xs px-3 py-1 font-bold">
                                    غاب: {sessionDetail.stats.absentCount}
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* Class Scanner + Complete Session Bar */}
                    <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 border-2 border-indigo-200/80 p-4 sm:p-5 rounded-2xl shadow-xs space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-indigo-600 text-white font-bold text-xs">
                                        {sessionDetail.group.gradeLevel}
                                    </Badge>
                                    <h3 className="text-base sm:text-lg font-black text-gray-900">
                                        {sessionDetail.group.name}
                                    </h3>
                                    {sessionDetail.teacher && (
                                        <span className="text-xs font-bold text-indigo-700">
                                            — أ/ {sessionDetail.teacher.name} ({sessionDetail.teacher.subject})
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    امسح QR كارت الطالب لتحضيره فوراً أو حضّر الطلاب يدوياً من الكشف بالأسفل.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant={showClassCamera ? 'destructive' : 'outline'}
                                    size="sm"
                                    onClick={() => setShowClassCamera(!showClassCamera)}
                                    className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold"
                                >
                                    <Camera className="w-4 h-4" />
                                    <span>{showClassCamera ? 'إغلاق الكاميرا' : 'مسح بالكاميرا'}</span>
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsCompleteDialogOpen(true)}
                                    className={`rounded-xl h-9 px-3.5 gap-1.5 text-xs font-black shadow-xs ${isSessionCompleted
                                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    <span>
                                        {isSessionCompleted
                                            ? 'تحديث السناب شوت وإعادة الإرسال'
                                            : 'إنهاء الحصة وحفظ السناب شوت'}
                                    </span>
                                </Button>
                            </div>
                        </div>

                        {/* Class Camera QR Scanner */}
                        {showClassCamera && (
                            <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-300 bg-black/5 p-2 max-w-xl mx-auto">
                                <div className="flex items-center justify-between pb-2 px-2 text-xs font-bold text-gray-700">
                                    <span>وجّه الكاميرا نحو QR كارت الطالب لتحضيره</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowClassCamera(false)}
                                        className="text-gray-400 hover:text-gray-700 p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <QrScanner
                                    mode="attendance"
                                    keepOpen={true}
                                    autoStart={true}
                                    onScanned={(code) => {
                                        recordSessionAttMutation.mutate({
                                            studentIdOrCode: code,
                                            status: 'PRESENT',
                                            source: 'QR_SCAN',
                                        });
                                    }}
                                />
                            </div>
                        )}

                        {/* Class Barcode Input Form */}
                        <form onSubmit={handleClassBarcodeSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
                            <div className="relative flex-1 w-full">
                                <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600" />
                                <Input
                                    ref={classBarcodeInputRef}
                                    value={classBarcodeInput}
                                    onChange={(e) => setClassBarcodeInput(e.target.value)}
                                    placeholder="امسح باركود الطالب أو اكتب كوده لتحضيره في هذه الحصة..."
                                    className="pr-11 h-11 text-xs sm:text-sm font-bold bg-white rounded-xl border-indigo-200 focus:border-indigo-600"
                                    disabled={recordSessionAttMutation.isPending}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={recordSessionAttMutation.isPending || !classBarcodeInput.trim()}
                                className="h-11 px-5 rounded-xl font-black text-xs sm:text-sm w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {recordSessionAttMutation.isPending ? 'جاري التحضير...' : 'تحضير في الحصة'}
                            </Button>
                        </form>

                        {/* Scanned Student Result Banner inside Class Mode */}
                        {lastClassScan && (
                            <div
                                className={`p-3.5 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${lastClassScan.financialStatus?.hasDebt
                                        ? 'bg-amber-50 border-amber-300'
                                        : 'bg-emerald-50 border-emerald-300'
                                    }`}
                            >
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-black text-gray-900">
                                            {lastClassScan.student.studentName}
                                        </span>
                                        <Badge variant="outline" className="font-mono text-xs bg-white">
                                            {lastClassScan.student.studentCode}
                                        </Badge>
                                        <Badge className="bg-emerald-600 text-white text-xs font-bold">
                                            تم تحضيره بالحصة ✓
                                        </Badge>
                                    </div>
                                    {lastClassScan.financialStatus?.hasDebt ? (
                                        <div className="flex items-center gap-1.5 text-amber-900 text-xs font-black">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span>
                                                تنبيه مالي: الطالب عليه مصاريف متبقية بقيمة{' '}
                                                <span className="text-rose-700 underline font-black">
                                                    {lastClassScan.financialStatus.totalRemainingDebt} ج.م
                                                </span>
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-bold text-emerald-700">
                                            ✅ الطالب خالص المصاريف
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                            handleOpenPaymentModal({
                                                studentId: lastClassScan.student._id,
                                                studentName: lastClassScan.student.studentName,
                                                studentCode: lastClassScan.student.studentCode,
                                                gradeLevel: lastClassScan.student.gradeLevel,
                                                totalRemainingDebt:
                                                    lastClassScan.financialStatus?.totalRemainingDebt || 0,
                                            })
                                        }
                                        className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 h-8 px-3 shadow-2xs"
                                    >
                                        <DollarSign className="w-3.5 h-3.5" />
                                        <span>تحصيل المصاريف</span>
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => setLastClassScan(null)}
                                        className="text-gray-400 hover:text-gray-700 p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Class Students Sheet */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                        {/* Sheet Header & Filters */}
                        <div className="p-3.5 sm:p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                                <h4 className="text-sm sm:text-base font-black text-gray-900">
                                    كشف طلاب الحصة ({sessionDetail.stats.totalEnrolled} طالب مسجل)
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    يشمل طلاب الباكيدج لهذا الصف + طلاب البرايفت المسجلين في هذه الحصة فقط.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setClassStatusFilter('ALL')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${classStatusFilter === 'ALL'
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    الكل ({sessionDetail.stats.totalEnrolled})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClassStatusFilter('PRESENT')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${classStatusFilter === 'PRESENT'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        }`}
                                >
                                    حاضر ({sessionDetail.stats.presentCount + sessionDetail.stats.lateCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClassStatusFilter('ABSENT')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${classStatusFilter === 'ABSENT'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                        }`}
                                >
                                    غائب ({sessionDetail.stats.absentCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setClassStatusFilter('HAS_DEBT')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${classStatusFilter === 'HAS_DEBT'
                                            ? 'bg-amber-600 text-white'
                                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        }`}
                                >
                                    عليه مصاريف ({sessionStudents.filter((s) => s.financialStatus.hasDebt).length})
                                </button>

                                {/* Search Input */}
                                <div className="relative w-full sm:w-48">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <Input
                                        value={classStudentSearch}
                                        onChange={(e) => setClassStudentSearch(e.target.value)}
                                        placeholder="بحث بالاسم أو الكود..."
                                        className="pr-8 h-8 text-xs rounded-xl bg-gray-50 border-gray-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {filteredSessionStudents.length === 0 ? (
                            <div className="py-12 text-center text-xs text-gray-400">
                                لا يوجد طلاب مطابقين للبحث في هذه الحصة.
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-right text-gray-500 text-xs bg-gray-50/50">
                                                <th className="px-4 py-2.5 font-semibold">#</th>
                                                <th className="px-4 py-2.5 font-semibold">الطالب</th>
                                                <th className="px-4 py-2.5 font-semibold">الكود</th>
                                                <th className="px-4 py-2.5 font-semibold">نوع الاشتراك</th>
                                                <th className="px-4 py-2.5 font-semibold text-center">الموقف المالي</th>
                                                <th className="px-4 py-2.5 font-semibold text-center">حالة الحضور بالحصة</th>
                                                <th className="px-4 py-2.5 font-semibold text-center">تحصيل مصاريف</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredSessionStudents.map((st, idx) => (
                                                <tr key={st._id} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <Link
                                                            href={`/center/students/${st._id}`}
                                                            className="font-bold text-gray-900 hover:text-primary transition-colors block"
                                                        >
                                                            {st.studentName}
                                                        </Link>
                                                        {st.studentPhone && (
                                                            <span className="text-[11px] text-gray-400 dir-ltr block text-right">
                                                                {st.studentPhone}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-gray-600">
                                                        {st.studentCode}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] font-bold ${st.enrollmentType === 'PACKAGE'
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : st.enrollmentType === 'PRIVATE'
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                }`}
                                                        >
                                                            {st.enrollmentType === 'PACKAGE'
                                                                ? `باكيدج ${st.packageName || ''}`
                                                                : st.enrollmentType === 'PRIVATE'
                                                                    ? 'حصة برايفت'
                                                                    : 'باكيدج + برايفت'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        {st.financialStatus.hasDebt ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-amber-50 text-amber-900 border-amber-300 text-[11px] font-black"
                                                            >
                                                                متبقي {st.financialStatus.totalRemainingDebt} ج.م
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold"
                                                            >
                                                                خالص
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetClassStudentStatus(st._id, 'PRESENT')}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${st.status === 'PRESENT'
                                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                                                                    }`}
                                                            >
                                                                حاضر
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetClassStudentStatus(st._id, 'ABSENT')}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${st.status === 'ABSENT'
                                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                                                                    }`}
                                                            >
                                                                غائب
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetClassStudentStatus(st._id, 'LATE')}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${st.status === 'LATE'
                                                                        ? 'bg-amber-500 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                                                                    }`}
                                                            >
                                                                متأخر
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetClassStudentStatus(st._id, 'EXCUSED')}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${st.status === 'EXCUSED'
                                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                                                    }`}
                                                            >
                                                                معذور
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenPaymentModal({
                                                                    studentId: st._id,
                                                                    studentName: st.studentName,
                                                                    studentCode: st.studentCode,
                                                                    gradeLevel: st.gradeLevel,
                                                                    totalRemainingDebt: st.financialStatus.totalRemainingDebt,
                                                                })
                                                            }
                                                            className={`h-7 px-2.5 rounded-lg text-xs font-bold gap-1 ${st.financialStatus.hasDebt
                                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                    : 'border-gray-200 text-gray-700'
                                                                }`}
                                                        >
                                                            <DollarSign className="w-3 h-3" />
                                                            <span>تحصيل</span>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Feed View */}
                                <div className="block md:hidden divide-y divide-gray-100">
                                    {filteredSessionStudents.map((st) => (
                                        <div key={st._id} className="p-3.5 space-y-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="space-y-0.5">
                                                    <Link
                                                        href={`/center/students/${st._id}`}
                                                        className="font-bold text-gray-900 hover:text-primary text-sm"
                                                    >
                                                        {st.studentName}
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                        <span className="font-mono font-bold">{st.studentCode}</span>
                                                        <span>•</span>
                                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold">
                                                            {st.enrollmentType === 'PACKAGE' ? 'باكيدج' : 'برايفت'}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {st.financialStatus.hasDebt ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-black">
                                                            عليه {st.financialStatus.totalRemainingDebt} ج.م
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                                            خالص
                                                        </Badge>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleOpenPaymentModal({
                                                                studentId: st._id,
                                                                studentName: st.studentName,
                                                                studentCode: st.studentCode,
                                                                gradeLevel: st.gradeLevel,
                                                                totalRemainingDebt: st.financialStatus.totalRemainingDebt,
                                                            })
                                                        }
                                                        className={`h-7 px-2 rounded-lg text-[10px] font-bold gap-1 shrink-0 ${st.financialStatus.hasDebt
                                                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                : 'bg-gray-100 text-gray-700'
                                                            }`}
                                                    >
                                                        <DollarSign className="w-3 h-3" />
                                                        <span>تحصيل</span>
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetClassStudentStatus(st._id, 'PRESENT')}
                                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'PRESENT'
                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    حاضر
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetClassStudentStatus(st._id, 'ABSENT')}
                                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'ABSENT'
                                                            ? 'bg-rose-600 text-white shadow-xs'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    غائب
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetClassStudentStatus(st._id, 'LATE')}
                                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'LATE'
                                                            ? 'bg-amber-500 text-white shadow-xs'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    متأخر
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetClassStudentStatus(st._id, 'EXCUSED')}
                                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'EXCUSED'
                                                            ? 'bg-blue-600 text-white shadow-xs'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}
                                                >
                                                    معذور
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── Complete Session Dialog ────────────────────────────────────── */}
            <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-base font-black flex items-center gap-2">
                            <CheckCheck className="w-5 h-5 text-indigo-600" />
                            <span>
                                {isSessionCompleted
                                    ? 'تحديث السناب شوت وإعادة الإرسال'
                                    : 'إنهاء الحصة وحفظ السناب شوت'}
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs text-gray-600">
                        <p>
                            سيتم حفظ كشف الحضور والغياب لهذه الحصة نهائياً كسناب شوت، وتسجيل إحصائيات الحاضرين والغائبين.
                        </p>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs font-bold">
                            <span className="text-emerald-700">
                                حاضر: {(sessionDetail?.stats.presentCount || 0) + (sessionDetail?.stats.lateCount || 0)} طالب
                            </span>
                            <span className="text-rose-700">
                                غائب: {sessionDetail?.stats.absentCount || 0} طالب
                            </span>
                            <span className="text-gray-700">
                                الإجمالي: {sessionDetail?.stats.totalEnrolled || 0}
                            </span>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 pt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sendNotificationsOnComplete}
                                onChange={(e) => setSendNotificationsOnComplete(e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>إرسال إشعارات فورية لأولياء الأمور على تطبيق ولي الأمر بحالة الطالب</span>
                        </label>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCompleteDialogOpen(false)}
                            className="rounded-xl"
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="button"
                            onClick={() => completeSessionMutation.mutate()}
                            disabled={completeSessionMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
                        >
                            {completeSessionMutation.isPending ? 'جاري الحفظ...' : 'تأكيد الإنهاء وحفظ السناب شوت'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Quick Fee Collection Modal ─────────────────────────────────── */}
            <Dialog open={!!paymentModalStudent} onOpenChange={(open) => !open && setPaymentModalStudent(null)}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-base font-black flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            <span>تحصيل مصاريف الطالب</span>
                        </DialogTitle>
                    </DialogHeader>

                    {paymentModalStudent && (
                        <form onSubmit={handlePaymentSubmit} className="space-y-4 py-2">
                            <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between font-bold">
                                    <span className="text-gray-900 font-black">{paymentModalStudent.studentName}</span>
                                    <span className="text-gray-500 font-mono">{paymentModalStudent.studentCode}</span>
                                </div>
                                <div className="text-amber-900 font-bold">
                                    المديونية المتبقية:{' '}
                                    <span className="text-rose-700 font-black text-sm">
                                        {paymentModalStudent.totalRemainingDebt} ج.م
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700">المبلغ المدفوع (ج.م) *</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="أدخل المبلغ..."
                                    className="h-10 text-sm font-bold rounded-xl"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700">طريقة الدفع *</label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {[
                                        { id: 'CASH', label: 'كاش (نقدي)' },
                                        { id: 'INSTAPAY', label: 'إنستاباي (InstaPay)' },
                                        { id: 'VODAFONE_CASH', label: 'فودافون كاش' },
                                        { id: 'BANK_TRANSFER', label: 'تحويل بنكي' },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPaymentMethod(m.id as any)}
                                            className={`p-2 rounded-xl border text-center font-bold transition-all ${paymentMethod === m.id
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700">ملاحظات التحصيل (اختياري)</label>
                                <Input
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="ملاحظات..."
                                    className="h-9 text-xs rounded-xl"
                                />
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPaymentModalStudent(null)}
                                    className="rounded-xl"
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={collectPaymentMutation.isPending}
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold"
                                >
                                    {collectPaymentMutation.isPending ? 'جاري التحصيل...' : 'تأكيد التحصيل'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}


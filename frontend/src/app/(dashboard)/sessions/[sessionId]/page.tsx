'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSessionById, updateSessionStatus } from '@/lib/api/sessions';
import {
    recordAttendance,
    getSessionAttendance,
    updateAttendance,
    completeSession,
    getSessionSnapshot,
    getWhatsAppLinks,
    fetchAttendanceHtml,
    type IWhatsAppLink,
} from '@/lib/api/attendance';
import { printHtmlContent } from '@/lib/utils/print';
import { fetchStudents, updateStudent } from '@/lib/api/students';
import { useAuthStore } from '@/lib/store/auth.store';
import dynamic from 'next/dynamic';
const QRScannerPanel = dynamic(
    () => import('@/components/sessions/QRScannerPanel').then(m => m.QRScannerPanel),
    { ssr: false }
);
import { BatchSubscriptionModal } from '@/components/payments/BatchSubscriptionModal';
import { SetExcuseModal } from '@/components/sessions/SetExcuseModal';
import { EditAttendanceDialog } from '@/components/sessions/EditAttendanceDialog';
import { StudentSearchResults } from '@/components/sessions/StudentSearchResults';
import { SnapshotSummary } from '@/components/sessions/SnapshotSummary';
import { WhatsAppLinksDialog } from '@/components/sessions/WhatsAppLinksDialog';
import { toast } from 'sonner';
import {
    ArrowRight,
    CheckCircle2,
    XCircle,
    Clock,
    Users,
    AlertTriangle,
    AlertCircle,
    Loader2,
    UserCheck,
    UserX,
    Edit2,
    CalendarCheck,
    MessageSquare,
    ExternalLink,
    Send,
    Receipt,
    FileDown,
} from 'lucide-react';
import { ReportCardSkeleton } from '@/components/layout/skeletons/ReportCardSkeleton';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { IAttendanceRecord, IAttendanceSnapshot, AttendanceStatus } from '@/types/session.types';

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
    PRESENT: 'حاضر',
    ABSENT: 'غائب',
    LATE: 'متأخر',
    EXCUSED: 'مُستأذن',
};

const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-green-100 text-green-700 border-green-200',
    ABSENT: 'bg-red-100 text-red-600 border-red-200',
    LATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    EXCUSED: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: 'مجدولة',
    IN_PROGRESS: 'جارية',
    COMPLETED: 'منتهية',
    CANCELLED: 'ملغية',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SessionDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';

    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [editRecord, setEditRecord] = useState<IAttendanceRecord | null>(null);
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    // Excused Absence State
    const [excuseStudent, setExcuseStudent] = useState<any | null>(null);
    const [showAllStudents, setShowAllStudents] = useState(false);

    const handleDownloadAttendancePdf = async () => {
        setPdfLoading(true);
        try {
            const html = await fetchAttendanceHtml(sessionId);
            printHtmlContent(html);
        } catch {
            toast.error('فشل تحميل تقرير الحضور');
        } finally {
            setPdfLoading(false);
        }
    };

    // Fetch session
    const { data: session, isLoading: sessionLoading } = useQuery({
        queryKey: ['session', sessionId],
        queryFn: () => fetchSessionById(sessionId),
        refetchInterval: 30000,
    });

    // Fetch attendance records (live polling every 5s when IN_PROGRESS)
    const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
        queryKey: ['attendance', sessionId],
        queryFn: () => getSessionAttendance(sessionId),
        refetchInterval: session?.status === 'IN_PROGRESS' ? 5000 : false,
        enabled: !!session,
    });

    // Fetch snapshot if completed
    const { data: snapshot } = useQuery({
        queryKey: ['snapshot', sessionId],
        queryFn: () => getSessionSnapshot(sessionId),
        enabled: session?.status === 'COMPLETED',
    });

    // Fetch students for the group (includes hasActiveSubscription)
    const groupId = typeof session?.groupId === 'object'
        ? (session.groupId as any)._id
        : session?.groupId ?? '';

    const { data: groupStudentsData } = useQuery({
        queryKey: ['students', { groupId, limit: 200 }],
        queryFn: () => fetchStudents({ groupId, limit: 200 }),
        enabled: !!groupId,
    });

    // Build a map: studentId → hasActiveSubscription
    const subscriptionMap = new Map<string, boolean>(
        (groupStudentsData?.data ?? []).map((s) => [s._id, s.hasActiveSubscription ?? true])
    );

    const alreadyRecordedIds = new Set(
        attendanceRecords
            .map((r) => (r.studentId as any)?._id ?? (r.studentId as any))
            .filter(Boolean)
    );

    // Start session (mark IN_PROGRESS) when recording first attendance
    const ensureInProgress = useCallback(async () => {
        if (session?.status === 'SCHEDULED') {
            try {
                // Optimistically update session status
                queryClient.setQueryData(['session', sessionId], (old: any) => ({ ...old, status: 'IN_PROGRESS' }));
                await updateSessionStatus(sessionId, 'IN_PROGRESS');
                queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
                queryClient.invalidateQueries({ queryKey: ['sessions'] });
            } catch (err) {
                console.error('Failed to update session status:', err);
            }
        }
    }, [session?.status, sessionId, queryClient]);

    // Record attendance
    const recordMutation = useMutation({
        mutationFn: async (studentId: string) => {
            await ensureInProgress();
            return recordAttendance({
                sessionId,
                studentId,
                status: 'PRESENT',
            });
        },
        onMutate: async (studentId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['attendance', sessionId] });

            // Snapshot previous value
            const previousAttendance = queryClient.getQueryData<IAttendanceRecord[]>(['attendance', sessionId]) || [];

            // Find student info for optimistic record
            const student = groupStudentsData?.data?.find(s => s._id === studentId);
            
            // Create optimistic record
            const optimisticRecord: any = {
                _id: `temp-${Date.now()}`,
                studentId: student || { _id: studentId, studentName: 'جاري التحميل...', studentCode: '...' },
                sessionId,
                status: 'PRESENT',
                scannedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            // Update cache
            queryClient.setQueryData(['attendance', sessionId], [...previousAttendance, optimisticRecord]);

            return { previousAttendance };
        },
        onSuccess: (record) => {
            const name = (record.studentId as any)?.studentName ?? 'الطالب';
            const guestSuffix = (record as any).isGuest ? ' (طالب زائر)' : '';
            toast.success(`تم تسجيل حضور ${name}${guestSuffix}`);
        },
        onError: (err: any, studentId, context) => {
            // Rollback optimistic update
            if (context?.previousAttendance) {
                queryClient.setQueryData(['attendance', sessionId], context.previousAttendance);
            }

            const msg = err?.response?.data?.message ?? 'حدث خطأ (قد يكون بسبب انقطاع الاتصال)';
            if (msg.includes('بالفعل')) {
                toast.warning('تم تسجيل حضور هذا الطالب مسبقاً');
            } else {
                toast.error(msg);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance', sessionId] });
            setSearchQuery('');
        },
    });

    // Update attendance status
    const updateMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
            updateAttendance(id, status),
        onSuccess: () => {
            toast.success('تم تحديث الحضور');
            queryClient.invalidateQueries({ queryKey: ['attendance', sessionId] });
            setEditRecord(null);
        },
        onError: (err: any) => {
            
        },
    });

    // Record excuse
    const setExcuseMutation = useMutation({
        mutationFn: async ({ studentId, count }: { studentId: string; count: number }) => {
            // 1. Update student excusedSessionsCount
            await updateStudent(studentId, { excusedSessionsCount: count });
            
            // 2. Record attendance as EXCUSED for this session
            await ensureInProgress();
            return recordAttendance({
                sessionId,
                studentId,
                status: 'EXCUSED',
                notes: `مُستأذن لـ ${count} حصص (بدءاً من هذه الحصة)`
            });
        },
        onSuccess: (record) => {
            const name = (record.studentId as any)?.studentName ?? 'الطالب';
            toast.success(`تم تسجيل إذن غياب لـ ${name}`);
            queryClient.invalidateQueries({ queryKey: ['attendance', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['student_detail'] });
            setExcuseStudent(null);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء حفظ الإذن');
        }
    });

    // Complete session
    const completeMutation = useMutation({
        mutationFn: () => completeSession(sessionId),
        onSuccess: (result) => {
            toast.success('تم إنهاء الحصة وحفظ السجل');
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.setQueryData(['snapshot', sessionId], result.snapshot);
            setShowCompleteConfirm(false);
        },
        onError: (err: any) => {
            
        },
    });

    const handleQRScan = useCallback(async (studentId: string) => {
        if (alreadyRecordedIds.has(studentId)) {
            toast.warning('تم تسجيل هذا الطالب مسبقاً');
            return;
        }
        // Use non-async mutate for instant UI feedback, but match the expected Promise return type
        recordMutation.mutate(studentId);
    }, [alreadyRecordedIds, recordMutation]);

    const groupName =
        typeof session?.groupId === 'object'
            ? (session.groupId as any).name
            : '—';

    const isSessionActive =
        session?.status === 'SCHEDULED' || session?.status === 'IN_PROGRESS';

    if (sessionLoading) {
        return <div className="p-6"><ReportCardSkeleton /></div>;
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-3" dir="rtl">
                <XCircle className="h-10 w-10 text-gray-300" />
                <p className="text-gray-500">الحصة غير موجودة</p>
                <Button variant="outline" onClick={() => router.push('/sessions')}>
                    العودة للحصص
                </Button>
            </div>
        );
    }

    const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'ABSENT').length;

    return (
        <div className="min-h-screen bg-gray-50/30 p-3 sm:p-4 lg:p-6" dir="rtl">
            {/* Header */}
            <div className="mb-4 sm:mb-5">
                <button
                    onClick={() => router.push('/sessions')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
                >
                    <ArrowRight className="h-4 w-4" />
                    الرجوع للحصص
                </button>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                            {groupName}
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            {new Date(session.date).toLocaleDateString('ar-EG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })} — {session.startTime}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium',
                            STATUS_COLORS[session.status]
                        )}>
                            {STATUS_LABELS[session.status]}
                        </span>
                        {canWrite && isSessionActive && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowCompleteConfirm(true)}
                                className="gap-1.5 text-xs sm:text-sm"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                إنهاء الحصة
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-3 shadow-sm text-center">
                    <p className="text-lg sm:text-xl font-bold text-green-700">{presentCount}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">حاضر</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-3 shadow-sm text-center">
                    <p className="text-lg sm:text-xl font-bold text-red-600">{absentCount}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">غائب</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-3 shadow-sm text-center">
                    <p className="text-lg sm:text-xl font-bold text-blue-700">{attendanceRecords.length}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">إجمالي</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                {/* Left Panel — QR Scanner (assistant only, active sessions) */}
                {canWrite && isSessionActive && (
                    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5 shadow-sm">
                        <QRScannerPanel
                            sessionId={sessionId}
                            onScan={handleQRScan}
                            onManualSearch={(q) => setSearchQuery(q)}
                            disabled={recordMutation.isPending}
                        />
                        {/* Search Results */}
                        {searchQuery && (
                            <div className="mt-3">
                                <StudentSearchResults
                                    sessionId={sessionId}
                                    groupId={groupId}
                                    search={searchQuery}
                                    alreadyRecordedIds={alreadyRecordedIds}
                                    onRecord={(studentId) => recordMutation.mutate(studentId)}
                                    onClose={() => setSearchQuery('')}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Right Panel — Live Attendance List */}
                <div className={cn(
                    'flex flex-col gap-3',
                    (!canWrite || !isSessionActive) && 'lg:col-span-2'
                )}>
                    {/* Attendance List */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                قائمة الحضور
                                {session.status === 'IN_PROGRESS' && (
                                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        مباشر
                                    </span>
                                )}
                            </h3>
                            <span className="text-sm text-gray-400">{attendanceRecords.length} سجل</span>
                        </div>

                        {attendanceLoading ? (
                            <div className="p-5">
                                <TableSkeleton rows={10} columns={4} />
                            </div>
                        ) : attendanceRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                <Users className="h-10 w-10 text-gray-200" />
                                <p className="text-sm">لم يُسجَّل حضور بعد</p>
                                {canWrite && isSessionActive && (
                                    <p className="text-xs">استخدم الكاميرا أو البحث اليدوي لتسجيل الحضور</p>
                                )}
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {attendanceRecords.map((record) => {
                                    const student = record.studentId as any;
                                    return (
                                        <li
                                            key={record._id}
                                            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-gray-50/60 transition-colors"
                                        >
                                            <div className={cn(
                                                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                                record.status === 'PRESENT' ? 'bg-green-100' :
                                                record.status === 'LATE' ? 'bg-yellow-100' : 
                                                record.status === 'EXCUSED' ? 'bg-blue-100' : 'bg-red-100'
                                            )}>
                                                {record.status === 'ABSENT' ? (
                                                    <UserX className="h-4 w-4 text-red-500" />
                                                ) : record.status === 'EXCUSED' ? (
                                                    <Clock className="h-4 w-4 text-blue-600" />
                                                ) : (
                                                    <UserCheck className={cn(
                                                        'h-4 w-4',
                                                        record.status === 'LATE' ? 'text-yellow-600' : 'text-green-600'
                                                    )} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-gray-800 truncate">
                                                        {student?.studentName ?? '—'}
                                                    </p>
                                                    {(record as any).isGuest && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50 shrink-0">
                                                            زائر
                                                        </Badge>
                                                    )}
                                                    {subscriptionMap.get(student?._id ?? '') === false && (
                                                        <span
                                                            title="غير مشترك هذا الشهر"
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0"
                                                        >
                                                            <AlertCircle className="h-2.5 w-2.5" />
                                                            غير مشترك
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {student?.studentCode} · {' '}
                                                    {new Date(record.scannedAt).toLocaleTimeString('ar-EG', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                    {record._id.toString().startsWith('temp-') && (
                                                        <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mr-2 inline-flex">
                                                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                            جاري المزامنة...
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                'text-xs px-2 py-0.5 rounded-full border font-medium',
                                                ATTENDANCE_COLORS[record.status]
                                            )}>
                                                {ATTENDANCE_LABELS[record.status]}
                                            </span>
                                            {canWrite && isSessionActive && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-gray-400 hover:text-gray-600"
                                                    onClick={() => setEditRecord(record)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Missing Students Section */}
                    {canWrite && isSessionActive && (groupStudentsData?.data?.length ?? 0) > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setShowAllStudents(!showAllStudents)}
                                className="w-full flex items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            >
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <UserX className="h-5 w-5 text-gray-400" />
                                    طلاب لم يحضروا بعد
                                    <Badge variant="outline" className="mr-2 text-gray-400 border-gray-200">
                                        {(groupStudentsData?.data ?? []).filter(s => !alreadyRecordedIds.has(s._id)).length}
                                    </Badge>
                                </h3>
                                <div className="flex items-center gap-2 h-7 w-7 rounded-lg bg-gray-50 text-gray-400">
                                    <Edit2 className={cn("h-4 w-4 mx-auto transition-transform", showAllStudents ? "rotate-180" : "")} />
                                </div>
                            </button>

                            {showAllStudents && (
                                <ul className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                                    {(groupStudentsData?.data ?? [])
                                        .filter(s => !alreadyRecordedIds.has(s._id))
                                        .map((student) => (
                                            <li
                                                key={student._id}
                                                className="flex items-center justify-between px-3 sm:px-5 py-2.5 hover:bg-gray-50/60 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate">{student.studentName}</p>
                                                    <p className="text-[10px] text-gray-400">{student.studentCode}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                                                        onClick={() => setExcuseStudent(student)}
                                                    >
                                                        <CalendarCheck className="h-3.5 w-3.5" />
                                                        تسجيل إذن
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-primary hover:bg-primary/5"
                                                        onClick={() => recordMutation.mutate(student._id)}
                                                    >
                                                        تحضير
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Snapshot (after completion) */}
            {session.status === 'COMPLETED' && snapshot && (
                <div className="mt-3 sm:mt-5 space-y-3">
                    <SnapshotSummary snapshot={snapshot} />
                    <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2">
                        {canWrite && (
                            <BatchSubscriptionModal />
                        )}
                        <Button
                            variant="outline"
                            onClick={handleDownloadAttendancePdf}
                            disabled={pdfLoading}
                            className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50 w-full sm:w-auto"
                        >
                            {pdfLoading
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <FileDown className="h-4 w-4" />
                            }
                            تقرير الحضور PDF
                        </Button>
                        <Button
                            onClick={() => setShowWhatsApp(true)}
                            className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white w-full sm:w-auto"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">إرسال رسائل واتساب لأولياء الأمور</span>
                            <span className="sm:hidden">واتساب لأولياء الأمور</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Set Excuse Modal */}
            {excuseStudent && (
                <SetExcuseModal
                    student={excuseStudent}
                    onClose={() => setExcuseStudent(null)}
                    onSave={(count) => setExcuseMutation.mutate({ studentId: excuseStudent._id, count })}
                    isSaving={setExcuseMutation.isPending}
                />
            )}

            {/* Complete Session Confirm Dialog */}
            <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
                <DialogContent className="sm:max-w-[400px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            إنهاء الحصة
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 text-sm text-gray-600">
                        <p>هل أنت متأكد من إنهاء الحصة؟</p>
                        <p className="mt-1 text-gray-500">سيتم حفظ سجل الحضور ولن تتمكن من تعديله لاحقاً.</p>
                        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                            <p>الحاضرون: <span className="font-semibold text-green-700">{presentCount}</span></p>
                            <p>الغائبون: <span className="font-semibold text-red-600">{absentCount}</span></p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCompleteConfirm(false)}
                            disabled={completeMutation.isPending}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => completeMutation.mutate()}
                            disabled={completeMutation.isPending}
                        >
                            {completeMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            )}
                            تأكيد الإنهاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Attendance Dialog */}
            {editRecord && (
                <EditAttendanceDialog
                    record={editRecord}
                    onClose={() => setEditRecord(null)}
                    onSave={(status) =>
                        updateMutation.mutate({ id: editRecord._id, status })
                    }
                />
            )}

            {/* WhatsApp Links Dialog */}
            {showWhatsApp && (
                <WhatsAppLinksDialog
                    sessionId={sessionId}
                    open={showWhatsApp}
                    onClose={() => setShowWhatsApp(false)}
                />
            )}
        </div>
    );
}

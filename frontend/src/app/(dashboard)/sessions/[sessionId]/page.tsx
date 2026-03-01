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
    downloadAttendancePdf,
    type IWhatsAppLink,
} from '@/lib/api/attendance';
import { downloadBlob } from '@/lib/utils/download';
import { fetchStudents } from '@/lib/api/students';
import { useAuthStore } from '@/lib/store/auth.store';
import { QRScannerPanel } from '@/components/sessions/QRScannerPanel';
import { BatchSubscriptionModal } from '@/components/payments/BatchSubscriptionModal';
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
import { Button } from '@/components/ui/button';
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
};

const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-green-100 text-green-700 border-green-200',
    ABSENT: 'bg-red-100 text-red-600 border-red-200',
    LATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
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

// ─── Edit Attendance Dialog ───────────────────────────────────────────────────
function EditAttendanceDialog({
    record,
    onClose,
    onSave,
}: {
    record: IAttendanceRecord;
    onClose: () => void;
    onSave: (status: AttendanceStatus, notes?: string) => void;
}) {
    const [status, setStatus] = useState<AttendanceStatus>(record.status);

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[360px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit2 className="h-4 w-4 text-primary" />
                        تعديل حضور الطالب
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <p className="text-sm text-gray-600 mb-3">
                        الطالب: <span className="font-semibold">{(record.studentId as any)?.studentName ?? '—'}</span>
                    </p>
                    <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>
                                    {ATTENDANCE_LABELS[s]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>إلغاء</Button>
                    <Button onClick={() => onSave(status)}>حفظ</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Student Search Results Panel ────────────────────────────────────────────
function StudentSearchResults({
    sessionId,
    groupId,
    search,
    alreadyRecordedIds,
    onRecord,
    onClose,
}: {
    sessionId: string;
    groupId: string;
    search: string;
    alreadyRecordedIds: Set<string>;
    onRecord: (studentId: string) => void;
    onClose: () => void;
}) {
    const { data } = useQuery({
        queryKey: ['students-search', groupId, search],
        queryFn: () => fetchStudents({ groupId, search, limit: 10 }),
        enabled: search.length >= 1,
    });

    const students = data?.data ?? [];

    if (students.length === 0) return null;

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">نتائج البحث</span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {students.map((student) => {
                    const already = alreadyRecordedIds.has(student._id);
                    return (
                        <li key={student._id}>
                            <button
                                className={cn(
                                    'w-full flex items-center justify-between px-3 py-2.5 text-sm text-right transition-colors',
                                    already
                                        ? 'bg-green-50 text-green-700 cursor-default'
                                        : 'hover:bg-primary/5 text-gray-700'
                                )}
                                onClick={() => !already && onRecord(student._id)}
                                disabled={already}
                            >
                                <span className="font-medium">{student.studentName}</span>
                                <span className="text-xs text-gray-400">{student.studentCode}</span>
                                {already && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mr-2">
                                        مسجل
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ─── Snapshot Summary ─────────────────────────────────────────────────────────
function SnapshotSummary({ snapshot }: { snapshot: IAttendanceSnapshot }) {
    const rate = snapshot.totalCount > 0
        ? Math.round((snapshot.presentCount / snapshot.totalCount) * 100)
        : 0;

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                ملخص الحصة
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center bg-green-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-green-700">{snapshot.presentCount}</p>
                    <p className="text-xs text-green-600 mt-1">حاضر</p>
                </div>
                <div className="text-center bg-red-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-600">{snapshot.absentCount}</p>
                    <p className="text-xs text-red-500 mt-1">غائب</p>
                </div>
                <div className="text-center bg-blue-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-blue-700">{rate}%</p>
                    <p className="text-xs text-blue-600 mt-1">نسبة الحضور</p>
                </div>
            </div>

            {snapshot.absentStudents.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">الغائبون:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {snapshot.absentStudents.map((s) => (
                            <span
                                key={s.studentId}
                                className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100"
                            >
                                {s.studentName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── WhatsApp Links Dialog ────────────────────────────────────────────────────
function WhatsAppLinksDialog({
    sessionId,
    open,
    onClose,
}: {
    sessionId: string;
    open: boolean;
    onClose: () => void;
}) {
    const { data: links = [], isLoading } = useQuery({
        queryKey: ['whatsapp-links', sessionId],
        queryFn: () => getWhatsAppLinks(sessionId),
        enabled: open,
    });

    const present = links.filter((l) => l.status === 'PRESENT');
    const absent  = links.filter((l) => l.status === 'ABSENT');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                        إرسال رسائل واتساب لأولياء الأمور
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        جارٍ التحميل...
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 -mx-6 px-6">
                        {/* Summary */}
                        <div className="flex gap-3 mb-4">
                            <div className="flex-1 bg-green-50 rounded-lg p-3 text-center border border-green-100">
                                <p className="text-lg font-bold text-green-700">{present.length}</p>
                                <p className="text-xs text-green-600">حاضر</p>
                            </div>
                            <div className="flex-1 bg-red-50 rounded-lg p-3 text-center border border-red-100">
                                <p className="text-lg font-bold text-red-600">{absent.length}</p>
                                <p className="text-xs text-red-500">غائب</p>
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-gray-700">{links.length}</p>
                                <p className="text-xs text-gray-500">إجمالي</p>
                            </div>
                        </div>

                        {/* Absent first (priority) */}
                        {absent.length > 0 && (
                            <div className="mb-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    الغائبون — {absent.length}
                                </p>
                                <ul className="space-y-1.5">
                                    {absent.map((l) => (
                                        <li key={l.studentId}>
                                            <a
                                                href={l.whatsappLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserX className="h-4 w-4 text-red-400 shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800">{l.studentName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Send className="h-3.5 w-3.5" />
                                                    فتح واتساب
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Present */}
                        {present.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    الحاضرون — {present.length}
                                </p>
                                <ul className="space-y-1.5">
                                    {present.map((l) => (
                                        <li key={l.studentId}>
                                            <a
                                                href={l.whatsappLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-green-100 bg-green-50 hover:bg-green-100 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800">{l.studentName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Send className="h-3.5 w-3.5" />
                                                    فتح واتساب
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 mt-2">
                    <p className="text-xs text-gray-400 text-center">
                        اضغط على اسم الطالب لفتح محادثة واتساب مع ولي الأمر
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SessionDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const isAssistant = user?.role === 'assistant';

    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [editRecord, setEditRecord] = useState<IAttendanceRecord | null>(null);
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [showBatchSubscribe, setShowBatchSubscribe] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const handleDownloadAttendancePdf = async () => {
        setPdfLoading(true);
        try {
            const blob = await downloadAttendancePdf(sessionId);
            downloadBlob(blob, `تقرير-حضور-${sessionId}.pdf`);
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
            await updateSessionStatus(sessionId, 'IN_PROGRESS');
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
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
        onSuccess: (record) => {
            const name = (record.studentId as any)?.studentName ?? 'الطالب';
            toast.success(`تم تسجيل حضور ${name}`);
            queryClient.invalidateQueries({ queryKey: ['attendance', sessionId] });
            setSearchQuery('');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message ?? 'حدث خطأ';
            if (msg.includes('بالفعل')) {
                toast.warning('تم تسجيل حضور هذا الطالب مسبقاً');
            } else {
                toast.error(msg);
            }
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
            toast.error(err?.response?.data?.message ?? 'حدث خطأ');
        },
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
            toast.error(err?.response?.data?.message ?? 'حدث خطأ');
        },
    });

    const handleQRScan = useCallback(async (studentId: string) => {
        if (alreadyRecordedIds.has(studentId)) {
            toast.warning('تم تسجيل هذا الطالب مسبقاً');
            return;
        }
        await recordMutation.mutateAsync(studentId);
    }, [alreadyRecordedIds, recordMutation]);

    const groupName =
        typeof session?.groupId === 'object'
            ? (session.groupId as any).name
            : '—';

    const isSessionActive =
        session?.status === 'SCHEDULED' || session?.status === 'IN_PROGRESS';

    if (sessionLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
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
        <div className="min-h-screen bg-gray-50/30 p-4 lg:p-6" dir="rtl">
            {/* Header */}
            <div className="mb-5">
                <button
                    onClick={() => router.push('/sessions')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
                >
                    <ArrowRight className="h-4 w-4" />
                    الرجوع للحصص
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {groupName}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {new Date(session.date).toLocaleDateString('ar-EG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })} — {session.startTime}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium',
                            STATUS_COLORS[session.status]
                        )}>
                            {STATUS_LABELS[session.status]}
                        </span>
                        {isAssistant && isSessionActive && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setShowCompleteConfirm(true)}
                                className="gap-1.5"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                إنهاء الحصة
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
                    <p className="text-xl font-bold text-green-700">{presentCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">حاضر</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
                    <p className="text-xl font-bold text-red-600">{absentCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">غائب</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center">
                    <p className="text-xl font-bold text-blue-700">{attendanceRecords.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">إجمالي</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Panel — QR Scanner (assistant only, active sessions) */}
                {isAssistant && isSessionActive && (
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
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
                    'bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden',
                    (!isAssistant || !isSessionActive) && 'lg:col-span-2'
                )}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
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
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="h-5 w-5 animate-spin ml-2" />
                            تحميل...
                        </div>
                    ) : attendanceRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                            <Users className="h-10 w-10 text-gray-200" />
                            <p className="text-sm">لم يُسجَّل حضور بعد</p>
                            {isAssistant && isSessionActive && (
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
                                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors"
                                    >
                                        <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                                            record.status === 'PRESENT' ? 'bg-green-100' :
                                            record.status === 'LATE' ? 'bg-yellow-100' : 'bg-red-100'
                                        )}>
                                            {record.status === 'ABSENT' ? (
                                                <UserX className="h-4 w-4 text-red-500" />
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
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'text-xs px-2 py-0.5 rounded-full border font-medium',
                                            ATTENDANCE_COLORS[record.status]
                                        )}>
                                            {ATTENDANCE_LABELS[record.status]}
                                        </span>
                                        {isAssistant && isSessionActive && (
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
            </div>

            {/* Snapshot (after completion) */}
            {session.status === 'COMPLETED' && snapshot && (
                <div className="mt-5 space-y-3">
                    <SnapshotSummary snapshot={snapshot} />
                    <div className="flex justify-end flex-wrap gap-2">
                        {isAssistant && (
                            <Button
                                variant="outline"
                                onClick={() => setShowBatchSubscribe(true)}
                                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                                <Receipt className="h-4 w-4" />
                                تسجيل اشتراكات الحاضرين
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={handleDownloadAttendancePdf}
                            disabled={pdfLoading}
                            className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            {pdfLoading
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <FileDown className="h-4 w-4" />
                            }
                            تقرير الحضور PDF
                        </Button>
                        <Button
                            onClick={() => setShowWhatsApp(true)}
                            className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
                        >
                            <MessageSquare className="h-4 w-4" />
                            إرسال رسائل واتساب لأولياء الأمور
                        </Button>
                    </div>
                </div>
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

            {/* Batch Subscription Modal (after session completion) */}
            {showBatchSubscribe && (
                <BatchSubscriptionModal
                    open={showBatchSubscribe}
                    onOpenChange={setShowBatchSubscribe}
                />
            )}
        </div>
    );
}

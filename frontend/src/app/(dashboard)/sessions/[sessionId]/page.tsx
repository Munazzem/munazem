'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSessionById, updateSessionStatus, deleteSession } from '@/lib/api/sessions';
import {
    recordAttendance,
    getSessionAttendance,
    updateAttendance,
    adjustCompletedAttendance,
    completeSession,
    getSessionSnapshot,
    getWhatsAppLinks,
    fetchAttendanceHtml,
    type IWhatsAppLink,
} from '@/lib/api/attendance';
import { printHtmlContent } from '@/lib/utils/print';
import { fetchStudents, updateStudent } from '@/lib/api/students';
import { resolveCard } from '@/lib/api/cards';
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
import { QK } from '@/lib/query-keys';
import { useOfflineSyncStore } from '@/lib/store/offline-sync.store';
import { OutboxService } from '@/lib/offline/outbox.service';
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
    Trash2,
    RefreshCw,
    WifiOff,
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
import { HomeworkToggleButton } from '@/components/sessions/HomeworkToggleButton';
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

/** استخراج معرف المجموعة كنص صريح سواء كان ObjectId أو كائن populated */
function extractGroupId(gid: any): string {
    if (!gid) return '';
    if (typeof gid === 'object') return gid._id?.toString?.() ?? gid._id ?? '';
    return gid.toString();
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SessionDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const isHomeworkTrackingEnabled = Boolean(user?.features?.homeworkTracking);

    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editRecord, setEditRecord] = useState<IAttendanceRecord | null>(null);
    const [showWhatsApp, setShowWhatsApp] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pendingHomeworkToggleIds, setPendingHomeworkToggleIds] = useState<Set<string>>(new Set());

    // Excused Absence State
    const [excuseStudent, setExcuseStudent] = useState<any | null>(null);
    const [showAllStudents, setShowAllStudents] = useState(false);

    const handleDownloadAttendancePdf = async () => {
        setPdfLoading(true);
        try {
            const html = await fetchAttendanceHtml(sessionId);
            printHtmlContent(html);
        } catch {
            // Handled by interceptor

        } finally {
            setPdfLoading(false);
        }
    };

    // Fetch session
    const { data: session, isLoading: sessionLoading } = useQuery({
        queryKey: QK.sessions.detail(sessionId),
        queryFn: () => fetchSessionById(sessionId),
        refetchInterval: 30000,
    });

    // Fetch attendance records (live polling every 5s when IN_PROGRESS)
    const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
        queryKey: QK.attendance.bySession(sessionId),
        queryFn: () => getSessionAttendance(sessionId),
        refetchInterval: session?.status === 'IN_PROGRESS' ? 5000 : false,
        enabled: !!session,
    });

    // Fetch snapshot if completed
    const { data: snapshot } = useQuery({
        queryKey: QK.attendance.snapshot(sessionId),
        queryFn: () => getSessionSnapshot(sessionId),
        enabled: session?.status === 'COMPLETED',
    });

    // Fetch students for the group (includes hasActiveSubscription)
    const groupId = typeof session?.groupId === 'object'
        ? (session.groupId as any)._id
        : session?.groupId ?? '';

    const { data: groupStudentsData } = useQuery({
        queryKey: QK.students.list({ groupId, limit: 200 }),
        queryFn: () => fetchStudents({ groupId, limit: 200 }),
        enabled: !!groupId,
    });

    // Build a map: studentId → hasActiveSubscription
    const subscriptionMap = new Map<string, boolean>(
        (groupStudentsData?.data ?? []).map((s) => [s._id, s.hasActiveSubscription ?? true])
    );

    const pendingCount = useOfflineSyncStore((s) => s.pendingCount);
    const isSyncing = useOfflineSyncStore((s) => s.isSyncing);
    const flushQueue = useOfflineSyncStore((s) => s.flushQueue);
    const refreshPendingCount = useOfflineSyncStore((s) => s.refreshPendingCount);

    const [localPendingRecords, setLocalPendingRecords] = useState<IAttendanceRecord[]>([]);

    // Refresh pending count and load local pending records on mount / change
    useEffect(() => {
        refreshPendingCount(sessionId).catch(() => {});
        OutboxService.getPendingMutations(sessionId).then((mutations) => {
            const mapped: IAttendanceRecord[] = mutations.map(m => ({
                _id: `temp-${m.clientMutationId}`,
                studentId: {
                    // rawToken records have no studentId yet — use clientMutationId as temp display id
                    _id:         m.studentId ?? m.clientMutationId,
                    studentName: m.studentName,
                    studentCode: m.studentCode ?? '...',
                    studentPhone: m.studentPhone,
                },
                sessionId:    m.sessionId,
                status:       m.status,
                isGuest:      m.isGuest,
                homeworkDone: m.homeworkDone ?? true,
                scannedAt:    m.scannedAt,
                _syncStatus:  m.syncStatus,
            }));
            setLocalPendingRecords(mapped);
        }).catch(() => {});
    }, [sessionId, pendingCount, refreshPendingCount]);

    // Build unified attendance records: server records + local pending records not yet in server list
    const combinedAttendanceRecords = [...attendanceRecords];
    const serverStudentIdSet = new Set(
        attendanceRecords
            .map((r) => (r.studentId as any)?._id ?? (r.studentId as any))
            .filter(Boolean)
    );

    for (const pending of localPendingRecords) {
        const pId = (pending.studentId as any)?._id ?? (pending.studentId as any);
        if (pId && !serverStudentIdSet.has(pId)) {
            combinedAttendanceRecords.push(pending);
        }
    }

    const alreadyRecordedIds = new Set(
        combinedAttendanceRecords
            .map((r) => (r.studentId as any)?._id ?? (r.studentId as any))
            .filter(Boolean)
    );

    // Sort attendance records alphabetically by student name
    const sortedAttendanceRecords = [...combinedAttendanceRecords].sort((a, b) => {
        const nameA = (a.studentId as any)?.studentName ?? '';
        const nameB = (b.studentId as any)?.studentName ?? '';
        return nameA.localeCompare(nameB, 'ar');
    });

    // Start session (mark IN_PROGRESS) when recording first attendance
    const ensureInProgress = useCallback(async () => {
        if (session?.status === 'SCHEDULED') {
            try {
                // Optimistically update session status
                queryClient.setQueryData(QK.sessions.detail(sessionId), (old: any) => ({ ...old, status: 'IN_PROGRESS' }));
                await updateSessionStatus(sessionId, 'IN_PROGRESS');
                queryClient.invalidateQueries({ queryKey: QK.sessions.detail(sessionId) });
                queryClient.invalidateQueries({ queryKey: QK.sessions.all });
            } catch (err) {
                console.error('Failed to update session status:', err);
            }
        }
    }, [session?.status, sessionId, queryClient]);

    // Record attendance (Online-first with IndexedDB offline outbox fallback)
    const recordMutation = useMutation({
        mutationFn: async (studentId: string) => {
            await ensureInProgress();
            return recordAttendance({
                sessionId,
                studentId,
                status: 'PRESENT',
                homeworkDone: true,
            });
        },
        onMutate: async (studentId) => {
            await queryClient.cancelQueries({ queryKey: QK.attendance.bySession(sessionId) });
            const previousAttendance = queryClient.getQueryData<IAttendanceRecord[]>(QK.attendance.bySession(sessionId)) || [];

            const student = groupStudentsData?.data?.find(s => s._id === studentId);
            const clientMutationId = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const isGuest = student ? (extractGroupId(student.groupId) !== groupId) : false;

            const studentInfo = student
                ? {
                      _id: student._id,
                      studentName: student.studentName,
                      studentCode: student.studentCode,
                      studentPhone: student.studentPhone,
                  }
                : {
                      _id: studentId,
                      studentName: 'جاري التحميل...',
                      studentCode: '...',
                  };

            const optimisticRecord: IAttendanceRecord = {
                _id: `temp-${clientMutationId}`,
                studentId: studentInfo,
                sessionId,
                status: 'PRESENT',
                isGuest,
                homeworkDone: true,
                scannedAt: new Date().toISOString(),
                _syncStatus: 'QUEUED',
            };

            queryClient.setQueryData(QK.attendance.bySession(sessionId), [...previousAttendance, optimisticRecord]);

            return { previousAttendance, clientMutationId, optimisticRecord, student };
        },
        onSuccess: (record) => {
            const name = (record.studentId as any)?.studentName ?? 'الطالب';
            const guestSuffix = (record as any).isGuest ? ' (طالب زائر)' : '';
            toast.success(`تم تسجيل حضور ${name}${guestSuffix}`);
        },
        onError: async (err: any, studentId, context) => {
            const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network') || err.message?.includes('timeout') || err.message?.includes('Failed to fetch');

            if (isNetworkError && context) {
                const studentName = context.student?.studentName || 'الطالب';
                const studentCode = context.student?.studentCode || '...';
                const studentPhone = context.student?.studentPhone || '';
                const isGuest = context.student ? (extractGroupId(context.student.groupId) !== groupId) : false;

                // Enqueue to IndexedDB Outbox
                await OutboxService.enqueueAttendance({
                    clientMutationId: context.clientMutationId,
                    sessionId,
                    studentId,
                    studentName,
                    studentCode,
                    studentPhone,
                    status: 'PRESENT',
                    isGuest,
                    homeworkDone: true,
                    scannedAt: context.optimisticRecord.scannedAt,
                    createdAt: Date.now(),
                    syncStatus: 'QUEUED',
                    retryCount: 0,
                });

                await refreshPendingCount(sessionId);
                toast.info(`تم حفظ حضور ${studentName} محلياً (سيتم رفعه عند توفر الإنترنت)`, {
                    icon: '⏳',
                    duration: 4000,
                });
                return; // Do NOT rollback!
            }

            // Rollback for actual API/validation errors (409, 400, etc.)
            if (context?.previousAttendance) {
                queryClient.setQueryData(QK.attendance.bySession(sessionId), context.previousAttendance);
            }
        },
        onSettled: () => {
            if (typeof window !== 'undefined' && navigator.onLine) {
                queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
            }
            setSearchQuery('');
        },
    });

    // Update attendance status (supports live editing and post-completion adjustments)
    const updateMutation = useMutation({
        mutationFn: async ({ id, status, notes, homeworkDone, studentId }: {
            id: string;
            status?: AttendanceStatus;
            notes?: string;
            homeworkDone?: boolean;
            studentId?: string;
        }) => {
            if (session?.status === 'COMPLETED') {
                const sId = studentId || (typeof editRecord?.studentId === 'object' ? (editRecord?.studentId as any)._id : editRecord?.studentId) || id;
                return adjustCompletedAttendance(sessionId, sId, status || editRecord?.status || 'PRESENT', notes, homeworkDone);
            }
            return updateAttendance(id, {
                ...(status ? { status } : {}),
                ...(notes !== undefined ? { notes } : {}),
                ...(homeworkDone !== undefined ? { homeworkDone } : {}),
            });
        },
        onSuccess: () => {
            toast.success('تم تحديث حالة الحضور بنجاح');
            queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
            queryClient.invalidateQueries({ queryKey: QK.attendance.snapshot(sessionId) });
            queryClient.invalidateQueries({ queryKey: ['student-report'] });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            setEditRecord(null);
        },
        onError: () => {
            // Handled by interceptor
        },
    });

    // Toggle homework tracking status for a student record (online or offline temp record)
    const handleToggleHomework = async (record: IAttendanceRecord, newStatus: boolean) => {
        const isTemp = record._id.toString().startsWith('temp-');
        
        if (isTemp) {
            const clientMutationId = record._id.toString().replace('temp-', '');
            // 1. Update IndexedDB mutation directly
            await OutboxService.updateMutation(clientMutationId, { homeworkDone: newStatus });
            // 2. Optimistically update localPendingRecords state
            setLocalPendingRecords(prev =>
                prev.map(r => r._id === record._id ? { ...r, homeworkDone: newStatus } : r)
            );
            // 3. Optimistically update React Query cache
            queryClient.setQueryData(QK.attendance.bySession(sessionId), (prev: IAttendanceRecord[] = []) =>
                prev.map(r => r._id === record._id ? { ...r, homeworkDone: newStatus } : r)
            );
            toast.success(newStatus ? 'تم تسجيل تسليم الواجب محلياً' : 'تم تسجيل عدم تسليم الواجب محلياً');
            return;
        }

        // Real DB record:
        const previousAttendance = queryClient.getQueryData<IAttendanceRecord[]>(QK.attendance.bySession(sessionId)) || [];
        
        // Optimistic UI update
        queryClient.setQueryData(QK.attendance.bySession(sessionId), (prev: IAttendanceRecord[] = []) =>
            prev.map(r => r._id === record._id ? { ...r, homeworkDone: newStatus } : r)
        );

        setPendingHomeworkToggleIds(prev => new Set(prev).add(record._id));

        try {
            if (session?.status === 'COMPLETED') {
                const studentId = typeof record.studentId === 'object' ? (record.studentId as any)?._id : record.studentId;
                await adjustCompletedAttendance(sessionId, studentId, record.status, record.notes, newStatus);
            } else {
                await updateAttendance(record._id, { homeworkDone: newStatus });
            }
            toast.success(newStatus ? 'تم تسجيل تسليم الواجب' : 'تم تسجيل عدم تسليم الواجب');
            queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
            queryClient.invalidateQueries({ queryKey: QK.attendance.snapshot(sessionId) });
        } catch (err: any) {
            queryClient.setQueryData(QK.attendance.bySession(sessionId), previousAttendance);
            toast.error('تعذر تحديث حالة الواجب');
        } finally {
            setPendingHomeworkToggleIds(prev => {
                const next = new Set(prev);
                next.delete(record._id);
                return next;
            });
        }
    };

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
            queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
            queryClient.invalidateQueries({ queryKey: QK.students.details });
            setExcuseStudent(null);
        },
        onError: (err: any) => {
            // Handled by interceptor
        }
    });

    // Complete session
    const completeMutation = useMutation({
        mutationFn: () => completeSession(sessionId),
        onSuccess: (result) => {
            toast.success('تم إنهاء الحصة وحفظ السجل');
            queryClient.invalidateQueries({ queryKey: QK.sessions.detail(sessionId) });
            queryClient.invalidateQueries({ queryKey: QK.sessions.all });
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            queryClient.setQueryData(QK.attendance.snapshot(sessionId), result.snapshot);
            setShowCompleteConfirm(false);
        },
        onError: (err: any) => {
            
        },
    });

    // Delete session permanently
    const deleteMutation = useMutation({
        mutationFn: () => deleteSession(sessionId),
        onSuccess: () => {
            toast.success('تم حذف الحصة وإلغاء جميع سجلاتها بنجاح');
            // Remove deleted session queries to avoid 404 on unmount refetch
            queryClient.removeQueries({ queryKey: QK.sessions.detail(sessionId) });
            queryClient.removeQueries({ queryKey: QK.attendance.bySession(sessionId) });
            queryClient.removeQueries({ queryKey: QK.attendance.snapshot(sessionId) });
            
            // Invalidate all related lists and reports for instant UI sync
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['group-report'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['studentReport'] });
            queryClient.invalidateQueries({ queryKey: ['student-report'] });
            queryClient.invalidateQueries({ queryKey: ['student_detail'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
            queryClient.invalidateQueries({ queryKey: ['dailySummary'] });
            
            router.replace('/sessions');
        },
        onError: () => {
            setShowDeleteConfirm(false);
        },
    });

    const handleQRScan = useCallback(async (scanInput: string) => {
        try {
            // Resolve the scan input (token / barcode / code) against the server.
            // x-skip-error-toast is set in resolveCard so the axios interceptor stays silent —
            // we own the UX from here.
            const result = await resolveCard(scanInput);

            if (!result.student) {
                // Card exists but is not yet linked to any student
                toast.error('هذا الكارت جديد وغير مربوط بأي طالب');
                return;
            }

            const studentId = result.student.studentId;

            if (alreadyRecordedIds.has(studentId)) {
                toast.warning('تم تسجيل هذا الطالب مسبقاً');
                return;
            }

            // ── Online path ─────────────────────────────────────────────────────
            recordMutation.mutate(studentId);

        } catch (error: any) {
            // ── Offline / network-error path ────────────────────────────────────
            const isNetworkError =
                !error.response ||
                error.code === 'ERR_NETWORK' ||
                error.message?.includes('Network') ||
                error.message?.includes('timeout') ||
                error.message?.includes('Failed to fetch');

            if (!isNetworkError) {
                // Server returned a real error (404 unrecognized token, 400, etc.)
                const msg = error.response?.data?.message || 'تعذر تحديد الطالب';
                toast.error(msg);
                return;
            }

            // ── Try local cache resolution ──────────────────────────────────────
            // groupStudentsData holds students of the session's own group.
            // Match by barcode or studentCode (the two non-ObjectId identifiers a QR might carry).
            const localStudents = groupStudentsData?.data ?? [];
            const localStudent = localStudents.find(
                s => s.barcode === scanInput || s.studentCode === scanInput
            );

            const clientMutationId = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const scannedAt = new Date().toISOString();

            if (localStudent) {
                // ── Cache HIT: student is a known group member ─────────────────
                if (alreadyRecordedIds.has(localStudent._id)) {
                    toast.warning('تم تسجيل هذا الطالب مسبقاً');
                    return;
                }

                const isGuest = extractGroupId(localStudent.groupId) !== groupId;

                // Optimistic UI update
                queryClient.setQueryData(QK.attendance.bySession(sessionId), (prev: IAttendanceRecord[] = []) => [
                    ...prev,
                    {
                        _id: `temp-${clientMutationId}`,
                        studentId: {
                            _id: localStudent._id,
                            studentName: localStudent.studentName,
                            studentCode: localStudent.studentCode,
                            studentPhone: localStudent.studentPhone,
                        },
                        sessionId,
                        status: 'PRESENT',
                        isGuest,
                        homeworkDone: true,
                        scannedAt,
                        _syncStatus: 'QUEUED',
                    } as IAttendanceRecord,
                ]);

                await OutboxService.enqueueAttendance({
                    clientMutationId,
                    sessionId,
                    studentId:    localStudent._id,   // ObjectId — fast sync path
                    studentName:  localStudent.studentName,
                    studentCode:  localStudent.studentCode,
                    studentPhone: localStudent.studentPhone ?? '',
                    status:       'PRESENT',
                    isGuest,
                    homeworkDone: true,
                    scannedAt,
                    createdAt:    Date.now(),
                    syncStatus:   'QUEUED',
                    retryCount:   0,
                });

                await refreshPendingCount(sessionId);
                toast.info(`تم حفظ حضور ${localStudent.studentName} محلياً (⏳ سيتم رفعه عند الاتصال)`, {
                    duration: 4000,
                });

            } else {
                // ── Cache MISS: guest student or new student not in local list ──
                // Enqueue the raw scan token — the server will resolve it at sync time.
                await OutboxService.enqueueAttendance({
                    clientMutationId,
                    sessionId,
                    rawToken:     scanInput,           // deferred server-side resolution
                    studentName:  `طالب زائر (${scanInput.slice(-6)})`,
                    status:       'PRESENT',
                    isGuest:      true,               // assume guest until server confirms
                    homeworkDone: true,
                    scannedAt,
                    createdAt:    Date.now(),
                    syncStatus:   'QUEUED',
                    retryCount:   0,
                });

                // Optimistic UI placeholder (no studentId known yet)
                queryClient.setQueryData(QK.attendance.bySession(sessionId), (prev: IAttendanceRecord[] = []) => [
                    ...prev,
                    {
                        _id: `temp-${clientMutationId}`,
                        studentId: {
                            _id: clientMutationId,       // temp id — not a real ObjectId
                            studentName: `طالب زائر (${scanInput.slice(-6)})`,
                            studentCode: '...',
                        },
                        sessionId,
                        status: 'PRESENT',
                        isGuest: true,
                        homeworkDone: true,
                        scannedAt,
                        _syncStatus: 'QUEUED',
                    } as IAttendanceRecord,
                ]);

                await refreshPendingCount(sessionId);
                toast.info('تم حفظ مسح كارت مجهول محلياً (⏳ سيُحسم عند الاتصال)', {
                    duration: 5000,
                });
            }
        }
    }, [alreadyRecordedIds, groupId, groupStudentsData, queryClient, recordMutation, refreshPendingCount, sessionId]);

    const groupName =
        typeof session?.groupId === 'object'
            ? (session.groupId as any).name
            : '—';

    const isSessionActive =
        session?.status === 'SCHEDULED' || session?.status === 'IN_PROGRESS';

    if (sessionLoading) {
        return <div className="p-6"><ReportCardSkeleton /></div>;
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    const sessionDateStr = session ? new Date(session.date).toLocaleDateString('en-CA') : '';
    const isFutureSession = sessionDateStr > todayStr;

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
    const excusedCount = attendanceRecords.filter((r) => r.status === 'EXCUSED').length;
    
    // Total absentees = Students in group who didn't show up + Students explicitly marked as ABSENT
    // During active session, it's safer to calculate as: Total Group - (Present + Excused)
    const totalGroupStudents = groupStudentsData?.data?.length ?? 0;
    const absentCount = session.status === 'COMPLETED' 
        ? attendanceRecords.filter((r) => r.status === 'ABSENT').length
        : Math.max(0, totalGroupStudents - presentCount - excusedCount);

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
                        {canWrite && isSessionActive && !isFutureSession && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    if (pendingCount > 0) {
                                        toast.error(`يوجد ${pendingCount} سجلات حضور معلقة محلياً. يرجى المزامنة أولاً قبل إنهاء الحصة لتجنب احتساب الطلاب كغائبين.`, {
                                            duration: 6000,
                                        });
                                        return;
                                    }
                                    setShowCompleteConfirm(true);
                                }}
                                className="gap-1.5 text-xs sm:text-sm"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                إنهاء الحصة
                            </Button>
                        )}
                        {canWrite && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="gap-1.5 text-xs sm:text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                حذف الحصة
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Offline Pending Sync Banner */}
            {pendingCount > 0 && isSessionActive && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5 text-amber-800">
                        <Clock className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
                        <div>
                            <p className="text-xs sm:text-sm font-bold">
                                يوجد {pendingCount} {pendingCount === 1 ? 'سجل حضور معلق محلياً' : 'سجلات حضور معلقة محلياً'}
                            </p>
                            <p className="text-[10px] sm:text-xs text-amber-700 mt-0.5">
                                تم حفظ الحضور بأمان على جهازك وسيتم رفعه تلقائياً للسيرفر فور توفر الاتصال
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={isSyncing}
                        onClick={async () => {
                            const { synced } = await flushQueue(sessionId, () => {
                                queryClient.invalidateQueries({ queryKey: QK.attendance.bySession(sessionId) });
                            });
                            if (synced > 0) {
                                toast.success(`تمت مزامنة ${synced} سجل بنجاح`);
                            }
                        }}
                        className="border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 text-xs font-bold gap-1.5 shrink-0"
                    >
                        {isSyncing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {isSyncing ? 'جاري الرفع...' : 'مزامنة الآن'}
                    </Button>
                </div>
            )}

            {/* Future Session Warning Banner */}
            {isFutureSession && session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
                <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start sm:items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                        <h3 className="text-amber-800 font-bold text-sm">تنبيه: موعد الحصة لم يأتِ بعد</h3>
                        <p className="text-amber-700 text-xs mt-1">لا يمكنك تسجيل الغياب أو فتح الكاميرا لهذه الحصة إلا في يوم الحصة أو بعده.</p>
                    </div>
                </div>
            )}

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
                {canWrite && isSessionActive && !isFutureSession && (
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
                    (!canWrite || !isSessionActive || isFutureSession) && 'lg:col-span-2'
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
                                {sortedAttendanceRecords.map((record) => {
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
                                                    {record._syncStatus === 'QUEUED' || record._id.toString().startsWith('temp-') ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium shrink-0 mr-2">
                                                            <Clock className="h-2.5 w-2.5 text-amber-600 animate-pulse" />
                                                            معلق محلياً
                                                        </span>
                                                    ) : record._syncStatus === 'SYNCING' ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium shrink-0 mr-2">
                                                            <Loader2 className="h-2.5 w-2.5 text-blue-600 animate-spin" />
                                                            جاري الحفظ
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                                                {/* Homework Tracking Toggle Button */}
                                                {isHomeworkTrackingEnabled && (record.status === 'PRESENT' || record.status === 'LATE') && (
                                                    <HomeworkToggleButton
                                                        recordId={record._id}
                                                        homeworkDone={record.homeworkDone}
                                                        disabled={!canWrite}
                                                        isPending={pendingHomeworkToggleIds.has(record._id)}
                                                        onToggle={(newVal) => handleToggleHomework(record, newVal)}
                                                    />
                                                )}
                                                <span className={cn(
                                                    'text-xs px-2 py-0.5 rounded-full border font-medium shrink-0',
                                                    ATTENDANCE_COLORS[record.status]
                                                )}>
                                                    {ATTENDANCE_LABELS[record.status]}
                                                </span>
                                                {canWrite && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-gray-400 hover:text-gray-600 shrink-0"
                                                        title="تعديل حالة الحضور"
                                                        onClick={() => setEditRecord(record)}
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Missing Students Section */}
                    {canWrite && isSessionActive && !isFutureSession && (groupStudentsData?.data?.length ?? 0) > 0 && (
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
                                        .slice()
                                        .sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'))
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
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[400px]" dir="rtl">
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
                    showHomeworkTracking={isHomeworkTrackingEnabled}
                    onClose={() => setEditRecord(null)}
                    onSave={(status, notes, homeworkDone) =>
                        updateMutation.mutate({ id: editRecord._id, status, notes, homeworkDone })
                    }
                />
            )}

            {/* Delete Session Confirm Dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[400px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            حذف الحصة نهائياً
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 text-sm text-gray-600">
                        <p>هل أنت متأكد من حذف هذه الحصة نهائياً؟</p>
                        <p className="mt-1 text-gray-500">سيتم إزالة الحصة وجميع سجلات الحضور المرتبطة بها وإعادة ضبط عداد دورة المجموعة بدون تعويض.</p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={deleteMutation.isPending}
                        >
                            إلغاء
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            )}
                            تأكيد الحذف
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

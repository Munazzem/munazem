'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
    CalendarCheck,
    QrCode,
    CheckCircle2,
    XCircle,
    Clock,
    Users,
    Camera,
    Volume2,
    VolumeX,
    Search,
    LogIn,
    ClipboardList,
    GraduationCap,
    BookOpen,
    ExternalLink,
    AlertTriangle,
    Layers,
    UserCheck,
    X,
    Printer,
    DollarSign,
    Send,
    BellRing,
    Lock,
    History,
    CheckCheck,
    Loader2,
    Sparkles,
} from 'lucide-react';
import {
    fetchCenterGroups,
    checkInStudent,
    fetchDailyCheckIns,
    fetchCenterStudents,
    fetchTodayCenterSessions,
    fetchCenterSessionById,
    recordCenterSessionAttendance,
    completeCenterSession,
    notifyQuickCheckInAbsentees,
    recordCenterPayment,
} from '@/lib/api/centers';
import {
    ICenterGroup,
    CenterCheckInResponse,
    DailyCheckInsResult,
    TodayCenterSessionsResponse,
    CenterSessionDetailResponse,
    CenterSessionAttendanceResponse,
} from '@/types/center.types';
import {
    STAGE_HIERARCHY,
    STAGE_HIERARCHY_MAP,
    StageKey,
    getStageForGrade,
} from '@/lib/constants/grade.constants';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { soundEffects } from '@/lib/utils/sound';
import { printHtmlContent } from '@/lib/utils/print';
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

const EMPTY_GROUPS: ICenterGroup[] = [];

export default function CenterAttendancePage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const paramGroupId = searchParams.get('groupId');

    // ── Mode Switcher: CLASSES (حصص اليوم والغياب) vs GATE_CHECKIN (التحضير السريع) ──
    const [activeTab, setActiveTab] = useState<'CLASSES' | 'GATE_CHECKIN'>(
        paramGroupId ? 'CLASSES' : 'CLASSES'
    );

    // ── Global Date ───────────────────────────────────────────────────────────
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // ── Shared Sound & Camera State ───────────────────────────────────────────
    const [isMuted, setIsMuted] = useState(soundEffects.getMuted());

    // ── Mode 1: Today's Scheduled Classes (حصص اليوم والغياب) State ────────────
    const [classStageFilter, setClassStageFilter] = useState<'ALL' | StageKey>('ALL');
    const [classGradeFilter, setClassGradeFilter] = useState<string>('ALL');
    const [includeAllClasses, setIncludeAllClasses] = useState<boolean>(Boolean(paramGroupId));
    const [selectedGroupId, setSelectedGroupId] = useState<string>(paramGroupId || '');
    const [classBarcodeInput, setClassBarcodeInput] = useState('');
    const classBarcodeInputRef = useRef<HTMLInputElement>(null);
    const [showClassCamera, setShowClassCamera] = useState(false);
    const [lastClassScan, setLastClassScan] = useState<CenterSessionAttendanceResponse | null>(null);
    const [classStudentSearch, setClassStudentSearch] = useState('');
    const [classStatusFilter, setClassStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'HAS_DEBT'>('ALL');
    const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
    const [sendNotificationsOnComplete, setSendNotificationsOnComplete] = useState(true);

    // ── Mode 2: Gate Quick Check-In (التحضير السريع) State ─────────────────────
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [lastCheckIn, setLastCheckIn] = useState<CenterCheckInResponse | null>(null);
    const [feedSearch, setFeedSearch] = useState('');
    const [activeStageFilter, setActiveStageFilter] = useState<'ALL' | StageKey | 'OTHER'>('ALL');
    const [activeQuickGradeFilter, setActiveQuickGradeFilter] = useState<string>('ALL');
    const [isClassStageModalOpen, setIsClassStageModalOpen] = useState(false);
    const [isQuickFilterModalOpen, setIsQuickFilterModalOpen] = useState(false);
    const [quickSheetModal, setQuickSheetModal] = useState<{
        stageKey: StageKey;
        stageTitle: string;
        grade?: string;
    } | null>(null);
    const [quickModalTab, setQuickModalTab] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
    const [quickModalSearch, setQuickModalSearch] = useState('');

    // ── Shared Quick Fee Collection Modal State (تحصيل المصاريف) ────────────────
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
        setPaymentNotes(`تحصيل مصاريف من شاشة الحضور والغياب (${selectedDate})`);
    };

    const collectPaymentMutation = useMutation({
        mutationFn: recordCenterPayment,
        onSuccess: () => {
            toast.success(`✅ تم تحصيل المصاريف للطالب ${paymentModalStudent?.studentName} بنجاح`);
            soundEffects.playSuccess();
            const paidAmount = Number(paymentAmount) || 0;

            if (lastCheckIn && paymentModalStudent && lastCheckIn.student._id === paymentModalStudent.studentId) {
                const newRem = Math.max(0, (lastCheckIn.financialStatus.totalRemaining || 0) - paidAmount);
                setLastCheckIn({
                    ...lastCheckIn,
                    financialStatus: {
                        ...lastCheckIn.financialStatus,
                        totalPaid: (lastCheckIn.financialStatus.totalPaid || 0) + paidAmount,
                        totalRemaining: newRem,
                        hasDebt: newRem > 0,
                    },
                });
            }

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
            queryClient.invalidateQueries({ queryKey: ['center', 'daily-checkins'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'financials'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تحصيل المصاريف');
        },
    });

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
            description: paymentNotes.trim() || `تحصيل مصروفات من الحضور والغياب (${paymentMethod})`,
        });
    };

    // ── Queries: Mode 1 (Today's Classes & Session Detail) ────────────────────
    const { data: todaySessionsData, isLoading: loadingTodaySessions } = useQuery<TodayCenterSessionsResponse>({
        queryKey: ['center', 'today-sessions', selectedDate, includeAllClasses],
        queryFn: () =>
            fetchTodayCenterSessions({
                date: selectedDate,
                includeAllClasses,
            }),
    });

    const rawTodayClasses = todaySessionsData?.classes || [];

    // Filter today's classes by Stage -> Grade hierarchy
    const filteredTodayClasses = rawTodayClasses.filter((cls) => {
        const gStage = getStageForGrade(cls.group.gradeLevel);
        if (classStageFilter !== 'ALL' && gStage !== classStageFilter) return false;
        if (classGradeFilter !== 'ALL' && cls.group.gradeLevel !== classGradeFilter) return false;
        return true;
    });

    // Auto-select first class when available
    useEffect(() => {
        if (paramGroupId && !selectedGroupId) {
            setSelectedGroupId(paramGroupId);
            return;
        }
        if (filteredTodayClasses.length > 0) {
            const exists = filteredTodayClasses.some((c) => c.group._id === selectedGroupId);
            if (!exists) {
                setSelectedGroupId(filteredTodayClasses[0].group._id);
            }
        } else if (rawTodayClasses.length === 0 && !includeAllClasses) {
            // If no scheduled classes today, keep selectedGroupId empty until user toggles or selects
        }
    }, [filteredTodayClasses, paramGroupId, selectedGroupId, rawTodayClasses.length, includeAllClasses]);

    // Selected Class Session Detail Query
    const { data: sessionDetail, isLoading: loadingSessionDetail } = useQuery<CenterSessionDetailResponse>({
        queryKey: ['center', 'session-detail', selectedGroupId, selectedDate],
        queryFn: () => fetchCenterSessionById(selectedGroupId, selectedDate),
        enabled: !!selectedGroupId && !!selectedDate,
    });

    // ── Mutations: Mode 1 (Class Session Attendance & Completion) ─────────────
    const recordSessionAttMutation = useMutation({
        mutationFn: (payload: {
            studentId?: string;
            studentIdOrCode?: string;
            status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
            source?: 'MANUAL' | 'QR_SCAN' | 'BARCODE';
        }) =>
            recordCenterSessionAttendance(selectedGroupId, {
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
                queryKey: ['center', 'session-detail', selectedGroupId, selectedDate],
            });
            queryClient.invalidateQueries({
                queryKey: ['center', 'today-sessions', selectedDate],
            });
        },
        onError: (err: any) => {
            soundEffects.playWarning();
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل حضور الحصة');
        },
    });

    const completeSessionMutation = useMutation({
        mutationFn: () =>
            completeCenterSession(selectedGroupId, {
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
                queryKey: ['center', 'session-detail', selectedGroupId, selectedDate],
            });
            queryClient.invalidateQueries({
                queryKey: ['center', 'today-sessions', selectedDate],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنهاء الحصة');
        },
    });

    const handleClassBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = classBarcodeInput.trim();
        if (!code || !selectedGroupId) return;
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
        if (!selectedGroupId) return;
        recordSessionAttMutation.mutate({
            studentId,
            status,
            source: 'MANUAL',
        });
    };

    // ── Queries & Mutations: Mode 2 (Quick Check-In) ──────────────────────────
    const { data: groupsData } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });
    const groups = groupsData || EMPTY_GROUPS;

    const { data: dailyCheckInsData, isLoading: loadingDailyCheckIns } = useQuery<DailyCheckInsResult>({
        queryKey: ['center', 'daily-checkins', selectedDate, feedSearch],
        queryFn: () => fetchDailyCheckIns({ date: selectedDate, search: feedSearch }),
    });

    const { data: allActiveStudents = [] } = useQuery<any[]>({
        queryKey: ['center', 'students', 'all-active-for-attendance'],
        queryFn: async () => {
            const all: any[] = [];
            let page = 1;
            let totalPages = 1;
            do {
                const res = await fetchCenterStudents({ isActive: true, page, limit: 100 });
                all.push(...(res.data || []));
                totalPages = res.totalPages || 1;
                page++;
            } while (page <= totalPages && page <= 100);
            return all;
        },
        staleTime: 60_000,
    });

    const allCheckIns = dailyCheckInsData?.checkIns || [];
    const presentStudentIds = new Set(
        allCheckIns.map((ci) => String(ci.studentId?._id || ci.studentId))
    );
    const feedSearchTerm = feedSearch.trim().toLowerCase();
    const allAbsentStudents = allActiveStudents.filter((s) => {
        if (presentStudentIds.has(String(s._id))) return false;
        if (!feedSearchTerm) return true;
        return (
            (s.studentName || '').toLowerCase().includes(feedSearchTerm) ||
            (s.studentCode || '').toLowerCase().includes(feedSearchTerm) ||
            (s.studentPhone || '').includes(feedSearchTerm)
        );
    });

    const absentByStage = (stage: string) =>
        allAbsentStudents.filter((s) => getStageForGrade(s.gradeLevel) === stage);
    const secondaryAbsent = absentByStage('SECONDARY');
    const prepAbsent = absentByStage('PREPARATORY');
    const primaryAbsent = absentByStage('PRIMARY');
    const otherAbsent = absentByStage('OTHER');

    const secondaryCheckIns = allCheckIns.filter(
        (ci) => getStageForGrade(ci.studentId?.gradeLevel) === 'SECONDARY'
    );
    const prepCheckIns = allCheckIns.filter(
        (ci) => getStageForGrade(ci.studentId?.gradeLevel) === 'PREPARATORY'
    );
    const primaryCheckIns = allCheckIns.filter(
        (ci) => getStageForGrade(ci.studentId?.gradeLevel) === 'PRIMARY'
    );
    const otherCheckIns = allCheckIns.filter(
        (ci) => getStageForGrade(ci.studentId?.gradeLevel) === 'OTHER'
    );

    const checkInMutation = useMutation({
        mutationFn: checkInStudent,
        onSuccess: (data) => {
            setLastCheckIn(data);
            if (data.financialStatus.hasDebt) {
                soundEffects.playWarning();
            } else {
                soundEffects.playSuccess();
            }

            if (data.isNewCheckIn) {
                toast.success(`✅ تم تسجيل دخول الطالب: ${data.student.studentName} وإرسال إشعار لولي الأمر`);
            } else {
                toast.info(`الطالب ${data.student.studentName} مسجل دخول بالفعل اليوم`);
            }

            queryClient.invalidateQueries({
                queryKey: ['center', 'daily-checkins', selectedDate],
            });
            setBarcodeInput('');
            if (barcodeInputRef.current) barcodeInputRef.current.focus();
        },
        onError: (err: any) => {
            soundEffects.playWarning();
            const msg = err.response?.data?.message || 'لم يتم العثور على الطالب أو حدث خطأ';
            toast.error(msg);
            if (barcodeInputRef.current) barcodeInputRef.current.focus();
        },
    });

    const notifyAbsenteesMutation = useMutation({
        mutationFn: notifyQuickCheckInAbsentees,
        onSuccess: (res) => {
            toast.success(
                `📨 تم إرسال رسائل الغياب لأولياء الأمور بنجاح (${res.sent} إشعار مرسل من أصل ${res.absentCount} غائب)`
            );
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إرسال رسائل الغياب');
        },
    });

    const handleSendAbsenteeMessages = (gradeLevel?: string) => {
        const targetLabel = gradeLevel ? `لصف (${gradeLevel})` : 'لجميع الطلاب الغائبين اليوم';
        if (!window.confirm(`هل تريد إرسال إشعارات غياب الآن لأولياء الأمور ${targetLabel}؟`)) {
            return;
        }
        notifyAbsenteesMutation.mutate({
            date: selectedDate,
            gradeLevel: gradeLevel && gradeLevel !== 'ALL' ? gradeLevel : undefined,
        });
    };

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = barcodeInput.trim();
        if (!code) return;
        checkInMutation.mutate({
            studentIdOrCode: code,
            date: selectedDate,
            source: 'BARCODE',
        });
    };

    const handleToggleMute = () => {
        const next = soundEffects.toggleMute();
        setIsMuted(next);
        toast.info(next ? 'تم كتم الصوت' : 'تم تفعيل التنبيهات الصوتية');
    };

    const handlePrintDailySheet = () => {
        if (!allCheckIns || allCheckIns.length === 0) {
            toast.error('لا يوجد حضور مسجل اليوم لطباعته');
            return;
        }

        const dateStr = new Date(selectedDate).toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const gradeOrder: string[] = [
            ...STAGE_HIERARCHY_MAP.SECONDARY.grades,
            ...STAGE_HIERARCHY_MAP.PREPARATORY.grades,
            ...STAGE_HIERARCHY_MAP.PRIMARY.grades,
        ];
        const getGradeRank = (g?: string | null) => {
            if (!g) return 999;
            const i = gradeOrder.indexOf(g);
            return i === -1 ? 998 : i;
        };

        const sortedCheckInsForPrint = [...allCheckIns].sort((a, b) => {
            const rankDiff = getGradeRank(a.studentId?.gradeLevel) - getGradeRank(b.studentId?.gradeLevel);
            if (rankDiff !== 0) return rankDiff;
            return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
        });

        const rowsHtml = sortedCheckInsForPrint
            .map((ci, idx) => {
                const student = ci.studentId;
                const timeStr = new Date(ci.checkInTime).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                const stage = getStageForGrade(student?.gradeLevel);
                const stageLabel =
                    stage === 'SECONDARY'
                        ? 'ثانوي'
                        : stage === 'PREPARATORY'
                            ? 'إعدادي'
                            : stage === 'PRIMARY'
                                ? 'ابتدائي'
                                : 'أخرى';

                let enrollmentInfo = 'دخول عام بالسنتر';
                if (ci.enrollment) {
                    const e = ci.enrollment;
                    const parts: string[] = [];
                    if (e.packageId?.name) parts.push(`باقة: ${e.packageId.name}`);
                    if (e.privateTeachers && e.privateTeachers.length > 0) {
                        const tchs = e.privateTeachers
                            .map((pt) => pt.centerTeacherId?.name)
                            .filter(Boolean)
                            .join('، ');
                        if (tchs) parts.push(`حصص خاصة: ${tchs}`);
                    }
                    if (parts.length > 0) enrollmentInfo = parts.join(' | ');
                }

                const debt = ci.totalRemainingDebt || 0;
                const debtBadge =
                    debt > 0
                        ? `<span style="color: #b45309; font-weight: bold;">متبقي ${debt} ج.م</span>`
                        : `<span style="color: #15803d; font-weight: bold;">خالص</span>`;

                return `
                    <tr style="border-bottom: 1px solid #e5e7eb; text-align: right;">
                        <td style="padding: 7px; font-size: 11px; text-align: center;">${idx + 1}</td>
                        <td style="padding: 7px; font-size: 11px; font-weight: bold; font-family: monospace;">${student?.studentCode || '—'}</td>
                        <td style="padding: 7px; font-size: 12px; font-weight: bold;">${student?.studentName || '—'}</td>
                        <td style="padding: 7px; font-size: 11px;">${student?.gradeLevel || '—'} (${stageLabel})</td>
                        <td style="padding: 7px; font-size: 11px; text-align: center; font-weight: bold;">${timeStr}</td>
                        <td style="padding: 7px; font-size: 11px; text-align: center;"><span style="color: #166534; font-weight: bold; background-color: #dcfce7; padding: 2px 6px; border-radius: 4px;">حاضر بالسنتر</span></td>
                        <td style="padding: 7px; font-size: 11px;">${enrollmentInfo}</td>
                        <td style="padding: 7px; font-size: 11px; text-align: center;">${debtBadge}</td>
                    </tr>
                `;
            })
            .join('');

        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8" />
                <title>كشف حضور واستقبال السنتر اليومي - ${selectedDate}</title>
                <style>
                    body {
                        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                        direction: rtl;
                        margin: 20px;
                        color: #111827;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #2563eb;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th {
                        background-color: #f3f4f6;
                        padding: 8px;
                        font-size: 11px;
                        font-weight: bold;
                        border-bottom: 2px solid #d1d5db;
                        text-align: right;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 900;">كشف حضور واستقبال السنتر اليومي</h2>
                        <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">التاريخ: ${dateStr}</div>
                    </div>
                    <div style="text-align: left; font-size: 11px; color: #6b7280;">
                        <div>إجمالي الحضور: ${allCheckIns.length} طالب | الغياب: ${allAbsentStudents.length} طالب</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 25px; text-align: center;">#</th>
                            <th style="width: 75px;">الكود</th>
                            <th>اسم الطالب</th>
                            <th>الصف والمرحلة</th>
                            <th style="text-align: center; width: 75px;">وقت الدخول</th>
                            <th style="text-align: center; width: 95px;">الحالة</th>
                            <th>الاشتراكات والحصص</th>
                            <th style="text-align: center; width: 85px;">الموقف المالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printHtmlContent(html, `كشف_حضور_السنتر_${selectedDate}`);
    };

    // ── Filtered Class Students in Mode 1 ─────────────────────────────────────
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

    // ── Stage Sections for Mode 2 (Quick Check-In) ────────────────────────────
    const stageSections = [
        {
            key: 'SECONDARY' as const,
            title: 'المرحلة الثانوية',
            subtitle: 'الصف الأول الثانوي، الصف الثاني الثانوي، الصف الثالث الثانوي',
            grades: STAGE_HIERARCHY_MAP.SECONDARY.grades,
            icon: GraduationCap,
            items: secondaryCheckIns,
            absent: secondaryAbsent,
            headerClass: 'bg-gradient-to-l from-indigo-50/90 via-white to-indigo-50/20 border-b border-indigo-100',
            iconBoxClass: 'bg-indigo-600 text-white shadow-xs',
            badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الثانوية اليوم حتى الآن.',
        },
        {
            key: 'PREPARATORY' as const,
            title: 'المرحلة الإعدادية',
            subtitle: 'الصف الأول الإعدادي، الصف الثاني الإعدادي، الصف الثالث الإعدادي',
            grades: STAGE_HIERARCHY_MAP.PREPARATORY.grades,
            icon: BookOpen,
            items: prepCheckIns,
            absent: prepAbsent,
            headerClass: 'bg-gradient-to-l from-emerald-50/90 via-white to-emerald-50/20 border-b border-emerald-100',
            iconBoxClass: 'bg-emerald-600 text-white shadow-xs',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الإعدادية اليوم حتى الآن.',
        },
        {
            key: 'PRIMARY' as const,
            title: 'المرحلة الابتدائية',
            subtitle: 'صفوف المرحلة الابتدائية (من الصف الأول إلى السادس الابتدائي)',
            grades: STAGE_HIERARCHY_MAP.PRIMARY.grades,
            icon: Layers,
            items: primaryCheckIns,
            absent: primaryAbsent,
            headerClass: 'bg-gradient-to-l from-amber-50/90 via-white to-amber-50/20 border-b border-amber-100',
            iconBoxClass: 'bg-amber-600 text-white shadow-xs',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الابتدائية اليوم حتى الآن.',
        },
    ];

    const visibleSections =
        activeStageFilter === 'ALL'
            ? stageSections
            : stageSections.filter((s) => s.key === activeStageFilter);

    return (
        <div className="space-y-5 pb-16" dir="rtl">
            {/* ── Top Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-xs">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
                        <CalendarCheck className="h-7 w-7 text-primary shrink-0" />
                        <span>الحضور والغياب بالسنتر</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        اختر بين تحضير حصص اليوم المجدولة (مع السناب شوت وإشعارات الحصة) أو التحضير السريع على بوابة السنتر.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <BranchSwitcher />
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <span className="text-xs font-bold text-gray-600">التاريخ:</span>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-8 w-36 rounded-lg border-gray-200 text-xs font-bold bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* ── Two-Mode Switcher Bar (حصص اليوم vs التحضير السريع) ─────────── */}
            <div className="bg-white p-2.5 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:flex items-center gap-2 p-1 bg-gray-100/90 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('CLASSES')}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === 'CLASSES'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <ClipboardList className="w-4 h-4 shrink-0" />
                        <span>حصص اليوم والغياب</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'CLASSES'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            {rawTodayClasses.length} حصة
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('GATE_CHECKIN')}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === 'GATE_CHECKIN'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <LogIn className="w-4 h-4 shrink-0" />
                        <span>التحضير السريع (بوابة السنتر)</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'GATE_CHECKIN'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            {allCheckIns.length} حاضر
                        </span>
                    </button>
                </div>

                <div className="flex items-center gap-2 justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleToggleMute}
                        className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs font-bold text-gray-600"
                    >
                        {isMuted ? (
                            <VolumeX className="w-4 h-4 text-rose-500" />
                        ) : (
                            <Volume2 className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>{isMuted ? 'صامت' : 'الصوت مفعّل'}</span>
                    </Button>
                    <Link href="/center/reports">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                        >
                            <Printer className="w-4 h-4" />
                            <span>طباعة كشف أسبوعي</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* MODE 1: TODAY'S SCHEDULED CLASSES (حصص اليوم والغياب)               */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'CLASSES' && (
                <div className="space-y-6">
                    {/* Stage -> Grade Compact Modal Trigger Bar */}
                    <div className="bg-white p-3.5 sm:px-5 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsClassStageModalOpen(true)}
                                className="rounded-xl border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 font-black text-xs h-9 px-3.5 gap-2"
                            >
                                <Layers className="w-4 h-4 text-indigo-600" />
                                <span>
                                    المرحلة والصف:{' '}
                                    {classStageFilter === 'ALL'
                                        ? 'كل المراحل والصفوف'
                                        : classGradeFilter === 'ALL'
                                            ? STAGE_HIERARCHY_MAP[classStageFilter].label
                                            : `${STAGE_HIERARCHY_MAP[classStageFilter].shortLabel} — ${classGradeFilter}`}
                                </span>
                            </Button>

                            {(classStageFilter !== 'ALL' || classGradeFilter !== 'ALL') && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setClassStageFilter('ALL');
                                        setClassGradeFilter('ALL');
                                    }}
                                    className="h-8 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 gap-1"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    <span>إلغاء التصفية</span>
                                </Button>
                            )}
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                            <input
                                type="checkbox"
                                checked={includeAllClasses}
                                onChange={(e) => setIncludeAllClasses(e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>عرض كل حصص السنتر (حتى غير المجدولة اليوم)</span>
                        </label>
                    </div>

                    {/* ── TODAY'S CLASSES HORIZONTAL CARDS (حصص اليوم) ───────────── */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
                                    <CalendarCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                                        <span>حصص اليوم ({todaySessionsData?.arabicDay || ''})</span>
                                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs font-black">
                                            {filteredTodayClasses.length} حصة
                                        </Badge>
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        اضغط على الحصة لفتح كشف الحضور والغياب الخاص بها، مسح الكروت، أو إنهاء الحصة وحفظ السناب شوت.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {loadingTodaySessions ? (
                            <div className="py-10 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                <span>جاري تحميل حصص اليوم...</span>
                            </div>
                        ) : filteredTodayClasses.length === 0 ? (
                            <div className="py-10 text-center space-y-3 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 p-6">
                                <CalendarCheck className="w-10 h-10 text-gray-300 mx-auto" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-gray-700">
                                        لا توجد حصص مجدولة ليوم ({todaySessionsData?.arabicDay || selectedDate}) في هذا القسم
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        يمكنك إظهار جميع حصص السنتر حتى غير المجدولة اليوم بالضغط على الزر بالأسفل.
                                    </p>
                                </div>
                                {!includeAllClasses && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIncludeAllClasses(true)}
                                        className="rounded-xl text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    >
                                        عرض كل الحصص المسجلة بالسنتر
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                                {filteredTodayClasses.map((cls) => {
                                    const isSelected = selectedGroupId === cls.group._id;
                                    const isCompleted = cls.sessionStatus === 'COMPLETED';
                                    const isInProgress = cls.sessionStatus === 'IN_PROGRESS';

                                    return (
                                        <div
                                            key={cls.group._id}
                                            onClick={() => {
                                                setSelectedGroupId(cls.group._id);
                                                setLastClassScan(null);
                                            }}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 relative overflow-hidden ${isSelected
                                                    ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                                                    : isCompleted
                                                        ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xs'
                                                }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-white text-gray-700 border-gray-200 text-[10px] font-bold"
                                                    >
                                                        {cls.group.gradeLevel}
                                                    </Badge>
                                                    {isCompleted ? (
                                                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold gap-1">
                                                            <CheckCheck className="w-3 h-3" />
                                                            منتهية (سناب شوت)
                                                        </Badge>
                                                    ) : isInProgress ? (
                                                        <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                                                            جارية الآن
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold"
                                                        >
                                                            {cls.isScheduledToday ? 'حصة اليوم' : 'حصة إضافية'}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="font-black text-gray-900 text-sm sm:text-base line-clamp-1">
                                                        {cls.group.name}
                                                    </h3>
                                                    <p className="text-xs text-gray-600 font-bold mt-0.5">
                                                        {cls.teacher?.name || 'مدرس بالسنتر'}
                                                        {cls.subject ? ` — ${cls.subject}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1 font-bold text-indigo-700">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {cls.scheduledTime || 'بدون موعد محدد'}
                                                </span>
                                                <span className="font-black text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg text-[11px]">
                                                    {cls.presentCount + cls.lateCount} / {cls.totalEnrolled} حاضر
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── SELECTED CLASS ATTENDANCE WORKSPACE ─────────────────────── */}
                    {selectedGroupId && sessionDetail && (
                        <div className="space-y-5">
                            {/* Snapshot Banner if Session is Completed */}
                            {isSessionCompleted && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
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
                                            <p className="text-xs text-emerald-800 mt-1">
                                                يمكنك تعديل حالة الغياب أو الحضور لأي طالب بالأسفل في أي وقت — سيتم تحديث السناب شوت تلقائياً وإرسال إشعار <strong>[تصحيح]</strong> لولي الأمر على الأبليكيشن.
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
                            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 border-2 border-indigo-200/80 p-5 sm:p-6 rounded-3xl shadow-xs space-y-4">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-indigo-100 pb-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge className="bg-indigo-600 text-white font-bold text-xs">
                                                {sessionDetail.group.gradeLevel}
                                            </Badge>
                                            <h3 className="text-lg sm:text-xl font-black text-gray-900">
                                                {sessionDetail.group.name}
                                            </h3>
                                            {sessionDetail.teacher && (
                                                <span className="text-xs sm:text-sm font-bold text-indigo-700">
                                                    — أ/ {sessionDetail.teacher.name} ({sessionDetail.teacher.subject})
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            امسح QR كارت الطالب لتحضيره في هذه الحصة فوراً وإظهار موقفه المالي، أو حضّر الطلاب يدوياً من الكشف بالأسفل.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant={showClassCamera ? 'destructive' : 'outline'}
                                            size="sm"
                                            onClick={() => setShowClassCamera(!showClassCamera)}
                                            className="rounded-xl h-10 px-3.5 gap-1.5 text-xs font-bold"
                                        >
                                            <Camera className="w-4 h-4" />
                                            <span>{showClassCamera ? 'إغلاق الكاميرا' : 'مسح بالكاميرا للحصة'}</span>
                                        </Button>

                                        <Button
                                            type="button"
                                            onClick={() => setIsCompleteDialogOpen(true)}
                                            className={`rounded-xl h-10 px-4 gap-2 text-xs font-black shadow-sm ${isSessionCompleted
                                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                }`}
                                        >
                                            <CheckCheck className="w-4 h-4" />
                                            <span>
                                                {isSessionCompleted
                                                    ? 'تحديث السناب شوت وإعادة إرسال الإشعارات'
                                                    : 'إنهاء الحصة وحفظ السناب شوت'}
                                            </span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Class Camera QR Scanner */}
                                {showClassCamera && (
                                    <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-300 bg-black/5 p-2 max-w-xl mx-auto">
                                        <div className="flex items-center justify-between pb-2 px-2 text-xs font-bold text-gray-700">
                                            <span>وجّه الكاميرا نحو QR كارت الطالب لتحضيره في ({sessionDetail.group.name})</span>
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
                                <form onSubmit={handleClassBarcodeSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="relative flex-1 w-full">
                                        <QrCode className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600" />
                                        <Input
                                            ref={classBarcodeInputRef}
                                            value={classBarcodeInput}
                                            onChange={(e) => setClassBarcodeInput(e.target.value)}
                                            placeholder="امسح باركود الطالب أو اكتب كوده لتحضيره في هذه الحصة..."
                                            className="pr-12 h-12 text-sm font-bold bg-white rounded-2xl border-indigo-200 focus:border-indigo-600"
                                            disabled={recordSessionAttMutation.isPending}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={recordSessionAttMutation.isPending || !classBarcodeInput.trim()}
                                        className="h-12 px-6 rounded-2xl font-black text-xs sm:text-sm w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {recordSessionAttMutation.isPending ? 'جاري التحضير...' : 'تحضير في الحصة'}
                                    </Button>
                                </form>

                                {/* Scanned Student Result Banner inside Class Mode (with Debt Alert + Collect Payment Button) */}
                                {lastClassScan && (
                                    <div
                                        className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${lastClassScan.financialStatus?.hasDebt
                                                ? 'bg-amber-50 border-amber-300'
                                                : 'bg-emerald-50 border-emerald-300'
                                            }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-base font-black text-gray-900">
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
                                                <div className="flex items-center gap-2 text-amber-900 text-xs font-black pt-1">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                    <span>
                                                        تنبيه مالي: الطالب عليه مصاريف متبقية بقيمة{' '}
                                                        <span className="text-rose-700 underline">
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
                                                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 h-9 px-3.5 shadow-xs"
                                            >
                                                <DollarSign className="w-4 h-4" />
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
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                                {/* Sheet Header & Filters */}
                                <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div>
                                            <h4 className="text-base font-black text-gray-900">
                                                كشف طلاب الحصة ({sessionDetail.stats.totalEnrolled} طالب مسجل)
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                يشمل طلاب الباكيدج لهذا الصف + طلاب البرايفت المسجلين في هذه الحصة فقط.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Quick Status Counters / Filters */}
                                        <button
                                            type="button"
                                            onClick={() => setClassStatusFilter('ALL')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${classStatusFilter === 'ALL'
                                                    ? 'bg-gray-900 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            الكل ({sessionDetail.stats.totalEnrolled})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClassStatusFilter('PRESENT')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${classStatusFilter === 'PRESENT'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                }`}
                                        >
                                            حاضر ({sessionDetail.stats.presentCount + sessionDetail.stats.lateCount})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClassStatusFilter('ABSENT')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${classStatusFilter === 'ABSENT'
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                }`}
                                        >
                                            غائب ({sessionDetail.stats.absentCount})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClassStatusFilter('HAS_DEBT')}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${classStatusFilter === 'HAS_DEBT'
                                                    ? 'bg-amber-600 text-white'
                                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                                }`}
                                        >
                                            عليه مصاريف ({sessionStudents.filter((s) => s.financialStatus.hasDebt).length})
                                        </button>

                                        {/* Search Input */}
                                        <div className="relative w-full sm:w-56">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                            <Input
                                                value={classStudentSearch}
                                                onChange={(e) => setClassStudentSearch(e.target.value)}
                                                placeholder="بحث بالاسم أو الكود..."
                                                className="pr-8 h-9 text-xs rounded-xl bg-gray-50 border-gray-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {loadingSessionDetail ? (
                                    <div className="py-16 text-center text-xs text-gray-400">
                                        جاري تحميل كشف طلاب الحصة...
                                    </div>
                                ) : filteredSessionStudents.length === 0 ? (
                                    <div className="py-16 text-center text-xs text-gray-400">
                                        لا يوجد طلاب مطابقين للبحث في هذه الحصة.
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-100 text-right text-gray-500 text-xs bg-gray-50/50">
                                                        <th className="px-4 py-3 font-semibold">#</th>
                                                        <th className="px-4 py-3 font-semibold">الطالب</th>
                                                        <th className="px-4 py-3 font-semibold">الكود</th>
                                                        <th className="px-4 py-3 font-semibold">نوع الاشتراك</th>
                                                        <th className="px-4 py-3 font-semibold text-center">الموقف المالي</th>
                                                        <th className="px-4 py-3 font-semibold text-center">حالة الحضور بالحصة</th>
                                                        <th className="px-4 py-3 font-semibold text-center">تحصيل مصاريف</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {filteredSessionStudents.map((st, idx) => (
                                                        <tr key={st._id} className="hover:bg-gray-50/60 transition-colors">
                                                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="px-4 py-3">
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
                                                            <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">
                                                                {st.studentCode}
                                                            </td>
                                                            <td className="px-4 py-3">
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
                                                            <td className="px-4 py-3 text-center">
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
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetClassStudentStatus(st._id, 'PRESENT')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'PRESENT'
                                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                                : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                                                                            }`}
                                                                    >
                                                                        حاضر
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetClassStudentStatus(st._id, 'ABSENT')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'ABSENT'
                                                                                ? 'bg-rose-600 text-white shadow-xs'
                                                                                : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                                                                            }`}
                                                                    >
                                                                        غائب
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetClassStudentStatus(st._id, 'LATE')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'LATE'
                                                                                ? 'bg-amber-500 text-white shadow-xs'
                                                                                : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                                                                            }`}
                                                                    >
                                                                        متأخر
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSetClassStudentStatus(st._id, 'EXCUSED')}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${st.status === 'EXCUSED'
                                                                                ? 'bg-blue-600 text-white shadow-xs'
                                                                                : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                                                            }`}
                                                                    >
                                                                        معذور
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant={st.financialStatus.hasDebt ? 'default' : 'outline'}
                                                                    onClick={() =>
                                                                        handleOpenPaymentModal({
                                                                            studentId: st._id,
                                                                            studentName: st.studentName,
                                                                            studentCode: st.studentCode,
                                                                            gradeLevel: st.gradeLevel,
                                                                            totalRemainingDebt:
                                                                                st.financialStatus.totalRemainingDebt,
                                                                        })
                                                                    }
                                                                    className={`h-8 px-3 rounded-xl text-xs font-bold gap-1 ${st.financialStatus.hasDebt
                                                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                            : 'border-gray-200 text-gray-600'
                                                                        }`}
                                                                >
                                                                    <DollarSign className="w-3.5 h-3.5" />
                                                                    <span>تحصيل</span>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Touch-Friendly Cards */}
                                        <div className="md:hidden divide-y divide-gray-100">
                                            {filteredSessionStudents.map((st) => (
                                                <div key={st._id} className="p-4 space-y-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <Link
                                                                href={`/center/students/${st._id}`}
                                                                className="font-black text-gray-900 text-sm hover:text-primary"
                                                            >
                                                                {st.studentName}
                                                            </Link>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold">
                                                                    {st.studentCode}
                                                                </span>
                                                                <Badge variant="outline" className="text-[10px] font-bold">
                                                                    {st.enrollmentType === 'PACKAGE' ? 'باكيدج' : 'برايفت'}
                                                                </Badge>
                                                                {st.financialStatus.hasDebt ? (
                                                                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-black">
                                                                        عليه {st.financialStatus.totalRemainingDebt} ج.م
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                                                        خالص
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

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
                                                            className={`h-8 px-2.5 rounded-xl text-[11px] font-bold gap-1 shrink-0 ${st.financialStatus.hasDebt
                                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                    : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            <DollarSign className="w-3.5 h-3.5" />
                                                            <span>تحصيل</span>
                                                        </Button>
                                                    </div>

                                                    <div className="grid grid-cols-4 gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetClassStudentStatus(st._id, 'PRESENT')}
                                                            className={`py-2 rounded-xl text-xs font-bold transition-all ${st.status === 'PRESENT'
                                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                        >
                                                            حاضر
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetClassStudentStatus(st._id, 'ABSENT')}
                                                            className={`py-2 rounded-xl text-xs font-bold transition-all ${st.status === 'ABSENT'
                                                                    ? 'bg-rose-600 text-white shadow-xs'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                        >
                                                            غائب
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetClassStudentStatus(st._id, 'LATE')}
                                                            className={`py-2 rounded-xl text-xs font-bold transition-all ${st.status === 'LATE'
                                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                        >
                                                            متأخر
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetClassStudentStatus(st._id, 'EXCUSED')}
                                                            className={`py-2 rounded-xl text-xs font-bold transition-all ${st.status === 'EXCUSED'
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
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* MODE 2: QUICK GATE CHECK-IN (التحضير السريع)                         */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'GATE_CHECKIN' && (
                <div className="space-y-6">
                    {/* Scanner Hero Box */}
                    <div className="bg-gradient-to-br from-primary/5 via-white to-primary/10 border-2 border-primary/20 p-5 sm:p-6 rounded-3xl shadow-sm relative overflow-hidden">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs shrink-0">
                                        <QrCode className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-gray-900">
                                            التحضير السريع لكروت وباركود الطلاب (بوابة السنتر)
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            يرسل إشعار حضور فوري لولي الأمر بمجرد مسح الـ QR Code، ويظهر الموقف المالي للطالب.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant={showCamera ? 'destructive' : 'outline'}
                                        size="sm"
                                        onClick={() => setShowCamera(!showCamera)}
                                        className="rounded-xl h-9 px-3 gap-1.5 text-xs font-bold"
                                    >
                                        <Camera className="w-4 h-4" />
                                        <span>{showCamera ? 'إغلاق الكاميرا' : 'مسح بالكاميرا'}</span>
                                    </Button>

                                    <Button
                                        type="button"
                                        onClick={() => handleSendAbsenteeMessages(activeQuickGradeFilter)}
                                        disabled={notifyAbsenteesMutation.isPending || allAbsentStudents.length === 0}
                                        className="rounded-xl h-9 px-3.5 gap-1.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                                    >
                                        {notifyAbsenteesMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <BellRing className="w-4 h-4" />
                                        )}
                                        <span>إرسال رسائل للغائبين ({allAbsentStudents.length})</span>
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePrintDailySheet}
                                        className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs font-bold text-gray-700"
                                    >
                                        <Printer className="w-4 h-4 text-primary" />
                                        <span>طباعة اليوم</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Camera QR Scanner */}
                            {showCamera && (
                                <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 bg-black/5 p-2">
                                    <div className="flex items-center justify-between pb-2 px-2 text-xs font-bold text-gray-700">
                                        <span>وجّه الكاميرا نحو باركود أو QR كارت الطالب</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowCamera(false)}
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
                                            checkInMutation.mutate({
                                                studentIdOrCode: code,
                                                date: selectedDate,
                                                source: 'QR_SCAN',
                                            });
                                        }}
                                    />
                                </div>
                            )}

                            {/* Scanner Barcode Input Form */}
                            <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                                <div className="relative flex-1 w-full">
                                    <QrCode className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                                    <Input
                                        ref={barcodeInputRef}
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder="امسح الباركود، أو اكتب كود الطالب أو رقم هاتفه واضغط Enter..."
                                        className="pr-12 h-14 text-sm font-bold bg-white rounded-2xl border-primary/30 focus:border-primary shadow-xs"
                                        autoFocus={!showCamera}
                                        disabled={checkInMutation.isPending}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={checkInMutation.isPending || !barcodeInput.trim()}
                                    className="h-14 px-8 rounded-2xl font-black text-sm w-full sm:w-auto shadow-md shadow-primary/20"
                                >
                                    {checkInMutation.isPending ? 'جاري التسجيل...' : 'تسجيل حضور بالسنتر'}
                                </Button>
                            </form>
                        </div>
                    </div>

                    {/* Active Scanned Student Result Card (with Debt Alert + Collect Payment Button) */}
                    {lastCheckIn && (
                        <div
                            className={`p-5 sm:p-6 rounded-3xl border-2 transition-all ${lastCheckIn.financialStatus.hasDebt
                                    ? 'bg-amber-50/70 border-amber-300'
                                    : 'bg-emerald-50/50 border-emerald-200'
                                }`}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${lastCheckIn.financialStatus.hasDebt
                                                ? 'bg-amber-200 text-amber-900'
                                                : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                    >
                                        {lastCheckIn.student.studentName.charAt(0)}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-xl font-black text-gray-900">
                                                {lastCheckIn.student.studentName}
                                            </h3>
                                            <Badge variant="outline" className="font-mono font-bold text-xs bg-white text-gray-700">
                                                {lastCheckIn.student.studentCode}
                                            </Badge>
                                            <Badge className="bg-emerald-600 text-white font-bold text-xs">
                                                ✅ حاضر بالسنتر اليوم
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-3">
                                            <span>
                                                الصف: <strong>{lastCheckIn.student.gradeLevel}</strong>
                                            </span>
                                            {lastCheckIn.student.studentPhone && (
                                                <span>
                                                    الهاتف: <strong className="dir-ltr">{lastCheckIn.student.studentPhone}</strong>
                                                </span>
                                            )}
                                            <span>
                                                وقت الدخول:{' '}
                                                <strong className="font-mono">
                                                    {new Date(lastCheckIn.checkIn.checkInTime).toLocaleTimeString('ar-EG', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </strong>
                                            </span>
                                        </div>

                                        {/* Financial Alert & Collect Fee Button */}
                                        <div className="pt-2 flex flex-wrap items-center gap-3">
                                            {lastCheckIn.financialStatus.hasDebt ? (
                                                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-100 text-amber-950 text-xs font-black border border-amber-300">
                                                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                                                    <span>
                                                        تنبيه مديونية: متبقي مستحقات{' '}
                                                        <strong className="text-rose-700 underline">
                                                            {lastCheckIn.financialStatus.totalRemaining} ج.م
                                                        </strong>
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/80 text-emerald-800 text-xs font-bold">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    <span>الاشتراك مسدد بالكامل</span>
                                                </div>
                                            )}

                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() =>
                                                    handleOpenPaymentModal({
                                                        studentId: lastCheckIn.student._id,
                                                        studentName: lastCheckIn.student.studentName,
                                                        studentCode: lastCheckIn.student.studentCode,
                                                        gradeLevel: lastCheckIn.student.gradeLevel,
                                                        totalRemainingDebt:
                                                            lastCheckIn.financialStatus.totalRemaining || 0,
                                                    })
                                                }
                                                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 h-9 px-4 shadow-xs"
                                            >
                                                <DollarSign className="w-4 h-4" />
                                                <span>تحصيل المصاريف الآن</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Enrolled Classes Summary */}
                                <div className="w-full lg:max-w-md bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <span className="text-xs font-black text-gray-900">
                                            حصص الطالب المسجل بها اليوم ({lastCheckIn.todayArabicDay})
                                        </span>
                                        {lastCheckIn.enrollmentSummary?.packageName && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                                {lastCheckIn.enrollmentSummary.packageName}
                                            </Badge>
                                        )}
                                    </div>
                                    {lastCheckIn.scheduledTodayGroups.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {lastCheckIn.scheduledTodayGroups.map((group) => (
                                                <div
                                                    key={group._id}
                                                    className="p-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs"
                                                >
                                                    <span className="font-bold text-gray-900">
                                                        {group.name} — {group.centerTeacher?.name || ''}
                                                    </span>
                                                    {group.scheduleTime && (
                                                        <span className="px-2 py-0.5 rounded bg-white border text-[10px] font-bold">
                                                            {group.scheduleTime}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 py-1">
                                            لا توجد حصص مجدولة لهذا الطالب اليوم وفقاً لجدوله.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Daily Check-Ins & Absences Container */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    سجل الحضور والغياب بالتحضير السريع ({new Date(selectedDate).toLocaleDateString('ar-EG')})
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    اضغط على أي مرحلة أو صف دراسي لفتح كشف الحضور وجرد الغياب الخاص به في نافذة مستقلة.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsQuickFilterModalOpen(true)}
                                    className="rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-black text-xs h-10 px-3.5 gap-2 shrink-0"
                                >
                                    <Layers className="w-4 h-4" />
                                    <span>
                                        المرحلة والصف:{' '}
                                        {activeStageFilter === 'ALL' || activeStageFilter === 'OTHER'
                                            ? 'كل المراحل'
                                            : activeQuickGradeFilter === 'ALL'
                                                ? STAGE_HIERARCHY_MAP[activeStageFilter].label
                                                : `${STAGE_HIERARCHY_MAP[activeStageFilter].shortLabel} — ${activeQuickGradeFilter}`}
                                    </span>
                                </Button>

                                {(activeStageFilter !== 'ALL' || activeQuickGradeFilter !== 'ALL') && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setActiveStageFilter('ALL');
                                            setActiveQuickGradeFilter('ALL');
                                        }}
                                        className="h-9 px-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 gap-1 shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        <span>إلغاء التصفية</span>
                                    </Button>
                                )}

                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        value={feedSearch}
                                        onChange={(e) => setFeedSearch(e.target.value)}
                                        placeholder="بحث بالاسم، الكود، أو الهاتف..."
                                        className="pr-10 h-10 text-xs rounded-xl bg-gray-50/70 border-gray-200"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Render Stage Sections */}
                        {loadingDailyCheckIns ? (
                            <div className="py-20 text-center text-xs text-gray-400">
                                جاري تحميل سجل الحضور اليومي...
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {visibleSections.map((section) => {
                                    const SectionIcon = section.icon;
                                    const gradeList = section.grades as readonly string[];

                                    const sectionPresent =
                                        activeQuickGradeFilter === 'ALL'
                                            ? section.items
                                            : section.items.filter(
                                                (ci) => ci.studentId?.gradeLevel === activeQuickGradeFilter
                                            );

                                    const sectionAbsent =
                                        activeQuickGradeFilter === 'ALL'
                                            ? section.absent
                                            : section.absent.filter(
                                                (s: any) => s.gradeLevel === activeQuickGradeFilter
                                            );

                                    const activeGradesInSection =
                                        activeQuickGradeFilter === 'ALL'
                                            ? gradeList
                                            : gradeList.filter((g) => g === activeQuickGradeFilter);

                                    return (
                                        <div key={section.key} className="p-4 sm:p-6 space-y-4">
                                            {/* Stage Header */}
                                            <div className={`p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 border ${section.headerClass}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${section.iconBoxClass}`}>
                                                        <SectionIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm sm:text-base font-black text-gray-900">{section.title}</h4>
                                                        <p className="text-[11px] text-gray-500">{section.subtitle}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQuickSheetModal({
                                                                stageKey: section.key,
                                                                stageTitle: section.title,
                                                            });
                                                            setQuickModalTab('PRESENT');
                                                            setQuickModalSearch('');
                                                        }}
                                                        className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all hover:opacity-90 ${section.badgeClass}`}
                                                    >
                                                        {sectionPresent.length} حاضر (عرض الكشف)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setQuickSheetModal({
                                                                stageKey: section.key,
                                                                stageTitle: section.title,
                                                            });
                                                            setQuickModalTab('ABSENT');
                                                            setQuickModalSearch('');
                                                        }}
                                                        className="text-xs font-black px-3 py-1.5 rounded-xl border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 transition-all"
                                                    >
                                                        {sectionAbsent.length} غائب (جرد الغياب)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Ordered Grade Cards inside Stage (Click to open Grade Modal) */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {activeGradesInSection.map((grade) => {
                                                    const gPresent = section.items.filter(
                                                        (ci) => ci.studentId?.gradeLevel === grade
                                                    );
                                                    const gAbsent = section.absent.filter(
                                                        (s: any) => s.gradeLevel === grade
                                                    );

                                                    return (
                                                        <div
                                                            key={grade}
                                                            onClick={() => {
                                                                setQuickSheetModal({
                                                                    stageKey: section.key,
                                                                    stageTitle: section.title,
                                                                    grade,
                                                                });
                                                                setQuickModalTab('PRESENT');
                                                                setQuickModalSearch('');
                                                            }}
                                                            className="p-4 rounded-2xl border border-gray-200 bg-gray-50/40 hover:bg-white hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-black text-gray-900 flex items-center gap-2">
                                                                    <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                                                                    {grade}
                                                                </span>
                                                                <span className="text-[11px] font-bold text-primary hover:underline">
                                                                    فتح الكشف ←
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setQuickSheetModal({
                                                                            stageKey: section.key,
                                                                            stageTitle: section.title,
                                                                            grade,
                                                                        });
                                                                        setQuickModalTab('PRESENT');
                                                                        setQuickModalSearch('');
                                                                    }}
                                                                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black text-center transition-all"
                                                                >
                                                                    ✅ {gPresent.length} حاضر
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setQuickSheetModal({
                                                                            stageKey: section.key,
                                                                            stageTitle: section.title,
                                                                            grade,
                                                                        });
                                                                        setQuickModalTab('ABSENT');
                                                                        setQuickModalSearch('');
                                                                    }}
                                                                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black text-center transition-all"
                                                                >
                                                                    ❌ {gAbsent.length} غائب
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Complete Class Session & Save Snapshot Confirmation Dialog ──── */}
            <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <CheckCheck className="w-5 h-5 text-indigo-600" />
                            <span>إنهاء الحصة وحفظ السناب شوت</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs text-gray-600">
                        <p className="leading-relaxed">
                            عند إنهاء الحصة <strong>({sessionDetail?.group?.name})</strong> ليوم{' '}
                            <strong>{selectedDate}</strong>:
                        </p>
                        <ul className="list-disc pr-5 space-y-1.5 text-gray-700 font-medium">
                            <li>يتم تسجيل الطلاب غير المحضرين كـ <strong>غائبين (ABSENT)</strong> تلقائياً.</li>
                            <li>يتم حفظ <strong>سناب شوت (Snapshot)</strong> كامل للحصة بأسماء وحالات كل الطلاب.</li>
                            <li>يمكنك تعديل الغياب والحضور بعد الإنهاء في أي وقت.</li>
                        </ul>

                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sendNotificationsOnComplete}
                                onChange={(e) => setSendNotificationsOnComplete(e.target.checked)}
                                className="h-4 w-4 rounded border-indigo-300 text-indigo-600"
                            />
                            <span>إرسال إشعارات الحضور والغياب لأولياء الأمور على الأبليكيشن الآن</span>
                        </label>
                    </div>

                    <DialogFooter className="gap-2 sm:justify-start">
                        <Button
                            type="button"
                            onClick={() => completeSessionMutation.mutate()}
                            disabled={completeSessionMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2"
                        >
                            {completeSessionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>تأكيد إنهاء الحصة وحفظ السناب شوت</span>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCompleteDialogOpen(false)}
                            className="rounded-xl"
                        >
                            إلغاء
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Shared Quick Fee Collection Modal (نافذة تحصيل المصاريف) ─────── */}
            <Dialog open={!!paymentModalStudent} onOpenChange={(open) => !open && setPaymentModalStudent(null)}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            <span>تحصيل مصاريف الطالب</span>
                        </DialogTitle>
                    </DialogHeader>

                    {paymentModalStudent && (
                        <form onSubmit={handlePaymentSubmit} className="space-y-4 py-2">
                            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-1">
                                <div className="font-black text-gray-900 text-sm">
                                    {paymentModalStudent.studentName}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-3">
                                    {paymentModalStudent.studentCode && (
                                        <span>الكود: {paymentModalStudent.studentCode}</span>
                                    )}
                                    {paymentModalStudent.gradeLevel && (
                                        <span>الصف: {paymentModalStudent.gradeLevel}</span>
                                    )}
                                </div>
                                <div className="pt-1 text-xs font-black text-amber-800">
                                    إجمالي المتبقي على الطالب حالياً:{' '}
                                    <span className="text-rose-600">{paymentModalStudent.totalRemainingDebt} ج.م</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    المبلغ المحصّل (ج.م) *
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="any"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="أدخل المبلغ..."
                                    className="rounded-xl font-bold"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    طريقة الدفع
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    <option value="CASH">نقدي (كاش)</option>
                                    <option value="VODAFONE_CASH">فودافون كاش / محفظة</option>
                                    <option value="INSTAPAY">إنستا باي (InstaPay)</option>
                                    <option value="BANK_TRANSFER">تحويل بنكي</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    ملاحظات (اختياري)
                                </label>
                                <Input
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    placeholder="بيان التحصيل..."
                                    className="rounded-xl text-xs"
                                />
                            </div>

                            <DialogFooter className="gap-2 sm:justify-start pt-2">
                                <Button
                                    type="submit"
                                    disabled={collectPaymentMutation.isPending}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-2"
                                >
                                    {collectPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>تأكيد تحصيل المبلغ</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPaymentModalStudent(null)}
                                    className="rounded-xl"
                                >
                                    إلغاء
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Mode 1: Stage & Grade Filter Modal (حصص اليوم) ──────────────── */}
            <Dialog open={isClassStageModalOpen} onOpenChange={setIsClassStageModalOpen}>
                <DialogContent
                    className="flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1.25rem)] sm:max-w-lg max-h-[88dvh] text-right font-sans"
                    dir="rtl"
                >
                    <DialogHeader className="p-4 pb-3 pl-10 border-b border-gray-100 shrink-0 text-right">
                        <DialogTitle className="text-sm sm:text-lg font-black text-gray-900 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
                            <span>اختيار المرحلة والصف الدراسي (حصص اليوم)</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 space-y-3.5">
                        <button
                            type="button"
                            onClick={() => {
                                setClassStageFilter('ALL');
                                setClassGradeFilter('ALL');
                                setIsClassStageModalOpen(false);
                            }}
                            className={`w-full p-3 rounded-xl text-xs font-black border text-right flex items-center justify-between gap-2 transition-all ${
                                classStageFilter === 'ALL'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                                }`}
                        >
                            <span>عرض كل المراحل والصفوف الدراسية</span>
                            <Badge variant="outline" className="bg-white/20 text-current border-current/20 text-[10px] shrink-0">
                                {rawTodayClasses.length} حصة
                            </Badge>
                        </button>

                        {STAGE_HIERARCHY.map((st) => {
                            const isStageSelected = classStageFilter === st.id;
                            return (
                                <div key={st.id} className="p-3 sm:p-3.5 rounded-2xl border border-gray-200 bg-gray-50/40 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black text-gray-900">{st.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setClassStageFilter(st.id);
                                                setClassGradeFilter('ALL');
                                                setIsClassStageModalOpen(false);
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                                                isStageSelected && classGradeFilter === 'ALL'
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                                                }`}
                                        >
                                            كل صفوف {st.shortLabel}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {st.grades.map((grade) => {
                                            const active = isStageSelected && classGradeFilter === grade;
                                            return (
                                                <button
                                                    key={grade}
                                                    type="button"
                                                    onClick={() => {
                                                        setClassStageFilter(st.id);
                                                        setClassGradeFilter(grade);
                                                        setIsClassStageModalOpen(false);
                                                    }}
                                                    className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all ${
                                                        active
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                            : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    {grade}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Mode 2: Stage & Grade Filter Modal (التحضير السريع) ─────────── */}
            <Dialog open={isQuickFilterModalOpen} onOpenChange={setIsQuickFilterModalOpen}>
                <DialogContent
                    className="flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1.25rem)] sm:max-w-lg max-h-[88dvh] text-right font-sans"
                    dir="rtl"
                >
                    <DialogHeader className="p-4 pb-3 pl-10 border-b border-gray-100 shrink-0 text-right">
                        <DialogTitle className="text-sm sm:text-lg font-black text-gray-900 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-primary shrink-0" />
                            <span>اختيار المرحلة والصف الدراسي</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 space-y-3.5">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveStageFilter('ALL');
                                setActiveQuickGradeFilter('ALL');
                                setIsQuickFilterModalOpen(false);
                            }}
                            className={`w-full p-3 rounded-xl text-xs font-black border text-right flex flex-wrap items-center justify-between gap-2 transition-all ${
                                activeStageFilter === 'ALL'
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                                }`}
                        >
                            <span>كل المراحل والصفوف الدراسية</span>
                            <span className="text-[11px] font-bold">
                                ({allCheckIns.length} حاضر / {allAbsentStudents.length} غائب)
                            </span>
                        </button>

                        {STAGE_HIERARCHY.map((st) => {
                            const isStageSelected = activeStageFilter === st.id;
                            return (
                                <div key={st.id} className="p-3 sm:p-3.5 rounded-2xl border border-gray-200 bg-gray-50/40 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black text-gray-900">{st.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveStageFilter(st.id);
                                                setActiveQuickGradeFilter('ALL');
                                                setIsQuickFilterModalOpen(false);
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                                                isStageSelected && activeQuickGradeFilter === 'ALL'
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white text-primary border border-primary/30 hover:bg-primary/5'
                                                }`}
                                        >
                                            كل صفوف {st.shortLabel}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {st.grades.map((grade) => {
                                            const active = isStageSelected && activeQuickGradeFilter === grade;
                                            const pCount = allCheckIns.filter((ci) => ci.studentId?.gradeLevel === grade).length;
                                            const aCount = allAbsentStudents.filter((s: any) => s.gradeLevel === grade).length;
                                            return (
                                                <button
                                                    key={grade}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveStageFilter(st.id);
                                                        setActiveQuickGradeFilter(grade);
                                                        setIsQuickFilterModalOpen(false);
                                                    }}
                                                    className={`p-2.5 rounded-xl text-xs font-bold border text-center transition-all space-y-1 ${
                                                        active
                                                            ? 'bg-primary text-white border-primary shadow-xs'
                                                            : 'bg-white text-gray-700 border-gray-200 hover:border-primary/40'
                                                        }`}
                                                >
                                                    <div className="truncate">{grade}</div>
                                                    <div className="text-[10px] opacity-85">
                                                        {pCount} حاضر | {aCount} غائب
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Stage / Grade Attendance & Absence Full Sheet Modal ──────────── */}
            <Dialog open={!!quickSheetModal} onOpenChange={(open) => !open && setQuickSheetModal(null)}>
                <DialogContent
                    className="flex flex-col gap-0 p-0 overflow-hidden w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90dvh] text-right font-sans"
                    dir="rtl"
                >
                    {quickSheetModal && (() => {
                        const targetSection = stageSections.find((s) => s.key === quickSheetModal.stageKey);
                        const gradeList = (targetSection?.grades || []) as readonly string[];
                        const activeGrades = quickSheetModal.grade
                            ? [quickSheetModal.grade]
                            : gradeList;

                        const qSearch = quickModalSearch.trim().toLowerCase();
                        const rawPresent = (targetSection?.items || []).filter((ci) => {
                            if (quickSheetModal.grade && ci.studentId?.gradeLevel !== quickSheetModal.grade) {
                                return false;
                            }
                            if (!qSearch) return true;
                            const st = ci.studentId;
                            return (
                                (st?.studentName || '').toLowerCase().includes(qSearch) ||
                                (st?.studentCode || '').toLowerCase().includes(qSearch) ||
                                (st?.studentPhone || '').includes(qSearch)
                            );
                        });

                        const rawAbsent = (targetSection?.absent || []).filter((s: any) => {
                            if (quickSheetModal.grade && s.gradeLevel !== quickSheetModal.grade) {
                                return false;
                            }
                            if (!qSearch) return true;
                            return (
                                (s.studentName || '').toLowerCase().includes(qSearch) ||
                                (s.studentCode || '').toLowerCase().includes(qSearch) ||
                                (s.studentPhone || '').includes(qSearch)
                            );
                        });

                        const presentGroups = activeGrades
                            .map((grade) => ({
                                grade,
                                items: rawPresent.filter((ci) => ci.studentId?.gradeLevel === grade),
                            }))
                            .filter((g) => g.items.length > 0);

                        const absentGroups = activeGrades
                            .map((grade) => ({
                                grade,
                                items: rawAbsent.filter((s: any) => s.gradeLevel === grade),
                            }))
                            .filter((g) => g.items.length > 0);

                        return (
                            <>
                                {/* Fixed Header & Controls */}
                                <div className="p-4 sm:p-5 pb-3 border-b border-gray-100 space-y-3 shrink-0 min-w-0 bg-white">
                                    <DialogHeader className="text-right pl-8">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                            <div className="min-w-0">
                                                <DialogTitle className="text-sm sm:text-lg font-black text-gray-900 flex items-center gap-2 text-right">
                                                    <GraduationCap className="w-5 h-5 text-primary shrink-0" />
                                                    <span className="leading-snug">
                                                        {quickSheetModal.grade
                                                            ? `${quickSheetModal.grade} (${quickSheetModal.stageTitle})`
                                                            : `كشف ${quickSheetModal.stageTitle} بالكامل`}
                                                    </span>
                                                </DialogTitle>
                                                <p className="text-[11px] sm:text-xs text-gray-500 mt-1 text-right">
                                                    تاريخ اليوم: {new Date(selectedDate).toLocaleDateString('ar-EG')} — مرتب حسب الصف الدراسي
                                                </p>
                                            </div>

                                            {rawAbsent.length > 0 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => handleSendAbsenteeMessages(quickSheetModal.grade)}
                                                    disabled={notifyAbsenteesMutation.isPending}
                                                    className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs h-9 px-3.5 gap-1.5 w-full sm:w-auto shrink-0"
                                                >
                                                    <BellRing className="w-3.5 h-3.5" />
                                                    <span>إرسال رسائل للغائبين ({rawAbsent.length})</span>
                                                </Button>
                                            )}
                                        </div>
                                    </DialogHeader>

                                    {/* Present/Absent Tabs + Search */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-2xl border border-gray-200/80">
                                        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={() => setQuickModalTab('PRESENT')}
                                                className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                                    quickModalTab === 'PRESENT'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-white text-emerald-700 border border-emerald-200'
                                                }`}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                <span className="truncate">الحضور ({rawPresent.length})</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setQuickModalTab('ABSENT')}
                                                className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                                    quickModalTab === 'ABSENT'
                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                        : 'bg-white text-rose-700 border border-rose-200'
                                                }`}
                                            >
                                                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                <span className="truncate">الغياب ({rawAbsent.length})</span>
                                            </button>
                                        </div>

                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                value={quickModalSearch}
                                                onChange={(e) => setQuickModalSearch(e.target.value)}
                                                placeholder="ابحث بالاسم أو الكود..."
                                                className="pr-9 h-9 text-xs bg-white rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    {/* Grade Quick Switcher inside Modal */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                                        <span className="text-[11px] font-bold text-gray-500 shrink-0 ml-1">الصف:</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQuickSheetModal({
                                                    ...quickSheetModal,
                                                    grade: undefined,
                                                })
                                            }
                                            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold shrink-0 transition-all ${
                                                !quickSheetModal.grade
                                                    ? 'bg-gray-900 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            كل الصفوف
                                        </button>
                                        {gradeList.map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() =>
                                                    setQuickSheetModal({
                                                        ...quickSheetModal,
                                                        grade: g,
                                                    })
                                                }
                                                className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold shrink-0 transition-all ${
                                                    quickSheetModal.grade === g
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Scrollable Modal Body */}
                                <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-3 sm:p-5 bg-gray-50/40">
                                    {quickModalTab === 'PRESENT' ? (
                                        presentGroups.length === 0 ? (
                                            <div className="py-12 text-center text-xs text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                                                لا يوجد طلاب حاضرون مسجلون في هذا القسم.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {presentGroups.map((grp) => (
                                                    <div key={grp.grade} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-2xs">
                                                        <div className="px-3.5 sm:px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 min-w-0 truncate">
                                                                <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
                                                                <span className="truncate">{grp.grade}</span>
                                                            </span>
                                                            <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-200 text-[11px] font-black shrink-0">
                                                                {grp.items.length} حاضر
                                                            </Badge>
                                                        </div>

                                                        {/* Mobile Cards (Zero horizontal overflow) */}
                                                        <div className="md:hidden divide-y divide-gray-100">
                                                            {grp.items.map((ci) => {
                                                                const student = ci.studentId;
                                                                const timeStr = new Date(ci.checkInTime).toLocaleTimeString('ar-EG', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                });
                                                                const debt = ci.totalRemainingDebt || 0;

                                                                return (
                                                                    <div key={ci._id} className="p-3.5 space-y-2.5">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div className="min-w-0 space-y-1">
                                                                                <div className="font-black text-sm text-gray-900 leading-snug break-words">
                                                                                    {student?.studentName || 'طالب'}
                                                                                </div>
                                                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                                                    <span className="font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                                                                                        {student?.studentCode || '—'}
                                                                                    </span>
                                                                                    <span className="font-mono font-bold text-gray-500 flex items-center gap-1">
                                                                                        <Clock className="w-3 h-3" />
                                                                                        {timeStr}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="shrink-0">
                                                                                {debt > 0 ? (
                                                                                    <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-black">
                                                                                        متبقي {debt} ج.م
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                                                                        خالص
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {student?._id && (
                                                                            <div className="flex items-center gap-2 pt-1">
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant={debt > 0 ? 'default' : 'outline'}
                                                                                    onClick={() =>
                                                                                        handleOpenPaymentModal({
                                                                                            studentId: student._id,
                                                                                            studentName: student.studentName,
                                                                                            studentCode: student.studentCode,
                                                                                            gradeLevel: student.gradeLevel,
                                                                                            totalRemainingDebt: debt,
                                                                                        })
                                                                                    }
                                                                                    className={`flex-1 h-8 px-3 rounded-xl text-xs font-bold gap-1 ${
                                                                                        debt > 0
                                                                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                                            : 'border-gray-200 text-gray-700'
                                                                                    }`}
                                                                                >
                                                                                    <DollarSign className="w-3.5 h-3.5" />
                                                                                    <span>تحصيل مصاريف</span>
                                                                                </Button>
                                                                                <Link
                                                                                    href={`/center/students/${student._id}`}
                                                                                    className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 inline-flex items-center justify-center gap-1 text-xs text-primary font-bold shrink-0"
                                                                                >
                                                                                    <span>الملف</span>
                                                                                    <ExternalLink className="w-3 h-3" />
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Desktop Table */}
                                                        <div className="hidden md:block overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-gray-100 text-right text-gray-500 text-xs bg-gray-50/60">
                                                                        <th className="px-4 py-2.5 font-semibold">وقت الدخول</th>
                                                                        <th className="px-4 py-2.5 font-semibold">الكود</th>
                                                                        <th className="px-4 py-2.5 font-semibold">اسم الطالب</th>
                                                                        <th className="px-4 py-2.5 font-semibold text-center">الموقف المالي</th>
                                                                        <th className="px-4 py-2.5 font-semibold text-center">تحصيل مصاريف</th>
                                                                        <th className="px-4 py-2.5 font-semibold text-center">الملف</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50">
                                                                    {grp.items.map((ci) => {
                                                                        const student = ci.studentId;
                                                                        const timeStr = new Date(ci.checkInTime).toLocaleTimeString('ar-EG', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        });
                                                                        const debt = ci.totalRemainingDebt || 0;

                                                                        return (
                                                                            <tr key={ci._id} className="hover:bg-gray-50/70">
                                                                                <td className="px-4 py-2.5 font-mono text-xs font-bold">{timeStr}</td>
                                                                                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 font-bold">
                                                                                    {student?.studentCode || '—'}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 font-bold text-gray-900">
                                                                                    {student?.studentName || 'طالب'}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-center">
                                                                                    {debt > 0 ? (
                                                                                        <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-black">
                                                                                            متبقي {debt} ج.م
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                                                                            خالص
                                                                                        </Badge>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-center">
                                                                                    {student?._id && (
                                                                                        <Button
                                                                                            type="button"
                                                                                            size="sm"
                                                                                            variant={debt > 0 ? 'default' : 'outline'}
                                                                                            onClick={() =>
                                                                                                handleOpenPaymentModal({
                                                                                                    studentId: student._id,
                                                                                                    studentName: student.studentName,
                                                                                                    studentCode: student.studentCode,
                                                                                                    gradeLevel: student.gradeLevel,
                                                                                                    totalRemainingDebt: debt,
                                                                                                })
                                                                                            }
                                                                                            className={`h-8 px-3 rounded-xl text-xs font-bold gap-1 ${
                                                                                                debt > 0
                                                                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                                                    : 'border-gray-200 text-gray-600'
                                                                                            }`}
                                                                                        >
                                                                                            <DollarSign className="w-3.5 h-3.5" />
                                                                                            <span>تحصيل</span>
                                                                                        </Button>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-4 py-2.5 text-center">
                                                                                    {student?._id && (
                                                                                        <Link
                                                                                            href={`/center/students/${student._id}`}
                                                                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold"
                                                                                        >
                                                                                            عرض
                                                                                            <ExternalLink className="w-3 h-3" />
                                                                                        </Link>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : absentGroups.length === 0 ? (
                                        <div className="py-12 text-center text-xs text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                                            لا يوجد طلاب غائبون في هذا القسم.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {absentGroups.map((grp) => (
                                                <div key={grp.grade} className="rounded-2xl border border-rose-200 overflow-hidden bg-white shadow-2xs">
                                                    <div className="px-3.5 sm:px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-2">
                                                        <span className="text-xs font-black text-rose-950 flex items-center gap-1.5 min-w-0 truncate">
                                                            <GraduationCap className="w-4 h-4 text-rose-700 shrink-0" />
                                                            <span className="truncate">{grp.grade}</span>
                                                        </span>
                                                        <Badge variant="outline" className="bg-white text-rose-700 border-rose-200 text-[11px] font-black shrink-0">
                                                            {grp.items.length} غائب
                                                        </Badge>
                                                    </div>

                                                    {/* Mobile Cards (Zero horizontal overflow) */}
                                                    <div className="md:hidden divide-y divide-rose-100">
                                                        {grp.items.map((s: any) => (
                                                            <div key={s._id} className="p-3.5 flex items-center justify-between gap-2.5">
                                                                <div className="min-w-0 space-y-1">
                                                                    <div className="font-black text-sm text-gray-900 leading-snug break-words">
                                                                        {s.studentName}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                                                        <span className="font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                                                                            {s.studentCode || '—'}
                                                                        </span>
                                                                        <Badge className="bg-rose-600 text-white font-bold text-[10px]">
                                                                            غائب
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                <Link
                                                                    href={`/center/students/${s._id}`}
                                                                    className="h-8 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 inline-flex items-center gap-1 text-xs text-primary font-bold shrink-0"
                                                                >
                                                                    <span>الملف</span>
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </Link>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Desktop Table */}
                                                    <div className="hidden md:block overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-rose-100 text-right text-gray-500 text-xs bg-rose-50/40">
                                                                    <th className="px-4 py-2.5 font-semibold">الكود</th>
                                                                    <th className="px-4 py-2.5 font-semibold">اسم الطالب</th>
                                                                    <th className="px-4 py-2.5 font-semibold">الصف الدراسي</th>
                                                                    <th className="px-4 py-2.5 font-semibold text-center">الحالة</th>
                                                                    <th className="px-4 py-2.5 font-semibold text-center">الملف</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-rose-50">
                                                                {grp.items.map((s: any) => (
                                                                    <tr key={s._id} className="hover:bg-rose-50/40">
                                                                        <td className="px-4 py-2.5 font-mono font-bold text-xs text-gray-600">
                                                                            {s.studentCode || '—'}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 font-bold text-gray-900">
                                                                            {s.studentName}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-xs font-bold">
                                                                            {s.gradeLevel || '—'}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            <Badge className="bg-rose-600 text-white font-bold text-[11px]">
                                                                                غائب
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            <Link
                                                                                href={`/center/students/${s._id}`}
                                                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold"
                                                                            >
                                                                                عرض
                                                                                <ExternalLink className="w-3 h-3" />
                                                                            </Link>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}

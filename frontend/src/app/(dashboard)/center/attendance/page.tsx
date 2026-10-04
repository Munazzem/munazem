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
    AlertCircle,
    LogIn,
    ClipboardList,
    GraduationCap,
    BookOpen,
    Check,
    ExternalLink,
    AlertTriangle,
    Layers,
    UserCheck,
    X,
    Sparkles,
    Filter,
    Printer,
} from 'lucide-react';
import {
    fetchCenterGroups,
    fetchGroupAttendance,
    recordCenterAttendance,
    bulkRecordCenterAttendance,
    fetchCenterEnrollments,
    checkInStudent,
    updateCheckInGroups,
    fetchDailyCheckIns,
} from '@/lib/api/centers';
import {
    ICenterGroup,
    ICenterAttendanceRecord,
    ICenterEnrollment,
    CenterCheckInResponse,
    DailyCheckInsResult,
} from '@/types/center.types';
import {
    PRIMARY_GRADES,
    PREPARATORY_GRADES,
    SECONDARY_GRADES,
} from '@/lib/constants/grade.constants';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { soundEffects } from '@/lib/utils/sound';
import { printHtmlContent } from '@/lib/utils/print';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const QrScanner = dynamic(
    () => import('@/components/scanner/QrScanner').then((m) => m.QrScanner),
    { ssr: false }
);

// ── Stage Helpers ─────────────────────────────────────────────────────────────
type StageKey = 'ALL' | 'SECONDARY' | 'PREPARATORY' | 'PRIMARY' | 'OTHER';

function getStageForGrade(gradeLevel?: string | null): 'SECONDARY' | 'PREPARATORY' | 'PRIMARY' | 'OTHER' {
    if (!gradeLevel) return 'OTHER';
    const g = gradeLevel.trim();
    if (SECONDARY_GRADES.includes(g as any) || g.includes('الثانوي') || g.toUpperCase().startsWith('SEC')) return 'SECONDARY';
    if (PREPARATORY_GRADES.includes(g as any) || g.includes('الإعدادي') || g.toUpperCase().startsWith('PREP')) return 'PREPARATORY';
    if (PRIMARY_GRADES.includes(g as any) || g.includes('الابتدائي') || g.toUpperCase().startsWith('PRIM')) return 'PRIMARY';
    return 'OTHER';
}

const EMPTY_GROUPS: ICenterGroup[] = [];
const EMPTY_ENROLLMENTS: ICenterEnrollment[] = [];
const EMPTY_ATTENDANCE: ICenterAttendanceRecord[] = [];

export default function CenterAttendancePage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const paramGroupId = searchParams.get('groupId');

    // ── Navigation Tabs ───────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'GATE_CHECKIN' | 'GROUP_SHEET'>(
        paramGroupId ? 'GROUP_SHEET' : 'GATE_CHECKIN'
    );

    // ── Global Date ───────────────────────────────────────────────────────────
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // ── Tab 1: Gate Check-In State ────────────────────────────────────────────
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
    const [lastCheckIn, setLastCheckIn] = useState<CenterCheckInResponse | null>(null);
    const [feedSearch, setFeedSearch] = useState('');
    const [activeStageFilter, setActiveStageFilter] = useState<StageKey>('ALL');

    // ── Tab 2: Group Sheet State ──────────────────────────────────────────────
    const [selectedGroupId, setSelectedGroupId] = useState<string>(paramGroupId || '');
    const [groupStageFilter, setGroupStageFilter] = useState<StageKey>('ALL');
    const [sheetStatuses, setSheetStatuses] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});

    // ── Queries ───────────────────────────────────────────────────────────────
    // Groups for center
    const { data: groupsData, isLoading: loadingGroups } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });
    const groups = groupsData || EMPTY_GROUPS;

    useEffect(() => {
        if (!selectedGroupId && groups.length > 0) {
            setSelectedGroupId(paramGroupId || groups[0]._id);
        }
    }, [groups, selectedGroupId, paramGroupId]);

    // Daily Check-Ins Query (Tab 1)
    const { data: dailyCheckInsData, isLoading: loadingDailyCheckIns } = useQuery<DailyCheckInsResult>({
        queryKey: ['center', 'daily-checkins', selectedDate, feedSearch],
        queryFn: () => fetchDailyCheckIns({ date: selectedDate, search: feedSearch }),
    });

    // Group Attendance Query (Tab 2)
    const { data: attendanceListRaw, isLoading: loadingAttendance } = useQuery<ICenterAttendanceRecord[]>({
        queryKey: ['center', 'attendance', selectedGroupId, selectedDate],
        queryFn: () => fetchGroupAttendance(selectedGroupId, selectedDate),
        enabled: !!selectedGroupId && !!selectedDate,
    });
    const attendanceList = attendanceListRaw || EMPTY_ATTENDANCE;

    // Enrollments Query for Group Sheet
    const { data: allEnrollmentsData } = useQuery<ICenterEnrollment[]>({
        queryKey: ['center', 'enrollments'],
        queryFn: () => fetchCenterEnrollments({ isActive: true }),
    });
    const allEnrollments = allEnrollmentsData || EMPTY_ENROLLMENTS;

    // ── Stage Grouping of Daily Check-Ins ─────────────────────────────────────
    const allCheckIns = dailyCheckInsData?.checkIns || [];

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

    // ── Mutations: Gate Check-In ──────────────────────────────────────────────
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
                toast.success(`✅ تم تسجيل دخول الطالب: ${data.student.studentName}`);
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

    const updateGroupsMutation = useMutation({
        mutationFn: updateCheckInGroups,
        onSuccess: (_res, variables) => {
            toast.success('تم تحديث حضور الحصص للطالب بنجاح');
            if (lastCheckIn && lastCheckIn.student._id === variables.studentId) {
                setLastCheckIn({
                    ...lastCheckIn,
                    attendedGroupIds: variables.groupIds,
                    scheduledTodayGroups: lastCheckIn.scheduledTodayGroups.map((g) => ({
                        ...g,
                        isAttended: variables.groupIds.includes(g._id),
                    })),
                    otherEnrolledGroups: lastCheckIn.otherEnrolledGroups.map((g) => ({
                        ...g,
                        isAttended: variables.groupIds.includes(g._id),
                    })),
                });
            }
            queryClient.invalidateQueries({
                queryKey: ['center', 'daily-checkins', selectedDate],
            });
            queryClient.invalidateQueries({
                queryKey: ['center', 'attendance'],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'فشل تحديث حضور الحصص');
        },
    });

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

    const handleToggleGroupForLastCheckIn = (groupId: string) => {
        if (!lastCheckIn) return;
        const currentSet = new Set(lastCheckIn.attendedGroupIds || []);
        if (currentSet.has(groupId)) {
            currentSet.delete(groupId);
        } else {
            currentSet.add(groupId);
        }
        const updated = Array.from(currentSet);
        updateGroupsMutation.mutate({
            studentId: lastCheckIn.student._id,
            date: selectedDate,
            groupIds: updated,
        });
    };

    const handleAttendAllTodayGroups = () => {
        if (!lastCheckIn || lastCheckIn.scheduledTodayGroups.length === 0) return;
        const todayIds = lastCheckIn.scheduledTodayGroups.map((g) => g._id);
        const combined = Array.from(new Set([...(lastCheckIn.attendedGroupIds || []), ...todayIds]));
        updateGroupsMutation.mutate({
            studentId: lastCheckIn.student._id,
            date: selectedDate,
            groupIds: combined,
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

        const rowsHtml = allCheckIns
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
                        if (tchs) parts.push(`مدرسين: ${tchs}`);
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
                        <td style="padding: 7px; font-size: 10px; text-align: center; color: #6b7280;">${ci.source === 'QR_SCAN' ? 'QR' : ci.source === 'BARCODE' ? 'باركود' : 'يدوي'}</td>
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
                        font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
                    .kpi-row {
                        display: flex;
                        gap: 12px;
                        margin-bottom: 16px;
                    }
                    .kpi-card {
                        flex: 1;
                        padding: 10px;
                        border-radius: 8px;
                        border: 1px solid #e5e7eb;
                        background-color: #f9fafb;
                        text-align: center;
                    }
                    .kpi-title { font-size: 11px; color: #6b7280; font-weight: bold; }
                    .kpi-value { font-size: 18px; font-weight: 900; color: #111827; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th {
                        background-color: #f3f4f6;
                        padding: 8px;
                        font-size: 11px;
                        font-weight: bold;
                        border-bottom: 2px solid #d1d5db;
                        text-align: right;
                    }
                    @media print {
                        body { margin: 10mm; }
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
                        <div>نظام منظّم لإدارة المراكز التعليمية</div>
                        <div>وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}</div>
                    </div>
                </div>

                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-title">إجمالي حضور السنتر</div>
                        <div class="kpi-value">${allCheckIns.length} طالب</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">المرحلة الثانوية</div>
                        <div class="kpi-value" style="color: #4f46e5;">${secondaryCheckIns.length}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">المرحلة الإعدادية</div>
                        <div class="kpi-value" style="color: #059669;">${prepCheckIns.length}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">المرحلة الابتدائية</div>
                        <div class="kpi-value" style="color: #d97706;">${primaryCheckIns.length}</div>
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
                            <th style="text-align: center; width: 95px;">الحالة بالسنتر</th>
                            <th>الاشتراكات والحصص</th>
                            <th style="text-align: center; width: 85px;">الموقف المالي</th>
                            <th style="text-align: center; width: 55px;">الوسيلة</th>
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

    // ── Tab 2: Group Sheet Logic ──────────────────────────────────────────────
    const filteredGroups = groups.filter((g) => {
        if (groupStageFilter === 'ALL') return true;
        return getStageForGrade(g.gradeLevel) === groupStageFilter;
    });

    const currentGroup = groups.find((g) => g._id === selectedGroupId);

    const eligibleStudents = allEnrollments.filter((enrollment) => {
        if (!currentGroup) return false;
        const student = enrollment.studentId;
        if (!student) return false;

        const isSameGrade = student.gradeLevel === currentGroup.gradeLevel;

        if (currentGroup.groupType === 'PACKAGE') {
            const isPackage = isSameGrade && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH');
            if (!isPackage) return false;
            if (enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                return enrollment.packageGroups.some((pg: any) =>
                    (typeof pg === 'object' ? pg._id : pg) === currentGroup._id
                );
            }
            return true;
        }

        if (currentGroup.groupType === 'PRIVATE') {
            const currentTeacherId =
                typeof currentGroup.centerTeacherId === 'object'
                    ? (currentGroup.centerTeacherId as any)._id
                    : currentGroup.centerTeacherId;

            return enrollment.privateTeachers?.some(
                (pt) =>
                    (typeof pt.centerTeacherId === 'object'
                        ? (pt.centerTeacherId as any)._id
                        : pt.centerTeacherId) === currentTeacherId &&
                    (!pt.groupId || (typeof pt.groupId === 'object' ? (pt.groupId as any)._id : pt.groupId) === currentGroup._id)
            );
        }

        if (currentGroup.groupType === 'MIXED') {
            const currentTeacherId =
                typeof currentGroup.centerTeacherId === 'object'
                    ? (currentGroup.centerTeacherId as any)._id
                    : currentGroup.centerTeacherId;

            let isPackageMatch = isSameGrade && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH');
            if (isPackageMatch && enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                isPackageMatch = enrollment.packageGroups.some((pg: any) =>
                    (typeof pg === 'object' ? pg._id : pg) === currentGroup._id
                );
            }

            const isPrivateMatch = enrollment.privateTeachers?.some(
                (pt) =>
                    (typeof pt.centerTeacherId === 'object'
                        ? (pt.centerTeacherId as any)._id
                        : pt.centerTeacherId) === currentTeacherId &&
                    (!pt.groupId || (typeof pt.groupId === 'object' ? (pt.groupId as any)._id : pt.groupId) === currentGroup._id)
            );

            return Boolean(isPackageMatch || isPrivateMatch);
        }

        return false;
    });

    // Reset sheet statuses when group or date changes
    useEffect(() => {
        setSheetStatuses({});
    }, [selectedGroupId, selectedDate]);

    // Sync sheet statuses when attendance data arrives from server
    useEffect(() => {
        if (!attendanceListRaw || attendanceListRaw.length === 0) return;
        const initialMap: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
        for (const item of attendanceListRaw) {
            const sid = typeof item.studentId === 'object' ? (item.studentId as any)._id : item.studentId;
            if (sid) {
                initialMap[sid] = item.status;
            }
        }
        setSheetStatuses(initialMap);
    }, [attendanceListRaw]);

    const recordSingleMutation = useMutation({
        mutationFn: recordCenterAttendance,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['center', 'attendance', selectedGroupId, selectedDate],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الحضور');
        },
    });

    const bulkRecordMutation = useMutation({
        mutationFn: bulkRecordCenterAttendance,
        onSuccess: () => {
            toast.success('✅ تم حفظ كشف حضور المجموعة بنجاح');
            queryClient.invalidateQueries({
                queryKey: ['center', 'attendance', selectedGroupId, selectedDate],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ كشف الحضور');
        },
    });

    const handleSetStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
        setSheetStatuses((prev) => ({ ...prev, [studentId]: status }));
        recordSingleMutation.mutate({
            groupId: selectedGroupId,
            studentId,
            date: selectedDate,
            status,
            source: 'MANUAL',
        });
    };

    const handleMarkAllPresent = () => {
        if (!selectedGroupId || eligibleStudents.length === 0) return;
        const newStatuses: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
        const records = eligibleStudents.map((e) => {
            const sid = e.studentId._id;
            newStatuses[sid] = 'PRESENT';
            return {
                studentId: sid,
                status: 'PRESENT' as const,
                source: 'MANUAL' as const,
            };
        });
        setSheetStatuses(newStatuses);
        bulkRecordMutation.mutate({
            groupId: selectedGroupId,
            date: selectedDate,
            records,
        });
    };

    const groupPresentCount = Object.values(sheetStatuses).filter((s) => s === 'PRESENT').length;
    const groupAbsentCount = Object.values(sheetStatuses).filter((s) => s === 'ABSENT').length;
    const groupLateCount = Object.values(sheetStatuses).filter((s) => s === 'LATE').length;
    const groupExcusedCount = Object.values(sheetStatuses).filter((s) => s === 'EXCUSED').length;

    const stats = dailyCheckInsData?.stats || {
        totalCheckedIn: 0,
        totalWithAttendedClasses: 0,
        totalGeneralOnly: 0,
    };

    interface StageSection {
        key: StageKey;
        title: string;
        subtitle: string;
        icon: any;
        items: typeof allCheckIns;
        accentColor: string;
        borderClass: string;
        headerClass: string;
        iconBoxClass: string;
        badgeClass: string;
        emptyText: string;
    }

    // ── Stage Sections Definition ─────────────────────────────────────────────
    const stageSections: StageSection[] = [
        {
            key: 'SECONDARY',
            title: 'المرحلة الثانوية',
            subtitle: 'الصف الأول الثانوي، الصف الثاني الثانوي، الصف الثالث الثانوي',
            icon: GraduationCap,
            items: secondaryCheckIns,
            accentColor: 'indigo',
            borderClass: 'border-indigo-100',
            headerClass: 'bg-gradient-to-l from-indigo-50/90 via-white to-indigo-50/20 border-b border-indigo-100',
            iconBoxClass: 'bg-indigo-600 text-white shadow-xs',
            badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الثانوية اليوم حتى الآن.',
        },
        {
            key: 'PREPARATORY',
            title: 'المرحلة الإعدادية',
            subtitle: 'الصف الأول الإعدادي، الصف الثاني الإعدادي، الصف الثالث الإعدادي',
            icon: BookOpen,
            items: prepCheckIns,
            accentColor: 'emerald',
            borderClass: 'border-emerald-100',
            headerClass: 'bg-gradient-to-l from-emerald-50/90 via-white to-emerald-50/20 border-b border-emerald-100',
            iconBoxClass: 'bg-emerald-600 text-white shadow-xs',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الإعدادية اليوم حتى الآن.',
        },
        {
            key: 'PRIMARY',
            title: 'المرحلة الابتدائية',
            subtitle: 'صفوف المرحلة الابتدائية (من الصف الأول إلى السادس الابتدائي)',
            icon: Layers,
            items: primaryCheckIns,
            accentColor: 'amber',
            borderClass: 'border-amber-100',
            headerClass: 'bg-gradient-to-l from-amber-50/90 via-white to-amber-50/20 border-b border-amber-100',
            iconBoxClass: 'bg-amber-600 text-white shadow-xs',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
            emptyText: 'لا يوجد حضور مسجل لطلاب المرحلة الابتدائية اليوم حتى الآن.',
        },
    ];

    if (otherCheckIns.length > 0) {
        stageSections.push({
            key: 'OTHER',
            title: 'مراحل أخرى / غير محددة',
            subtitle: 'طلاب غير مسجلين ضمن مرحلة دراسية محددة',
            icon: Users,
            items: otherCheckIns,
            accentColor: 'gray',
            borderClass: 'border-gray-200',
            headerClass: 'bg-gray-50/80 border-b border-gray-200',
            iconBoxClass: 'bg-gray-700 text-white',
            badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
            emptyText: 'لا توجد تسجيلات أخرى.',
        });
    }

    const visibleSections = activeStageFilter === 'ALL'
        ? stageSections
        : stageSections.filter((s) => s.key === activeStageFilter);

    return (
        <div className="space-y-6 pb-16" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-xs">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
                        <CalendarCheck className="h-7 w-7 text-primary" />
                        التحضير السريع لدخول السنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        تسجيل حضور ودخول الطلاب إلى السنتر فور مسح الكارت أو الباركود لحضور الحصص اليومية.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePrintDailySheet}
                        className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-xs"
                    >
                        <Printer className="w-4 h-4 text-primary" />
                        <span>طباعة كشف حضور السنتر</span>
                    </Button>
                    <BranchSwitcher />
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-xs">
                <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('GATE_CHECKIN')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'GATE_CHECKIN'
                                ? 'bg-white text-primary shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <LogIn className="w-4 h-4" />
                        التحضير السريع للسنتر
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            activeTab === 'GATE_CHECKIN' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {allCheckIns.length} حاضر اليوم
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('GROUP_SHEET')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'GROUP_SHEET'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        كشف مجموعات المدرسين
                        <span className="text-[10px] text-gray-400 font-normal">
                            ({groups.length} مجموعة)
                        </span>
                    </button>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 px-3 py-1">
                    <span className="text-xs font-bold text-gray-500 shrink-0">التاريخ:</span>
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-9 w-40 rounded-xl border-gray-200 text-xs font-bold bg-gray-50/50"
                    />
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: GATE / RECEPTION CHECK-IN                                     */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'GATE_CHECKIN' && (
                <div className="space-y-6">
                    {/* Scanner Hero Box */}
                    <div className="bg-gradient-to-br from-primary/5 via-white to-primary/10 border-2 border-primary/20 p-6 rounded-3xl shadow-sm relative overflow-hidden">
                        <div className="max-w-3xl mx-auto space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                                        <QrCode className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-gray-900">
                                            التحضير السريع لكروت وباركود الطلاب
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            امسح كارت الطالب أو اكتب كوده لتسجيل حضوره بالسنتر فوراً.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleToggleMute}
                                        title={isMuted ? 'تفعيل الصوت' : 'كتم الصوت'}
                                        className="rounded-xl border-gray-200 h-9 px-3 gap-1.5 text-xs text-gray-600"
                                    >
                                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
                                        <span className="hidden sm:inline">{isMuted ? 'صامت' : 'صوت مفعّل'}</span>
                                    </Button>

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

                    {/* Active Scanned Student Result Card */}
                    {lastCheckIn && (
                        <div className={`p-6 rounded-3xl border transition-all ${
                            lastCheckIn.financialStatus.hasDebt
                                ? 'bg-amber-50/50 border-amber-200'
                                : 'bg-emerald-50/40 border-emerald-200'
                        }`}>
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                {/* Student Info */}
                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                                        lastCheckIn.financialStatus.hasDebt
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {lastCheckIn.student.studentName.charAt(0)}
                                    </div>
                                    <div className="space-y-1">
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
                                            {lastCheckIn.isNewCheckIn ? (
                                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px]">
                                                    دخول جديد الآن
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-gray-200 text-gray-700 font-bold text-[11px]">
                                                    تم تسجيله مسبقاً اليوم
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-3 pt-0.5">
                                            <span className="flex items-center gap-1">
                                                <span>المرحلة:</span>
                                                <strong className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800">
                                                    {lastCheckIn.student.gradeLevel}
                                                </strong>
                                            </span>
                                            {lastCheckIn.student.studentPhone && (
                                                <span>الهاتف: <strong className="dir-ltr">{lastCheckIn.student.studentPhone}</strong></span>
                                            )}
                                            {lastCheckIn.student.parentPhone && (
                                                <span>ولي الأمر: <strong className="dir-ltr">{lastCheckIn.student.parentPhone}</strong></span>
                                            )}
                                            <span>
                                                وقت تسجيل الدخول:{' '}
                                                <strong className="text-gray-900 font-mono font-bold">
                                                    {new Date(lastCheckIn.checkIn.checkInTime).toLocaleTimeString('ar-EG', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </strong>
                                            </span>
                                        </div>

                                        {/* Financial Alert */}
                                        <div className="pt-2">
                                            {lastCheckIn.financialStatus.hasDebt ? (
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                                                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                                                    <span>تنبيه مالي: متبقي مستحقات <strong>{lastCheckIn.financialStatus.totalRemaining} ج.م</strong></span>
                                                    <Link
                                                        href={`/center/students/${lastCheckIn.student._id}`}
                                                        className="text-amber-800 underline hover:text-amber-950 font-normal mr-2"
                                                    >
                                                        سجل المدفوعات
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100/80 text-emerald-800 text-xs font-bold">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    <span>الاشتراك مسدد بالكامل</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Informative Enrolled Classes & Package Box (No Checkboxes!) */}
                                <div className="w-full lg:max-w-md bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4 text-primary" />
                                            <div>
                                                <span className="text-xs font-black text-gray-900 block">
                                                    الاشتراكات والحصص المسجل بها الطالب
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    بيانات استرشادية للعلم عند الاستقبال
                                                </span>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                            حاضر بالسنتر
                                        </Badge>
                                    </div>

                                    {/* Package Name */}
                                    {lastCheckIn.enrollmentSummary?.packageName && (
                                        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">باقة السنتر:</span>
                                            <span className="text-xs font-black text-primary">
                                                {lastCheckIn.enrollmentSummary.packageName}
                                            </span>
                                        </div>
                                    )}

                                    {/* Scheduled Today Groups */}
                                    {lastCheckIn.scheduledTodayGroups.length > 0 ? (
                                        <div className="space-y-1.5">
                                            <span className="text-[11px] font-bold text-gray-600 block">
                                                حصص اليوم المجدولة ({lastCheckIn.todayArabicDay}):
                                            </span>
                                            {lastCheckIn.scheduledTodayGroups.map((group) => (
                                                <div
                                                    key={group._id}
                                                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs"
                                                >
                                                    <div className="space-y-0.5">
                                                        <span className="font-bold text-gray-900 block">{group.name}</span>
                                                        <span className="text-[11px] text-gray-500">
                                                            {group.centerTeacher?.name || 'مدرس بالسنتر'} {group.centerTeacher?.subject && `(${group.centerTeacher.subject})`}
                                                        </span>
                                                    </div>
                                                    {group.scheduleTime && (
                                                        <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 font-bold text-[10px] text-gray-700">
                                                            {group.scheduleTime}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-2.5 px-3 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                                            {lastCheckIn.otherEnrolledGroups.length > 0
                                                ? 'لا توجد حصص مجدولة لهذا الطالب اليوم وفقاً لجدوله (حضور حر / تعويض / استذكار).'
                                                : 'مسجل دخول عام بالسنتر لحضور حصصه.'}
                                        </div>
                                    )}

                                    {/* Other Enrolled Groups list */}
                                    {lastCheckIn.otherEnrolledGroups.length > 0 && (
                                        <details className="text-xs text-gray-600 pt-1">
                                            <summary className="cursor-pointer font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1">
                                                <span>باقي المجموعات المقيد بها في أيام أخرى ({lastCheckIn.otherEnrolledGroups.length})</span>
                                            </summary>
                                            <div className="mt-2 space-y-1.5 pl-2 max-h-36 overflow-y-auto">
                                                {lastCheckIn.otherEnrolledGroups.map((og) => (
                                                    <div
                                                        key={og._id}
                                                        className="p-2 rounded-lg bg-white border border-gray-100 flex items-center justify-between text-[11px]"
                                                    >
                                                        <span className="font-bold text-gray-800">{og.name}</span>
                                                        <span className="text-gray-500 text-[10px]">{og.centerTeacher?.name || ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STAGE KPI SUMMARY CARDS ─────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Overall Center */}
                        <div
                            onClick={() => setActiveStageFilter('ALL')}
                            className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
                                activeStageFilter === 'ALL'
                                    ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/20'
                                    : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-gray-500 block">إجمالي حضور السنتر اليوم</span>
                                <div className="text-2xl font-black text-gray-900">{allCheckIns.length}</div>
                                <span className="text-[10px] text-gray-400 font-medium block">
                                    طالب حاضر بالسنتر اليوم
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-xs">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Secondary Stage */}
                        <div
                            onClick={() => setActiveStageFilter(activeStageFilter === 'SECONDARY' ? 'ALL' : 'SECONDARY')}
                            className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
                                activeStageFilter === 'SECONDARY'
                                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                                    : 'bg-white border-gray-100 hover:border-indigo-200'
                            }`}
                        >
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-indigo-700 block">المرحلة الثانوية</span>
                                <div className="text-2xl font-black text-indigo-950">{secondaryCheckIns.length}</div>
                                <span className="text-[10px] text-indigo-600/70 font-medium block">
                                    الصف الأول، الثاني، والثالث الثانوي
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                                <GraduationCap className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Preparatory Stage */}
                        <div
                            onClick={() => setActiveStageFilter(activeStageFilter === 'PREPARATORY' ? 'ALL' : 'PREPARATORY')}
                            className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
                                activeStageFilter === 'PREPARATORY'
                                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                                    : 'bg-white border-gray-100 hover:border-emerald-200'
                            }`}
                        >
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-emerald-700 block">المرحلة الإعدادية</span>
                                <div className="text-2xl font-black text-emerald-950">{prepCheckIns.length}</div>
                                <span className="text-[10px] text-emerald-600/70 font-medium block">
                                    الصف الأول، الثاني، والثالث الإعدادي
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                                <BookOpen className="w-6 h-6" />
                            </div>
                        </div>

                        {/* Primary Stage */}
                        <div
                            onClick={() => setActiveStageFilter(activeStageFilter === 'PRIMARY' ? 'ALL' : 'PRIMARY')}
                            className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
                                activeStageFilter === 'PRIMARY'
                                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                                    : 'bg-white border-gray-100 hover:border-amber-200'
                            }`}
                        >
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-bold text-amber-700 block">المرحلة الابتدائية</span>
                                <div className="text-2xl font-black text-amber-950">{primaryCheckIns.length}</div>
                                <span className="text-[10px] text-amber-600/70 font-medium block">
                                    صفوف المرحلة الابتدائية (1 - 6)
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                                <Layers className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* ── DAILY CHECK-INS SECTIONS CONTAINER ─────────────────────── */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                        {/* Feed Bar Header & Search */}
                        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" />
                                    سجل دخول الطلاب للسنتر اليوم ({new Date(selectedDate).toLocaleDateString('ar-EG')})
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    مقسم بحسب المراحل الدراسية لسهولة المتابعة والإشراف.
                                </p>
                            </div>

                            {/* Search */}
                            <div className="relative w-full md:w-80">
                                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    value={feedSearch}
                                    onChange={(e) => setFeedSearch(e.target.value)}
                                    placeholder="بحث بالاسم، الكود، أو الهاتف..."
                                    className="pr-10 h-10 text-xs rounded-xl bg-gray-50/70 border-gray-200"
                                />
                            </div>
                        </div>

                        {/* Stage Filter Switcher Tabs */}
                        <div className="px-6 py-3 bg-gray-50/60 border-b border-gray-100 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 ml-2">عرض الأقسام:</span>
                            <button
                                type="button"
                                onClick={() => setActiveStageFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeStageFilter === 'ALL'
                                        ? 'bg-gray-900 text-white shadow-xs'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                كل المراحل ({allCheckIns.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveStageFilter('SECONDARY')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeStageFilter === 'SECONDARY'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                                }`}
                            >
                                المرحلة الثانوية ({secondaryCheckIns.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveStageFilter('PREPARATORY')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeStageFilter === 'PREPARATORY'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                                }`}
                            >
                                المرحلة الإعدادية ({prepCheckIns.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveStageFilter('PRIMARY')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeStageFilter === 'PRIMARY'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                                }`}
                            >
                                المرحلة الابتدائية ({primaryCheckIns.length})
                            </button>
                        </div>

                        {/* Render Grouped Stage Sections */}
                        {loadingDailyCheckIns ? (
                            <div className="py-20 text-center text-xs text-gray-400">
                                جاري تحميل سجل الحضور اليومي...
                            </div>
                        ) : allCheckIns.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 space-y-2">
                                <UserCheck className="w-12 h-12 mx-auto text-gray-300" />
                                <p className="text-sm font-bold text-gray-700">لا يوجد حضور مسجل اليوم حتى الآن</p>
                                <p className="text-xs text-gray-400">امسح كارت أول طالب يدخل السنتر لبدء التسجيل وتوزيعه على مرحلته.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {visibleSections.map((section) => {
                                    const SectionIcon = section.icon;

                                    return (
                                        <div key={section.key} className="space-y-0">
                                            {/* Stage Section Header */}
                                            <div className={`p-4 sm:px-6 flex items-center justify-between ${section.headerClass}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${section.iconBoxClass}`}>
                                                        <SectionIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                                            {section.title}
                                                        </h4>
                                                        <p className="text-[11px] text-gray-500">
                                                            {section.subtitle}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${section.badgeClass}`}>
                                                    {section.items.length} طالب حاضر
                                                </span>
                                            </div>

                                            {/* Stage Students Table */}
                                            {section.items.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-gray-400 bg-gray-50/30">
                                                    {section.emptyText}
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-gray-100 text-right text-gray-500 text-xs bg-gray-50/40">
                                                                <th className="px-5 py-3 font-semibold">وقت الدخول</th>
                                                                <th className="px-5 py-3 font-semibold">كود الطالب</th>
                                                                <th className="px-5 py-3 font-semibold">اسم الطالب</th>
                                                                <th className="px-5 py-3 font-semibold">الصف الدراسي</th>
                                                                <th className="px-5 py-3 font-semibold text-center">حالة الحضور</th>
                                                                <th className="px-5 py-3 font-semibold">الاشتراكات والحصص المسجل بها</th>
                                                                <th className="px-5 py-3 font-semibold text-center">الموقف المالي</th>
                                                                <th className="px-5 py-3 font-semibold">الوسيلة</th>
                                                                <th className="px-5 py-3 font-semibold">المسؤول</th>
                                                                <th className="px-5 py-3 font-semibold text-center">الملف</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {section.items.map((ci) => {
                                                                const student = ci.studentId;
                                                                const checkInDate = new Date(ci.checkInTime);
                                                                const timeStr = checkInDate.toLocaleTimeString('ar-EG', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                });

                                                                return (
                                                                    <tr key={ci._id} className="hover:bg-gray-50/70 transition-colors">
                                                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                                                            <span className="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
                                                                                {timeStr}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-xs text-gray-600">
                                                                            {student?.studentCode || '—'}
                                                                        </td>
                                                                        <td className="px-5 py-3.5">
                                                                            <div>
                                                                                <p className="font-bold text-gray-900">{student?.studentName || 'طالب'}</p>
                                                                                {student?.studentPhone && (
                                                                                    <p className="text-[11px] text-gray-400 dir-ltr text-right">{student.studentPhone}</p>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-xs text-gray-700 font-bold whitespace-nowrap">
                                                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800">
                                                                                {student?.gradeLevel}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                                            <Badge className="bg-emerald-600 text-white font-bold text-[11px] gap-1 px-2.5 py-0.5">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                حاضر بالسنتر
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="px-5 py-3.5">
                                                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                                                {ci.enrollment?.packageId?.name && (
                                                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                                                                                        باقة: {ci.enrollment.packageId.name}
                                                                                    </Badge>
                                                                                )}
                                                                                {ci.enrollment?.privateTeachers && ci.enrollment.privateTeachers.length > 0 && (
                                                                                    ci.enrollment.privateTeachers.map((pt, pidx) => (
                                                                                        <Badge key={pidx} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">
                                                                                            {pt.centerTeacherId?.name || 'مدرس'} {pt.centerTeacherId?.subject ? `(${pt.centerTeacherId.subject})` : ''}
                                                                                        </Badge>
                                                                                    ))
                                                                                )}
                                                                                {!ci.enrollment?.packageId?.name && (!ci.enrollment?.privateTeachers || ci.enrollment.privateTeachers.length === 0) && (
                                                                                    <span className="text-[11px] text-gray-400 italic">
                                                                                        حضور عام بالسنتر
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                                            {(ci.totalRemainingDebt || 0) > 0 ? (
                                                                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold">
                                                                                    متبقي {ci.totalRemainingDebt} ج.م
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                                                                    خالص
                                                                                </Badge>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                                                            <Badge variant="secondary" className="text-[10px] font-bold">
                                                                                {ci.source === 'QR_SCAN' ? 'كاميرا QR' : ci.source === 'BARCODE' ? 'قارئ باركود' : 'يدوي'}
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                                                                            {(typeof ci.recordedBy === 'object' ? (ci.recordedBy as any)?.name : null) || 'النظام'}
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
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
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: GROUP ATTENDANCE SHEET                                        */}
            {/* ════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'GROUP_SHEET' && (
                <div className="space-y-6">
                    {/* Controls Bar: Group Select with Stage Filter */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                            <span className="text-xs font-bold text-gray-500">فلترة المجموعات حسب المرحلة:</span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setGroupStageFilter('ALL')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        groupStageFilter === 'ALL'
                                            ? 'bg-gray-900 text-white shadow-xs'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    الكل
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGroupStageFilter('SECONDARY')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        groupStageFilter === 'SECONDARY'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                    }`}
                                >
                                    المرحلة الثانوية
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGroupStageFilter('PREPARATORY')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        groupStageFilter === 'PREPARATORY'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                >
                                    المرحلة الإعدادية
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGroupStageFilter('PRIMARY')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        groupStageFilter === 'PRIMARY'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    }`}
                                >
                                    المرحلة الابتدائية
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">المجموعة الدراسية</label>
                                <select
                                    value={selectedGroupId}
                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
                                >
                                    {filteredGroups.map((g) => {
                                        const tch = typeof g.centerTeacherId === 'object' ? g.centerTeacherId : null;
                                        return (
                                            <option key={g._id} value={g._id}>
                                                {g.name} — {tch?.name} ({g.gradeLevel})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">تاريخ الحصة</label>
                                <Input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="h-10 rounded-xl border-gray-200 text-xs font-bold"
                                />
                            </div>

                            <div className="flex items-end">
                                <div className="w-full bg-gray-50 p-2 rounded-xl border border-gray-100 flex items-center justify-around text-center">
                                    <div>
                                        <span className="text-xs font-bold text-emerald-600 block">{groupPresentCount}</span>
                                        <span className="text-[10px] text-gray-400">حاضر</span>
                                    </div>
                                    <div className="h-6 w-px bg-gray-200" />
                                    <div>
                                        <span className="text-xs font-bold text-rose-600 block">{groupAbsentCount}</span>
                                        <span className="text-[10px] text-gray-400">غائب</span>
                                    </div>
                                    <div className="h-6 w-px bg-gray-200" />
                                    <div>
                                        <span className="text-xs font-bold text-amber-600 block">{groupLateCount}</span>
                                        <span className="text-[10px] text-gray-400">متأخر</span>
                                    </div>
                                    <div className="h-6 w-px bg-gray-200" />
                                    <div>
                                        <span className="text-xs font-bold text-blue-600 block">{eligibleStudents.length}</span>
                                        <span className="text-[10px] text-gray-400">المسجلين</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Group Students Table */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-gray-900">
                                    كشف طلاب: {currentGroup?.name || 'المجموعة'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {eligibleStudents.length} طالب مؤهل لهذه المجموعة بناءً على الاشتراكات النشطة
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMarkAllPresent}
                                    disabled={bulkRecordMutation.isPending || eligibleStudents.length === 0}
                                    className="rounded-xl text-xs font-bold gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    تحضير جميع الطلاب
                                </Button>
                            </div>
                        </div>

                        {loadingAttendance ? (
                            <div className="py-16 text-center text-xs text-gray-400">
                                جاري تحميل كشف الحضور...
                            </div>
                        ) : eligibleStudents.length === 0 ? (
                            <div className="py-16 text-center text-gray-400 text-xs">
                                لا يوجد طلاب مسجلين مؤهلين لهذه المجموعة حالياً
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-right text-gray-500 text-xs bg-gray-50/50">
                                            <th className="px-5 py-3 font-semibold">#</th>
                                            <th className="px-5 py-3 font-semibold">اسم الطالب</th>
                                            <th className="px-5 py-3 font-semibold">كود الطالب</th>
                                            <th className="px-5 py-3 font-semibold">نوع الاشتراك</th>
                                            <th className="px-5 py-3 font-semibold text-center">حالة الحضور</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {eligibleStudents.map((enrollment, index) => {
                                            const student = enrollment.studentId;
                                            const currentStatus = sheetStatuses[student._id];

                                            return (
                                                <tr key={student._id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-5 py-3 font-bold text-gray-900">
                                                        {student.studentName}
                                                    </td>
                                                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                                                        {student.studentCode}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <Badge variant="outline" className="text-[10px] font-bold">
                                                            {enrollment.type === 'PACKAGE' ? 'باقة سنتر' : enrollment.type === 'PRIVATE' ? 'برايفت' : 'مجمع'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetStudentStatus(student._id, 'PRESENT')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    currentStatus === 'PRESENT'
                                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                                                                }`}
                                                            >
                                                                حاضر
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetStudentStatus(student._id, 'ABSENT')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    currentStatus === 'ABSENT'
                                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                                                                }`}
                                                            >
                                                                غائب
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetStudentStatus(student._id, 'LATE')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    currentStatus === 'LATE'
                                                                        ? 'bg-amber-500 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                                                                }`}
                                                            >
                                                                متأخر
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetStudentStatus(student._id, 'EXCUSED')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    currentStatus === 'EXCUSED'
                                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                                                }`}
                                                            >
                                                                معذور
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

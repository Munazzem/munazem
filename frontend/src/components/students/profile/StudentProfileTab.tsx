'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api/groups';
import { updateStudent } from '@/lib/api/students';
import { recordManualAttendance } from '@/lib/api/attendance';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QrCode, User, Phone, Hash, TrendingUp, Check, Clock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
    studentId: string;
    student: any;
    report: any;
    canWrite: boolean;
    qrDataUrl: string;
    qrValue: string;
    groupName: string;
}

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

export function StudentProfileTab({ studentId, student, report, canWrite, qrDataUrl, qrValue, groupName }: Props) {
    const queryClient = useQueryClient();

    // ── Group change ─────────────────────────────
    const currentGroupId =
        typeof student?.groupId === 'object' && student?.groupId !== null
            ? ((student.groupId as any)._id as string | undefined) ?? ''
            : typeof student?.groupId === 'string'
                ? student.groupId
                : '';

    const [isChangingGroup, setIsChangingGroup] = useState(false);
    const [newGroupId, setNewGroupId] = useState<string>('');
    // Confirm attendance dialog state
    const [attendanceConfirm, setAttendanceConfirm] = useState<{ label: string } | null>(null);

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
            
        },
    });

    // ── Missing sessions logic ─────────────────────────
    const recordManualMutation = useMutation({
        mutationFn: () => recordManualAttendance(studentId),
        onSuccess: () => {
            toast.success('تم تسجيل الحصة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['studentReport', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student_detail', studentId] });
        },
        onError: (err: any) => {
            
        },
    });

    // ── Quota ──────────────────────────
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
            
        },
    });

    const monthlySessionsQuota = report?.student?.monthlySessionsQuota ?? student.monthlySessionsQuota ?? 8;
    const usedSessionsThisMonth = report?.student?.usedSessionsThisMonth ?? student.usedSessionsThisMonth ?? 0;
    const attendancePercentage = Math.round((usedSessionsThisMonth / monthlySessionsQuota) * 100) || 0;

    return (
        <>
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
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                <Select value={newGroupId} onValueChange={setNewGroupId}>
                                    <SelectTrigger className="h-8 text-xs bg-white w-full sm:w-auto">
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
                                        size="sm"
                                        className="h-8 px-3 text-[11px]"
                                        disabled={changeGroupMutation.isPending || newGroupId === currentGroupId}
                                        onClick={() => changeGroupMutation.mutate()}
                                    >
                                        حفظ
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
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
                    {student.excusedSessionsCount && student.excusedSessionsCount > 0 ? (
                        <div className="flex flex-col gap-1 p-3 bg-blue-50 rounded-xl border border-blue-100 animate-pulse">
                            <span className="text-[10px] sm:text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" /> متبقي استئذان لـ
                            </span>
                            <span className="text-[13px] sm:text-[15px] font-bold text-blue-800">
                                {student.excusedSessionsCount} حصص قادمة
                            </span>
                        </div>
                    ) : student.excusedUntil && (
                        <div className="flex flex-col gap-1 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <span className="text-[10px] sm:text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" /> مُستأذن حتى
                            </span>
                            <span className="text-[13px] sm:text-[15px] font-bold text-blue-800">
                                {new Date(student.excusedUntil).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
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
                                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                                    <input
                                        type="number"
                                        className="w-12 h-7 text-xs border rounded px-1 text-center bg-white"
                                        value={tempQuota}
                                        onChange={(e) => setTempQuota(parseInt(e.target.value) || 0)}
                                    />
                                    <Button size="sm" className="h-7 text-xs" onClick={() => updateQuotaMutation.mutate(tempQuota)}>حفظ</Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingQuota(false)}>إلغاء</Button>
                                </div>
                            ) : (
                                canWrite && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] text-blue-600 hover:text-blue-700"
                                        onClick={() => {
                                            setTempQuota(student.monthlySessionsQuota);
                                            setEditingQuota(true);
                                        }}
                                    >
                                        تعديل الإجمالي
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Progress Grid */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-500 font-medium">
                                تم حضور {usedSessionsThisMonth} من {monthlySessionsQuota} حصص
                            </span>
                            <span className="text-xs font-bold text-[#0f4c81]">
                                {attendancePercentage}%
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
                                            if (!isPresent && canWrite) {
                                                setAttendanceConfirm({ label: `حضور حصة يوم ${dateStr}` });
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
                            {Array.from({ length: Math.max(0, monthlySessionsQuota - (report?.student?.monthlySessions?.length ?? 0)) }).map((_, i) => {
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
                                            if (!isManualFilled && canWrite) {
                                                setAttendanceConfirm({ label: 'حضور حصة إضافية' });
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

        <ConfirmDialog
            open={attendanceConfirm !== null}
            onOpenChange={(v) => { if (!v) setAttendanceConfirm(null); }}
            title={`تسجيل ${attendanceConfirm?.label}?`}
            confirmLabel="تسجيل"
            onConfirm={() => {
                recordManualMutation.mutate();
                setAttendanceConfirm(null);
            }}
        />
        </>
    );
}

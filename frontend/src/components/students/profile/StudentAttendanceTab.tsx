'use client';

import { useState } from 'react';
import { Loader2, History, Check, X, Clock, UserCheck, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AttendanceAdjustmentModal } from './AttendanceAdjustmentModal';

interface Props {
    reportLoading: boolean;
    report: any;
    studentId?: string;
    studentName?: string;
    canWrite?: boolean;
}

const formatSessionDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        const dayName = d.toLocaleDateString('ar-EG', { weekday: 'short' });
        const day = d.getDate();
        const month = d.toLocaleDateString('ar-EG', { month: 'short' });
        const fullDate = d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return { dayName, dateFormatted: `${day} ${month}`, fullDate };
    } catch {
        return { dayName: '—', dateFormatted: '—', fullDate: '' };
    }
};

export function StudentAttendanceTab({
    reportLoading,
    report,
    studentId,
    studentName,
    canWrite = true,
}: Props) {
    const [selectedSessionForAdjustment, setSelectedSessionForAdjustment] = useState<{
        sessionId?: string;
        date: string;
        status: string;
        homeworkDone?: boolean | null;
    } | null>(null);

    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText className="h-10 w-10 mb-3 text-gray-200" />
                <p className="font-medium">لا توجد بيانات حضور</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-green-50/80 rounded-2xl p-3 sm:p-4 text-center border border-green-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-green-700">{report.attendance.presentCount}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">حاضر</p>
                </div>
                <div className="bg-red-50/80 rounded-2xl p-3 sm:p-4 text-center border border-red-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-red-600">{report.attendance.absentCount}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">غائب</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-blue-50/80 rounded-2xl p-3 sm:p-4 text-center border border-blue-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-blue-700 drop-shadow-sm">{report.attendance.attendanceRate}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">نسبة الحضور</p>
                </div>
            </div>
            
            {report.attendance.history?.length > 0 && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <History className="h-4 w-4 shrink-0" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">سجل الحضور والغياب للـ {report.attendance.history.length} حصة الأخيرة</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">مرتبة من الأحدث (يمين) إلى الأقدم (يسار) — انقر على أي حصة لتعديل حالتها أو حذفها</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3">
                        {report.attendance.history.map((h: any, i: number) => {
                            const isPresent = h.status === 'PRESENT' || h.status === 'LATE';
                            const isAbsent = h.status === 'ABSENT';
                            const isExcused = h.status === 'EXCUSED';
                            const isGuest = h.status === 'GUEST';
                            const { dayName, dateFormatted, fullDate } = formatSessionDate(h.date);
                            const hasHomework = typeof h.homeworkDone === 'boolean' && isPresent;

                            return (
                                <div
                                    key={i}
                                    title={`${fullDate} — ${isPresent ? (hasHomework ? (h.homeworkDone ? 'حاضر (تم الواجب)' : 'حاضر (لم يتم الواجب)') : 'حاضر') : isExcused ? 'بعذر / معوّض' : isGuest ? 'زائر' : isAbsent ? 'غائب' : '—'} (انقر للتعديل أو الحذف)`}
                                    onClick={() => canWrite && h.sessionId && setSelectedSessionForAdjustment({
                                        sessionId: h.sessionId,
                                        date: h.date,
                                        status: h.status,
                                        homeworkDone: typeof h.homeworkDone === 'boolean' ? h.homeworkDone : null,
                                    })}
                                    className={cn(
                                        'flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all duration-200 select-none',
                                        canWrite && h.sessionId && 'cursor-pointer hover:scale-[1.04] hover:shadow-md active:scale-95',
                                        isPresent ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80' :
                                        isAbsent  ? 'bg-red-50/80 border-red-200 text-red-800 hover:bg-red-100/80' :
                                        isExcused ? 'bg-blue-50/80 border-blue-200 text-blue-800 hover:bg-blue-100/80' :
                                        isGuest   ? 'bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100/80' :
                                        'bg-gray-50 border-gray-200 text-gray-700'
                                    )}
                                >
                                    {/* Status Badge */}
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-2xs",
                                            isPresent ? "bg-emerald-500 text-white" :
                                            isAbsent  ? "bg-red-500 text-white" :
                                            isExcused ? "bg-blue-500 text-white" :
                                            isGuest   ? "bg-amber-500 text-white" :
                                            "bg-gray-400 text-white"
                                        )}>
                                            {isPresent ? <Check className="h-3 w-3 stroke-[3]" /> :
                                             isAbsent  ? <X className="h-3 w-3 stroke-[3]" /> :
                                             isExcused ? <Clock className="h-3 w-3" /> :
                                             isGuest   ? <UserCheck className="h-3 w-3" /> : null}
                                        </div>
                                        <span className="text-[11px] font-bold">
                                            {isPresent ? 'حاضر' : isAbsent ? 'غائب' : isExcused ? 'بعذر' : isGuest ? 'زائر' : '—'}
                                        </span>
                                    </div>

                                    {/* Homework Badge if applicable */}
                                    {hasHomework && (
                                        <span className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full border mb-1.5 leading-none shrink-0",
                                            h.homeworkDone
                                                ? "bg-emerald-100/90 text-emerald-800 border-emerald-300"
                                                : "bg-rose-100/90 text-rose-800 border-rose-300"
                                        )}>
                                            {h.homeworkDone ? 'واجب ✓' : 'بلا واجب ✗'}
                                        </span>
                                    )}

                                    {/* Divider */}
                                    <div className={cn(
                                        "w-full h-px mb-1.5 opacity-60",
                                        isPresent ? "bg-emerald-200" :
                                        isAbsent  ? "bg-red-200" :
                                        isExcused ? "bg-blue-200" :
                                        isGuest   ? "bg-amber-200" :
                                        "bg-gray-200"
                                    )} />

                                    {/* Day & Date */}
                                    <span className="text-[10px] font-semibold opacity-75 leading-none mb-0.5">{dayName}</span>
                                    <span className="text-xs font-black tracking-tight">{dateFormatted}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-100 flex-wrap text-xs text-gray-600 font-semibold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> حاضر
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> غائب
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> بعذر / معوّض
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> زائر
                        </span>
                    </div>
                </div>
            )}

            {/* Modal for adjusting or deleting session attendance */}
            {studentId && (
                <AttendanceAdjustmentModal
                    open={selectedSessionForAdjustment !== null}
                    onOpenChange={(open) => { if (!open) setSelectedSessionForAdjustment(null); }}
                    sessionId={selectedSessionForAdjustment?.sessionId}
                    studentId={studentId}
                    studentName={studentName}
                    sessionDate={selectedSessionForAdjustment?.date}
                    currentStatus={selectedSessionForAdjustment?.status}
                    currentHomeworkDone={selectedSessionForAdjustment?.homeworkDone}
                    canWrite={canWrite}
                />
            )}
        </div>
    );
}

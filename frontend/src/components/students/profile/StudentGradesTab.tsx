'use client';

import { useState } from 'react';
import { Loader2, GraduationCap, Trophy, XCircle, CheckCircle2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth.store';
import { EditGradeModal } from '@/components/exams/EditGradeModal';

interface Props {
    reportLoading?: boolean;
    report?: any;
    grades?: any[];
    studentName?: string;
    studentId?: string;
}

const GRADE_COLORS: Record<string, string> = {
    'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'A':  'bg-green-50 text-green-700 border-green-200',
    'B':  'bg-blue-50 text-blue-700 border-blue-200',
    'C':  'bg-yellow-50 text-yellow-700 border-yellow-200',
    'D':  'bg-orange-50 text-orange-600 border-orange-200',
    'F':  'bg-red-50 text-red-600 border-red-200',
};

export function StudentGradesTab({
    reportLoading,
    report,
    grades: customGrades,
    studentName: customStudentName,
    studentId: customStudentId,
}: Props) {
    const user = useAuthStore((s) => s.user);
    const canWrite =
        user?.role === 'assistant' ||
        user?.role === 'teacher' ||
        user?.role === 'centerOwner' ||
        user?.role === 'centerSupervisor';
    const [editingGrade, setEditingGrade] = useState<any | null>(null);

    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    const grades: any[] = customGrades ?? report?.grades?.history ?? [];
    const total = customGrades ? customGrades.length : (report?.grades?.total ?? grades.length);
    const studentName = customStudentName || report?.student?.studentName || '';
    const studentId = customStudentId || report?.student?._id || '';

    if (grades.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <GraduationCap className="h-12 w-12 mb-3 text-gray-200" />
                <p className="font-medium text-sm">لا توجد درجات مسجلة</p>
                <p className="text-xs mt-1 text-gray-300">ستظهر هنا الدرجات بعد تسجيل نتائج الامتحانات</p>
            </div>
        );
    }

    // Summary stats
    const passedCount  = grades.filter((g) => g.passed).length;
    const failedCount  = grades.length - passedCount;

    return (
        <div className="space-y-4" dir="rtl">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {/* Exams Count */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 rounded-2xl p-2.5 sm:p-4 border border-blue-100 text-center">
                    <p className="text-lg sm:text-2xl font-black text-blue-700">{total}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-blue-800/60 mt-0.5">عدد الامتحانات</p>
                </div>
                {/* Passed */}
                <div className="bg-gradient-to-br from-green-50 to-green-100/40 rounded-2xl p-2.5 sm:p-4 border border-green-100 text-center">
                    <p className="text-lg sm:text-2xl font-black text-green-700">{passedCount}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-green-800/60 mt-0.5">ناجح</p>
                </div>
                {/* Failed */}
                <div className="bg-gradient-to-br from-red-50 to-red-100/40 rounded-2xl p-2.5 sm:p-4 border border-red-100 text-center">
                    <p className="text-lg sm:text-2xl font-black text-red-600">{failedCount}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-red-800/60 mt-0.5">راسب</p>
                </div>
            </div>

            {/* ── Grades List ── */}
            <div className="grid gap-3">
                {grades.map((g: any, i: number) => {
                    const gradeColor = GRADE_COLORS[g.grade] ?? 'bg-gray-50 text-gray-600 border-gray-200';
                    const scoreRatio = g.totalMarks > 0 ? (g.score / g.totalMarks) * 100 : 0;

                    return (
                        <div
                            key={g._id || i}
                            className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 shadow-xs hover:shadow-md transition-all space-y-2.5"
                        >
                            {/* Top row: Title, Date, Score & Edit */}
                            <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className={cn(
                                        "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 border",
                                        g.passed
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            : "bg-rose-50 text-rose-600 border-rose-100"
                                    )}>
                                        <Trophy className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-900 truncate" title={g.examTitle}>
                                            {g.examTitle}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 font-medium">
                                            {new Date(g.date).toLocaleDateString('ar-EG', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {/* Score & Edit Action */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <div className="bg-gray-50/80 border border-gray-200/60 px-2 sm:px-2.5 py-1 rounded-xl text-left" dir="ltr">
                                        <span className="text-base sm:text-lg font-black text-gray-900">{g.score}</span>
                                        <span className="text-xs font-bold text-gray-400"> / {g.totalMarks}</span>
                                    </div>
                                    {canWrite && g._id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-xl shrink-0"
                                            onClick={() => setEditingGrade(g)}
                                            title="تعديل الدرجة"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Middle row: Badges & Percentage */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {g.passed ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                            ناجح
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                                            <XCircle className="h-3 w-3 text-rose-600" />
                                            راسب
                                        </span>
                                    )}
                                    {g.grade && (
                                        <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', gradeColor)}>
                                            {g.grade}
                                        </span>
                                    )}
                                    {g.passingMarks !== undefined && g.passingMarks !== null && (
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            درجة النجاح: {g.passingMarks}
                                        </span>
                                    )}
                                </div>

                                <span className={cn(
                                    "text-xs font-black font-mono px-1.5 py-0.5 rounded-md",
                                    g.passed ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                                )}>
                                    {Math.round(scoreRatio)}%
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={cn(
                                        'h-1.5 rounded-full transition-all duration-500',
                                        g.passed ? 'bg-emerald-500' : 'bg-rose-500'
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, scoreRatio))}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Edit Grade Modal */}
            {editingGrade && (
                <EditGradeModal
                    open={editingGrade !== null}
                    onOpenChange={(v) => { if (!v) setEditingGrade(null); }}
                    examId={editingGrade.examId}
                    examTitle={editingGrade.examTitle}
                    resultId={editingGrade._id}
                    studentName={studentName}
                    studentId={studentId}
                    totalMarks={editingGrade.totalMarks}
                    passingMarks={editingGrade.passingMarks}
                    initialScore={editingGrade.score}
                />
            )}
        </div>
    );
}

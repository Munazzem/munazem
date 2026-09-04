'use client';

import { useState } from 'react';
import { Loader2, GraduationCap, Trophy, XCircle, CheckCircle2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth.store';
import { EditGradeModal } from '@/components/exams/EditGradeModal';

interface Props {
    reportLoading: boolean;
    report: any;
}

const GRADE_COLORS: Record<string, string> = {
    'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'A':  'bg-green-50 text-green-700 border-green-200',
    'B':  'bg-blue-50 text-blue-700 border-blue-200',
    'C':  'bg-yellow-50 text-yellow-700 border-yellow-200',
    'D':  'bg-orange-50 text-orange-600 border-orange-200',
    'F':  'bg-red-50 text-red-600 border-red-200',
};

export function StudentGradesTab({ reportLoading, report }: Props) {
    const user = useAuthStore((s) => s.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const [editingGrade, setEditingGrade] = useState<any | null>(null);

    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    const grades: any[] = report?.grades?.history ?? [];
    const total          = report?.grades?.total ?? 0;
    const studentName    = report?.student?.studentName ?? '';
    const studentId      = report?.student?._id ?? '';

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
        <div className="space-y-5">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-3 gap-3">
                {/* Exams Count */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 rounded-2xl p-3 sm:p-4 border border-blue-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-blue-700">{total}</p>
                    <p className="text-[10px] font-bold text-blue-800/50 mt-0.5">عدد الامتحانات</p>
                </div>
                {/* Passed */}
                <div className="bg-gradient-to-br from-green-50 to-green-100/40 rounded-2xl p-3 sm:p-4 border border-green-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-green-700">{passedCount}</p>
                    <p className="text-[10px] font-bold text-green-800/50 mt-0.5">ناجح</p>
                </div>
                {/* Failed */}
                <div className="bg-gradient-to-br from-red-50 to-red-100/40 rounded-2xl p-3 sm:p-4 border border-red-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-red-600">{failedCount}</p>
                    <p className="text-[10px] font-bold text-red-800/50 mt-0.5">راسب</p>
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
                            className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-3">
                                {/* Left: Exam info */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-xl bg-[#0f4c81]/8 border border-[#0f4c81]/10 flex items-center justify-center shrink-0">
                                        <Trophy className="h-4.5 w-4.5 text-[#0f4c81]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{g.examTitle}</p>
                                        <p className="text-xs text-gray-400 mt-0.5 font-medium">
                                            {new Date(g.date).toLocaleDateString('ar-EG', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Score + Grade badge + Edit button */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <div className="flex items-center gap-1.5">
                                        {canWrite && g._id && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-gray-400 hover:text-primary rounded-full"
                                                onClick={() => setEditingGrade(g)}
                                                title="تعديل الدرجة"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {g.passed
                                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            : <XCircle className="h-4 w-4 text-red-400" />
                                        }
                                        <span className={cn(
                                            'text-xs font-bold px-2.5 py-0.5 rounded-full border',
                                            gradeColor
                                        )}>
                                            {g.grade}
                                        </span>
                                    </div>
                                    <p className="text-base font-extrabold text-gray-800">
                                        {g.score}
                                        <span className="text-xs font-bold text-gray-400 mr-0.5">/ {g.totalMarks}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        {g.passed ? 'ناجح' : 'راسب'} — درجة النجاح: {g.passingMarks}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className={cn(
                                            'h-1.5 rounded-full transition-all',
                                            g.passed ? 'bg-green-500' : 'bg-red-400'
                                        )}
                                        style={{ width: `${Math.min(100, Math.max(0, scoreRatio))}%` }}
                                    />
                                </div>
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

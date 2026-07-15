'use client';

import { Loader2, GraduationCap, Trophy, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    const grades: any[] = report?.grades?.history ?? [];
    const total          = report?.grades?.total ?? 0;

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
    const avgPercentage = grades.length > 0
        ? Math.round(grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length)
        : 0;

    return (
        <div className="space-y-5">

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-3 gap-3">
                {/* Exams Count */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 rounded-2xl p-3 sm:p-4 border border-blue-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-blue-700">{total}</p>
                    <p className="text-[10px] font-bold text-blue-800/50 mt-0.5">عدد الامتحانات</p>
                </div>
                {/* Average */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 rounded-2xl p-3 sm:p-4 border border-indigo-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-indigo-700">{avgPercentage}%</p>
                    <p className="text-[10px] font-bold text-indigo-800/50 mt-0.5">المتوسط</p>
                </div>
                {/* Passed / Failed */}
                <div className="bg-gradient-to-br from-green-50 to-green-100/40 rounded-2xl p-3 sm:p-4 border border-green-100 text-center">
                    <p className="text-xl sm:text-2xl font-extrabold text-green-700">
                        {passedCount}
                        <span className="text-xs font-bold text-red-400 mr-1">/ {failedCount} رسوب</span>
                    </p>
                    <p className="text-[10px] font-bold text-green-800/50 mt-0.5">نجح / رسب</p>
                </div>
            </div>

            {/* ── Grades List ── */}
            <div className="grid gap-3">
                {grades.map((g: any, i: number) => {
                    const gradeColor = GRADE_COLORS[g.grade] ?? 'bg-gray-50 text-gray-600 border-gray-200';
                    const percentage = g.percentage ?? Math.round((g.score / g.totalMarks) * 100);

                    return (
                        <div
                            key={i}
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

                                {/* Right: Score + Grade badge */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <div className="flex items-center gap-2">
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
                                    <span className="text-[10px] font-bold text-gray-600">{percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className={cn(
                                            'h-1.5 rounded-full transition-all',
                                            g.passed ? 'bg-green-500' : 'bg-red-400'
                                        )}
                                        style={{ width: `${Math.min(100, percentage)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

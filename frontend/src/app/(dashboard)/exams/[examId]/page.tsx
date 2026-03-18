'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ArrowRight,
    ClipboardList,
    Sparkles,
    Loader2,
    CheckCircle2,
    Clock,
    BookOpen,
    Trash2,
    Send,
    ListChecks,
    BarChart2,
    AlertTriangle,
    MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchExamById, getExamResults, publishExam, deleteExam } from '@/lib/api/exams';
import type { IExam, ExamStatus, IQuestion } from '@/lib/api/exams';
import dynamic from 'next/dynamic';
const BatchResultsModal = dynamic(
    () => import('@/components/exams/BatchResultsModal').then(m => m.BatchResultsModal),
    { ssr: false }
);
import { useAuthStore } from '@/lib/store/auth.store';
import { cn } from '@/lib/utils';

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_MAP: Record<ExamStatus, { label: string; className: string; icon: React.ElementType }> = {
    DRAFT:     { label: 'مسودة', className: 'bg-amber-100 text-amber-700',  icon: Clock },
    PUBLISHED: { label: 'منشور', className: 'bg-blue-100 text-blue-700',    icon: BookOpen },
    COMPLETED: { label: 'مكتمل', className: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: ExamStatus }) {
    const s = STATUS_MAP[status] ?? STATUS_MAP.DRAFT;
    const Icon = s.icon;
    return (
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', s.className)}>
            <Icon className="h-3.5 w-3.5" />
            {s.label}
        </span>
    );
}

// ── Grade badge ────────────────────────────────────────────────────
const GRADE_COLORS: Record<string, string> = {
    'A+': 'bg-green-100 text-green-700',
    'A':  'bg-green-100 text-green-600',
    'B':  'bg-blue-100 text-blue-700',
    'C':  'bg-yellow-100 text-yellow-700',
    'D':  'bg-orange-100 text-orange-700',
    'F':  'bg-red-100 text-red-700',
};

// ── Question type label ────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
    MCQ:        'اختيار من متعدد',
    TRUE_FALSE: 'صح أم خطأ',
    ESSAY:      'مقالي',
};

type Tab = 'questions' | 'results';

export default function ExamDetailPage() {
    const { examId } = useParams<{ examId: string }>();
    const router     = useRouter();
    const user       = useAuthStore((s) => s.user);
    const isTeacher  = user?.role === 'teacher' || user?.role === 'assistant';
    const queryClient = useQueryClient();

    const [activeTab,       setActiveTab]       = useState<Tab>('questions');
    const [showBatchModal,  setShowBatchModal]  = useState(false);

    const { data: exam, isLoading: examLoading, isError: examError } = useQuery({
        queryKey: ['exam', examId],
        queryFn:  () => fetchExamById(examId),
    });

    const { data: resultsData, isLoading: resultsLoading } = useQuery({
        queryKey: ['exam-results', examId],
        queryFn:  () => getExamResults(examId),
        enabled:  activeTab === 'results' && !!examId,
    });

    const publishMutation = useMutation({
        mutationFn: () => publishExam(examId),
        onSuccess:  () => {
            toast.success('تم نشر الامتحان بنجاح');
            queryClient.invalidateQueries({ queryKey: ['exam', examId] });
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
        
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteExam(examId),
        onSuccess:  () => {
            toast.success('تم حذف الامتحان');
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            router.push('/exams');
        },
        
    });

    if (examLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (examError || !exam) {
        return (
            <div className="p-8 text-center" dir="rtl">
                <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
                <p className="text-red-500 font-bold">لم يتم العثور على الامتحان.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/exams')}>عودة</Button>
            </div>
        );
    }

    const examData = (exam as any).data ?? exam as IExam;
    const questions: IQuestion[] = examData.questions ?? [];
    const results   = (resultsData as any)?.results ?? [];
    const summary   = resultsData as any;

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex items-start gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/exams')}
                    className="shrink-0 mt-0.5"
                >
                    <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 truncate">{examData.title}</h1>
                        <StatusBadge status={examData.status} />
                        {examData.source === 'AI_GENERATED' && (
                            <span className="inline-flex items-center gap-1 text-xs text-purple-500 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                                <Sparkles className="h-3 w-3" /> AI
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-sm text-gray-500">
                        {examData.gradeLevel && <span>{examData.gradeLevel}</span>}
                        <span>{new Date(examData.date).toLocaleDateString('ar-EG')}</span>
                        <span>الدرجة الكلية: <strong className="text-gray-700">{examData.totalMarks}</strong></span>
                        <span>درجة النجاح: <strong className="text-gray-700">{examData.passingMarks}</strong></span>
                        <span>{questions.length} سؤال</span>
                    </div>
                </div>
            </div>

            {/* Teacher action buttons */}
            {isTeacher && (
                <div className="flex flex-wrap gap-2">
                    {examData.status === 'DRAFT' && (
                        <>
                            <Button
                                onClick={() => {
                                    if (questions.length === 0) { toast.error('أضف أسئلة قبل النشر'); return; }
                                    publishMutation.mutate();
                                }}
                                disabled={publishMutation.isPending}
                                className="gap-2"
                            >
                                {publishMutation.isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Send className="h-4 w-4" />
                                }
                                نشر الامتحان
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => { if (window.confirm('حذف هذا الامتحان؟')) deleteMutation.mutate(); }}
                                disabled={deleteMutation.isPending}
                                className="gap-2"
                            >
                                {deleteMutation.isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />
                                }
                                حذف
                            </Button>
                        </>
                    )}
                    {examData.status === 'PUBLISHED' && (
                        <Button
                            onClick={() => setShowBatchModal(true)}
                            className="gap-2"
                        >
                            <ListChecks className="h-4 w-4" />
                            إدخال النتائج دفعة واحدة
                        </Button>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 gap-1">
                {([
                    { key: 'questions', label: 'الأسئلة',   icon: ClipboardList },
                    { key: 'results',   label: 'النتائج',   icon: BarChart2 },
                ] as const).map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                                activeTab === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Questions Tab ── */}
            {activeTab === 'questions' && (
                <div className="space-y-3">
                    {questions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400">لا توجد أسئلة في هذا الامتحان بعد.</p>
                        </div>
                    ) : (
                        questions.map((q, idx) => (
                            <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                                <div className="flex items-start gap-3">
                                    <span className="flex-none h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {TYPE_LABELS[q.type] ?? q.type}
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">
                                                {q.marks} {q.marks === 1 ? 'درجة' : 'درجات'}
                                            </span>
                                        </div>
                                        <p className="text-gray-900 font-medium leading-relaxed">{q.text}</p>

                                        {/* MCQ options */}
                                        {q.type === 'MCQ' && q.options && q.options.length > 0 && (
                                            <div className="mt-3 space-y-1.5">
                                                {q.options.map((opt, oi) => (
                                                    <div
                                                        key={oi}
                                                        className={cn(
                                                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                                                            opt === q.correctAnswer
                                                                ? 'bg-green-50 text-green-800 font-medium'
                                                                : 'bg-gray-50 text-gray-600'
                                                        )}
                                                    >
                                                        <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                                                            {String.fromCharCode(65 + oi)}
                                                        </span>
                                                        {opt}
                                                        {opt === q.correctAnswer && (
                                                            <CheckCircle2 className="h-4 w-4 mr-auto text-green-600" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* TRUE/FALSE */}
                                        {q.type === 'TRUE_FALSE' && q.correctAnswer && (
                                            <div className="mt-2">
                                                <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                    الإجابة: {q.correctAnswer}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Results Tab ── */}
            {activeTab === 'results' && (
                <div className="space-y-4">
                    {resultsLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            {summary?.totalStudents > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'الطلاب',         value: summary.totalStudents, color: 'text-gray-700' },
                                        { label: 'نسبة النجاح',    value: summary.passRate,       color: 'text-green-600' },
                                        { label: 'ناجحون',         value: summary.passingCount,   color: 'text-green-600' },
                                        { label: 'راسبون',         value: summary.failingCount,   color: 'text-red-600'   },
                                    ].map((c) => (
                                        <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                                            <p className={cn('text-2xl font-bold', c.color)}>{c.value}</p>
                                            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Results table */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                {results.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <BarChart2 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-400">لا توجد نتائج بعد.</p>
                                        {isTeacher && examData.status === 'PUBLISHED' && (
                                            <Button
                                                className="mt-4 gap-2"
                                                onClick={() => setShowBatchModal(true)}
                                            >
                                                <ListChecks className="h-4 w-4" />
                                                إدخال النتائج
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop */}
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                                        <th className="text-right font-semibold text-gray-500 px-6 py-3">الطالب</th>
                                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">الدرجة</th>
                                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">النسبة</th>
                                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">التقدير</th>
                                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                                        <th className="text-center font-semibold text-gray-500 px-4 py-3 w-12">واتساب</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {results.map((r: any) => {
                                                        const name = r.studentName ?? '—';
                                                        const waMsg = encodeURIComponent(
                                                            `السلام عليكم،\nنتيجة ${name} في امتحان "${examData.title}":\nالدرجة: ${r.score} من ${examData.totalMarks}\nالنسبة: ${r.percentage}%\nالتقدير: ${r.grade}\nالحالة: ${r.passed ? 'ناجح ✅' : 'راسب ❌'}`
                                                        );
                                                        return (
                                                            <tr key={r._id} className="hover:bg-gray-50/50">
                                                                <td className="px-6 py-3 font-medium text-gray-900">{name}</td>
                                                                <td className="px-4 py-3 text-center font-bold text-gray-800">
                                                                    {r.score} / {examData.totalMarks}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-gray-600">{r.percentage}%</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={cn(
                                                                        'inline-block w-10 text-center text-sm font-bold px-1.5 py-0.5 rounded',
                                                                        GRADE_COLORS[r.grade] ?? 'bg-gray-100 text-gray-700'
                                                                    )}>
                                                                        {r.grade}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={cn(
                                                                        'text-xs font-medium px-2 py-0.5 rounded-full',
                                                                        r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                    )}>
                                                                        {r.passed ? 'ناجح' : 'راسب'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <a
                                                                        href={`https://wa.me/?text=${waMsg}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                                                                        title="إرسال النتيجة لولي الأمر"
                                                                    >
                                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                                    </a>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile cards */}
                                        <div className="sm:hidden divide-y divide-gray-50">
                                            {results.map((r: any) => {
                                                const name = r.studentName ?? '—';
                                                const waMsg = encodeURIComponent(
                                                    `السلام عليكم،\nنتيجة ${name} في امتحان "${examData.title}":\nالدرجة: ${r.score} من ${examData.totalMarks}\nالنسبة: ${r.percentage}%\nالتقدير: ${r.grade}\nالحالة: ${r.passed ? 'ناجح ✅' : 'راسب ❌'}`
                                                );
                                                return (
                                                    <div key={r._id} className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium text-gray-900">{name}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    'text-xs font-medium px-2 py-0.5 rounded-full',
                                                                    r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                )}>
                                                                    {r.passed ? 'ناجح' : 'راسب'}
                                                                </span>
                                                                <a
                                                                    href={`https://wa.me/?text=${waMsg}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                                                                >
                                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 mt-1 text-sm text-gray-500">
                                                            <span>الدرجة: <strong className="text-gray-800">{r.score}</strong></span>
                                                            <span>النسبة: <strong className="text-gray-800">{r.percentage}%</strong></span>
                                                            <span>التقدير: <strong className={GRADE_COLORS[r.grade] ? 'font-bold' : ''}>{r.grade}</strong></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Batch Results Modal */}
            {showBatchModal && (
                <BatchResultsModal
                    exam={examData}
                    open={showBatchModal}
                    onOpenChange={setShowBatchModal}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['exam-results', examId] });
                    }}
                />
            )}
        </div>
    );
}

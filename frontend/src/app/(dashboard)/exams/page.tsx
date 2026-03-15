'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    ClipboardList,
    Plus,
    Sparkles,
    Search,
    Filter,
    Loader2,
    Trash2,
    ChevronLeft,
    CheckCircle2,
    Clock,
    BookOpen,
    ArrowRight,
} from 'lucide-react';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchExams, deleteExam } from '@/lib/api/exams';
import type { IExam, ExamStatus } from '@/lib/api/exams';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import dynamic from 'next/dynamic';
import { CreateExamModal } from '@/components/exams/CreateExamModal';
const AIGenerateExamModal = dynamic(
    () => import('@/components/exams/AIGenerateExamModal').then(m => m.AIGenerateExamModal),
    { ssr: false }
);
import { cn } from '@/lib/utils';

// ── Status helpers ──────────────────────────────────────────────────
const STATUS_MAP: Record<ExamStatus, { label: string; className: string; icon: React.ElementType }> = {
    DRAFT:     { label: 'مسودة',   className: 'bg-amber-100 text-amber-700',  icon: Clock },
    PUBLISHED: { label: 'منشور',   className: 'bg-blue-100 text-blue-700',    icon: BookOpen },
    COMPLETED: { label: 'مكتمل',   className: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: ExamStatus }) {
    const s = STATUS_MAP[status] ?? STATUS_MAP.DRAFT;
    const Icon = s.icon;
    return (
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', s.className)}>
            <Icon className="h-3 w-3" />
            {s.label}
        </span>
    );
}

export default function ExamsPage() {
    const user      = useAuthStore((s) => s.user);
    const isTeacher = user?.role === 'teacher' || user?.role === 'assistant';
    const router    = useRouter();
    const queryClient = useQueryClient();
    const allowedGrades = getAllowedGrades(user?.stage);

    const [search,        setSearch]        = useState('');
    const [statusFilter,  setStatusFilter]  = useState('');
    const [gradeFilter,   setGradeFilter]   = useState('');
    const [page,          setPage]          = useState(1);
    const [showCreate,    setShowCreate]    = useState(false);
    const [showAI,        setShowAI]        = useState(false);
    const limit = 20;

    const { data, isLoading, isError } = useQuery({
        queryKey: ['exams', { page, limit, status: statusFilter, gradeLevel: gradeFilter }],
        queryFn:  () => fetchExams({
            page,
            limit,
            status:     (statusFilter as ExamStatus) || undefined,
            gradeLevel: gradeFilter || undefined,
        }),
        placeholderData: keepPreviousData,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteExam,
        onSuccess:  () => {
            toast.success('تم حذف الامتحان');
            queryClient.invalidateQueries({ queryKey: ['exams'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    const exams: IExam[] = (data as any)?.data ?? [];
    const pagination     = (data as any)?.pagination;

    // Enforce stage-based grade filtering on the frontend as well
    const stageFiltered = user?.stage
        ? exams.filter((e) => !e.gradeLevel || allowedGrades.includes(e.gradeLevel))
        : exams;

    const filtered = search.trim()
        ? stageFiltered.filter((e) => e.title.includes(search))
        : stageFiltered;

    const AI_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AI_EXAMS === 'true';

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">الامتحانات</h1>
                    <p className="text-gray-500 mt-1">
                        إدارة وتتبع نتائج الامتحانات ({pagination?.total ?? 0} امتحان)
                    </p>
                </div>
                {isTeacher && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        {AI_ENABLED ? (
                            <Button
                                variant="outline"
                                onClick={() => setShowAI(true)}
                                className="gap-2 flex-1 sm:flex-none"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span className="hidden sm:inline">توليد بالذكاء الاصطناعي</span>
                                <span className="sm:hidden">AI</span>
                            </Button>
                        ) : null}
                        <Button onClick={() => setShowCreate(true)} className="gap-2 flex-1 sm:flex-none">
                            <Plus className="h-4 w-4" />
                            <span>إنشاء امتحان</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                    <Input
                        placeholder="ابحث باسم الامتحان..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-10 bg-gray-50 border-gray-200"
                    />
                </div>
                <Select value={statusFilter || 'ALL'} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }} dir="rtl">
                    <SelectTrigger className="w-full sm:w-40 border-gray-200 bg-gray-50">
                        <Filter size={14} className="ml-2 text-gray-400" />
                        <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="ALL">كل الحالات</SelectItem>
                        <SelectItem value="DRAFT">مسودة</SelectItem>
                        <SelectItem value="PUBLISHED">منشور</SelectItem>
                        <SelectItem value="COMPLETED">مكتمل</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={gradeFilter || 'ALL'} onValueChange={(v) => { setGradeFilter(v === 'ALL' ? '' : v); setPage(1); }} dir="rtl">
                    <SelectTrigger className="w-full sm:w-48 border-gray-200 bg-gray-50">
                        <SelectValue placeholder="المرحلة" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="ALL">كل المراحل</SelectItem>
                        {allowedGrades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Table — Desktop */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-4 sm:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <TableSkeleton rows={8} columns={5} />
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-red-500 font-bold">حدث خطأ أثناء تحميل البيانات.</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400">لا توجد امتحانات بعد.</p>
                        {isTeacher && <p className="text-xs text-gray-400 mt-1">اضغط "إنشاء امتحان" للبدء.</p>}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-right font-semibold text-gray-500 px-6 py-3">الامتحان</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">المرحلة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">التاريخ</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الأسئلة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الدرجة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                        <th className="text-center font-semibold text-gray-500 px-4 py-3 w-24">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((exam) => (
                                        <tr
                                            key={exam._id}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/exams/${exam._id}`)}
                                        >
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                        <ClipboardList className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{exam.title}</p>
                                                        {exam.source === 'AI_GENERATED' && (
                                                            <span className="text-xs text-purple-500 flex items-center gap-0.5">
                                                                <Sparkles className="h-3 w-3" /> AI
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-xs text-gray-500">
                                                    {exam.gradeLevel ?? '—'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(exam.date).toLocaleDateString('ar-EG')}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 font-medium">
                                                {exam.questions?.length ?? 0}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 font-medium">
                                                {exam.totalMarks} / {exam.passingMarks}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={exam.status} />
                                            </td>
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 text-gray-400 hover:text-primary"
                                                        onClick={() => router.push(`/exams/${exam._id}`)}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    {isTeacher && exam.status === 'DRAFT' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-gray-400 hover:text-red-500"
                                                            onClick={() => {
                                                                if (window.confirm(`حذف "${exam.title}"؟`)) deleteMutation.mutate(exam._id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="lg:hidden divide-y divide-gray-50">
                            {filtered.map((exam) => (
                                <div
                                    key={exam._id}
                                    className="p-4 hover:bg-gray-50/50 cursor-pointer"
                                    onClick={() => router.push(`/exams/${exam._id}`)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <ClipboardList className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-gray-900 truncate">{exam.title}</p>
                                                {exam.source === 'AI_GENERATED' && (
                                                    <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                                )}
                                                <StatusBadge status={exam.status} />
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                                                {exam.gradeLevel && <span>{exam.gradeLevel}</span>}
                                                <span>{new Date(exam.date).toLocaleDateString('ar-EG')}</span>
                                                <span>{exam.questions?.length ?? 0} سؤال</span>
                                                <span>الدرجة: {exam.totalMarks} / نجاح: {exam.passingMarks}</span>
                                            </div>
                                        </div>
                                        <ChevronLeft className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                        <p className="text-sm text-gray-500">
                            صفحة <span className="font-bold text-gray-900">{pagination.page}</span> من{' '}
                            <span className="font-bold text-gray-900">{pagination.totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>السابق</Button>
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>التالي</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateExamModal   open={showCreate} onOpenChange={setShowCreate} />
            {AI_ENABLED && (
                <AIGenerateExamModal open={showAI}  onOpenChange={setShowAI} />
            )}
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Award, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateResult, deleteResult } from '@/lib/api/exams';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    examId: string;
    examTitle?: string;
    resultId: string;
    studentName: string;
    studentId?: string;
    totalMarks: number;
    passingMarks: number;
    initialScore: number;
    onSuccess?: () => void;
}

export function EditGradeModal({
    open,
    onOpenChange,
    examId,
    examTitle,
    resultId,
    studentName,
    studentId,
    totalMarks,
    passingMarks,
    initialScore,
    onSuccess,
}: Props) {
    const queryClient = useQueryClient();
    const [score, setScore] = useState<number | ''>(initialScore);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    useEffect(() => {
        if (open) {
            setScore(initialScore);
        }
    }, [open, initialScore]);

    const numericScore = typeof score === 'number' ? score : 0;
    const isPassed = numericScore >= passingMarks;
    const isValid = score !== '' && numericScore >= 0 && numericScore <= totalMarks;

    const updateMutation = useMutation({
        mutationFn: () => updateResult(examId, resultId, { score: numericScore }),
        onSuccess: () => {
            toast.success(`تم تعديل درجة ${studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['exam-results', examId] });
            queryClient.invalidateQueries({ queryKey: ['exam', examId] });
            if (studentId) {
                queryClient.invalidateQueries({ queryKey: ['student-report', studentId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['student-report'] });
            }
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء تعديل الدرجة');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteResult(examId, resultId),
        onSuccess: () => {
            toast.success(`تم حذف درجة ${studentName}`);
            queryClient.invalidateQueries({ queryKey: ['exam-results', examId] });
            queryClient.invalidateQueries({ queryKey: ['exam', examId] });
            if (studentId) {
                queryClient.invalidateQueries({ queryKey: ['student-report', studentId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['student-report'] });
            }
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء حذف الدرجة');
        },
    });

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} dir="rtl" className="max-w-sm bg-white rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Award className="h-5 w-5 text-primary" />
                            تعديل درجة الطالب
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Student and Exam Info */}
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1">
                            <p className="text-sm font-bold text-gray-900">{studentName}</p>
                            {examTitle && (
                                <p className="text-xs text-gray-500 truncate">الامتحان: {examTitle}</p>
                            )}
                            <p className="text-xs text-gray-400">
                                الدرجة الكلية: <strong className="text-gray-700">{totalMarks}</strong> · درجة النجاح: <strong className="text-gray-700">{passingMarks}</strong>
                            </p>
                        </div>

                        {/* Score Input */}
                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                الدرجة الجديدة (من {totalMarks})
                            </label>
                            <Input
                                type="number"
                                min={0}
                                max={totalMarks}
                                value={score}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setScore('');
                                    } else {
                                        const n = Number(val);
                                        setScore(Math.min(totalMarks, Math.max(0, n)));
                                    }
                                }}
                                className="text-center text-2xl font-black h-14"
                                autoFocus
                            />
                        </div>

                        {/* Status preview */}
                        {score !== '' && (
                            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-gray-50/70 border border-gray-100">
                                <span className={cn(
                                    'text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1',
                                    isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                )}>
                                    {isPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                    {isPassed ? 'ناجح' : 'راسب'}
                                </span>
                                <span className="text-xs text-gray-500 font-medium">
                                    {score} من {totalMarks}
                                </span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 flex-row justify-between pt-2 border-t">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 px-2"
                            onClick={() => setShowConfirmDelete(true)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                            حذف الدرجة
                        </Button>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={updateMutation.isPending || deleteMutation.isPending}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="button"
                                onClick={() => updateMutation.mutate()}
                                disabled={!isValid || updateMutation.isPending}
                                className="gap-2"
                            >
                                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                حفظ التعديل
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={showConfirmDelete}
                onOpenChange={setShowConfirmDelete}
                title={`حذف درجة "${studentName}"؟`}
                description="سيتم إزالة نتيجة هذا الطالب من سجلات الامتحان، ويمكنك إعادة إدخالها لاحقاً."
                confirmLabel="حذف"
                variant="danger"
                onConfirm={() => {
                    deleteMutation.mutate();
                    setShowConfirmDelete(false);
                }}
            />
        </>
    );
}

'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExams, recordResult } from '@/lib/api/exams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
}

export function AddGradeModal({ open, onClose, studentId, studentName }: Props) {
    const queryClient = useQueryClient();
    const [selectedExamId, setSelectedExamId] = useState('');
    const [score, setScore] = useState<number | ''>('');

    const { data } = useQuery({
        queryKey: ['exams-published'],
        queryFn: () => fetchExams({ status: 'PUBLISHED' as any, limit: 50 }),
        enabled: open,
    });
    const exams = data?.data ?? [];
    const selectedExam = exams.find((e: any) => e._id === selectedExamId);

    const mutation = useMutation({
        mutationFn: () => recordResult(selectedExamId, { studentId, score: Number(score) }),
        onSuccess: () => {
            toast.success(`✅ تم تسجيل درجة ${studentName}`);
            if (selectedExamId) {
                queryClient.invalidateQueries({ queryKey: ['exam-results', selectedExamId] });
            }
            queryClient.invalidateQueries({ queryKey: ['student-report', studentId] });
            onClose();
            setSelectedExamId('');
            setScore('');
        },
    });

    const isValid = selectedExamId && score !== '' && Number(score) >= 0
        && (!selectedExam || Number(score) <= selectedExam.totalMarks);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} dir="rtl" className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-orange-600" />
                        إضافة درجة — {studentName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Exam picker */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1.5 block">اختر الامتحان</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {exams.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">لا توجد امتحانات منشورة</p>
                            )}
                            {exams.map((e: any) => (
                                <button
                                    key={e._id}
                                    onClick={() => { setSelectedExamId(e._id); setScore(''); }}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all',
                                        selectedExamId === e._id
                                            ? 'border-orange-400 bg-orange-50'
                                            : 'border-gray-100 hover:border-orange-200'
                                    )}
                                >
                                    <span className="font-medium text-gray-800 text-right">{e.title}</span>
                                    <span className="text-xs text-gray-500 shrink-0 mr-2">من {e.totalMarks}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Score input */}
                    {selectedExam && (
                        <div>
                            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                                الدرجة (من {selectedExam.totalMarks} | نجاح {selectedExam.passingMarks})
                            </label>
                            <Input
                                type="number"
                                min={0}
                                max={selectedExam.totalMarks}
                                value={score}
                                onChange={e => setScore(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder={`0 - ${selectedExam.totalMarks}`}
                                className="text-center text-xl font-black h-14"
                                autoFocus
                            />
                            {score !== '' && (
                                <p className={cn(
                                    'text-center text-sm font-bold mt-2',
                                    Number(score) >= selectedExam.passingMarks ? 'text-green-600' : 'text-red-500'
                                )}>
                                    {Number(score) >= selectedExam.passingMarks ? '✅ ناجح' : '❌ راسب'}
                                    {' · '}{Math.round((Number(score) / selectedExam.totalMarks) * 100)}%
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
                        <Button
                            onClick={() => mutation.mutate()}
                            disabled={!isValid || mutation.isPending}
                            className="flex-1 bg-orange-500 hover:bg-orange-600"
                        >
                            {mutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><CheckCircle2 className="h-4 w-4 ml-1" />تسجيل الدرجة</>
                            }
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

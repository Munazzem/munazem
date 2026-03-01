'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { batchRecordResults, getExamResults } from '@/lib/api/exams';
import { fetchStudents } from '@/lib/api/students';
import type { IExam } from '@/lib/api/exams';

interface Props {
    exam:         IExam;
    open:         boolean;
    onOpenChange: (v: boolean) => void;
    onSuccess?:   () => void;
}

interface StudentRow {
    studentId:   string;
    studentName: string;
    score:       number | '';
    alreadyDone: boolean;
}

export function BatchResultsModal({ exam, open, onOpenChange, onSuccess }: Props) {
    const [rows, setRows] = useState<StudentRow[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{ total: number; inserted: number } | null>(null);

    // Fetch students belonging to the exam's groups
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: ['students-for-exam', exam._id, exam.groupIds],
        queryFn:  () => fetchStudents({ limit: 200, groupId: exam.groupIds?.[0] }),
        enabled:  open,
    });

    // Fetch already-recorded results
    const { data: resultsData } = useQuery({
        queryKey: ['exam-results', exam._id],
        queryFn:  () => getExamResults(exam._id),
        enabled:  open,
    });

    useEffect(() => {
        if (!open) { setSubmitted(false); setResult(null); return; }
        const students: any[] = (studentsData as any)?.data ?? (studentsData as any) ?? [];
        const done: Set<string> = new Set(
            ((resultsData as any)?.results ?? []).map((r: any) =>
                typeof r.studentId === 'string' ? r.studentId : r.studentId?._id
            )
        );

        setRows(
            students.map((s) => ({
                studentId:   s._id,
                studentName: s.fullName,
                score:       '',
                alreadyDone: done.has(s._id),
            }))
        );
    }, [open, studentsData, resultsData]);

    const mutation = useMutation({
        mutationFn: () => {
            const valid = rows
                .filter((r) => !r.alreadyDone && r.score !== '')
                .map((r) => ({ studentId: r.studentId, score: Number(r.score) }));
            if (valid.length === 0) throw new Error('أدخل درجة طالب واحد على الأقل');
            return batchRecordResults(exam._id, valid);
        },
        onSuccess: (res) => {
            setResult(res);
            setSubmitted(true);
            toast.success(`تم إدخال ${res.inserted} نتيجة من ${res.total}`);
            onSuccess?.();
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? err?.message ?? 'حدث خطأ'),
    });

    const updateScore = (idx: number, val: string) => {
        const n = val === '' ? '' : Math.min(Number(val), exam.totalMarks);
        setRows((prev) => prev.map((r, i) => i === idx ? { ...r, score: n } : r));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3">
                        إدخال نتائج — {exam.title}
                        <span className="text-sm font-normal text-gray-400 mr-2">
                            (الدرجة الكلية: {exam.totalMarks} · النجاح: {exam.passingMarks})
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {submitted && result ? (
                    <div className="py-8 text-center space-y-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                        <p className="text-lg font-bold text-gray-800">تم الحفظ بنجاح</p>
                        <p className="text-gray-500">
                            تم إدخال <span className="font-bold text-green-600">{result.inserted}</span> نتيجة من أصل{' '}
                            <span className="font-bold">{result.total}</span>
                        </p>
                        <Button onClick={() => onOpenChange(false)}>إغلاق</Button>
                    </div>
                ) : studentsLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 space-y-2">
                        <XCircle className="h-10 w-10 mx-auto text-gray-200" />
                        <p>لا يوجد طلاب مرتبطون بهذا الامتحان.</p>
                        <p className="text-xs">تأكد من تحديد المجموعات عند إنشاء الامتحان.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 py-2">
                            <div className="grid grid-cols-12 text-xs font-medium text-gray-400 px-3 pb-1 border-b">
                                <span className="col-span-7">الطالب</span>
                                <span className="col-span-5 text-center">الدرجة</span>
                            </div>
                            {rows.map((row, idx) => (
                                <div
                                    key={row.studentId}
                                    className={`grid grid-cols-12 items-center gap-2 px-3 py-2 rounded-lg ${row.alreadyDone ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="col-span-7 flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                            {row.studentName.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-800 truncate">{row.studentName}</span>
                                    </div>
                                    <div className="col-span-5 flex items-center justify-center">
                                        {row.alreadyDone ? (
                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle2 className="h-3.5 w-3.5" /> مُدخَل
                                            </span>
                                        ) : (
                                            <Input
                                                type="number"
                                                min={0}
                                                max={exam.totalMarks}
                                                value={row.score}
                                                onChange={(e) => updateScore(idx, e.target.value)}
                                                placeholder={`0 – ${exam.totalMarks}`}
                                                dir="ltr"
                                                className="text-center text-sm h-8 w-24"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 justify-end pt-3 border-t">
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                إلغاء
                            </Button>
                            <Button
                                onClick={() => mutation.mutate()}
                                disabled={mutation.isPending}
                                className="gap-2 min-w-[120px]"
                            >
                                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                حفظ النتائج
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

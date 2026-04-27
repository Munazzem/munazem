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
import { fetchGroups } from '@/lib/api/groups';
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
    const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);

    // Fetch all groups to get names for filtering
    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
        enabled: open,
    });

    const examGroups = (groupsData?.data ?? []).filter((g: any) => 
        exam.groupIds?.map(String).includes(String(g._id))
    );

    useEffect(() => {
        if (open && !selectedGroupId && exam.groupIds?.length) {
            setSelectedGroupId(String(exam.groupIds[0]));
        }
    }, [open, exam.groupIds, selectedGroupId]);

    // Fetch students — filter by selected group
    const { data: studentsData, isLoading: studentsLoading } = useQuery({
        queryKey: ['students-for-exam', exam._id, selectedGroupId],
        queryFn:  () => fetchStudents({ limit: 200, ...(selectedGroupId ? { groupId: selectedGroupId } : {}) }),
        enabled:  open,
    });

    // Fetch already-recorded results
    const { data: resultsData } = useQuery({
        queryKey: ['exam-results', exam._id],
        queryFn:  () => getExamResults(exam._id),
        enabled:  open,
    });

    const [rows, setRows] = useState<StudentRow[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{ total: number; inserted: number } | null>(null);

    useEffect(() => {
        if (!open) { setSubmitted(false); setResult(null); return; }

        // fetchStudents returns { data: [...], pagination: {...} }
        const raw: any = studentsData;
        const students: any[] = Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw)
            ? raw
            : [];

        const done: Set<string> = new Set(
            ((resultsData as any)?.results ?? []).map((r: any) =>
                typeof r.studentId === 'string' ? r.studentId : r.studentId?._id
            )
        );

        setRows(
            students
                .filter((s) => s?._id && (s?.studentName || s?.fullName))
                .map((s) => {
                    const name = s.fullName
                        ?? (s.studentName && s.parentName
                            ? `${s.studentName} ${s.parentName}`
                            : s.studentName ?? '—');
                    return {
                        studentId:   String(s._id),
                        studentName: String(name),
                        score:       '',
                        alreadyDone: done.has(String(s._id)),
                    };
                })
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
                ) : (
                    <>
                        {/* Group Selector */}
                        {examGroups.length > 1 && (
                            <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50/50 rounded-xl border border-gray-100">
                                {examGroups.map((g: any) => (
                                    <button
                                        key={g._id}
                                        onClick={() => setSelectedGroupId(g._id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            selectedGroupId === g._id
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {rows.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 space-y-2">
                                <XCircle className="h-10 w-10 mx-auto text-gray-200" />
                                <p>لا يوجد طلاب في هذه المجموعة حالياً.</p>
                            </div>
                        ) : (
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
                        )}

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

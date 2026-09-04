'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, AlertCircle, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateExam } from '@/lib/api/exams';
import type { IExam, IQuestion, QuestionType } from '@/lib/api/exams';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';

const questionSchema = z.object({
    type:          z.enum(['MCQ', 'TRUE_FALSE', 'ESSAY']),
    text:          z.string().min(3, 'أدخل نص السؤال'),
    marks:         z.number({ error: 'أدخل الدرجة' }).min(1),
    options:       z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
});

const schema = z.object({
    title:        z.string().min(3, 'أدخل عنوان الامتحان'),
    date:         z.string().min(1, 'أدخل التاريخ'),
    totalMarks:   z.number({ error: 'أدخل الدرجة النهائية' }).min(1, 'الدرجة النهائية يجب أن تكون 1 على الأقل'),
    passingMarks: z.number({ error: 'أدخل درجة النجاح' }).optional(),
    gradeLevel:   z.string().optional(),
    groupIds:     z.array(z.string()).optional(),
    questions:    z.array(questionSchema).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    exam:         IExam | null;
    open:         boolean;
    onOpenChange: (v: boolean) => void;
    onSuccess?:   (updated: IExam) => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'MCQ',        label: 'اختيار من متعدد' },
    { value: 'TRUE_FALSE', label: 'صح أم خطأ' },
    { value: 'ESSAY',      label: 'مقالي' },
];

export function EditExamModal({ exam, open, onOpenChange, onSuccess }: Props) {
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);
    const queryClient = useQueryClient();

    const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { questions: [], groupIds: [] },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'questions' });
    const questions = watch('questions') ?? [];
    const selectedGroups = watch('groupIds') ?? [];

    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
    });
    const groups = (groupsData as any)?.data ?? (groupsData as any) ?? [];

    const watchedGradeLevel = watch('gradeLevel');
    const filteredGroups = watchedGradeLevel ? groups.filter((g: any) => g.gradeLevel === watchedGradeLevel) : groups;

    useEffect(() => {
        if (open && exam) {
            let formattedDate = '';
            try {
                if (exam.date) {
                    formattedDate = new Date(exam.date).toISOString().slice(0, 10);
                }
            } catch {
                formattedDate = '';
            }

            reset({
                title:        exam.title || '',
                date:         formattedDate,
                totalMarks:   exam.totalMarks || 20,
                passingMarks: exam.passingMarks || Math.round((exam.totalMarks || 20) * 0.5),
                gradeLevel:   exam.gradeLevel || undefined,
                groupIds:     (exam.groupIds || []).map(String),
                questions:    (exam.questions || []).map((q: any) => ({
                    type:          q.type || 'MCQ',
                    text:          q.text || '',
                    marks:         Number(q.marks) || 1,
                    options:       Array.isArray(q.options) ? [...q.options] : ['', '', '', ''],
                    correctAnswer: q.correctAnswer || '',
                })),
            });
            setExpandedIdx(null);
        }
    }, [open, exam, reset]);

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            if (!exam?._id) throw new Error('بيانات الامتحان غير صالحة');

            const questionsTotal = (values.questions ?? []).reduce((s, q) => s + (q.marks || 0), 0);
            if ((values.questions?.length ?? 0) > 0 && questionsTotal !== values.totalMarks) {
                throw new Error(`مجموع درجات الأسئلة (${questionsTotal}) لا يساوي الدرجة النهائية للامتحان (${values.totalMarks})`);
            }

            const passingMarks = values.passingMarks !== undefined && values.passingMarks !== null
                ? values.passingMarks
                : Math.round(values.totalMarks * 0.5);

            return await updateExam(exam._id, {
                title:        values.title,
                date:         values.date,
                totalMarks:   values.totalMarks,
                passingMarks,
                gradeLevel:   values.gradeLevel,
                groupIds:     values.groupIds,
                questions:    values.questions as IQuestion[] | undefined,
            });
        },
        onSuccess: (updated) => {
            toast.success('تم تعديل بيانات الامتحان بنجاح');
            if (exam?._id) {
                queryClient.invalidateQueries({ queryKey: ['exam', exam._id] });
                queryClient.invalidateQueries({ queryKey: ['exam-results', exam._id] });
            }
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            onSuccess?.(updated);
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء تعديل الامتحان');
        }
    });

    const addQuestion = () => {
        append({ type: 'MCQ', text: '', marks: 2, options: ['', '', '', ''], correctAnswer: '' });
        setExpandedIdx(fields.length);
    };

    const toggleGroup = (id: string) => {
        const current = selectedGroups;
        if (current.includes(id)) {
            setValue('groupIds', current.filter((g) => g !== id));
        } else {
            setValue('groupIds', [...current, id]);
        }
    };

    if (!exam) return null;

    const isPublishedOrDone = exam.status === 'PUBLISHED' || exam.status === 'COMPLETED';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold border-b pb-3 flex items-center gap-2">
                        <Edit className="h-5 w-5 text-primary" />
                        تعديل الامتحان: {exam.title}
                    </DialogTitle>
                </DialogHeader>

                {isPublishedOrDone && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">تنبيه: هذا الامتحان منشور</p>
                            <p className="mt-0.5 text-amber-700">
                                يمكنك تعديل العنوان والمجموعات والتاريخ. إذا قمت بتغيير الدرجة الكلية أو درجة النجاح، سيتم تلقائياً تحديث وإعادة احتساب درجات الطلاب المسجلة مسبقاً.
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5 py-2">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700 block mb-1">عنوان الامتحان *</label>
                            <Input {...register('title')} placeholder="مثال: امتحان الفصل الأول" />
                            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">التاريخ *</label>
                            <Input type="date" {...register('date')} dir="ltr" />
                            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">الدرجة النهائية *</label>
                            <Input
                                type="number"
                                min={1}
                                {...register('totalMarks', { valueAsNumber: true })}
                                placeholder="مثال: 20"
                                dir="ltr"
                            />
                            {errors.totalMarks && <p className="text-red-500 text-xs mt-1">{errors.totalMarks.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                درجة النجاح
                                <span className="text-xs text-gray-400 mr-1">(50% تلقائياً)</span>
                            </label>
                            <Input
                                type="number"
                                min={0}
                                {...register('passingMarks', { valueAsNumber: true })}
                                placeholder="تُحسب تلقائياً من الدرجة النهائية"
                                dir="ltr"
                            />
                            {errors.passingMarks && <p className="text-red-500 text-xs mt-1">{errors.passingMarks.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">المرحلة الدراسية</label>
                            <Select
                                defaultValue={watch('gradeLevel') || 'ALL'}
                                onValueChange={(v) => setValue('gradeLevel', v === 'ALL' ? undefined : v)}
                                dir="rtl"
                            >
                                <SelectTrigger className="bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="اختر المرحلة" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="ALL">كل المراحل</SelectItem>
                                    {allowedGrades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Groups */}
                    {filteredGroups.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">المجموعات المستهدفة</label>
                            <div className="flex flex-wrap gap-2">
                                {filteredGroups.map((g: any) => (
                                    <button
                                        key={g._id}
                                        type="button"
                                        onClick={() => toggleGroup(g._id)}
                                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                            selectedGroups.includes(g._id)
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary'
                                        }`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Questions */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-gray-700">
                                الأسئلة
                                {questions.length > 0 && (
                                    <span className="mr-2 text-xs text-gray-400">
                                        ({questions.length} سؤال · {questions.reduce((s, q) => s + (q.marks || 0), 0)} درجة)
                                    </span>
                                )}
                            </label>
                            <Button type="button" size="sm" variant="outline" onClick={addQuestion} className="gap-1 text-xs">
                                <Plus className="h-3.5 w-3.5" /> إضافة سؤال
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {fields.map((field, idx) => {
                                const q = questions[idx];
                                const isExpanded = expandedIdx === idx;
                                return (
                                    <div key={field.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                        {/* Question header */}
                                        <div className="flex items-center gap-2 p-3 bg-gray-50">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                                className="flex-1 flex items-center gap-2 text-right text-sm font-medium text-gray-700"
                                            >
                                                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                                                <span className="truncate">{q?.text || `سؤال ${idx + 1}`}</span>
                                                <span className="text-xs text-gray-400 shrink-0">({q?.marks || 0} درجة)</span>
                                            </button>
                                            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {/* Question body */}
                                        {isExpanded && (
                                            <div className="p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-600 block mb-1">نوع السؤال</label>
                                                        <Select
                                                            defaultValue={q?.type ?? 'MCQ'}
                                                            onValueChange={(v) => setValue(`questions.${idx}.type`, v as QuestionType)}
                                                            dir="rtl"
                                                        >
                                                            <SelectTrigger className="text-sm bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent dir="rtl">
                                                                {QUESTION_TYPES.map((t) => (
                                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-600 block mb-1">الدرجة</label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            {...register(`questions.${idx}.marks`, { valueAsNumber: true })}
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-medium text-gray-600 block mb-1">نص السؤال *</label>
                                                    <Input {...register(`questions.${idx}.text`)} placeholder="اكتب السؤال هنا..." />
                                                </div>

                                                {/* MCQ Options */}
                                                {watch(`questions.${idx}.type`) === 'MCQ' && (
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-medium text-gray-600 block">الخيارات</label>
                                                        {(watch(`questions.${idx}.options`) || ['', '', '', '']).map((_, optIdx) => (
                                                            <div key={optIdx} className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`correct-${idx}`}
                                                                    checked={watch(`questions.${idx}.correctAnswer`) === watch(`questions.${idx}.options.${optIdx}`)}
                                                                    onChange={() => {
                                                                        const val = watch(`questions.${idx}.options.${optIdx}`);
                                                                        setValue(`questions.${idx}.correctAnswer`, val);
                                                                    }}
                                                                    className="accent-primary"
                                                                    title="اختر كإجابة صحيحة"
                                                                />
                                                                <Input
                                                                    {...register(`questions.${idx}.options.${optIdx}`)}
                                                                    placeholder={`الخيار ${optIdx + 1}`}
                                                                    className="text-sm"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* True/False */}
                                                {watch(`questions.${idx}.type`) === 'TRUE_FALSE' && (
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-600 block mb-1">الإجابة الصحيحة</label>
                                                        <Select
                                                            defaultValue={watch(`questions.${idx}.correctAnswer`) ?? 'صح'}
                                                            onValueChange={(v) => setValue(`questions.${idx}.correctAnswer`, v)}
                                                            dir="rtl"
                                                        >
                                                            <SelectTrigger className="text-sm bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent dir="rtl">
                                                                <SelectItem value="صح">صح</SelectItem>
                                                                <SelectItem value="خطأ">خطأ</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-3 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="gap-2">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            حفظ التعديلات
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

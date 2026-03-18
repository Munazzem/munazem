'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createExam } from '@/lib/api/exams';
import type { IQuestion, QuestionType } from '@/lib/api/exams';
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
    passingMarks: z.number({ error: 'أدخل درجة النجاح' }).min(1),
    gradeLevel:   z.string().optional(),
    groupIds:     z.array(z.string()).optional(),
    questions:    z.array(questionSchema).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open:         boolean;
    onOpenChange: (v: boolean) => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'MCQ',        label: 'اختيار من متعدد' },
    { value: 'TRUE_FALSE', label: 'صح أم خطأ' },
    { value: 'ESSAY',      label: 'مقالي' },
];

export function CreateExamModal({ open, onOpenChange }: Props) {
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stage);
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

    const mutation = useMutation({
        mutationFn: (values: FormValues) => {
            const totalMarks   = (values.questions ?? []).reduce((s, q) => s + (q.marks || 0), 0);
            const autoTotal    = totalMarks || 100;
            // Use entered passingMarks if set, else default to 50% of total
            const passingMarks = values.passingMarks || Math.round(autoTotal * 0.5);
            return createExam({
                title:        values.title,
                date:         values.date,
                totalMarks:   autoTotal,
                passingMarks,
                gradeLevel:   values.gradeLevel,
                groupIds:     values.groupIds?.length ? values.groupIds : undefined,
                questions:    values.questions as IQuestion[],
                source:       'MANUAL',
            });
        },
        onSuccess: () => {
            toast.success('تم إنشاء الامتحان بنجاح');
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            reset();
            onOpenChange(false);
        },
        
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold border-b pb-3">إنشاء امتحان جديد</DialogTitle>
                </DialogHeader>

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
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                درجة النجاح
                                <span className="text-xs text-gray-400 mr-1">(50% تلقائياً)</span>
                            </label>
                            <Input
                                type="number"
                                min={1}
                                {...register('passingMarks', { valueAsNumber: true })}
                                placeholder="تُحسب تلقائياً من مجموع الدرجات"
                                dir="ltr"
                            />
                            {errors.passingMarks && <p className="text-red-500 text-xs mt-1">{errors.passingMarks.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">المرحلة الدراسية</label>
                            <Select onValueChange={(v) => setValue('gradeLevel', v === 'ALL' ? undefined : v)} dir="rtl">
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
                    {groups.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">المجموعات المستهدفة</label>
                            <div className="flex flex-wrap gap-2">
                                {groups.map((g: any) => (
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
                                                            dir="ltr"
                                                            className="text-sm"
                                                            {...register(`questions.${idx}.marks`, { valueAsNumber: true })}
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-medium text-gray-600 block mb-1">نص السؤال</label>
                                                    <Input
                                                        className="text-sm"
                                                        placeholder="اكتب نص السؤال هنا..."
                                                        {...register(`questions.${idx}.text`)}
                                                    />
                                                </div>

                                                {/* MCQ options */}
                                                {q?.type === 'MCQ' && (
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-medium text-gray-600 block">الخيارات</label>
                                                        {[0, 1, 2, 3].map((oi) => (
                                                            <div key={oi} className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-400 w-4">{oi + 1}.</span>
                                                                <Input
                                                                    className="text-sm flex-1"
                                                                    placeholder={`الخيار ${oi + 1}`}
                                                                    {...register(`questions.${idx}.options.${oi}`)}
                                                                />
                                                            </div>
                                                        ))}
                                                        <div>
                                                            <label className="text-xs font-medium text-gray-600 block mb-1">الإجابة الصحيحة</label>
                                                            <Input
                                                                className="text-sm"
                                                                placeholder="اكتب الإجابة الصحيحة"
                                                                {...register(`questions.${idx}.correctAnswer`)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* TRUE/FALSE options */}
                                                {q?.type === 'TRUE_FALSE' && (
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-600 block mb-1">الإجابة الصحيحة</label>
                                                        <Select
                                                            defaultValue={q?.correctAnswer ?? 'صح'}
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

                            {fields.length === 0 && (
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                                    لا توجد أسئلة بعد — اضغط "إضافة سؤال"
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 justify-end pt-2 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="gap-2 min-w-[120px]">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            حفظ كمسودة
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

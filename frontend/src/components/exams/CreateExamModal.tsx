'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createExam } from '@/lib/api/exams';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';

const schema = z.object({
    title:        z.string().min(3, 'أدخل عنوان الامتحان'),
    date:         z.string().min(1, 'أدخل التاريخ'),
    totalMarks:   z.number({ error: 'أدخل الدرجة النهائية' }).min(1, 'الدرجة النهائية يجب أن تكون 1 على الأقل'),
    passingMarks: z.number({ error: 'أدخل درجة النجاح' }).optional(),
    gradeLevel:   z.string().optional(),
    groupIds:     z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open:         boolean;
    onOpenChange: (v: boolean) => void;
}

export function CreateExamModal({ open, onOpenChange }: Props) {
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);
    const queryClient = useQueryClient();

    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { groupIds: [] },
    });

    const selectedGroups = watch('groupIds') ?? [];

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
    });
    const groups = (groupsData as any)?.data ?? (groupsData as any) ?? [];

    const watchedGradeLevel = watch('gradeLevel');
    const filteredGroups = watchedGradeLevel ? groups.filter((g: any) => g.gradeLevel === watchedGradeLevel) : groups;

    const mutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const passingMarks = values.passingMarks || Math.round(values.totalMarks * 0.5);
            return createExam({
                title:        values.title,
                date:         values.date,
                totalMarks:   values.totalMarks,
                passingMarks,
                gradeLevel:   values.gradeLevel,
                groupIds:     values.groupIds?.length ? values.groupIds : undefined,
                questions:    [],
                source:       'MANUAL',
            });
        },
        onSuccess: () => {
            toast.success('تم إنشاء الامتحان بنجاح');
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            reset();
            onOpenChange(false);
        },
        onError: () => {
            // Handled globally
        }
    });

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
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-xl bg-white rounded-2xl" dir="rtl">
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
                                min={1}
                                {...register('passingMarks', { valueAsNumber: true })}
                                placeholder="تُحسب تلقائياً من الدرجة النهائية"
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
                    {filteredGroups.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">المجموعات المستهدفة</label>
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
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

                    {/* Footer */}
                    <div className="flex gap-2 justify-end pt-3 border-t">
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

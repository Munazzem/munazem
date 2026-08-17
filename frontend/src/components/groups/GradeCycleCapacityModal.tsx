'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateGradeCycleCapacity } from '@/lib/api/groups';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2 } from 'lucide-react';

interface Props {
    allowedGrades: readonly string[];
}

export function GradeCycleCapacityModal({ allowedGrades }: Props) {
    const [open, setOpen] = useState(false);
    const [gradeLevel, setGradeLevel] = useState<string>('');
    const [cycleCapacity, setCycleCapacity] = useState<number | ''>('');
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: updateGradeCycleCapacity,
        onSuccess: (res: any) => {
            toast.success(res?.message || 'تم تحديث عدد الحصص بنجاح');
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            setOpen(false);
            setGradeLevel('');
            setCycleCapacity('');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'حدث خطأ أثناء تحديث عدد الحصص');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!gradeLevel) {
            toast.error('يرجى اختيار المرحلة الدراسية');
            return;
        }
        if (!cycleCapacity || cycleCapacity < 1) {
            toast.error('يرجى تحديد عدد صحيح للحصص');
            return;
        }

        mutation.mutate({ gradeLevel, cycleCapacity: Number(cycleCapacity) });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 h-10 px-4 whitespace-nowrap">
                    <Settings2 className="w-4 h-4" />
                    إعداد دورات المراحل
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 text-right">
                        تخصيص حصص الدورة (للمرحلة بالكامل)
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">المرحلة الدراسية</label>
                        <Select value={gradeLevel} onValueChange={setGradeLevel} dir="rtl">
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="اختر المرحلة" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {allowedGrades.map((g) => (
                                    <SelectItem key={g} value={g}>
                                        {g}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">عدد الحصص في الدورة</label>
                        <Input
                            type="number"
                            min={1}
                            placeholder="مثال: 8"
                            value={cycleCapacity}
                            onChange={(e) => setCycleCapacity(e.target.value ? Number(e.target.value) : '')}
                            required
                        />
                        <p className="text-xs text-gray-500">
                            سيتم تحديث الحد الأقصى لحصص الدورة لجميع مجموعات هذه المرحلة لتطابق هذا الرقم.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={mutation.isPending}
                        >
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...
                                </>
                            ) : (
                                'تطبيق التحديث'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

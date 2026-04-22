'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNotebook } from '@/lib/api/notebooks';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const schema = z.object({
    name: z.string().min(2, 'اسم المذكرة يجب أن يكون حرفين على الأقل'),
    gradeLevel: z.string().min(1, 'المرحلة الدراسية مطلوبة'),
    price: z.number().min(1, 'السعر يجب أن يكون أكبر من صفر'),
    stock: z.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddNotebookModal() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stage);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', gradeLevel: '', price: 0, stock: 0 },
    });

    const mutation = useMutation({
        mutationFn: createNotebook,
        onSuccess: () => {
            toast.success('تم إضافة المذكرة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            form.reset();
            setOpen(false);
        },
        onError: (err: any) => {
            
        },
    });

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
            <DialogTrigger asChild>
                <Button className="bg-[#1e3a6e] hover:bg-[#152a52] text-white gap-2">
                    <Plus size={18} />
                    إضافة مذكرة
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-4">إضافة مذكرة جديدة</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5 py-2">
                        {/* Name */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>اسم المذكرة <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="مثال: مذكرة الجبر — الصف الأول" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            {/* Grade Level */}
                            <FormField
                                control={form.control}
                                name="gradeLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>المرحلة <span className="text-red-500">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir="rtl">
                                                {allowedGrades.map((g) => (
                                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Price */}
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>السعر (ج.م) <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                dir="ltr"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Stock */}
                            <FormField
                                control={form.control}
                                name="stock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>الكمية المبدئية</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                dir="ltr"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
                                إلغاء
                            </Button>
                            <Button type="submit" className="bg-[#1e3a6e] hover:bg-[#152a52]" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                حفظ المذكرة
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTenant } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Loader2, Edit, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';

const schema = z.object({
    name: z.string().min(2, 'الاسم مطلوب'),
    phone: z.string().min(10, 'رقم الهاتف مطلوب'),
    stage: z.string().optional(),
    subject: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditTeacherModal({ teacher }: { teacher: any }) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: teacher?.name || '',
            phone: teacher?.phone || '',
            stage: teacher?.stage || '',
            subject: teacher?.subject || '',
        },
    });

    const mutation = useMutation({
        mutationFn: (values: FormValues) => updateTenant(teacher._id, values),
        onSuccess: () => {
            toast.success('تم التحديث بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-tenant', teacher._id] });
            queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
            setOpen(false);
        },
        onError: () => {
            // Error handled by global interceptor
        },
    });

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (val) form.reset({
                name: teacher?.name || '',
                phone: teacher?.phone || '',
                stage: teacher?.stage || '',
                subject: teacher?.subject || '',
            });
            setOpen(val);
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1">
                    <Pencil className="h-4 w-4" />
                    تعديل المدرس
                </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>تعديل بيانات المدرس</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>الاسم <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>رقم الهاتف <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input {...field} dir="ltr" className="text-right" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="stage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المرحلة</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="مثال: الثانوية العامة" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المادة</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="مثال: الرياضيات" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                إلغاء
                            </Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                حفظ التعديلات
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

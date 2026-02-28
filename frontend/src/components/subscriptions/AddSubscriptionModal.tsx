'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSubscription } from '@/lib/api/subscriptions';
import { fetchUsers } from '@/lib/api/users';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

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
    teacherId: z.string().min(1, 'يرجى اختيار معلم'),
    amount: z.coerce.number().min(1, 'المبلغ يجب أن يكون أكبر من صفر'),
    endDate: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
    paymentMethod: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddSubscriptionModal() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: usersData } = useQuery({
        queryKey: ['users', {}],
        queryFn: () => fetchUsers({}),
        enabled: open,
    });

    const teachers = ((usersData as any)?.data || usersData || []).filter(
        (u: any) => u.role === 'TEACHER'
    );

    const defaultEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            teacherId: '',
            amount: 0,
            endDate: defaultEndDate,
            paymentMethod: '',
        },
    });

    const mutation = useMutation({
        mutationFn: createSubscription,
        onSuccess: () => {
            toast.success('تم إضافة الاشتراك بنجاح');
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            form.reset();
            setOpen(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'حدث خطأ أثناء الإضافة');
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate({
            ...values,
            endDate: new Date(values.endDate).toISOString(),
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) form.reset();
            }}
        >
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2">
                    <Plus size={18} />
                    <span>إضافة اشتراك جديد</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[480px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-4">
                        إضافة اشتراك جديد
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
                        {/* Teacher select */}
                        <FormField
                            control={form.control}
                            name="teacherId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        المعلم <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر المعلم" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent dir="rtl">
                                            {teachers.length === 0 ? (
                                                <SelectItem value="_none" disabled>
                                                    لا يوجد معلمون
                                                </SelectItem>
                                            ) : (
                                                teachers.map((t: any) => (
                                                    <SelectItem key={t._id} value={t._id}>
                                                        {t.name} — {t.phone}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            {/* Amount */}
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            المبلغ (ج) <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="500"
                                                dir="ltr"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Payment method */}
                            <FormField
                                control={form.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>طريقة الدفع</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="اختر" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="cash">كاش</SelectItem>
                                                <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                                <SelectItem value="vodafone_cash">فودافون كاش</SelectItem>
                                                <SelectItem value="instapay">انستاباي</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* End date */}
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        تاريخ انتهاء الاشتراك <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="date" dir="ltr" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={mutation.isPending}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                className="bg-primary hover:bg-primary/90"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending && (
                                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                )}
                                حفظ الاشتراك
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

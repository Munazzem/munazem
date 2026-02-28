'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSubscription } from '@/lib/api/subscriptions';
import { fetchUsers } from '@/lib/api/users';
import { toast } from 'sonner';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    type SubscriptionPlan,
    type DurationMonths,
    PLAN_PRICES,
    PLAN_LABELS,
    DURATION_LABELS,
    DURATION_MONTHS,
} from '@/types/subscription.types';

const schema = z.object({
    teacherId: z.string().min(1, 'يرجى اختيار معلم'),
    planTier: z.enum(['BASIC', 'PRO', 'PREMIUM'] as const),
    durationMonths: z.union([z.literal(1), z.literal(4), z.literal(9), z.literal(12)]),
    paymentMethod: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const PLAN_CONFIG: Record<SubscriptionPlan, { color: string; border: string; bg: string; badge: string }> = {
    BASIC:   { color: 'text-blue-600',   border: 'border-blue-500',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
    PRO:     { color: 'text-purple-600', border: 'border-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
    PREMIUM: { color: 'text-amber-600',  border: 'border-amber-500',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700' },
};

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

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            teacherId: '',
            planTier: 'BASIC',
            durationMonths: 1,
            paymentMethod: '',
        },
    });

    const selectedPlan = form.watch('planTier') as SubscriptionPlan;
    const selectedDuration = form.watch('durationMonths') as DurationMonths;
    const total = PLAN_PRICES[selectedPlan] * selectedDuration;

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
        mutation.mutate(values as any);
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

            <DialogContent className="sm:max-w-[560px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-4">
                        إضافة اشتراك جديد
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">

                        {/* Teacher select */}
                        <FormField
                            control={form.control}
                            name="teacherId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المعلم <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر المعلم" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent dir="rtl">
                                            {teachers.length === 0 ? (
                                                <SelectItem value="_none" disabled>لا يوجد معلمون</SelectItem>
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

                        {/* Plan selection */}
                        <FormField
                            control={form.control}
                            name="planTier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>اختر الباقة <span className="text-red-500">*</span></FormLabel>
                                    <div className="grid grid-cols-3 gap-3 mt-1">
                                        {(['BASIC', 'PRO', 'PREMIUM'] as SubscriptionPlan[]).map((plan) => {
                                            const config = PLAN_CONFIG[plan];
                                            const isSelected = field.value === plan;
                                            return (
                                                <button
                                                    key={plan}
                                                    type="button"
                                                    onClick={() => field.onChange(plan)}
                                                    className={cn(
                                                        'relative rounded-xl border-2 p-3 text-center transition-all cursor-pointer',
                                                        isSelected
                                                            ? `${config.border} ${config.bg}`
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <CheckCircle2 className={cn('absolute top-2 left-2 h-4 w-4', config.color)} />
                                                    )}
                                                    <p className={cn('font-bold text-sm', isSelected ? config.color : 'text-gray-700')}>
                                                        {PLAN_LABELS[plan]}
                                                    </p>
                                                    <p className={cn('text-lg font-extrabold mt-1', isSelected ? config.color : 'text-gray-900')}>
                                                        {PLAN_PRICES[plan].toLocaleString('ar-EG')}
                                                    </p>
                                                    <p className="text-xs text-gray-500">ج / شهر</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Duration selection */}
                        <FormField
                            control={form.control}
                            name="durationMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>مدة الاشتراك <span className="text-red-500">*</span></FormLabel>
                                    <div className="space-y-2 mt-1">
                                        {DURATION_MONTHS.map((months) => {
                                            const isSelected = field.value === months;
                                            const durationTotal = PLAN_PRICES[selectedPlan] * months;
                                            return (
                                                <button
                                                    key={months}
                                                    type="button"
                                                    onClick={() => field.onChange(months)}
                                                    className={cn(
                                                        'w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all cursor-pointer',
                                                        isSelected
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                                                            isSelected ? 'border-primary' : 'border-gray-300'
                                                        )}>
                                                            {isSelected && (
                                                                <div className="h-2 w-2 rounded-full bg-primary" />
                                                            )}
                                                        </div>
                                                        <span className={cn('font-medium text-sm', isSelected ? 'text-primary' : 'text-gray-700')}>
                                                            {DURATION_LABELS[months as DurationMonths]}
                                                        </span>
                                                    </div>
                                                    <span className={cn('font-bold text-sm', isSelected ? 'text-primary' : 'text-gray-600')}>
                                                        {durationTotal.toLocaleString('ar-EG')} ج
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر طريقة الدفع" />
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

                        {/* Total summary */}
                        <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">الإجمالي المستحق</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {PLAN_PRICES[selectedPlan].toLocaleString('ar-EG')} ج × {selectedDuration} شهر
                                </p>
                            </div>
                            <p className="text-2xl font-extrabold text-primary">
                                {total.toLocaleString('ar-EG')} <span className="text-sm font-normal text-gray-500">ج</span>
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
                            <Button
                                type="submit"
                                className="bg-primary hover:bg-primary/90"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                حفظ الاشتراك
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

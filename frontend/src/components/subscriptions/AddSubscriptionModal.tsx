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

const PLAN_CONFIG: Record<SubscriptionPlan, { color: string; border: string; bg: string }> = {
    BASIC:   { color: 'text-blue-600',   border: 'border-blue-500',   bg: 'bg-blue-50'   },
    PRO:     { color: 'text-purple-600', border: 'border-purple-500', bg: 'bg-purple-50' },
    PREMIUM: { color: 'text-amber-600',  border: 'border-amber-500',  bg: 'bg-amber-50'  },
};

export function AddSubscriptionModal() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['users', {}],
        queryFn: () => fetchUsers({}),
        enabled: open,
    });

    // apiClient interceptor returns response.data → shape: { status, message, data: IUser[] }
    // fetchUsers returns (response as any).data which is that full object
    const rawUsers = (usersData as any)?.data ?? (Array.isArray(usersData) ? usersData : []);
    // Backend returns role as lowercase 'teacher'
    const teachers = rawUsers.filter((u: any) => u.role === 'teacher');

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

            <DialogContent className="sm:max-w-[680px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-3">
                        إضافة اشتراك جديد
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">

                        {/* Row 1: Teacher + Payment method */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="teacherId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>المعلم <span className="text-red-500">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    {usersLoading
                                                        ? <span className="text-gray-400 text-sm">جاري التحميل...</span>
                                                        : <SelectValue placeholder="اختر المعلم" />
                                                    }
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir="rtl">
                                                {teachers.length === 0 ? (
                                                    <SelectItem value="_none" disabled>
                                                        {usersLoading ? 'جاري التحميل...' : 'لا يوجد معلمون'}
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
                        </div>

                        {/* Row 2: Plan selection — 3 cards side by side */}
                        <FormField
                            control={form.control}
                            name="planTier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>الباقة <span className="text-red-500">*</span></FormLabel>
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
                                                        'relative rounded-xl border-2 py-3 px-2 text-center transition-all cursor-pointer',
                                                        isSelected
                                                            ? `${config.border} ${config.bg}`
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <CheckCircle2 className={cn('absolute top-2 left-2 h-3.5 w-3.5', config.color)} />
                                                    )}
                                                    <p className={cn('font-bold text-sm', isSelected ? config.color : 'text-gray-700')}>
                                                        {PLAN_LABELS[plan]}
                                                    </p>
                                                    <p className={cn('text-xl font-extrabold mt-0.5', isSelected ? config.color : 'text-gray-900')}>
                                                        {PLAN_PRICES[plan].toLocaleString('ar-EG')}
                                                    </p>
                                                    <p className="text-xs text-gray-400">ج / شهر</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Row 3: Duration — 4 buttons in a grid */}
                        <FormField
                            control={form.control}
                            name="durationMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>مدة الاشتراك <span className="text-red-500">*</span></FormLabel>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {DURATION_MONTHS.map((months) => {
                                            const isSelected = field.value === months;
                                            const durationTotal = PLAN_PRICES[selectedPlan] * months;
                                            return (
                                                <button
                                                    key={months}
                                                    type="button"
                                                    onClick={() => field.onChange(months)}
                                                    className={cn(
                                                        'flex items-center justify-between rounded-xl border-2 px-4 py-2.5 transition-all cursor-pointer',
                                                        isSelected
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            'h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                                                            isSelected ? 'border-primary' : 'border-gray-300'
                                                        )}>
                                                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                                        </div>
                                                        <span className={cn('font-medium text-xs', isSelected ? 'text-primary' : 'text-gray-700')}>
                                                            {DURATION_LABELS[months as DurationMonths]}
                                                        </span>
                                                    </div>
                                                    <span className={cn('font-bold text-xs shrink-0 mr-1', isSelected ? 'text-primary' : 'text-gray-500')}>
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

                        {/* Total + Actions in one row */}
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 mt-1">
                            <div>
                                <p className="text-xs text-gray-500">الإجمالي</p>
                                <p className="text-xs text-gray-400">
                                    {PLAN_PRICES[selectedPlan].toLocaleString('ar-EG')} ج × {selectedDuration} شهر
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-2xl font-extrabold text-primary">
                                    {total.toLocaleString('ar-EG')} <span className="text-sm font-normal text-gray-500">ج</span>
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setOpen(false)}
                                        disabled={mutation.isPending}
                                    >
                                        إلغاء
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        className="bg-primary hover:bg-primary/90"
                                        disabled={mutation.isPending}
                                    >
                                        {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                        حفظ
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

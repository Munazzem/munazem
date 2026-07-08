'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSubscription } from '@/lib/api/subscriptions';
import { toast } from 'sonner';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QK } from '@/lib/query-keys';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
    PLAN_CONFIG,
    PLAN_LABELS,
    DURATION_LABELS,
    DURATION_MONTHS,
} from '@/types/subscription.types';
import { Input } from '@/components/ui/input';
import type { ISubscription } from '@/types/subscription.types';

const schema = z.object({
    planTier: z.enum(['MINI', 'BASIC', 'PREMIUM'] as const),
    durationMonths: z.number().min(1, 'المدة يجب أن تكون شهراً واحداً على الأقل'),
    studentsCount: z.number().min(0, 'عدد الطلاب يجب أن يكون 0 أو أكثر').optional(),
    paymentMethod: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const PLAN_CARD_STYLE: Record<SubscriptionPlan, { color: string; border: string; bg: string }> = {
    MINI:    { color: 'text-indigo-600', border: 'border-indigo-500', bg: 'bg-indigo-50' },
    BASIC:   { color: 'text-blue-600',   border: 'border-blue-500',   bg: 'bg-blue-50'   },
    PREMIUM: { color: 'text-amber-600',  border: 'border-amber-500',  bg: 'bg-amber-50'  },
};

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    subscription: ISubscription | null;
}

export function RenewSubscriptionModal({ open, onOpenChange, subscription }: Props) {
    const queryClient = useQueryClient();

    const teacherName = typeof subscription?.teacherId === 'object' && subscription?.teacherId !== null
        ? subscription.teacherId.name
        : 'المعلم';

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            planTier: 'BASIC',
            durationMonths: 1,
            studentsCount: subscription?.studentsCount || 250,
            paymentMethod: '',
        },
    });

    // Pre-fill with current plan when modal opens
    useEffect(() => {
        if (open && subscription) {
            form.reset({
                planTier: subscription.planTier || 'BASIC',
                durationMonths: 1,
                studentsCount: subscription.studentsCount || 250,
                paymentMethod: '',
            });
        }
    }, [open, subscription, form]);

    const selectedPlan = form.watch('planTier') as SubscriptionPlan;
    const selectedDuration = form.watch('durationMonths') as DurationMonths;
    const studentsCount = form.watch('studentsCount') || 0;
    
    const config = PLAN_CONFIG[selectedPlan];
    const extraStudents = Math.max(0, studentsCount - config.baseStudents);
    const extraHundreds = Math.ceil(extraStudents / 100);
    const monthlyAmount = PLAN_PRICES[selectedPlan] + (extraHundreds * config.extraPricePer100);
    const total = monthlyAmount * selectedDuration;

    const mutation = useMutation({
        mutationFn: createSubscription,
        onSuccess: () => {
            toast.success('تم تجديد الاشتراك بنجاح');
            queryClient.invalidateQueries({ queryKey: QK.subscriptions.all });
            onOpenChange(false);
        },
        onError: (error: any) => {
            
        },
    });

    const onSubmit = (values: FormValues) => {
        if (!subscription) return;
        const teacherId = typeof subscription.teacherId === 'object' && subscription.teacherId !== null
            ? subscription.teacherId._id
            : subscription.teacherId as string;
        mutation.mutate({ teacherId, ...values } as any);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 border-b pb-3 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-primary" />
                        تجديد اشتراك — {teacherName}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">

                        {/* Plan selection */}
                        <FormField
                            control={form.control}
                            name="planTier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>الباقة <span className="text-red-500">*</span></FormLabel>
                                    <div className="grid grid-cols-3 gap-3 mt-1">
                                        {(['MINI', 'BASIC', 'PREMIUM'] as SubscriptionPlan[]).map((plan) => {
                                            const configStyle = PLAN_CARD_STYLE[plan];
                                            const isSelected = field.value === plan;
                                            return (
                                                <button
                                                    key={plan}
                                                    type="button"
                                                    onClick={() => field.onChange(plan)}
                                                    className={cn(
                                                        'relative rounded-xl border-2 py-3 px-2 text-center transition-all cursor-pointer',
                                                        isSelected
                                                            ? `${configStyle.border} ${configStyle.bg}`
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <CheckCircle2 className={cn('absolute top-2 left-2 h-3.5 w-3.5', configStyle.color)} />
                                                    )}
                                                    <p className={cn('font-bold text-sm', isSelected ? configStyle.color : 'text-gray-700')}>
                                                        {PLAN_LABELS[plan]}
                                                    </p>
                                                    <p className={cn('text-xl font-extrabold mt-0.5', isSelected ? configStyle.color : 'text-gray-900')}>
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

                        {/* Duration + Payment in 2 columns */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="durationMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>المدة (بالشهور) <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                {...field} 
                                                onChange={e => field.onChange(Number(e.target.value))} 
                                                placeholder="أدخل عدد الشهور..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="studentsCount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>عدد الطلاب المتوقع (اختياري)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value ?? ''} min={0} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} placeholder="يترك فارغاً لاعتماد الباقة" />
                                        </FormControl>
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

                        {/* Total + Actions */}
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                            <div>
                                <p className="text-xs text-gray-500">الإجمالي</p>
                                <p className="text-xs text-gray-400">
                                    {monthlyAmount.toLocaleString('ar-EG')} ج × {selectedDuration} شهر
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-2xl font-extrabold text-primary">
                                    {total.toLocaleString('ar-EG')} <span className="text-sm font-normal text-gray-500">ج</span>
                                </p>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                        إلغاء
                                    </Button>
                                    <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90" disabled={mutation.isPending}>
                                        {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                        تجديد
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

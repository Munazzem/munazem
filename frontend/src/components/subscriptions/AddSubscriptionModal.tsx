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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { QK } from '@/lib/query-keys';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
    type SubscriptionPlan,
    type DurationMonths,
    PLAN_PRICES,
    PLAN_LABELS,
    DURATION_LABELS,
    DURATION_MONTHS,
    PLAN_CONFIG
} from '@/types/subscription.types';

const schema = z.object({
    teacherId: z.string().min(1, 'يرجى اختيار معلم'),
    planTier: z.enum(['MINI', 'BASIC', 'PREMIUM'] as const),
    isFreeTrial: z.boolean().default(false),
    durationMonths: z.number().min(1, 'المدة يجب أن تكون شهراً واحداً على الأقل').optional(),
    studentsCount: z.number().min(0, 'عدد الطلاب يجب أن يكون 0 أو أكثر').optional(),
    paymentMethod: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const PLAN_CARD_STYLE: Record<SubscriptionPlan, { color: string; border: string; bg: string }> = {
    MINI:    { color: 'text-emerald-600', border: 'border-emerald-500', bg: 'bg-emerald-50'  },
    BASIC:   { color: 'text-blue-600',    border: 'border-blue-500',    bg: 'bg-blue-50'     },
    PREMIUM: { color: 'text-purple-600',  border: 'border-purple-500',  bg: 'bg-purple-50'   },
};

export function AddSubscriptionModal({ tenantId, disabled }: { tenantId?: string; disabled?: boolean } = {}) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: QK.users.list({}),
        queryFn: () => fetchUsers({}),
        enabled: open && !tenantId,
    });

    const rawUsers = (usersData as any)?.data ?? (Array.isArray(usersData) ? usersData : []);
    const teachers = rawUsers.filter((u: any) => u.role === 'teacher');

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            teacherId: tenantId || '',
            planTier: 'BASIC',
            durationMonths: 1,
            isFreeTrial: false,
            paymentMethod: '',
        },
    });

    const selectedPlan = form.watch('planTier') as SubscriptionPlan;
    const selectedDuration = form.watch('durationMonths') as DurationMonths;
    const studentsCount = form.watch('studentsCount');

    const isFreeTrial = form.watch('isFreeTrial');

    // Dynamic price calculation
    const basePrice = PLAN_PRICES[selectedPlan];
    const config = PLAN_CONFIG[selectedPlan];
    const actualStudents = studentsCount || 0;
    const extraStudents = Math.max(0, actualStudents - config.baseStudents);
    const extraHundreds = Math.ceil(extraStudents / 100);
    const monthlyAmount = basePrice + (extraHundreds * config.extraPricePer100);
    const total = isFreeTrial ? 0 : monthlyAmount * (selectedDuration || 1);

    const mutation = useMutation({
        mutationFn: createSubscription,
        onSuccess: () => {
            toast.success('تم إضافة الاشتراك بنجاح');
            queryClient.invalidateQueries({ queryKey: QK.subscriptions.all });
            if (tenantId) queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] });
            else queryClient.invalidateQueries({ queryKey: QK.users.all });
            form.reset();
            setOpen(false);
        },
        onError: () => {},
    });

    const onSubmit = (values: FormValues) => mutation.mutate(values as any);

    return (
        <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
                form.reset();
                if (tenantId) form.setValue('teacherId', tenantId);
            }
        }}>
            <DialogTrigger asChild>
                <Button disabled={disabled} className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 shrink-0">
                    <Plus size={18} />
                    <span>إضافة اشتراك</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[680px] bg-white rounded-2xl p-0 overflow-hidden" dir="rtl">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <DialogTitle className="text-xl font-bold text-gray-900">إضافة اشتراك جديد</DialogTitle>
                </DialogHeader>

                <div className="px-6 py-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    <Form {...form}>
                        <form id="add-sub-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            
                            {!tenantId && (
                                <FormField
                                    control={form.control}
                                    name="teacherId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>المعلم <span className="text-red-500">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        {usersLoading ? <span className="text-gray-400 text-sm">جاري التحميل...</span> : <SelectValue placeholder="اختر المعلم" />}
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
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="studentsCount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>عدد الطلاب المتوقع (اختياري)</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    {...field} 
                                                    value={field.value ?? ''}
                                                    min={0} 
                                                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                                                    placeholder="يترك فارغاً لاعتماد الباقة" 
                                                />
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

                            <FormField
                                control={form.control}
                                name="planTier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>الباقة <span className="text-red-500">*</span></FormLabel>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['MINI', 'BASIC', 'PREMIUM'] as SubscriptionPlan[]).map((plan) => {
                                                const style = PLAN_CARD_STYLE[plan];
                                                const isSelected = field.value === plan;
                                                return (
                                                    <button
                                                        key={plan}
                                                        type="button"
                                                        onClick={() => field.onChange(plan)}
                                                        className={cn(
                                                            'relative rounded-xl border-2 py-3 px-2 text-center transition-all cursor-pointer',
                                                            isSelected ? `${style.border} ${style.bg}` : 'border-gray-200 bg-white hover:border-gray-300'
                                                        )}
                                                    >
                                                        {isSelected && <CheckCircle2 className={cn('absolute top-2 left-2 h-3.5 w-3.5', style.color)} />}
                                                        <p className={cn('font-bold text-sm', isSelected ? style.color : 'text-gray-700')}>
                                                            {PLAN_LABELS[plan]}
                                                        </p>
                                                        <p className={cn('text-xl font-extrabold mt-0.5', isSelected ? style.color : 'text-gray-900')}>
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

                        {/* Free Trial Checkbox */}
                        <FormField
                            control={form.control}
                            name="isFreeTrial"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-x-reverse space-y-0 rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="border-primary"
                                        />
                                    </FormControl>
                                    <div className="space-y-1">
                                        <FormLabel className="text-sm font-bold text-primary">
                                            إصدار كفترة تجريبية مجانية
                                        </FormLabel>
                                        <p className="text-xs text-primary/80">
                                            سيمتد الاشتراك لمدة 7 أيام ولن يتم احتساب أي تكلفة مادية.
                                        </p>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Duration (Hidden if free trial) */}
                        {!isFreeTrial && (
                            <FormField
                                control={form.control}
                                name="durationMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>مدة الاشتراك (بالشهور) <span className="text-red-500">*</span></FormLabel>
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
                        )}
                        </form>
                    </Form>
                </div>

                <div className="flex items-center justify-between bg-gray-50 border-t border-gray-100 px-6 py-4">
                    <div>
                        <p className="text-xs text-gray-500">الإجمالي</p>
                        <p className="text-xs text-gray-400">
                            {isFreeTrial ? 'مجاني (فترة تجريبية)' : `${monthlyAmount.toLocaleString('ar-EG')} ج × ${selectedDuration} شهر`}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-2xl font-extrabold text-primary">
                            {total.toLocaleString('ar-EG')} {total > 0 && <span className="text-sm font-normal text-gray-500">ج</span>}
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>إلغاء</Button>
                            <Button type="submit" form="add-sub-form" className="bg-primary hover:bg-primary/90" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                حفظ
                            </Button>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}

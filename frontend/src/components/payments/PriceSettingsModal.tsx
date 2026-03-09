'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPriceSettings, savePriceSettings } from '@/lib/api/payments';
import { toast } from 'sonner';
import { Settings, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { ALL_GRADES, type GradeLevel, type IPriceSetting } from '@/types/payment.types';

export function PriceSettingsModal() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const [prices, setPrices] = useState<Record<GradeLevel, string>>(
        () => Object.fromEntries(ALL_GRADES.map((g) => [g, ''])) as Record<GradeLevel, string>
    );

    const { data: settings, isLoading } = useQuery({
        queryKey: ['price-settings'],
        queryFn: getPriceSettings,
        enabled: open,
        retry: false,
    });

    useEffect(() => {
        if (settings?.prices) {
            const map: Record<GradeLevel, string> = Object.fromEntries(
                ALL_GRADES.map((g) => [g, ''])
            ) as Record<GradeLevel, string>;
            settings.prices.forEach((p) => {
                map[p.gradeLevel] = p.amount.toString();
            });
            setPrices(map);
        }
    }, [settings]);

    const mutation = useMutation({
        mutationFn: (data: IPriceSetting[]) => savePriceSettings(data),
        onSuccess: () => {
            toast.success('تم حفظ الأسعار بنجاح');
            queryClient.invalidateQueries({ queryKey: ['price-settings'] });
            setOpen(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    const handleSave = () => {
        const pricesArray: IPriceSetting[] = ALL_GRADES
            .filter((g) => prices[g] && parseFloat(prices[g]) > 0)
            .map((g) => ({ gradeLevel: g, amount: parseFloat(prices[g]) }));

        if (pricesArray.length === 0) {
            toast.error('أدخل سعراً لمرحلة واحدة على الأقل');
            return;
        }
        mutation.mutate(pricesArray);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    إعداد الأسعار
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        أسعار الاشتراك الشهري
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        تحميل...
                    </div>
                ) : (
                    <div className="space-y-2 py-2">
                        <p className="text-xs text-gray-500 mb-3">
                            حدد سعر الاشتراك الشهري لكل مرحلة دراسية (بالجنيه المصري)
                        </p>
                        {ALL_GRADES.map((grade) => (
                            <div key={grade} className="flex items-center gap-3">
                                <label className="text-sm text-gray-700 flex-1 truncate">{grade}</label>
                                <div className="relative w-32 shrink-0">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={prices[grade]}
                                        onChange={(e) => setPrices((prev) => ({ ...prev, [grade]: e.target.value }))}
                                        className="pl-8 text-left"
                                        dir="ltr"
                                    />
                                    <span className="absolute left-2.5 top-2.5 text-xs text-gray-400">ج</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSave} disabled={mutation.isPending || isLoading} className="gap-2">
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ الأسعار
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

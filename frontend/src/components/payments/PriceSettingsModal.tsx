'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPriceSettings, savePriceSettings } from '@/lib/api/payments';
import { toast } from 'sonner';
import { Settings, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { QK } from '@/lib/query-keys';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { ALL_GRADES, type GradeLevel, type IPriceSetting, type ICenterDiscount } from '@/types/payment.types';

export function PriceSettingsModal() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const [prices, setPrices] = useState<Record<GradeLevel, string>>(
        () => Object.fromEntries(ALL_GRADES.map((g) => [g, ''])) as Record<GradeLevel, string>
    );
    const [centerDiscounts, setCenterDiscounts] = useState<ICenterDiscount[]>([]);

    const { data: settings, isLoading } = useQuery({
        queryKey: QK.payments.priceSettings,
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
        if (settings?.centerDiscounts) {
            setCenterDiscounts(settings.centerDiscounts);
        }
    }, [settings]);

    const mutation = useMutation({
        mutationFn: (data: { prices: IPriceSetting[], centerDiscounts: ICenterDiscount[] }) => savePriceSettings(data),
        onSuccess: () => {
            toast.success('تم حفظ الإعدادات بنجاح');
            queryClient.invalidateQueries({ queryKey: QK.payments.priceSettings });
            setOpen(false);
        },
    });

    const handleSave = () => {
        const pricesArray: IPriceSetting[] = ALL_GRADES
            .filter((g) => prices[g] && parseFloat(prices[g]) > 0)
            .map((g) => ({ gradeLevel: g, amount: parseFloat(prices[g]) }));

        if (pricesArray.length === 0) {
            toast.error('أدخل سعراً لمرحلة واحدة على الأقل');
            return;
        }

        // Validate center discounts
        const validCenters = centerDiscounts.filter(c => c.centerName.trim() !== '');

        mutation.mutate({ prices: pricesArray, centerDiscounts: validCenters });
    };

    const addCenter = () => {
        setCenterDiscounts([...centerDiscounts, { centerName: '', discountAmount: 0 }]);
    };

    const removeCenter = (index: number) => {
        setCenterDiscounts(centerDiscounts.filter((_, i) => i !== index));
    };

    const updateCenter = (index: number, field: keyof ICenterDiscount, value: any) => {
        const updated = [...centerDiscounts];
        updated[index] = { ...updated[index], [field]: value };
        setCenterDiscounts(updated as ICenterDiscount[]);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    إعداد الأسعار
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        الإعدادات المالية
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        تحميل...
                    </div>
                ) : (
                    <div className="space-y-6 py-2">
                        {/* الأسعار */}
                        <div>
                            <h4 className="font-semibold text-sm mb-2 text-primary">أسعار الاشتراك الشهري</h4>
                            <div className="space-y-2">
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
                        </div>

                        {/* خصومات السناتر */}
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm text-primary">خصومات السناتر</h4>
                                <Button variant="ghost" size="sm" onClick={addCenter} className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/5">
                                    <Plus className="h-3.5 w-3.5 ml-1" /> إضافة سنتر
                                </Button>
                            </div>
                            
                            {centerDiscounts.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    لا يوجد سناتر مضافة. يمكنك إضافة سناتر لتطبيق خصومات سريعة.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {centerDiscounts.map((center, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input 
                                                placeholder="اسم السنتر" 
                                                value={center.centerName}
                                                onChange={(e) => updateCenter(index, 'centerName', e.target.value)}
                                                className="flex-1 text-sm h-9"
                                            />
                                            <div className="relative w-28 shrink-0">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="قيمة الخصم"
                                                    value={center.discountAmount || ''}
                                                    onChange={(e) => updateCenter(index, 'discountAmount', parseFloat(e.target.value) || 0)}
                                                    className="pl-8 text-left text-sm h-9"
                                                    dir="ltr"
                                                />
                                                <span className="absolute left-2.5 top-2 text-xs text-gray-400">ج</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                                onClick={() => removeCenter(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSave} disabled={mutation.isPending || isLoading} className="gap-2">
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ الإعدادات
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

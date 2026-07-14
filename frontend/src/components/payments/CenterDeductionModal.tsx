'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recordCenterDeduction, getPriceSettings } from '@/lib/api/payments';
import { toast } from 'sonner';
import { Building2, Loader2, Minus } from 'lucide-react';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { QK } from '@/lib/query-keys';

interface CenterDeductionModalProps {
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function CenterDeductionModal({ onSuccess, trigger }: CenterDeductionModalProps) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    const [centerName, setCenterName]   = useState('');
    const [customName, setCustomName]   = useState('');
    const [amount,     setAmount]       = useState('');
    const [date,       setDate]         = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');

    // Fetch price settings to get the center discounts list
    const { data: priceSettings } = useQuery({
        queryKey: QK.payments.priceSettings,
        queryFn: getPriceSettings,
        staleTime: 5 * 60 * 1000,
    });

    const centerDiscounts: { centerName: string; discountAmount: number }[] =
        (priceSettings as any)?.centerDiscounts ?? [];

    const mutation = useMutation({
        mutationFn: recordCenterDeduction,
        onSuccess: () => {
            toast.success('تم تسجيل خصم السنتر بنجاح ✅');
            queryClient.invalidateQueries({ queryKey: QK.payments.dailyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.payments.monthlyLedgerBase });
            queryClient.invalidateQueries({ queryKey: QK.dashboard.summary });
            setOpen(false);
            resetForm();
            onSuccess?.();
        },
    });

    const resetForm = () => {
        setCenterName('');
        setCustomName('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setDescription('');
    };

    // Auto-fill amount when a known center is selected
    const handleCenterSelect = (val: string) => {
        setCenterName(val);
        if (val !== '__custom__') {
            const match = centerDiscounts.find(c => c.centerName === val);
            if (match) setAmount(String(match.discountAmount));
        } else {
            setAmount('');
        }
    };

    const effectiveCenterName = centerName === '__custom__' ? customName : centerName;
    const isValid = effectiveCenterName.trim() && Number(amount) > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        mutation.mutate({
            centerName: effectiveCenterName.trim(),
            amount:     Number(amount),
            description: description || undefined,
            date,
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
                        <Building2 className="h-4 w-4" />
                        خصم سنتر
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-700">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Building2 className="h-5 w-5" />
                        </div>
                        تسجيل خصم السنتر
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {/* Center Selection */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">السنتر</label>
                        {centerDiscounts.length > 0 ? (
                            <Select value={centerName} onValueChange={handleCenterSelect}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر السنتر..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {centerDiscounts.map(c => (
                                        <SelectItem key={c.centerName} value={c.centerName}>
                                            <span className="flex items-center justify-between w-full gap-4">
                                                <span>{c.centerName}</span>
                                                <span className="text-xs text-gray-400">{c.discountAmount.toLocaleString()} ج</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="__custom__">+ سنتر آخر (يدوي)</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                placeholder="اسم السنتر..."
                                required
                            />
                        )}
                        {centerName === '__custom__' && (
                            <Input
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                placeholder="اكتب اسم السنتر..."
                                className="mt-2"
                                required
                            />
                        )}
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">المبلغ المخصوم (جنيه)</label>
                        <div className="relative">
                            <Minus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 pointer-events-none" />
                            <Input
                                type="number"
                                min={1}
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                className="pr-9 text-orange-700 font-semibold"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-400">سيتم خصم هذا المبلغ من أرباحك وتسجيله كمصروف.</p>
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">التاريخ</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    {/* Description (optional) */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">ملاحظة (اختياري)</label>
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="مثال: خصم شهر يوليو 2026..."
                        />
                    </div>

                    {/* Submit */}
                    <Button
                        type="submit"
                        disabled={!isValid || mutation.isPending}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
                    >
                        {mutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Building2 className="h-4 w-4" />
                        )}
                        تسجيل الخصم
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

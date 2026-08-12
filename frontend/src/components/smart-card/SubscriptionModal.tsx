'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { recordSubscription, getPriceSettings } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
    gradeLevel: string;
}

export function SubscriptionModal({ open, onClose, studentId, studentName, gradeLevel }: Props) {
    const [discount, setDiscount] = useState(0);
    const [usePartial, setUsePartial] = useState(false);
    const [partialAmount, setPartialAmount] = useState<number | ''>('');
    const [manualAmount, setManualAmount] = useState<number | ''>('');
    const qc = useQueryClient();

    const { data: prices, isLoading: pricesLoading } = useQuery({
        queryKey: ['price-settings'],
        queryFn: getPriceSettings,
        enabled: open,
    });

    const basePrice: number = prices?.prices?.find((p: any) =>
        p.gradeLevel === gradeLevel || gradeLevel?.includes(p.gradeLevel)
    )?.amount ?? 0;

    const priceNotFound = !pricesLoading && prices && basePrice === 0;

    // Use setting price or manual entry
    const effectiveBase = basePrice > 0 ? basePrice : (manualAmount === '' ? 0 : Number(manualAmount));
    const afterDiscount = Math.max(0, effectiveBase - discount);

    // What actually gets paid now
    const paidNow = usePartial && partialAmount !== '' ? Number(partialAmount) : afterDiscount;
    const debtAmount = afterDiscount - paidNow;
    const isValid = effectiveBase > 0 && (!usePartial || partialAmount !== '');

    // Reset on open
    useEffect(() => {
        if (open) { setDiscount(0); setUsePartial(false); setPartialAmount(''); setManualAmount(''); }
    }, [open]);

    const mutation = useMutation({
        mutationFn: () => recordSubscription({
            studentId,
            discountAmount: discount > 0 ? discount : undefined,
            paidAmount: paidNow,
        }),
        onSuccess: () => {
            toast.success(`✅ تم تسجيل اشتراك ${studentName} — ${paidNow} ج.م`);
            qc.invalidateQueries({ queryKey: ['card-stats'] });
            onClose();
        },
    });

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} dir="rtl" className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        تحصيل اشتراك
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Student */}
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="font-bold text-gray-800">{studentName}</p>
                        <p className="text-xs text-gray-500">{gradeLevel}</p>
                    </div>

                    {/* Auto price */}
                    {basePrice > 0 && (
                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                            <span className="text-sm text-green-700 font-medium">السعر الأساسي</span>
                            <span className="font-black text-green-800 text-lg">{basePrice} ج.م</span>
                        </div>
                    )}

                    {/* Manual price when not found */}
                    {priceNotFound && (
                        <div>
                            <div className="flex items-center gap-2 text-orange-600 text-xs mb-2">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>لم يتم العثور على سعر لهذه المرحلة. أدخل المبلغ يدوياً.</span>
                            </div>
                            <Input
                                type="number"
                                min={1}
                                placeholder="قيمة الاشتراك بالجنيه"
                                value={manualAmount}
                                onChange={e => setManualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                className="text-center text-xl font-black h-14"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Discount */}
                    {effectiveBase > 0 && (
                        <div>
                            <label className="text-xs font-bold text-gray-600 mb-1.5 block">خصم (اختياري)</label>
                            <div className="flex items-center gap-2">
                                {[0, 10, 20, 50].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setDiscount(v)}
                                        className={cn(
                                            'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all',
                                            discount === v
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
                                        )}
                                    >
                                        {v === 0 ? 'بدون' : `${v} ج`}
                                    </button>
                                ))}
                                <Input
                                    type="number" min={0} max={effectiveBase} placeholder="أخرى"
                                    className="w-20 text-center text-xs"
                                    value={discount || ''}
                                    onChange={e => setDiscount(Math.min(effectiveBase, Number(e.target.value) || 0))}
                                />
                            </div>
                        </div>
                    )}

                    {/* Partial payment */}
                    {effectiveBase > 0 && (
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox" checked={usePartial}
                                    onChange={e => { setUsePartial(e.target.checked); setPartialAmount(''); }}
                                    className="rounded"
                                />
                                <span className="text-xs font-bold text-gray-600">دفع جزء فقط (باقي مديونية)</span>
                            </label>
                            {usePartial && (
                                <Input
                                    type="number" min={0} max={afterDiscount}
                                    placeholder={`من 0 إلى ${afterDiscount} ج.م`}
                                    className="mt-2"
                                    value={partialAmount}
                                    onChange={e => setPartialAmount(e.target.value === '' ? '' : Math.min(afterDiscount, Number(e.target.value)))}
                                    autoFocus
                                />
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {effectiveBase > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center space-y-1">
                            <p className="text-xs text-gray-500">المبلغ المدفوع الآن</p>
                            <p className="text-2xl font-black text-primary">{paidNow} ج.م</p>
                            {discount > 0 && <p className="text-xs text-green-600">خصم {discount} ج.م</p>}
                            {debtAmount > 0 && (
                                <p className="text-xs text-orange-500 font-bold">مديونية متبقية: {debtAmount} ج.م</p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
                        <Button
                            onClick={() => mutation.mutate()}
                            disabled={!isValid || mutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            {mutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><CheckCircle2 className="h-4 w-4 ml-1" />تأكيد التحصيل</>
                            }
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

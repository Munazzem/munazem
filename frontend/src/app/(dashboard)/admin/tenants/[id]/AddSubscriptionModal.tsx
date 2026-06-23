'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addSubscription } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';

export default function AddSubscriptionModal({ tenantId, disabled }: { tenantId: string, disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    
    const [planTier, setPlanTier] = useState('BASIC');
    const [durationMonths, setDurationMonths] = useState(1);
    const [promoCode, setPromoCode] = useState('');
    
    const mutation = useMutation({
        mutationFn: () => addSubscription(tenantId, { planTier, durationMonths, promoCode: promoCode || undefined }),
        onSuccess: () => {
            toast.success('تم إضافة الاشتراك بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-tenant', tenantId] });
            setOpen(false);
        },
        onError: () => {
            // Handled by global interceptor
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={disabled} className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة اشتراك
                </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>إضافة اشتراك جديد</DialogTitle>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">الباقة</label>
                        <select 
                            value={planTier} 
                            onChange={(e) => setPlanTier(e.target.value)}
                            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                        >
                            <option value="BASIC">الأساسية (BASIC)</option>
                            <option value="PRO">الاحترافية (PRO)</option>
                            <option value="PREMIUM">المتميزة (PREMIUM)</option>
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium">المدة</label>
                        <select 
                            value={durationMonths} 
                            onChange={(e) => setDurationMonths(Number(e.target.value))}
                            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                        >
                            <option value={1}>شهر واحد</option>
                            <option value={4}>ترم دراسي (4 شهور)</option>
                            <option value={9}>عام دراسي (9 شهور)</option>
                            <option value={12}>سنة كاملة (12 شهر)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">كود الخصم (اختياري)</label>
                        <input 
                            type="text"
                            value={promoCode} 
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-left uppercase"
                            placeholder="مثال: SUMMER20"
                            dir="ltr"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        إلغاء
                    </Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        تأكيد الإضافة
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPromoCodes, createPromoCode, togglePromoCode, deletePromoCode } from '@/lib/api/admin';
import type { PromoCode } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Tag, Trash2, Power, PowerOff, Loader2 } from 'lucide-react';

export default function PromoCodesSettings() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [code, setCode] = useState('');
    const [discountPercentage, setDiscountPercentage] = useState<number | ''>('');
    const [maxUses, setMaxUses] = useState<number | ''>('');
    const [expiresAt, setExpiresAt] = useState('');

    const { data: promoCodes, isLoading } = useQuery({
        queryKey: ['admin-promo-codes'],
        queryFn: fetchPromoCodes,
    });

    const createMutation = useMutation({
        mutationFn: createPromoCode,
        onSuccess: () => {
            toast.success('تم إنشاء كود الخصم بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
            setCode('');
            setDiscountPercentage('');
            setMaxUses('');
            setExpiresAt('');
            setIsCreating(false);
        },
        onError: () => {}
    });

    const toggleMutation = useMutation({
        mutationFn: togglePromoCode,
        onSuccess: () => {
            toast.success('تم تحديث حالة كود الخصم');
            queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deletePromoCode,
        onSuccess: () => {
            toast.success('تم حذف كود الخصم بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !discountPercentage) {
            toast.error('الرجاء إدخال الكود ونسبة الخصم');
            return;
        }
        createMutation.mutate({
            code,
            discountPercentage: Number(discountPercentage),
            maxUses: maxUses ? Number(maxUses) : undefined,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">أكواد الخصم (Promo Codes)</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        إدارة أكواد الخصم وتتبع استخدامها
                    </p>
                </div>
                <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "outline" : "default"} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {isCreating ? 'إلغاء الإضافة' : 'إضافة كود'}
                </Button>
            </div>

            {isCreating && (
                <div className="p-5 border-b border-gray-100 bg-primary/5">
                    <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">كود الخصم</label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="مثال: OFFER50"
                                className="uppercase text-left font-mono"
                                dir="ltr"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">الخصم (%)</label>
                            <Input
                                type="number"
                                min="1" max="100"
                                value={discountPercentage}
                                onChange={(e) => setDiscountPercentage(Number(e.target.value) || '')}
                                placeholder="مثال: 20"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">الحد الأقصى للاستخدام</label>
                            <Input
                                type="number"
                                min="1"
                                value={maxUses}
                                onChange={(e) => setMaxUses(Number(e.target.value) || '')}
                                placeholder="اختياري"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">تاريخ الانتهاء</label>
                            <Input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                            />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                حفظ الكود
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500">
                            <th className="p-4">الكود</th>
                            <th className="p-4">الخصم</th>
                            <th className="p-4">الاستخدام</th>
                            <th className="p-4">الانتهاء</th>
                            <th className="p-4">الحالة</th>
                            <th className="p-4 text-left">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                        {isLoading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" /></td></tr>
                        ) : promoCodes?.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد أكواد خصم مسجلة</td></tr>
                        ) : (
                            promoCodes?.map((promo) => {
                                const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
                                const isMaxed = promo.maxUses && promo.usedCount >= promo.maxUses;
                                const isInvalid = !promo.isActive || isExpired || isMaxed;

                                return (
                                    <tr key={promo._id} className={`hover:bg-gray-50/30 transition-colors ${isInvalid ? 'opacity-60 grayscale-[50%]' : ''}`}>
                                        <td className="p-4 font-mono font-bold text-gray-900" dir="ltr"><div className="inline-block bg-gray-100 px-2 py-1 rounded">{promo.code}</div></td>
                                        <td className="p-4 font-bold text-green-600">{promo.discountPercentage}%</td>
                                        <td className="p-4 text-gray-600">
                                            <span className="font-medium text-gray-900">{promo.usedCount}</span> 
                                            {promo.maxUses ? ` / ${promo.maxUses}` : ' (غير محدود)'}
                                        </td>
                                        <td className="p-4 text-gray-500">
                                            {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString('ar-EG') : 'بدون تاريخ'}
                                            {isExpired && <span className="block text-xs text-red-500">(منتهي)</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {promo.isActive ? 'مفعل' : 'معطل'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="outline" size="sm" 
                                                    className={promo.isActive ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                                                    onClick={() => toggleMutation.mutate(promo._id)}
                                                    disabled={toggleMutation.isPending}
                                                    title={promo.isActive ? 'تعطيل الكود' : 'تفعيل الكود'}
                                                >
                                                    {promo.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                </Button>
                                                <Button 
                                                    variant="outline" size="sm" 
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => { if(confirm('هل أنت متأكد من حذف كود الخصم؟')) deleteMutation.mutate(promo._id); }}
                                                    disabled={deleteMutation.isPending}
                                                    title="حذف نهائي"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

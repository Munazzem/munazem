'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlatformSettings, updatePlanPrices } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Save, Loader2, Info, Tag, Megaphone, DollarSign } from 'lucide-react';
import PromoCodesSettings from './PromoCodesSettings';
import AnnouncementsSettings from './AnnouncementsSettings';

function PricingSettings() {
    const queryClient = useQueryClient();
    const [prices, setPrices] = useState<Record<string, number>>({
        BASIC: 1000,
        PRO: 1500,
        PREMIUM: 2000,
    });

    const { data: settings, isLoading } = useQuery({
        queryKey: ['admin-platform-settings'],
        queryFn: fetchPlatformSettings,
    });

    useEffect(() => {
        if (settings) {
            setPrices(settings);
        }
    }, [settings]);

    const updateMutation = useMutation({
        mutationFn: (newPrices: Record<string, number>) => updatePlanPrices(newPrices),
        onSuccess: () => {
            toast.success('تم تحديث أسعار الباقات بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-platform-settings'] });
        },
        onError: () => {}, 
    });

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-800">أسعار الباقات (شهرياً)</h2>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-blue-500" />
                    هذه الأسعار ستُطبق على أي اشتراك جديد أو تجديد.
                </p>
            </div>

            <div className="p-5 space-y-6">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">الباقة الأساسية (BASIC)</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min="0"
                                    value={prices.BASIC}
                                    onChange={(e) => setPrices(p => ({ ...p, BASIC: Number(e.target.value) }))}
                                    className="pl-12 font-medium"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                                    ج.م
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">الباقة الاحترافية (PRO)</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min="0"
                                    value={prices.PRO}
                                    onChange={(e) => setPrices(p => ({ ...p, PRO: Number(e.target.value) }))}
                                    className="pl-12 font-medium"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                                    ج.م
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">الباقة المتميزة (PREMIUM)</label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    min="0"
                                    value={prices.PREMIUM}
                                    onChange={(e) => setPrices(p => ({ ...p, PREMIUM: Number(e.target.value) }))}
                                    className="pl-12 font-medium"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                                    ج.م
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <Button
                    onClick={() => updateMutation.mutate(prices)}
                    disabled={isLoading || updateMutation.isPending}
                    className="min-w-[120px]"
                >
                    {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                        <Save className="h-4 w-4 ml-2" />
                    )}
                    حفظ التغييرات
                </Button>
            </div>
        </div>
    );
}

export default function AdminSettingsPage() {
    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
                <p className="text-sm text-gray-500 mt-1">
                    إدارة أسعار الباقات، الخصومات، والإشعارات العامة
                </p>
            </div>

            <Tabs defaultValue="pricing" className="space-y-6">
                <TabsList className="bg-white border border-gray-100 p-1 shadow-sm rounded-xl inline-flex w-full sm:w-auto">
                    <TabsTrigger value="pricing" className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <DollarSign className="h-4 w-4" />
                        تسعير الباقات
                    </TabsTrigger>
                    <TabsTrigger value="promocodes" className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Tag className="h-4 w-4" />
                        أكواد الخصم
                    </TabsTrigger>
                    <TabsTrigger value="announcements" className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Megaphone className="h-4 w-4" />
                        الإشعارات العامة
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pricing" className="mt-0 outline-none">
                    <PricingSettings />
                </TabsContent>

                <TabsContent value="promocodes" className="mt-0 outline-none">
                    <PromoCodesSettings />
                </TabsContent>

                <TabsContent value="announcements" className="mt-0 outline-none">
                    <AnnouncementsSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}

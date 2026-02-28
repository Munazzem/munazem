'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/axios';
import { CreditCard, Users, Activity } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

const fetchSubscriptions = async () => {
    const res = await apiClient.get('/subscriptions');
    return res.data?.data || [];
};

const SuperAdminSkeleton = () => (
    <div className="space-y-6 animate-pulse mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gray-200"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 rounded-full bg-gray-100"></div>
                    </div>
                    <div>
                        <div className="h-4 w-32 bg-gray-100 rounded mb-2"></div>
                        <div className="h-8 w-24 bg-gray-200 rounded"></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export function SuperAdminDashboard() {
    const user = useAuthStore((state) => state.user);

    const { data: subscriptions, isLoading, isError } = useQuery({
        queryKey: ['superAdminSubscriptions'],
        queryFn: fetchSubscriptions
    });

    const totalRevenue = subscriptions?.reduce((sum: number, sub: { amount?: number; status?: string }) => sum + (sub.amount || 0), 0) || 0;
    const activeSubscriptions = subscriptions?.filter((sub: { amount?: number; status?: string }) => sub.status === 'ACTIVE').length || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    مرحباً بعودتك، مدير النظام {user?.name?.split(' ')[0]} 👋
                </h1>
                <p className="text-gray-500 mt-1">نظرة عامة على الاشتراكات وأداء المنصة.</p>
            </div>

            {isLoading ? (
                <SuperAdminSkeleton />
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl">
                    حدث خطأ أثناء تحميل إحصائيات النظام.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Stat Card 1 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <CreditCard size={20} />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي إيرادات الاشتراكات</p>
                            <h3 className="text-2xl font-bold text-gray-900">{totalRevenue} <span className="text-sm text-gray-500 font-normal">ج.م</span></h3>
                        </div>
                    </div>

                    {/* Stat Card 2 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-400"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Activity size={20} />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">الاشتراكات النشطة</p>
                            <h3 className="text-2xl font-bold text-gray-900">{activeSubscriptions} <span className="text-sm text-gray-500 font-normal">معلم</span></h3>
                        </div>
                    </div>

                    {/* Stat Card 3 */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-400"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                <Users size={20} />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">إجمالي المعلمين المشتركين</p>
                            <h3 className="text-2xl font-bold text-gray-900">{subscriptions?.length || 0}</h3>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

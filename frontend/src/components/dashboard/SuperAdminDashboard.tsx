'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/axios';
import { CreditCard, Users, Activity, ArrowLeft, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import Link from 'next/link';

const fetchSubscriptions = async () => {
    // apiClient interceptor returns response.data directly → shape: { status, message, data }
    const res = await apiClient.get('/subscriptions');
    return (res as any).data || [];
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
                        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-blue-400"></div>
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
                        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-green-500 to-emerald-400"></div>
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
                        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-purple-500 to-pink-400"></div>
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

            {/* Quick Actions */}
            <div>
                <h2 className="text-lg font-bold text-gray-800 mb-3">إجراءات سريعة</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                        href="/dashboard/subscriptions"
                        className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <CreditCard size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">إدارة الاشتراكات</p>
                                <p className="text-sm text-gray-500 mt-0.5">تجديد وإضافة اشتراكات المعلمين</p>
                            </div>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-primary transition-colors" />
                    </Link>

                    <Link
                        href="/dashboard/users"
                        className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                                <Users size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">إدارة المعلمين</p>
                                <p className="text-sm text-gray-500 mt-0.5">إضافة وتعديل حسابات المعلمين</p>
                            </div>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </Link>
                </div>
            </div>

            {/* Expiring Soon */}
            {!isLoading && !isError && subscriptions && subscriptions.length > 0 && (() => {
                const expiringSoon = subscriptions.filter((s: any) => {
                    const days = Math.ceil((new Date(s.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return s.status === 'ACTIVE' && days >= 0 && days <= 30;
                });
                if (expiringSoon.length === 0) return null;
                return (
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            اشتراكات تنتهي قريباً
                        </h2>
                        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                                {expiringSoon.slice(0, 5).map((sub: any) => {
                                    const teacher = typeof sub.teacherId === 'object' && sub.teacherId !== null
                                        ? sub.teacherId
                                        : { name: 'غير معروف', phone: '' };
                                    const days = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <div key={sub._id} className="flex items-center justify-between px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{teacher.name}</p>
                                                    <p className="text-xs text-gray-500" dir="ltr">{teacher.phone}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                                {days} يوم
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

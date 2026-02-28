'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSubscriptions } from '@/lib/api/subscriptions';
import type { ISubscription } from '@/types/subscription.types';
import { useAuthStore } from '@/lib/store/auth.store';
import {
    CreditCard,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    CalendarDays,
    TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';

function statusConfig(status: ISubscription['status']) {
    switch (status) {
        case 'ACTIVE':
            return { label: 'نشط', icon: CheckCircle2, className: 'bg-green-100 text-green-700 border-green-200' };
        case 'EXPIRED':
            return { label: 'منتهي', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' };
        case 'PENDING':
        default:
            return { label: 'معلق', icon: Clock, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    }
}

function daysRemaining(endDate: string) {
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function getTeacher(sub: ISubscription) {
    if (typeof sub.teacherId === 'object' && sub.teacherId !== null) {
        return sub.teacherId;
    }
    return { name: 'غير معروف', phone: '', email: '' };
}

export default function SubscriptionsPage() {
    const user = useAuthStore((s) => s.user);
    const [search, setSearch] = useState('');

    const { data, isLoading, isError } = useQuery({
        queryKey: ['subscriptions'],
        queryFn: fetchSubscriptions,
    });

    if (user?.role !== 'superAdmin') {
        return (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                غير مصرح لك بالوصول إلى هذه الصفحة.
            </div>
        );
    }

    const subscriptions: ISubscription[] = data || [];

    const filtered = subscriptions.filter((sub) => {
        const teacher = getTeacher(sub);
        return (
            teacher.name.toLowerCase().includes(search.toLowerCase()) ||
            teacher.phone?.includes(search)
        );
    });

    // Summary stats
    const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
    const expiredCount = subscriptions.filter((s) => s.status === 'EXPIRED').length;
    const totalRevenue = subscriptions.reduce((acc, s) => acc + (s.amount || 0), 0);
    const expiringSoon = subscriptions.filter((s) => {
        const days = daysRemaining(s.endDate);
        return s.status === 'ACTIVE' && days >= 0 && days <= 30;
    }).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">إدارة الاشتراكات</h1>
                    <p className="text-gray-500 mt-1">تتبع اشتراكات المعلمين وتجديدها.</p>
                </div>
                <AddSubscriptionModal />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">اشتراكات نشطة</p>
                        <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                        <XCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">اشتراكات منتهية</p>
                        <p className="text-2xl font-bold text-gray-900">{expiredCount}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <CalendarDays className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">تنتهي قريباً (30 يوم)</p>
                        <p className="text-2xl font-bold text-gray-900">{expiringSoon}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
                        <p className="text-xl font-bold text-gray-900">{totalRevenue.toLocaleString('ar-EG')} ج</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full sm:w-96">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </div>
                    <Input
                        placeholder="ابحث باسم المعلم أو الهاتف..."
                        className="pl-4 pr-10 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64 text-primary">
                    <Loader2 className="h-10 w-10 animate-spin" />
                </div>
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                    حدث خطأ أثناء تحميل الاشتراكات.
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    لا توجد اشتراكات مطابقة.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                                    <th className="text-right font-semibold py-3.5 px-4">المعلم</th>
                                    <th className="text-right font-semibold py-3.5 px-4">الهاتف</th>
                                    <th className="text-right font-semibold py-3.5 px-4">تاريخ البداية</th>
                                    <th className="text-right font-semibold py-3.5 px-4">تاريخ الانتهاء</th>
                                    <th className="text-right font-semibold py-3.5 px-4">المبلغ</th>
                                    <th className="text-right font-semibold py-3.5 px-4">طريقة الدفع</th>
                                    <th className="text-center font-semibold py-3.5 px-4">الحالة</th>
                                    <th className="text-center font-semibold py-3.5 px-4">الأيام المتبقية</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((sub) => {
                                    const teacher = getTeacher(sub);
                                    const { label, icon: StatusIcon, className: statusClass } = statusConfig(sub.status);
                                    const days = daysRemaining(sub.endDate);
                                    const isExpiring = sub.status === 'ACTIVE' && days >= 0 && days <= 30;

                                    return (
                                        <tr key={sub._id} className="hover:bg-gray-50/70 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                        {teacher.name.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{teacher.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500" dir="ltr">{teacher.phone || '—'}</td>
                                            <td className="py-3.5 px-4 text-gray-600">{formatDate(sub.startDate)}</td>
                                            <td className="py-3.5 px-4 text-gray-600">
                                                <span className={cn(isExpiring ? 'text-amber-600 font-semibold' : '')}>
                                                    {formatDate(sub.endDate)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                {(sub.amount || 0).toLocaleString('ar-EG')} ج
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500">
                                                {sub.paymentMethod || '—'}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Badge className={cn('inline-flex items-center gap-1.5 border text-xs font-medium', statusClass)}>
                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                    {label}
                                                </Badge>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                {sub.status === 'EXPIRED' ? (
                                                    <span className="text-red-500 font-semibold">منتهي</span>
                                                ) : days < 0 ? (
                                                    <span className="text-red-500 font-semibold">منتهي</span>
                                                ) : (
                                                    <span className={cn('font-semibold', isExpiring ? 'text-amber-600' : 'text-green-600')}>
                                                        {days} يوم
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

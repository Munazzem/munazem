'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSubscriptions } from '@/lib/api/subscriptions';
import type { ISubscription, SubscriptionPlan } from '@/types/subscription.types';
import { DURATION_LABELS } from '@/types/subscription.types';
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
    RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { RenewSubscriptionModal } from '@/components/subscriptions/RenewSubscriptionModal';
import { Button } from '@/components/ui/button';

const PLAN_BADGE: Record<SubscriptionPlan, { label: string; className: string }> = {
    BASIC:   { label: 'الأساسية',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
    PRO:     { label: 'الاحترافية', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    PREMIUM: { label: 'المتميزة',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function planBadge(plan?: SubscriptionPlan) {
    if (!plan || !PLAN_BADGE[plan]) return null;
    const { label, className } = PLAN_BADGE[plan];
    return <Badge className={cn('border text-xs font-medium', className)}>{label}</Badge>;
}

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
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getTeacher(sub: ISubscription) {
    if (typeof sub.teacherId === 'object' && sub.teacherId !== null) return sub.teacherId;
    return { name: 'غير معروف', phone: '', email: '' };
}

export default function SubscriptionsPage() {
    const user = useAuthStore((s) => s.user);
    const [search, setSearch] = useState('');
    const [renewSub, setRenewSub] = useState<ISubscription | null>(null);

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

    const activeCount    = subscriptions.filter((s) => s.status === 'ACTIVE').length;
    const expiredCount   = subscriptions.filter((s) => s.status === 'EXPIRED').length;
    const totalRevenue   = subscriptions.reduce((acc, s) => acc + (s.amount || 0), 0);
    const expiringSoon   = subscriptions.filter((s) => {
        const days = daysRemaining(s.endDate);
        return s.status === 'ACTIVE' && days >= 0 && days <= 30;
    }).length;

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">إدارة الاشتراكات</h1>
                    <p className="text-sm text-gray-500 mt-0.5">تتبع اشتراكات المعلمين وتجديدها.</p>
                </div>
                <AddSubscriptionModal />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { icon: CheckCircle2, bg: 'bg-green-100', color: 'text-green-600', label: 'اشتراكات نشطة', value: activeCount },
                    { icon: XCircle,      bg: 'bg-red-100',   color: 'text-red-500',   label: 'اشتراكات منتهية', value: expiredCount },
                    { icon: CalendarDays, bg: 'bg-amber-100', color: 'text-amber-600', label: 'تنتهي قريباً', value: expiringSoon },
                    { icon: TrendingUp,   bg: 'bg-blue-100',  color: 'text-blue-600',  label: 'إجمالي الإيرادات', value: `${totalRevenue.toLocaleString('ar-EG')} ج` },
                ].map(({ icon: Icon, bg, color, label, value }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-center gap-3">
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
                            <Icon className={cn('h-5 w-5', color)} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
                            <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={16} />
                    </div>
                    <Input
                        placeholder="ابحث باسم المعلم أو الهاتف..."
                        className="pl-4 pr-9 border-gray-200 bg-gray-50 focus-visible:ring-primary text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Content */}
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
                    {/* Mobile Cards */}
                    <div className="lg:hidden divide-y divide-gray-50">
                        {filtered.map((sub) => {
                            const teacher = getTeacher(sub);
                            const { label, icon: StatusIcon, className: statusClass } = statusConfig(sub.status);
                            const days = daysRemaining(sub.endDate);
                            const isExpiring = sub.status === 'ACTIVE' && days >= 0 && days <= 30;
                            return (
                                <div key={sub._id} className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                                {teacher.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{teacher.name}</p>
                                                <p className="text-xs text-gray-400" dir="ltr">{teacher.phone}</p>
                                            </div>
                                        </div>
                                        <Badge className={cn('inline-flex items-center gap-1 border text-xs font-medium shrink-0', statusClass)}>
                                            <StatusIcon className="h-3 w-3" />
                                            {label}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                        <div>الباقة: {planBadge(sub.planTier)}</div>
                                        <div>المدة: {DURATION_LABELS[sub.durationMonths] ?? `${sub.durationMonths} شهر`}</div>
                                        <div className={cn(isExpiring ? 'text-amber-600 font-semibold' : '')}>
                                            ينتهي: {formatDate(sub.endDate)}
                                        </div>
                                        <div className="font-bold text-gray-800">{(sub.amount || 0).toLocaleString('ar-EG')} ج</div>
                                    </div>
                                    <Button size="sm" variant="outline" className="w-full h-8 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 text-xs" onClick={() => setRenewSub(sub)}>
                                        <RefreshCw className="h-3.5 w-3.5" /> تجديد الاشتراك
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                                    <th className="text-right font-semibold py-3.5 px-4">المعلم</th>
                                    <th className="text-right font-semibold py-3.5 px-4">الهاتف</th>
                                    <th className="text-center font-semibold py-3.5 px-4">الباقة</th>
                                    <th className="text-right font-semibold py-3.5 px-4">المدة</th>
                                    <th className="text-right font-semibold py-3.5 px-4">تاريخ الانتهاء</th>
                                    <th className="text-right font-semibold py-3.5 px-4">المبلغ</th>
                                    <th className="text-center font-semibold py-3.5 px-4">الحالة</th>
                                    <th className="text-center font-semibold py-3.5 px-4">الأيام المتبقية</th>
                                    <th className="text-center font-semibold py-3.5 px-4">تجديد</th>
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
                                            <td className="py-3.5 px-4 text-center">{planBadge(sub.planTier)}</td>
                                            <td className="py-3.5 px-4 text-gray-600 text-sm whitespace-nowrap">
                                                {sub.durationMonths ? DURATION_LABELS[sub.durationMonths] ?? `${sub.durationMonths} شهر` : '—'}
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-600">
                                                <span className={cn(isExpiring ? 'text-amber-600 font-semibold' : '')}>
                                                    {formatDate(sub.endDate)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                {(sub.amount || 0).toLocaleString('ar-EG')} ج
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Badge className={cn('inline-flex items-center gap-1.5 border text-xs font-medium', statusClass)}>
                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                    {label}
                                                </Badge>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                {sub.status === 'EXPIRED' || days < 0 ? (
                                                    <span className="text-red-500 font-semibold">منتهي</span>
                                                ) : (
                                                    <span className={cn('font-semibold', isExpiring ? 'text-amber-600' : 'text-green-600')}>
                                                        {days} يوم
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-primary border-primary/30 hover:bg-primary/5" onClick={() => setRenewSub(sub)}>
                                                    <RefreshCw className="h-3.5 w-3.5" /> تجديد
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <RenewSubscriptionModal
                open={!!renewSub}
                onOpenChange={(v) => { if (!v) setRenewSub(null); }}
                subscription={renewSub}
            />
        </div>
    );
}

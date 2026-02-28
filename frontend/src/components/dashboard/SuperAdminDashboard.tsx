'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSubscriptions } from '@/lib/api/subscriptions';
import { fetchUsers } from '@/lib/api/users';
import { useAuthStore } from '@/lib/store/auth.store';
import {
    CreditCard,
    Users,
    Activity,
    ArrowLeft,
    Clock,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ISubscription } from '@/types/subscription.types';

// ── Skeleton ──────────────────────────────────────────────────────
const SuperAdminSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div>
            <div className="h-8 w-56 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-72 bg-gray-100 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-28 flex flex-col justify-between">
                    <div className="h-9 w-9 bg-gray-100 rounded-xl" />
                    <div>
                        <div className="h-3 w-28 bg-gray-100 rounded mb-2" />
                        <div className="h-7 w-16 bg-gray-200 rounded" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    suffix,
    icon: Icon,
    colorClass,
    bgClass,
    accentClass,
}: {
    label: string;
    value: number | string;
    suffix?: string;
    icon: React.ElementType;
    colorClass: string;
    bgClass: string;
    accentClass: string;
}) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
            <div className={cn('absolute top-0 left-0 w-full h-1', accentClass)} />
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', bgClass)}>
                <Icon className={cn('h-5 w-5', colorClass)} />
            </div>
            <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
                    {suffix && <span className="text-sm font-normal text-gray-400 mr-1">{suffix}</span>}
                </p>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────
export function SuperAdminDashboard() {
    const user = useAuthStore((state) => state.user);

    const { data: subscriptions = [], isLoading: loadingSubs, isError: errorSubs } = useQuery<ISubscription[]>({
        queryKey: ['superAdminSubscriptions'],
        queryFn: fetchSubscriptions,
    });

    const { data: usersData, isLoading: loadingUsers } = useQuery({
        queryKey: ['superAdminUsers'],
        queryFn: () => fetchUsers(),
    });

    const isLoading = loadingSubs || loadingUsers;

    const totalTeachers: number = (usersData as any)?.length ?? (usersData as any)?.data?.length ?? 0;
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE').length;
    const totalRevenue = subscriptions.reduce((sum, s) => sum + (s.amount ?? 0), 0);

    const expiringSoon = subscriptions
        .filter((s) => {
            const days = Math.ceil((new Date(s.endDate).getTime() - Date.now()) / 86400000);
            return s.status === 'ACTIVE' && days >= 0 && days <= 30;
        })
        .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    const PLAN_LABEL: Record<string, string> = {
        BASIC: 'أساسية',
        PRO: 'احترافية',
        PREMIUM: 'متميزة',
    };

    const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
        ACTIVE:  { label: 'نشط',     cls: 'bg-green-100 text-green-700' },
        EXPIRED: { label: 'منتهي',   cls: 'bg-red-100   text-red-600'   },
        PENDING: { label: 'معلق',    cls: 'bg-amber-100 text-amber-700'  },
    };

    if (isLoading) return <SuperAdminSkeleton />;

    if (errorSubs) {
        return (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                حدث خطأ أثناء تحميل بيانات النظام.
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    مرحباً بعودتك، {user?.name?.split(' ')[0]}
                </h1>
                <p className="text-gray-500 mt-1">نظرة عامة على اشتراكات المنصة وحالة المعلمين.</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="إجمالي المعلمين"
                    value={totalTeachers}
                    suffix="معلم"
                    icon={Users}
                    colorClass="text-blue-600"
                    bgClass="bg-blue-50"
                    accentClass="bg-linear-to-r from-blue-500 to-blue-400"
                />
                <StatCard
                    label="الاشتراكات النشطة"
                    value={activeSubscriptions}
                    suffix="اشتراك"
                    icon={CheckCircle2}
                    colorClass="text-green-600"
                    bgClass="bg-green-50"
                    accentClass="bg-linear-to-r from-green-500 to-emerald-400"
                />
                <StatCard
                    label="إجمالي إيرادات الاشتراكات"
                    value={totalRevenue}
                    suffix="ج.م"
                    icon={TrendingUp}
                    colorClass="text-primary"
                    bgClass="bg-primary/10"
                    accentClass="bg-linear-to-r from-primary to-blue-400"
                />
                <StatCard
                    label="تنتهي خلال 30 يوم"
                    value={expiringSoon.length}
                    suffix="اشتراك"
                    icon={AlertTriangle}
                    colorClass="text-amber-600"
                    bgClass="bg-amber-50"
                    accentClass="bg-linear-to-r from-amber-500 to-yellow-400"
                />
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-base font-bold text-gray-700 mb-3">إجراءات سريعة</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                        href="/dashboard/subscriptions"
                        className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <CreditCard size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">إدارة الاشتراكات</p>
                                <p className="text-xs text-gray-500 mt-0.5">تجديد وإضافة اشتراكات المعلمين</p>
                            </div>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
                    </Link>

                    <Link
                        href="/dashboard/users"
                        className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple-300 transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                                <Users size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">إدارة المعلمين</p>
                                <p className="text-xs text-gray-500 mt-0.5">إضافة وتعديل حسابات المعلمين</p>
                            </div>
                        </div>
                        <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors shrink-0" />
                    </Link>
                </div>
            </div>

            {/* Recent Subscriptions Table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        آخر الاشتراكات
                    </h2>
                    <Link href="/dashboard/subscriptions" className="text-xs text-primary hover:underline">
                        عرض الكل
                    </Link>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {subscriptions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">لا توجد اشتراكات بعد</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-right font-semibold text-gray-500 px-5 py-3">المعلم</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الباقة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">المبلغ</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">تنتهي</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {subscriptions.slice(0, 8).map((sub) => {
                                        const teacher = typeof sub.teacherId === 'object' && sub.teacherId !== null
                                            ? sub.teacherId as { name: string; phone: string }
                                            : { name: 'غير معروف', phone: '' };
                                        const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000);
                                        const statusCfg = STATUS_CONFIG[sub.status] ?? { label: sub.status, cls: 'bg-gray-100 text-gray-600' };
                                        return (
                                            <tr key={sub._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <p className="font-semibold text-gray-900">{teacher.name}</p>
                                                    <p className="text-xs text-gray-400" dir="ltr">{teacher.phone}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">{PLAN_LABEL[sub.planTier] ?? sub.planTier}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{sub.amount?.toLocaleString()} ج</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        'text-xs font-medium',
                                                        daysLeft <= 7 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-gray-500'
                                                    )}>
                                                        {new Date(sub.endDate).toLocaleDateString('ar-EG')}
                                                        {sub.status === 'ACTIVE' && ` (${daysLeft} يوم)`}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn('text-xs font-bold px-2 py-1 rounded-full', statusCfg.cls)}>
                                                        {statusCfg.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Expiring Soon Alert */}
            {expiringSoon.length > 0 && (
                <div>
                    <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        اشتراكات تنتهي خلال 30 يوم
                    </h2>
                    <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                        <div className="divide-y divide-amber-100">
                            {expiringSoon.slice(0, 5).map((sub) => {
                                const teacher = typeof sub.teacherId === 'object' && sub.teacherId !== null
                                    ? sub.teacherId as { name: string; phone: string }
                                    : { name: 'غير معروف', phone: '' };
                                const days = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000);
                                return (
                                    <div key={sub._id} className="flex items-center justify-between px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-sm shrink-0">
                                                {teacher.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">{teacher.name}</p>
                                                <p className="text-xs text-gray-500" dir="ltr">{teacher.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs text-gray-500">
                                                {PLAN_LABEL[sub.planTier] ?? sub.planTier}
                                            </Badge>
                                            <span className="text-sm font-bold text-amber-700 bg-white px-3 py-1 rounded-full border border-amber-200">
                                                {days} يوم
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

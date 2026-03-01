'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { Users, GraduationCap, Activity, TrendingUp, Receipt, Clock, CalendarDays, UserCheck, CreditCard, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/lib/api/dashboard';
import { fetchDailySummary } from '@/lib/api/reports';
import type { DashboardData } from '@/types/dashboard.types';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { cn } from '@/lib/utils';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// ── Skeleton ──────────────────────────────────────────────────────
const DashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div>
            <div className="h-8 w-48 bg-gray-200 rounded-md mb-2" />
            <div className="h-4 w-64 bg-gray-100 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-32 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-24 bg-gray-100 rounded" />
                        <div className="h-10 w-10 bg-gray-100 rounded-xl" />
                    </div>
                    <div className="h-8 w-16 bg-gray-200 rounded mt-4" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-72">
                <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
                <div className="h-48 bg-gray-100 rounded-lg w-full" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-72">
                <div className="h-6 w-32 bg-gray-200 rounded mb-6" />
                {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded mb-2" />)}
            </div>
        </div>
    </div>
);

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({
    label, value, suffix, icon: Icon, iconBg, iconColor, accent,
}: {
    label: string; value: number | string; suffix?: string;
    icon: React.ElementType; iconBg: string; iconColor: string; accent?: string;
}) {
    return (
        <div className={cn(
            'bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden',
        )}>
            {accent && <div className={cn('absolute top-0 left-0 w-full h-1', accent)} />}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">{label}</span>
                <div className={cn('h-10 w-10 flex items-center justify-center rounded-xl', iconBg)}>
                    <Icon className={cn('h-5 w-5', iconColor)} />
                </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                    {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
                </span>
                {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
            </div>
        </div>
    );
}

// ── Category labels ───────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
    SUBSCRIPTION: 'اشتراك',
    NOTEBOOK_SALE: 'مذكرة',
    OTHER_INCOME: 'أخرى',
    RENT: 'إيجار',
    SALARY: 'راتب',
    SUPPLIES: 'مستلزمات',
    OTHER_EXPENSE: 'مصاريف',
};

// ── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    const { data: dashboardData, isLoading, isError } = useQuery({
        queryKey: ['dashboardSummary'],
        queryFn: fetchDashboardStats,
        enabled: user?.role === 'teacher' || user?.role === 'assistant',
    });

    const { data: dailySummary } = useQuery({
        queryKey: ['dailySummary'],
        queryFn: () => fetchDailySummary(),
        enabled: user?.role === 'teacher' || user?.role === 'assistant',
        refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    });

    if (!isMounted) return <DashboardSkeleton />;
    if (user?.role === 'superAdmin') return <SuperAdminDashboard />;

    const stats = dashboardData as DashboardData | undefined;

    if (isLoading) return <DashboardSkeleton />;
    if (isError) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100 font-bold">
                حدث خطأ أثناء تحميل بيانات لوحة التحكم
            </div>
        );
    }

    const isTeacher = user?.role === 'teacher';

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">نظرة عامة</h1>
                <p className="text-gray-500 mt-1">حالة المنصة التعليمية لليوم.</p>
            </div>

            {/* Assistant welcome banner */}
            {stats?.message && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-primary font-medium flex items-center gap-3">
                    <Activity size={20} className="shrink-0" />
                    {stats.message}
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="إجمالي الطلاب"
                    value={stats?.totalStudents ?? 0}
                    suffix="طالب"
                    icon={Users}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <StatCard
                    label="مجموعات العمل"
                    value={stats?.totalGroups ?? 0}
                    suffix="مجموعة"
                    icon={GraduationCap}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                />
                <StatCard
                    label="حصص الشهر"
                    value={stats?.sessionsThisMonth ?? 0}
                    suffix="حصة"
                    icon={Activity}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                />
                {isTeacher && (
                    <StatCard
                        label="إيرادات الشهر"
                        value={stats?.financial?.totalIncome ?? 0}
                        suffix="ج.م"
                        icon={TrendingUp}
                        iconBg="bg-green-50"
                        iconColor="text-green-600"
                        accent="bg-linear-to-r from-green-400 to-emerald-400"
                    />
                )}
            </div>

            {/* Charts — Teacher only */}
            {isTeacher && stats?.charts && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Income Trend — Bar Chart via recharts */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            اتجاه الإيرادات (آخر 6 أشهر)
                        </h3>
                        {stats.charts.incomeTrend?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={stats.charts.incomeTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50}
                                        tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                    <Tooltip
                                        formatter={(v: number) => [`${v.toLocaleString('ar-EG')} ج.م`, 'الإيرادات']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13, direction: 'rtl' }}
                                    />
                                    <Bar dataKey="income" fill="#0f4c81" radius={[6, 6, 0, 0]} maxBarSize={48} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                                لا توجد بيانات مالية سابقة لعرضها
                            </div>
                        )}
                    </div>

                    {/* Students Per Group */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                            <Users className="h-5 w-5 text-indigo-500" />
                            توزيع الطلاب
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {stats.charts.studentsPerGroup?.length > 0 ? (
                                stats.charts.studentsPerGroup.map((g, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                                            <span className="text-sm text-gray-700 truncate">{g.groupName}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md shrink-0 mr-2">
                                            {g.studentCount}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-400 text-sm mt-8">لا يوجد طلاب مسجلين بعد</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Summary */}
            {dailySummary && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-primary" />
                            ملخص اليوم
                        </h3>
                        <span className="text-xs text-gray-400">
                            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-gray-50">
                        <div className="p-5 text-center">
                            <div className="flex justify-center mb-2">
                                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Activity className="h-4.5 w-4.5 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{dailySummary.sessionsCount}</p>
                            <p className="text-xs text-gray-500 mt-0.5">حصص منتهية</p>
                        </div>
                        <div className="p-5 text-center border-r border-gray-50">
                            <div className="flex justify-center mb-2">
                                <div className="h-9 w-9 rounded-xl bg-green-50 flex items-center justify-center">
                                    <UserCheck className="h-4.5 w-4.5 text-green-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{dailySummary.totalPresent}</p>
                            <p className="text-xs text-gray-500 mt-0.5">طالب حضر</p>
                        </div>
                        <div className="p-5 text-center border-r border-gray-50">
                            <div className="flex justify-center mb-2">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <CreditCard className="h-4.5 w-4.5 text-indigo-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{dailySummary.subscriptionsCount}</p>
                            <p className="text-xs text-gray-500 mt-0.5">اشتراك سُجِّل</p>
                        </div>
                        {isTeacher && (
                            <div className="p-5 text-center border-r border-gray-50">
                                <div className="flex justify-center mb-2">
                                    <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <Wallet className="h-4.5 w-4.5 text-emerald-600" />
                                    </div>
                                </div>
                                <p className={cn(
                                    'text-2xl font-bold',
                                    dailySummary.financial.netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                                )}>
                                    {dailySummary.financial.netBalance.toLocaleString('ar-EG')}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">صافي مالي (ج.م)</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Today's Activity Feed */}
            {stats?.recentActivities && stats.recentActivities.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            نشاط اليوم
                        </h3>
                        <span className="text-xs text-gray-400">
                            {stats.recentActivities.length} معاملة
                        </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {stats.recentActivities.slice(0, 6).map((tx, i) => (
                            <div key={i} className="flex items-center justify-between px-6 py-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                        tx.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                    )}>
                                        {tx.type === 'INCOME' ? '+' : '-'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">
                                            {tx.studentName || tx.description || CAT_LABELS[tx.category] || tx.category}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(tx.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            {' · '}{CAT_LABELS[tx.category] ?? tx.category}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn(
                                    'text-sm font-bold',
                                    tx.type === 'INCOME' ? 'text-green-700' : 'text-red-600'
                                )}>
                                    {tx.type === 'INCOME' ? '+' : '-'}{tx.paidAmount.toLocaleString('ar-EG')} ج
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

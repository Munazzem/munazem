'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { Users, GraduationCap, Activity, TrendingUp, Receipt, Clock, CalendarDays, UserCheck, CreditCard, Wallet, ArrowLeft, BookOpen, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { BulkSubscriptionModal } from '@/components/payments/BulkSubscriptionModal';
import { QuickNotebookSaleModal } from '@/components/payments/QuickNotebookSaleModal';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/lib/api/dashboard';
import { fetchDailySummary } from '@/lib/api/reports';
import type { DashboardData } from '@/types/dashboard.types';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { OnboardingCard } from '@/components/dashboard/OnboardingCard';
import { cn } from '@/lib/utils';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

// ── Skeleton ──────────────────────────────────────────────────────
const DashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-32 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                    <Skeleton className="h-8 w-16 mt-4" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[320px]">
                <Skeleton className="h-6 w-48 mb-6" />
                <Skeleton className="h-[200px] w-full" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[320px]">
                <Skeleton className="h-6 w-48 mb-6" />
                <Skeleton className="h-[200px] w-full" />
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

const CAT_LABELS: Record<string, string> = {
    SUBSCRIPTION: 'اشتراك',
    NOTEBOOK_SALE: 'مذكرة',
    OTHER_INCOME: 'أخرى',
    RENT: 'إيجار',
    SALARY: 'راتب',
    SUPPLIES: 'مستلزمات',
    OTHER_EXPENSE: 'مصاريف',
};

const CHART_COLORS = ['#0f4c81', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// ── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [isMounted, setIsMounted] = useState(false);
    const [showBulkSub,  setShowBulkSub]  = useState(false);
    const [showNbSale,   setShowNbSale]   = useState(false);

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
        <>
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Onboarding — للمدرس الجديد بدون مجموعات أو طلاب */}
            {isTeacher && (
                <OnboardingCard
                    totalGroups={stats?.totalGroups ?? 0}
                    totalStudents={stats?.totalStudents ?? 0}
                />
            )}

            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">نظرة عامة</h1>
                <p className="text-sm text-gray-500 mt-0.5">حالة المنظمة التعليمية لليوم.</p>
            </div>

            {/* Assistant welcome banner */}
            {stats?.message && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-primary font-medium flex items-center gap-3">
                    <Activity size={20} className="shrink-0" />
                    {stats.message}
                </div>
            )}

            {/* Stat Cards — Teacher only */}
            {isTeacher && (
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
                    <StatCard
                        label="إيرادات الشهر"
                        value={stats?.financial?.totalIncome ?? 0}
                        suffix="ج.م"
                        icon={TrendingUp}
                        iconBg="bg-green-50"
                        iconColor="text-green-600"
                        accent="bg-linear-to-r from-green-400 to-emerald-400"
                    />
                </div>
            )}

            {/* Quick Actions — Assistant only */}
            {!isTeacher && (
                <div>
                    <h2 className="text-base font-bold text-gray-700 mb-3">الوصول السريع</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Link
                            href="/students"
                            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">الطلاب</p>
                                <p className="text-xs text-gray-400 mt-0.5">إدارة الطلاب</p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </Link>

                        <Link
                            href="/groups"
                            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                <GraduationCap className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">المجموعات</p>
                                <p className="text-xs text-gray-400 mt-0.5">إدارة المجموعات</p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                        </Link>

                        <Link
                            href="/sessions"
                            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">الحصص</p>
                                <p className="text-xs text-gray-400 mt-0.5">تسجيل الحضور</p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-orange-500 transition-colors" />
                        </Link>

                        <Link
                            href="/exams"
                            className="group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-green-200 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">الامتحانات</p>
                                <p className="text-xs text-gray-400 mt-0.5">إدارة الامتحانات</p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                        </Link>
                    </div>

                    {/* Assistant quick payment buttons */}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <button
                            onClick={() => setShowBulkSub(true)}
                            className="group bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md hover:bg-primary/10 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">اشتراك جماعي</p>
                                <p className="text-xs text-gray-400 mt-0.5">دفع لمجموعة دفعة واحدة</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setShowNbSale(true)}
                            className="group bg-purple-50 border border-purple-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:bg-purple-100 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-200 transition-colors">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">بيع مذكرة</p>
                                <p className="text-xs text-gray-400 mt-0.5">بيع سريع لطالب</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Quick actions — Teacher only */}
            {/* The user requested to hide or make "Group Subscription" and "Notebook Sale" read-only for Teachers. We will hide them. */}

            {/* Charts Section */}
            {isTeacher && stats?.charts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    
                    {/* 1. Income Trend — AreaChart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                اتجاه الإيرادات
                            </div>
                            <span className="text-xs font-normal text-gray-400">آخر 6 أشهر</span>
                        </h3>
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.charts.incomeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0f4c81" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#0f4c81" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                                    <Tooltip
                                        formatter={(v: number | string | undefined | (number | string)[]) => [`${Number(v || 0).toLocaleString('ar-EG')} ج.م`, 'الإيرادات']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12, direction: 'rtl' }}
                                    />
                                    <Area type="monotone" dataKey="income" stroke="#0f4c81" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Attendance Trend — LineChart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                                مستويات الحضور
                            </div>
                            <span className="text-xs font-normal text-gray-400">آخر 8 حصص</span>
                        </h3>
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.charts.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip
                                        formatter={(v: number | string | undefined | (number | string)[]) => [`${v}%`, 'نسبة الحضور']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12, direction: 'rtl' }}
                                    />
                                    <Line type="stepAfter" dataKey="rate" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 3. Students Distribution — Donut Chart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                            توزيع الطلاب على المجموعات
                        </h3>
                        <div className="h-[280px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.charts.studentsPerGroup}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="studentCount"
                                        nameKey="groupName"
                                    >
                                        {(stats.charts.studentsPerGroup || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-15px] text-center pointer-events-none">
                                <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                                <p className="text-[10px] text-gray-400">إجمالي الطلاب</p>
                            </div>
                        </div>
                    </div>

                    {/* 4. Expenses Breakdown — Donut Chart */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                            تحليل المصروفات (هذا الشهر)
                        </h3>
                        <div className="h-[280px] w-full relative">
                            {stats.charts.expensesBreakdown?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.charts.expensesBreakdown.map(e => ({ ...e, name: CAT_LABELS[e.name] || e.name }))}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.charts.expensesBreakdown.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            formatter={(v: number | string | undefined | (number | string)[]) => [`${Number(v || 0).toLocaleString('ar-EG')} ج.م`, 'المبلغ']}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                                    <div className="bg-gray-50 p-4 rounded-full mb-2">
                                        <ArrowLeft className="h-6 w-6 opacity-20" />
                                    </div>
                                    لا توجد مصاريف مسجلة هذا الشهر
                                </div>
                            )}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-15px] text-center pointer-events-none">
                                <p className="text-xl font-bold text-red-600">{stats.financial?.totalExpenses.toLocaleString('ar-EG')}</p>
                                <p className="text-[10px] text-gray-400 font-medium">ج.م مصاريف</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Summary */}
            {dailySummary && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                            <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            ملخص اليوم
                        </h3>
                        <span className="text-xs text-gray-400">
                            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-gray-50">
                        <div className="p-3 sm:p-5 text-center">
                            <div className="flex justify-center mb-2">
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Activity className="h-4 w-4 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{dailySummary.sessionsCount}</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">حصص منتهية</p>
                        </div>
                        <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                            <div className="flex justify-center mb-2">
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-green-50 flex items-center justify-center">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{dailySummary.totalPresent}</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">طالب حضر</p>
                        </div>
                        <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                            <div className="flex justify-center mb-2">
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <CreditCard className="h-4 w-4 text-indigo-600" />
                                </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{dailySummary.subscriptionsCount}</p>
                            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">اشتراك سُجِّل</p>
                        </div>
                        {isTeacher && (
                            <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                                <div className="flex justify-center mb-2">
                                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <Wallet className="h-4 w-4 text-emerald-600" />
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
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                            <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            نشاط اليوم
                        </h3>
                        <span className="text-xs text-gray-400">{stats.recentActivities.length} معاملة</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {stats.recentActivities.slice(0, 6).map((tx, i) => (
                            <div key={i} className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <div className={cn(
                                        'h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                        tx.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                    )}>
                                        {tx.type === 'INCOME' ? '+' : '-'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {tx.studentName || tx.description || CAT_LABELS[tx.category] || tx.category}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3 shrink-0" />
                                            {new Date(tx.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            {' · '}{CAT_LABELS[tx.category] ?? tx.category}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn(
                                    'text-sm font-bold shrink-0',
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

        {/* Modals */}
        <BulkSubscriptionModal  open={showBulkSub} onOpenChange={setShowBulkSub} />
        <QuickNotebookSaleModal open={showNbSale}  onOpenChange={setShowNbSale} />
        </>
    );
}

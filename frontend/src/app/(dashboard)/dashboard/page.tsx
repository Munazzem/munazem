'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { Users, GraduationCap, Activity, TrendingUp, Receipt, Clock, CalendarDays, UserCheck, CreditCard, Wallet, ArrowLeft, BookOpen, ClipboardList, CheckCircle2, XCircle, CalendarX, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { BulkSubscriptionModal } from '@/components/payments/BulkSubscriptionModal';
import { QuickNotebookSaleModal } from '@/components/payments/QuickNotebookSaleModal';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/lib/api/dashboard';
import { fetchDailySummary, fetchUnpaidStudents } from '@/lib/api/reports';
import { fetchGroups } from '@/lib/api/groups';
import { fetchSessions } from '@/lib/api/sessions';
import type { DashboardData } from '@/types/dashboard.types';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { OnboardingCard } from '@/components/dashboard/OnboardingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncomeTrendChart } from '@/components/dashboard/charts/IncomeTrendChart';
import { AttendanceTrendChart } from '@/components/dashboard/charts/AttendanceTrendChart';
import { StudentsDistributionChart } from '@/components/dashboard/charts/StudentsDistributionChart';
import { ExpensesBreakdownChart } from '@/components/dashboard/charts/ExpensesBreakdownChart';
import { DailySummary } from '@/components/dashboard/DailySummary';
import { RecentActivity } from '@/components/dashboard/RecentActivity';



// ── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [isMounted, setIsMounted] = useState(false);
    const [showBulkSub,  setShowBulkSub]  = useState(false);
    const [showNbSale,   setShowNbSale]   = useState(false);
    const [showUnpaidList, setShowUnpaidList] = useState(false);

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

    // Use local date (not UTC) — fixes timezone offset for Egypt (UTC+3)
    const _now = new Date();
    const todayStr = [
        _now.getFullYear(),
        String(_now.getMonth() + 1).padStart(2, '0'),
        String(_now.getDate()).padStart(2, '0'),
    ].join('-');

    const { data: todaySessionsData } = useQuery({
        queryKey: ['sessions-today', todayStr],
        queryFn: () => fetchSessions({ date: todayStr, limit: 20 }),
        enabled: (user?.role === 'teacher' || user?.role === 'assistant'),
        refetchInterval: 5 * 60 * 1000,
    });
    const todaySessions = todaySessionsData?.data ?? [];

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 200 }),
        enabled: user?.role === 'teacher' || user?.role === 'assistant',
        staleTime: 10 * 60 * 1000,
    });
    // Build a fast lookup Map: groupId string → group name
    const groupMap = new Map(
        (groupsData?.data ?? []).map((g: any) => [g._id, g.name])
    );

    const { data: unpaidData } = useQuery({
        queryKey: ['unpaid-count'],
        queryFn: () => fetchUnpaidStudents(false),   // count only — very fast
        enabled: user?.role === 'teacher',
        refetchInterval: 10 * 60 * 1000,
        staleTime: 5 * 60 * 1000,
    });

    // Heavy query — only fired when user clicks "عرض القائمة"
    const { data: unpaidListData, isFetching: isLoadingList } = useQuery({
        queryKey: ['unpaid-list'],
        queryFn: () => fetchUnpaidStudents(true),
        enabled: user?.role === 'teacher' && showUnpaidList,
        staleTime: 5 * 60 * 1000,
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
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-10" dir="rtl">
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
            {!isTeacher && stats?.message && (
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

            {/* Today's Sessions Widget */}
            {(isTeacher || !isTeacher) && todaySessions.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            <h2 className="font-bold text-gray-800 text-sm">حصص اليوم</h2>
                            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{todaySessions.length}</span>
                        </div>
                        <Link href="/sessions" className="text-xs text-primary hover:underline flex items-center gap-1">
                            عرض الكل <ArrowLeft className="h-3 w-3" />
                        </Link>
                    </div>
                    <ul className="divide-y divide-gray-50">
                        {todaySessions.map((session) => {
                            const gId = typeof session.groupId === 'object' && session.groupId !== null
                                ? (session.groupId as any)._id ?? (session.groupId as any)
                                : session.groupId;
                            const groupName = (typeof session.groupId === 'object' && session.groupId !== null)
                                ? (session.groupId as any).name
                                : (groupMap.get(String(gId)) ?? '—');
                            const statusIcon = session.status === 'COMPLETED'
                                ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                : session.status === 'CANCELLED'
                                ? <CalendarX className="h-4 w-4 text-red-400 shrink-0" />
                                : <Clock className="h-4 w-4 text-orange-400 shrink-0" />;
                            const statusLabel = session.status === 'COMPLETED' ? 'منتهية'
                                : session.status === 'CANCELLED' ? 'ملغاة'
                                : session.status === 'IN_PROGRESS' ? 'جارية'
                                : 'مجدولة';
                            return (
                                <li key={session._id}>
                                    <Link
                                        href={`/sessions/${session._id}`}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {statusIcon}
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-800 text-sm truncate">{groupName}</p>
                                                <p className="text-xs text-gray-400">{session.startTime}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                session.status === 'COMPLETED' ? 'bg-green-50 text-green-700'
                                                : session.status === 'CANCELLED' ? 'bg-red-50 text-red-500'
                                                : session.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700'
                                                : 'bg-orange-50 text-orange-600'
                                            }`}>{statusLabel}</span>
                                            {session.status === 'SCHEDULED' && (
                                                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                                    تسجيل حضور <ArrowLeft className="h-3 w-3" />
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Unpaid Students Widget — teacher only */}
            {isTeacher && unpaidData && unpaidData.unpaidCount > 0 && (
                <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-50 bg-amber-50/50">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h2 className="font-bold text-gray-800 text-sm">لم يدفعوا بعد</h2>
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {unpaidData.unpaidCount} طالب
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 hidden sm:block">
                                {unpaidData.paidCount} من {unpaidData.totalActive} دفعوا
                            </span>
                            <button
                                onClick={() => setShowUnpaidList(v => !v)}
                                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 font-medium"
                            >
                                {showUnpaidList ? <>إخفاء <ChevronUp className="h-3.5 w-3.5" /></> : <>عرض القائمة <ChevronDown className="h-3.5 w-3.5" /></>}
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="px-4 pt-3 pb-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>دفعوا — {Math.round((unpaidData.paidCount / unpaidData.totalActive) * 100)}%</span>
                            <span>لم يدفعوا — {Math.round((unpaidData.unpaidCount / unpaidData.totalActive) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 bg-green-400 rounded-full transition-all duration-500"
                                style={{ width: `${(unpaidData.paidCount / unpaidData.totalActive) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Student list — collapsible, lazy loaded */}
                    {showUnpaidList && (
                        <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto border-t border-amber-50">
                            {isLoadingList ? (
                                <li className="flex items-center justify-center py-6 text-amber-500 text-sm gap-2">
                                    <span className="inline-block h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                    جارٍ تحميل القائمة...
                                </li>
                            ) : (unpaidListData?.students ?? []).map((s) => {
                                const groupName = typeof s.groupId === 'object' && s.groupId !== null
                                    ? (s.groupId as any).name
                                    : '—';
                                return (
                                    <li key={s._id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{s.studentName}</p>
                                            <p className="text-xs text-gray-400">{groupName} · {s.gradeLevel}</p>
                                        </div>
                                        <Link
                                            href={`/students/${s._id}`}
                                            className="text-xs text-primary hover:underline shrink-0 mr-2"
                                        >
                                            عرض الملف
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {/* Quick Actions — Assistant only */}
            {!isTeacher && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-base font-bold text-gray-700 mb-3">الوصول السريع</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Link
                                href="/students"
                                className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-300">
                                    <Users className="h-6 w-6" />
                                </div>
                                <p className="font-bold text-gray-800 text-sm">الطلاب</p>
                            </Link>

                            <Link
                                href="/groups"
                                className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                                    <GraduationCap className="h-6 w-6" />
                                </div>
                                <p className="font-bold text-gray-800 text-sm">المجموعات</p>
                            </Link>

                            <Link
                                href="/sessions"
                                className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500/20 group-hover:scale-110 transition-all duration-300">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <p className="font-bold text-gray-800 text-sm">الحصص</p>
                            </Link>

                            <Link
                                href="/exams"
                                className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-600 group-hover:bg-green-500/20 group-hover:scale-110 transition-all duration-300">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <p className="font-bold text-gray-800 text-sm">الامتحانات</p>
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <button
                            onClick={() => setShowBulkSub(true)}
                            className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                                <CreditCard className="h-6 w-6" />
                            </div>
                            <p className="font-bold text-gray-800 text-sm">اشتراك جماعي</p>
                        </button>

                        <button
                            onClick={() => setShowNbSale(true)}
                            className="group glass-panel rounded-2xl p-4 hover-lift transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <p className="font-bold text-gray-800 text-sm">حجز مذكرة</p>
                        </button>
                    </div>
                </div>
            )}

            {/* Charts Section — Teacher only */}
            {isTeacher && stats?.charts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <IncomeTrendChart data={stats.charts.incomeTrend || []} />
                    <AttendanceTrendChart data={stats.charts.attendanceTrend || []} />
                    <StudentsDistributionChart data={stats.charts.studentsPerGroup || []} totalStudents={stats.totalStudents || 0} />
                    <ExpensesBreakdownChart data={stats.charts.expensesBreakdown || []} totalExpenses={stats.financial?.totalExpenses ?? 0} />
                </div>
            )}

            {/* Daily Summary */}
            {dailySummary && <DailySummary data={dailySummary} isTeacher={isTeacher} />}

            {/* Recent Activities Feed */}
            {stats?.recentActivities && stats.recentActivities.length > 0 && (
                <RecentActivity activities={stats.recentActivities} />
            )}

            {/* Modals */}
            <BulkSubscriptionModal open={showBulkSub} onOpenChange={setShowBulkSub} />
            <QuickNotebookSaleModal open={showNbSale} onOpenChange={setShowNbSale} />
        </div>
    );
}

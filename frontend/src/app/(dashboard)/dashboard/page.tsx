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

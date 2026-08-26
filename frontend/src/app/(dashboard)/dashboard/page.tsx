'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import {
    Users,
    GraduationCap,
    Activity,
    TrendingUp,
    Clock,
    CalendarDays,
    UserCheck,
    CreditCard,
    Wallet,
    ArrowLeft,
    BookOpen,
    ClipboardList,
    CheckCircle2,
    CalendarX,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Plus,
    CalendarCheck,
    Send,
    Sparkles,
    ShieldCheck,
    Receipt,
} from 'lucide-react';
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
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { IncomeTrendChart } from '@/components/dashboard/charts/IncomeTrendChart';
import { AttendanceTrendChart } from '@/components/dashboard/charts/AttendanceTrendChart';
import { StudentsDistributionChart } from '@/components/dashboard/charts/StudentsDistributionChart';
import { ExpensesBreakdownChart } from '@/components/dashboard/charts/ExpensesBreakdownChart';
import { DailySummary } from '@/components/dashboard/DailySummary';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Page
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);
    const [isMounted, setIsMounted] = useState(false);
    const [showBulkSub, setShowBulkSub] = useState(false);
    const [showNbSale, setShowNbSale] = useState(false);
    const [showUnpaidList, setShowUnpaidList] = useState(false);
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        try {
            const saved = localStorage.getItem('monazem_privacy_mode');
            if (saved === 'true') {
                setIsPrivacyMode(true);
            }
        } catch { }
    }, []);

    const togglePrivacyMode = () => {
        setIsPrivacyMode((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('monazem_privacy_mode', String(next));
            } catch { }
            return next;
        });
    };

    const { data: dashboardData, isLoading, isError } = useQuery({
        queryKey: ['dashboardSummary'],
        queryFn: fetchDashboardStats,
        enabled: user?.role === 'teacher' || user?.role === 'assistant',
    });

    const { data: dailySummary } = useQuery({
        queryKey: ['dailySummary'],
        queryFn: () => fetchDailySummary(),
        enabled: user?.role === 'teacher' || user?.role === 'assistant',
        refetchInterval: 5 * 60 * 1000,
    });

    // Use local date (not UTC) — Egypt timezone UTC+3
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
        staleTime: 30 * 1000,
    });
    const groupMap = new Map(
        (groupsData?.data ?? []).map((g: any) => [g._id, g.name])
    );

    const { data: unpaidData } = useQuery({
        queryKey: ['unpaid-count'],
        queryFn: () => fetchUnpaidStudents(false),
        enabled: user?.role === 'teacher',
        refetchInterval: 2 * 60 * 1000,
    });

    const { data: unpaidListData, isFetching: isLoadingList } = useQuery({
        queryKey: ['unpaid-list'],
        queryFn: () => fetchUnpaidStudents(true),
        enabled: user?.role === 'teacher' && showUnpaidList,
    });

    if (!isMounted) return <DashboardSkeleton />;
    if (user?.role === 'superAdmin') return <SuperAdminDashboard />;

    const stats = dashboardData as DashboardData | undefined;

    if (isLoading) return <DashboardSkeleton />;
    if (isError) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-2xl border border-red-100 font-bold">
                حدث خطأ أثناء تحميل بيانات لوحة التحكم. يرجى المحاولة مرة أخرى.
            </div>
        );
    }

    const isTeacher = user?.role === 'teacher';

    const rawFirstName = user?.name ? user.name.trim().split(/\s+/)[0] : '';
    const firstName = rawFirstName || (isTeacher ? 'أستاذنا' : 'كابتن');

    const currentHour = new Date().getHours();
    const isMorning = currentHour >= 4 && currentHour < 14;

    const greetingHeadline = isTeacher
        ? (isMorning ? `صباح الفل يا مستر ${firstName} ☀️` : `مساء الخير يا مستر ${firstName} 🌙`)
        : `مرحباً، ${firstName} 👋`;

    const greetingSubtitle = isTeacher
        ? (isMorning ? 'كل شغلك جاهز ومُنظَّم !' : 'كل تقاريرك وحساباتك جاهزة ومتسجلة!')
        : 'لوحة متابعة وإدارة الحصص والطلاب';

    return (
        <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-500 pb-12" dir="rtl">
            {/* ── 1. Executive Top Header Bar ── */}
            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-xs p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Welcome & Center Identity */}
                    <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-inner shrink-0">
                            {user?.name ? user.name.charAt(0) : 'م'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-black text-gray-900">
                                    {greetingHeadline}
                                </h1>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/80 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    النظام نشط
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                {greetingSubtitle}
                            </p>
                        </div>
                    </div>

                    {/* Quick Executive Actions */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                        <Link href="/sessions">
                            <Button size="sm" className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xs">
                                <Plus className="h-3.5 w-3.5" />
                                بدء حصة
                            </Button>
                        </Link>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowBulkSub(true)}
                            className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/5 shadow-2xs"
                        >
                            <CreditCard className="h-3.5 w-3.5 text-primary" />
                            اشتراك جماعي
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowNbSale(true)}
                            className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 shadow-2xs"
                        >
                            <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                            حجز مذكرة
                        </Button>

                        <Link href="/students">
                            <Button size="sm" variant="outline" className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs">
                                <Users className="h-3.5 w-3.5 text-gray-500" />
                                الطلاب
                            </Button>
                        </Link>

                        {/* Privacy Toggle Eye */}
                        <button
                            type="button"
                            onClick={togglePrivacyMode}
                            title={isPrivacyMode ? "إلغاء وضع الخصوصية وإظهار الأرقام" : "تفعيل وضع الخصوصية لحجب الأرقام"}
                            className={cn(
                                "h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
                                isPrivacyMode
                                    ? "bg-primary text-white border-primary shadow-sm"
                                    : "bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            {isPrivacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">{isPrivacyMode ? 'محجوب' : 'خصوصية'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main Content Area with Privacy Shield ── */}
            <div className="relative">
                {/* Floating Privacy Unlock Shield */}
                {isPrivacyMode && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-12 sm:pt-20 pointer-events-auto">
                        <div className="bg-white/95 backdrop-blur-xl border border-gray-200/90 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200 mx-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                                <EyeOff className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900">وضع الخصوصية مفعّل</h3>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                    تم إخفاء الأرقام والبيانات المالية لحماية الخصوصية أمام الطلاب أو الزوار.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={togglePrivacyMode}
                                className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-98"
                            >
                                <Eye className="h-4 w-4" />
                                <span>إظهار الأرقام والبيانات</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Inner Content Wrapper */}
                <div
                    className={cn(
                        'space-y-5 sm:space-y-6 transition-all duration-300',
                        isPrivacyMode && 'filter blur-xl opacity-20 select-none pointer-events-none scale-[0.99]'
                    )}
                >
                    {/* Onboarding card for brand new teachers */}
                    {isTeacher && (
                        <OnboardingCard
                            totalGroups={stats?.totalGroups ?? 0}
                            totalStudents={stats?.totalStudents ?? 0}
                        />
                    )}

                    {/* Assistant welcome banner */}
                    {!isTeacher && stats?.message && (
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-primary font-medium flex items-center gap-3">
                            <Activity size={20} className="shrink-0" />
                            {stats.message}
                        </div>
                    )}

                    {/* ── 2. Unified 4 KPI Cards (Right to Left) ── */}
                    {isTeacher && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                            {/* Card 1: Students & Groups */}
                            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 group-hover:text-primary transition-colors">مجتمع الطلاب والمجموعات</span>
                                    <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                                        <Users className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-gray-900">{(stats?.totalStudents ?? 0).toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-gray-400">طالب مسجل</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50 text-gray-500">
                                        <span>النشطين: <strong className="text-emerald-700 font-bold">{stats?.activeStudents ?? stats?.totalStudents ?? 0}</strong></span>
                                        <span>المجموعات: <strong className="text-primary font-bold">{stats?.totalGroups ?? 0}</strong></span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Monthly Sessions Activity */}
                            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 group-hover:text-emerald-700 transition-colors">نشاط الحصص المنعقدة</span>
                                    <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                                        <CalendarCheck className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-gray-900">{(stats?.sessionsThisMonth ?? 0).toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-gray-400">حصة مكتملة هذا الشهر</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50 text-gray-500">
                                        <span>حصص اليوم: <strong className="text-gray-900 font-bold">{todaySessions.length}</strong></span>
                                        <span>المنتهية اليوم: <strong className="text-emerald-700 font-bold">{todaySessions.filter(s => s.status === 'COMPLETED').length}</strong></span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Notebook Sales & Stock */}
                            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 group-hover:text-purple-700 transition-colors">مبيعات المذكرات هذا الشهر</span>
                                    <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-purple-700">{(stats?.notebooks?.totalQuantity ?? 0).toLocaleString('en-US')}</span>
                                        <span className="text-xs font-bold text-gray-400">نسخة مباعة</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50 text-gray-500">
                                        <span>إجمالي الإيراد:</span>
                                        <strong className="text-purple-700 font-bold">{(stats?.notebooks?.totalRevenue ?? 0).toLocaleString()} ج</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Card 4: Total Revenue & Monthly Profit */}
                            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-500 group-hover:text-amber-700 transition-colors">إجمالي دخل وماليات الشهر</span>
                                    <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                                        <Wallet className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-emerald-700">{(stats?.financial?.totalIncome ?? 0).toLocaleString()}</span>
                                        <span className="text-xs font-bold text-gray-500">ج.م وارد</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50 text-gray-500">
                                        <span>الصافي: <strong className={cn("font-bold", (stats?.financial?.netBalance ?? 0) >= 0 ? "text-primary" : "text-red-600")}>{(stats?.financial?.netBalance ?? 0).toLocaleString()} ج</strong></span>
                                        <span>المصروف: <strong className="text-red-600 font-bold">{(stats?.financial?.totalExpenses ?? 0).toLocaleString()} ج</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── 3. Daily Executive Radar ── */}
                    {dailySummary && <DailySummary data={dailySummary} isTeacher={isTeacher} />}

                    {/* ── 4. Today's Live Sessions Hub & Unpaid Widget (2-Column Grid) ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
                        {/* Column 1 & 2: Today's Sessions Interactive Hub */}
                        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100/90 shadow-xs overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="font-extrabold text-gray-900 text-sm sm:text-base">جدول حصص اليوم</h2>
                                        <p className="text-[11px] text-gray-400">متابعة وانعقاد حصص المجموعات لحظياً</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                                        {todaySessions.length} حصص
                                    </Badge>
                                    <Link href="/sessions" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                        عرض الجدول الكامل <ArrowLeft className="h-3 w-3" />
                                    </Link>
                                </div>
                            </div>

                            {todaySessions.length === 0 ? (
                                <div className="p-10 text-center text-gray-400 space-y-2">
                                    <CalendarDays className="h-10 w-10 text-gray-300 mx-auto" />
                                    <p className="text-sm font-semibold text-gray-600">لا توجد حصص مجدولة لليوم</p>
                                    <p className="text-xs text-gray-400">يمكنك بدء حصة جديدة أو مراجعة جدول المجموعات</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {todaySessions.map((session) => {
                                        const gId = typeof session.groupId === 'object' && session.groupId !== null
                                            ? (session.groupId as any)._id ?? (session.groupId as any)
                                            : session.groupId;
                                        const groupName = (typeof session.groupId === 'object' && session.groupId !== null)
                                            ? (session.groupId as any).name
                                            : (groupMap.get(String(gId)) ?? 'مجموعة');
                                        const gradeLevel = (typeof session.groupId === 'object' && session.groupId !== null)
                                            ? (session.groupId as any).gradeLevel
                                            : '';

                                        const statusLabel = session.status === 'COMPLETED' ? 'منتهية ✓'
                                            : session.status === 'CANCELLED' ? 'ملغاة ✗'
                                                : session.status === 'IN_PROGRESS' ? 'جارية الآن 🔴'
                                                    : 'مجدولة ⏱️';

                                        const statusBadge = session.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : session.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200'
                                                : session.status === 'IN_PROGRESS' ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200';

                                        return (
                                            <li key={session._id} className="hover:bg-gray-50/60 transition-colors">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-5 gap-3">
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <div className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0 font-bold text-xs">
                                                            {session.startTime || '—'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-gray-900 text-sm truncate">{groupName}</p>
                                                                <Badge variant="outline" className={cn("text-[10px] py-0", statusBadge)}>
                                                                    {statusLabel}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-0.5">
                                                                {gradeLevel ? `${gradeLevel} · ` : ''}الموعد: {session.startTime}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                                        <Link href={`/sessions/${session._id}`} className="w-full sm:w-auto">
                                                            <Button size="sm" variant={session.status === 'COMPLETED' ? 'outline' : 'default'} className="w-full sm:w-auto h-8 text-xs font-bold gap-1 rounded-xl">
                                                                <ClipboardList className="h-3.5 w-3.5" />
                                                                {session.status === 'COMPLETED' ? 'مراجعة الحضور' : 'تسجيل الحضور بالباركود'}
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Column 3: Unpaid Cycle Students Widget */}
                        {isTeacher && unpaidData && (
                            <div className="bg-white rounded-3xl border border-amber-200/80 shadow-xs overflow-hidden">
                                <div className="p-4 sm:p-5 border-b border-amber-100 bg-amber-50/60">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-extrabold text-gray-900 text-sm">متابعة سداد الدورة</h3>
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold">
                                            {unpaidData.unpaidCount} متأخر
                                        </Badge>
                                    </div>

                                    {/* Progress rate */}
                                    <div className="mt-3.5 space-y-1.5">
                                        <div className="flex justify-between text-xs text-gray-600 font-semibold">
                                            <span>تم السداد: {unpaidData.paidCount}</span>
                                            <span>نسبة التحصيل: {unpaidData.totalActive > 0 ? Math.round((unpaidData.paidCount / unpaidData.totalActive) * 100) : 0}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="h-2.5 bg-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${unpaidData.totalActive > 0 ? (unpaidData.paidCount / unpaidData.totalActive) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">الطلاب المسجلين: <strong>{unpaidData.totalActive}</strong></span>
                                        <button
                                            onClick={() => setShowUnpaidList(v => !v)}
                                            className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1"
                                        >
                                            {showUnpaidList ? <>إخفاء القائمة <ChevronUp className="h-3.5 w-3.5" /></> : <>عرض المتأخرين <ChevronDown className="h-3.5 w-3.5" /></>}
                                        </button>
                                    </div>

                                    {showUnpaidList && (
                                        <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto pt-2">
                                            {isLoadingList ? (
                                                <div className="py-6 text-center text-xs text-amber-600 font-bold animate-pulse">
                                                    جارٍ تحميل أسماء المتأخرين...
                                                </div>
                                            ) : (unpaidListData?.students ?? []).map((st: any) => (
                                                <div key={st._id} className="py-2.5 flex items-center justify-between text-xs">
                                                    <div>
                                                        <p className="font-bold text-gray-900">{st.studentName}</p>
                                                        <p className="text-[11px] text-gray-400">{(st.groupId as any)?.name || 'مجموعة'} · {st.gradeLevel}</p>
                                                    </div>
                                                    <Link href={`/students/${st._id}`} className="text-primary font-bold hover:underline">
                                                        الملف
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 5. Financial & Academic Intelligence Charts (Teacher Only) ── */}
                    {isTeacher && stats?.charts && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    تحليلات الأداء والنمو
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                <IncomeTrendChart data={stats.charts.incomeTrend || []} />
                                <AttendanceTrendChart data={stats.charts.attendanceTrend || []} />
                                <StudentsDistributionChart data={stats.charts.studentsPerGroup || []} totalStudents={stats.totalStudents || 0} />
                                <ExpensesBreakdownChart data={stats.charts.expensesBreakdown || []} totalExpenses={stats.financial?.totalExpenses ?? 0} />
                            </div>
                        </div>
                    )}

                    {/* ── 6. Live Activity Stream ── */}
                    {stats?.recentActivities && stats.recentActivities.length > 0 && (
                        <RecentActivity activities={stats.recentActivities} />
                    )}
                </div>
            </div>

            {/* Modals */}
            <BulkSubscriptionModal open={showBulkSub} onOpenChange={setShowBulkSub} />
            <QuickNotebookSaleModal open={showNbSale} onOpenChange={setShowNbSale} />
        </div>
    );
}

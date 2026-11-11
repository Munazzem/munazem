'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Users, BookOpen, TrendingUp, AlertTriangle,
    UserCheck, UserX, BarChart2, RefreshCw,
    ArrowUpRight, Server, Cpu, Clock, Zap, Play,
    Activity, ChevronRight,
} from 'lucide-react';
import { fetchAdminStats, fetchGrowthData, fetchAdminErrors, fetchAdminHealth } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/store/auth.store';
import { LiveActiveUsersWidget } from '@/components/admin/LiveActiveUsersWidget';

// ── Modern KPI Stat Card ──────────────────────────────────────────
function StatCard({
    icon: Icon, label, value, sub, color = 'blue', href,
}: {
    icon: any; label: string; value: string | number; sub?: string;
    color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
    href?: string;
}) {
    const colors = {
        blue:   'bg-blue-50/80   text-blue-600   border-blue-100',
        green:  'bg-emerald-50/80  text-emerald-600  border-emerald-100',
        red:    'bg-rose-50/80    text-rose-600    border-rose-100',
        orange: 'bg-amber-50/80 text-amber-600 border-amber-100',
        purple: 'bg-indigo-50/80 text-indigo-600 border-indigo-100',
        gray:   'bg-slate-50/80   text-slate-600   border-slate-100',
    };
    const router = useRouter();
    return (
        <div
            onClick={() => href && router.push(href)}
            className={`bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3 transition-all ${
                href ? 'cursor-pointer hover:shadow-md hover:border-slate-200 group' : ''
            }`}
        >
            <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-2xl border ${colors[color]} shrink-0`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                {href && <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />}
            </div>
            <div>
                <p className="text-xs sm:text-sm text-slate-500 font-bold truncate">{label}</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono tracking-tight">
                    {typeof value === 'number' ? value.toLocaleString('en-US') : value}
                </p>
                {sub && <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>}
            </div>
        </div>
    );
}

// ── Skeleton Loader ──────────────────────────────────────────────
function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-2xs h-28 animate-pulse flex flex-col justify-between">
                    <div className="w-8 h-8 bg-slate-100 rounded-xl" />
                    <div className="space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                        <div className="h-6 bg-slate-100 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Level Badge ───────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
    const map: Record<string, string> = {
        critical: 'bg-rose-100 text-rose-700 border border-rose-200',
        error:    'bg-rose-50 text-rose-600 border border-rose-100',
        warn:     'bg-amber-100 text-amber-700 border border-amber-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${map[level] ?? 'bg-slate-100 text-slate-600'}`}>
            {level}
        </span>
    );
}

// ── Main Overview Page ────────────────────────────────────────────
export default function AdminOverviewPage() {
    const user   = useAuthStore(s => s.user);
    const router = useRouter();

    const isSuperAdmin = user?.role === 'superAdmin';

    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['admin-stats'],
        queryFn:  fetchAdminStats,
        enabled:  isSuperAdmin,
        refetchInterval: 60_000,
    });

    const { data: growth } = useQuery({
        queryKey: ['admin-growth'],
        queryFn:  fetchGrowthData,
        enabled:  isSuperAdmin,
    });

    const { data: errorsData } = useQuery({
        queryKey: ['admin-errors', { limit: 10 }],
        queryFn:  () => fetchAdminErrors({ limit: 10 }),
        enabled:  isSuperAdmin,
        refetchInterval: 30_000,
    });

    const { data: health, isFetching: healthFetching } = useQuery({
        queryKey: ['admin-health'],
        queryFn:  fetchAdminHealth,
        enabled:  isSuperAdmin,
        refetchInterval: 30_000,
    });

    if (user?.role !== 'superAdmin') {
        router.replace('/dashboard');
        return null;
    }

    const errors = errorsData?.data ?? [];

    return (
        <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">لوحة الإدارة والتحكم الشامل</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">نظرة لحظية على أداء ونشاط منصة مُنظّم</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <button
                        onClick={() => router.push('/admin/monitoring')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-primary hover:text-white hover:bg-primary transition-all bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5 shadow-2xs"
                    >
                        <Play className="h-3.5 w-3.5" />
                        مراقبة الواتساب
                    </button>
                    <button
                        onClick={() => refetchStats()}
                        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary transition-colors bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 shadow-2xs"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        تحديث
                    </button>
                </div>
            </div>

            {/* Live Presence Active Users Widget */}
            <LiveActiveUsersWidget />

            {/* KPI Cards Grid */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <StatCard
                        icon={Users} label="إجمالي المعلمين" color="blue"
                        value={stats.totalTeachers}
                        sub={`${stats.newTeachersThisMonth} جديد هذا الشهر`}
                        href="/admin/tenants"
                    />
                    <StatCard
                        icon={UserCheck} label="معلمون نشطون" color="green"
                        value={stats.activeTeachers}
                        sub={`${stats.inactiveTeachers} موقوف`}
                        href="/admin/tenants?status=active"
                    />
                    <StatCard
                        icon={BookOpen} label="إجمالي الطلاب" color="purple"
                        value={stats.totalStudents}
                        sub="في كل المجموعات"
                    />
                    <StatCard
                        icon={TrendingUp} label="الدخل الشهري (MRR)" color="green"
                        value={`${stats.mrr?.toLocaleString('en-US') ?? 0} ج.م`}
                        sub={`إيرادات الشهر: ${stats.monthlyRevenue?.toLocaleString('en-US') ?? 0} ج.م`}
                    />
                    <StatCard
                        icon={UserX} label="معدل الإلغاء (Churn)" color="orange"
                        value={`${stats.churnRate ?? 0}%`}
                        sub="آخر 30 يوم"
                    />
                    <StatCard
                        icon={UserCheck} label="اشتراكات نشطة" color="blue"
                        value={stats.activeSubscriptions}
                        sub="سارية المفعول"
                    />
                    <StatCard
                        icon={AlertTriangle} label="أخطاء هذا الشهر" color="red"
                        value={stats.recentErrorsThisMonth}
                        href="/admin/logs"
                    />
                    <StatCard
                        icon={BarChart2} label="نمو المعلمين" color="gray"
                        value={`+${stats.newTeachersThisMonth}`}
                        sub="هذا الشهر"
                    />
                </div>
            ) : null}

            {/* Server Health Widget */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <Server className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">صحة واستقرار الخادم (Server Health)</h2>
                            <p className="text-xs text-slate-400">استهلاك الذاكرة وأداء المعالجة</p>
                        </div>
                    </div>
                    {healthFetching && (
                        <span className="text-xs text-slate-400 animate-pulse">جارٍ التحديث...</span>
                    )}
                </div>

                {health ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Memory Heap */}
                        <div className="space-y-2 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="flex items-center gap-1 font-bold"><Cpu className="h-3.5 w-3.5 text-slate-400" /> ذاكرة Heap</span>
                                <span className="font-mono font-bold text-slate-800">{health.memory.heapUsedMB} / {health.memory.heapTotalMB} MB</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        health.memory.heapPct > 85 ? 'bg-rose-500' :
                                        health.memory.heapPct > 65 ? 'bg-amber-400' :
                                        'bg-emerald-500'
                                    }`}
                                    style={{ width: `${health.memory.heapPct}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono text-left">{health.memory.heapPct}% مستخدم</p>
                        </div>

                        {/* Errors summary */}
                        <div className="flex gap-2.5">
                            <div className="flex-1 bg-slate-50/70 rounded-2xl p-4 text-center border border-slate-100 flex flex-col justify-center">
                                <p className="text-xs text-slate-400 font-medium">أخطاء آخر ساعة</p>
                                <p className={`text-2xl font-black mt-1 font-mono ${
                                    health.errors.lastHour > 5 ? 'text-rose-600' :
                                    health.errors.lastHour > 0 ? 'text-amber-500' :
                                    'text-emerald-600'
                                }`}>{health.errors.lastHour}</p>
                            </div>
                            <div className="flex-1 bg-slate-50/70 rounded-2xl p-4 text-center border border-slate-100 flex flex-col justify-center">
                                <p className="text-xs text-slate-400 font-medium">أخطاء آخر 24 ساعة</p>
                                <p className={`text-2xl font-black mt-1 font-mono ${
                                    health.errors.last24h > 20 ? 'text-rose-600' :
                                    health.errors.last24h > 5  ? 'text-amber-500' :
                                    'text-emerald-600'
                                }`}>{health.errors.last24h}</p>
                            </div>
                        </div>

                        {/* Uptime Box */}
                        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex flex-col justify-center items-center gap-1 text-center">
                            <Clock className="h-5 w-5 text-primary/70" />
                            <p className="text-xs text-slate-500 font-medium mt-1">مدة تشغيل النظام المستمر</p>
                            <p className="text-base font-extrabold text-primary">{health.uptimeHuman}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[11px] text-emerald-700 font-bold">الخادم متصل ومستقر</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" />
                )}
            </div>

            {/* Top Teachers & Expiring Subscriptions Grid */}
            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Top Teachers */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="p-2.5 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <Users className="h-4 w-4 text-indigo-600" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">أكثر المعلمين نشاطاً (بالطلاب)</h2>
                        </div>
                        <div className="space-y-2.5">
                            {stats.topTeachers?.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">لا توجد بيانات كافية</p>
                            ) : (
                                stats.topTeachers?.map((teacher, idx) => (
                                    <div
                                        key={teacher._id}
                                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/admin/tenants/${teacher._id}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{teacher.name}</p>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{teacher.phone}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-black text-slate-900">{teacher.studentCount}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">طالب</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Expiring Soon */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-100">
                                    <Clock className="h-4 w-4 text-amber-600" />
                                </div>
                                <h2 className="text-base font-bold text-slate-800">اشتراكات تقترب من الانتهاء</h2>
                            </div>
                            <span className="text-xs text-slate-400 font-medium">خلال 15 يوم</span>
                        </div>
                        <div className="space-y-2.5">
                            {stats.expiringSoon?.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">لا توجد اشتراكات تنتهي قريباً 🎉</p>
                            ) : (
                                stats.expiringSoon?.map((sub) => {
                                    const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                    return (
                                        <div
                                            key={sub._id}
                                            className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/admin/tenants/${sub.teacher?._id}`)}
                                        >
                                            <div className="flex flex-col">
                                                <p className="text-sm font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">{sub.teacher?.name || 'غير معروف'}</p>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">{sub.teacher?.phone || '-'}</p>
                                            </div>
                                            <div className="text-left flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{sub.planTier}</span>
                                                <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${daysLeft <= 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    باقي {daysLeft} أيام
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

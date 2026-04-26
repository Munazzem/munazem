'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Users, BookOpen, TrendingUp, AlertTriangle,
    UserCheck, UserX, BarChart2, RefreshCw,
    ArrowUpRight, Server, Cpu, Clock, Zap,
} from 'lucide-react';
import { fetchAdminStats, fetchGrowthData, fetchAdminErrors, fetchAdminHealth } from '@/lib/api/admin';
import { useAuthStore } from '@/lib/store/auth.store';

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({
    icon: Icon, label, value, sub, color = 'blue', href,
}: {
    icon: any; label: string; value: string | number; sub?: string;
    color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
    href?: string;
}) {
    const colors = {
        blue:   'bg-blue-50   text-blue-600   border-blue-100',
        green:  'bg-green-50  text-green-600  border-green-100',
        red:    'bg-red-50    text-red-600    border-red-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        gray:   'bg-gray-50   text-gray-600   border-gray-100',
    };
    const router = useRouter();
    return (
        <div
            onClick={() => href && router.push(href)}
            className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start gap-4 ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
            <div className={`p-3 rounded-xl border ${colors[color]}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{value.toLocaleString()}</p>
                {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
            </div>
            {href && <ArrowUpRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />}
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────
function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-28 animate-pulse">
                    <div className="flex gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                        <div className="flex-1 space-y-2 pt-1">
                            <div className="h-3 bg-gray-100 rounded w-2/3" />
                            <div className="h-6 bg-gray-100 rounded w-1/2" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Level Badge ───────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
    const map: Record<string, string> = {
        critical: 'bg-red-100 text-red-700 border border-red-200',
        error:    'bg-orange-100 text-orange-700 border border-orange-200',
        warn:     'bg-yellow-100 text-yellow-700 border border-yellow-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[level] ?? 'bg-gray-100 text-gray-600'}`}>
            {level}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AdminOverviewPage() {
    const user   = useAuthStore(s => s.user);
    const router = useRouter();

    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['admin-stats'],
        queryFn:  fetchAdminStats,
        refetchInterval: 60_000,
    });

    const { data: growth } = useQuery({
        queryKey: ['admin-growth'],
        queryFn:  fetchGrowthData,
    });

    const { data: errorsData } = useQuery({
        queryKey: ['admin-errors', { limit: 10 }],
        queryFn:  () => fetchAdminErrors({ limit: 10 }),
        refetchInterval: 30_000,
    });

    const { data: health, isFetching: healthFetching } = useQuery({
        queryKey: ['admin-health'],
        queryFn:  fetchAdminHealth,
        refetchInterval: 30_000,
    });

    if (user?.role !== 'superAdmin') {
        router.replace('/dashboard');
        return null;
    }

    const errors = errorsData?.data ?? [];

    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم الإدارة</h1>
                    <p className="text-sm text-gray-500 mt-1">نظرة عامة على المنصة</p>
                </div>
                <button
                    onClick={() => refetchStats()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors bg-white border border-gray-200 rounded-xl px-4 py-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    تحديث
                </button>
            </div>

            {/* KPI Cards */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    />
                    <StatCard
                        icon={BookOpen} label="إجمالي الطلاب" color="purple"
                        value={stats.totalStudents}
                    />
                    <StatCard
                        icon={TrendingUp} label="إيرادات الشهر" color="green"
                        value={`${stats.monthlyRevenue.toLocaleString()} ج`}
                    />
                    <StatCard
                        icon={UserCheck} label="اشتراكات نشطة" color="green"
                        value={stats.activeSubscriptions}
                    />
                    <StatCard
                        icon={UserX} label="اشتراكات منتهية" color="orange"
                        value={stats.expiredSubscriptions}
                    />
                    <StatCard
                        icon={AlertTriangle} label="أخطاء هذا الشهر" color="red"
                        value={stats.recentErrorsThisMonth}
                        href="/admin/errors"
                    />
                    <StatCard
                        icon={BarChart2} label="نمو المعلمين" color="gray"
                        value={`+${stats.newTeachersThisMonth}`}
                        sub="هذا الشهر"
                    />
                </div>
            ) : null}

            {/* Server Health Widget */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-green-50 rounded-xl border border-green-100">
                            <Server className="h-4 w-4 text-green-600" />
                        </div>
                        <h2 className="text-base font-bold text-gray-800">صحة الخادم</h2>
                        {healthFetching && (
                            <span className="text-xs text-gray-400 animate-pulse">جارٍ التحديث...</span>
                        )}
                    </div>
                    <span className="text-xs text-gray-400">يتحدث كل 30 ثانية</span>
                </div>

                {health ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Memory Bar */}
                        <div className="sm:col-span-1 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> ذاكرة Heap</span>
                                <span className="font-semibold text-gray-700">{health.memory.heapUsedMB} / {health.memory.heapTotalMB} MB</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        health.memory.heapPct > 85 ? 'bg-red-500' :
                                        health.memory.heapPct > 65 ? 'bg-orange-400' :
                                        'bg-green-500'
                                    }`}
                                    style={{ width: `${health.memory.heapPct}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 text-left">{health.memory.heapPct}% مستخدم</p>
                        </div>

                        {/* RSS Memory */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> الذاكرة الكلية (RSS)</span>
                                <span className="font-semibold text-gray-700">{health.memory.rssMB} MB</span>
                            </div>
                            <div className="flex gap-3 mt-3">
                                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                                    <p className="text-xs text-gray-400">أخطاء آخر ساعة</p>
                                    <p className={`text-xl font-bold mt-1 ${
                                        health.errors.lastHour > 5 ? 'text-red-600' :
                                        health.errors.lastHour > 0 ? 'text-orange-500' :
                                        'text-green-600'
                                    }`}>{health.errors.lastHour}</p>
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                                    <p className="text-xs text-gray-400">أخطاء آخر 24 ساعة</p>
                                    <p className={`text-xl font-bold mt-1 ${
                                        health.errors.last24h > 20 ? 'text-red-600' :
                                        health.errors.last24h > 5  ? 'text-orange-500' :
                                        'text-green-600'
                                    }`}>{health.errors.last24h}</p>
                                </div>
                            </div>
                        </div>

                        {/* Uptime */}
                        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10 flex flex-col justify-center items-center gap-1">
                            <Clock className="h-5 w-5 text-primary/70" />
                            <p className="text-xs text-gray-500 mt-1">وقت التشغيل</p>
                            <p className="text-lg font-bold text-primary text-center">{health.uptimeHuman}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs text-green-600 font-medium">الخادم يعمل</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-24 bg-gray-50 rounded-xl animate-pulse" />
                )}
            </div>

            {/* Growth Chart */}
            {growth && growth.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-base font-bold text-gray-800 mb-4">نمو المعلمين الجدد (آخر 6 أشهر)</h2>
                    <div className="flex items-end gap-3 h-32">
                        {growth.map((g) => {
                            const maxVal = Math.max(...growth.map(x => x.count), 1);
                            const pct    = Math.round((g.count / maxVal) * 100);
                            return (
                                <div key={g.label} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold text-gray-700">{g.count}</span>
                                    <div
                                        className="w-full bg-primary/80 rounded-t-lg transition-all"
                                        style={{ height: `${Math.max(pct, 4)}%` }}
                                    />
                                    <span className="text-[10px] text-gray-400">{g.label.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent Errors */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-800">آخر الأخطاء</h2>
                    <button
                        onClick={() => router.push('/admin/errors')}
                        className="text-xs text-primary hover:underline"
                    >
                        عرض الكل
                    </button>
                </div>
                {errors.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4 text-center">لا توجد أخطاء حديثة 🎉</p>
                ) : (
                    <div className="space-y-2">
                        {errors.map((e) => (
                            <div key={e._id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                                <LevelBadge level={e.level} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{e.message}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{e.method} {e.path}</p>
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">
                                    {new Date(e.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

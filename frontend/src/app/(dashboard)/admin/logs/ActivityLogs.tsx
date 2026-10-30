'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Activity, RefreshCw, ChevronLeft, ChevronRight,
    LogIn, UserPlus, UserMinus, Wallet, Receipt,
    CheckCircle2, CalendarPlus, ShieldAlert,
    Filter, Users, Building2, GraduationCap,
} from 'lucide-react';
import { fetchActivityFeed, fetchTenants } from '@/lib/api/admin';
import type { ActivityLogEntry } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';

// ── Event catalog: icon, color, Arabic label ─────────────────────
const EVENT_CONFIG: Record<string, {
    icon: typeof Activity;
    color: string;
    bg: string;
    border: string;
    label: string;
}> = {
    user_login:         { icon: LogIn,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100',   label: 'تسجيل دخول'  },
    user_login_failed:  { icon: ShieldAlert,  color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',   label: 'دخول فاشل'    },
    student_created:    { icon: UserPlus,     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100',label: 'إضافة طالب'   },
    student_deleted:    { icon: UserMinus,    color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100', label: 'حذف طالب'     },
    payment_recorded:   { icon: Wallet,       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100',label: 'تسجيل دفعة'  },
    expense_recorded:   { icon: Receipt,      color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',   label: 'تسجيل مصروف' },
    session_completed:  { icon: CheckCircle2, color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100', label: 'إنهاء حصة'   },
    sessions_generated: { icon: CalendarPlus, color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100', label: 'توليد حصص'   },
};

const ALL_EVENTS = Object.keys(EVENT_CONFIG);

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `من ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `من ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `من ${days} يوم`;
    return new Date(dateStr).toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function describeEvent(entry: ActivityLogEntry): string {
    const meta = (entry.meta || {}) as Record<string, unknown>;
    switch (entry.event) {
        case 'user_login':
            return `${(meta.name as string) || 'مستخدم'} سجّل دخول (${(meta.role as string) === 'teacher' ? 'معلم' : (meta.role as string) === 'assistant' ? 'مساعد' : (meta.role as string) || ''})`;
        case 'user_login_failed':
            return `محاولة دخول فاشلة — ${(meta.reason as string) === 'invalid_password' ? 'كلمة مرور خاطئة' : 'سبب غير معروف'}`;
        case 'student_created':
            return `تم إضافة الطالب "${(meta.studentName as string) || ''}" (${(meta.studentCode as string) || ''}) في ${(meta.groupName as string) || 'مجموعة'}`;
        case 'student_deleted':
            return `تم حذف الطالب "${(meta.studentName as string) || ''}" (${(meta.studentCode as string) || ''})`;
        case 'payment_recorded':
            return `دفعة ${(meta.paidAmount as number)?.toLocaleString('en-US') || '0'} ج.م — ${(meta.studentName as string) || 'طالب'}`;
        case 'expense_recorded':
            return `مصروف ${(meta.amount as number)?.toLocaleString('en-US') || '0'} ج.م — ${(meta.category as string) || ''}`;
        case 'session_completed': {
            const p = (meta.presentCount as number) ?? 0;
            const a = (meta.absentCount as number) ?? 0;
            return `تم إنهاء حصة (${p} حاضر، ${a} غائب)`;
        }
        case 'sessions_generated': {
            const t = (meta.type as string) === 'week' ? 'أسبوعي' : 'شهري';
            return `توليد ${t} — ${(meta.createdCount as number) ?? 0} حصة جديدة`;
        }
        default:
            return entry.event;
    }
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
    const config = EVENT_CONFIG[entry.event] || {
        icon: Activity,
        color: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-100',
        label: entry.event,
    };
    const Icon = config.icon;

    return (
        <div className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
            <div className={`p-2 rounded-xl ${config.bg} border ${config.border} shrink-0 mt-0.5`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${config.bg} ${config.color} border ${config.border}`}>
                        {config.label}
                    </span>
                    {entry.teacherName && (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate">
                            {entry.teacherName}
                        </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono mr-auto">
                        {timeAgo(entry.createdAt)}
                    </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    {describeEvent(entry)}
                </p>
            </div>
        </div>
    );
}

export default function ActivityFeedPage() {
    const [eventFilter, setEventFilter] = useState('');
    const [teacherFilter, setTeacherFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data: teachersData } = useQuery({
        queryKey: ['admin-tenants-list-short'],
        queryFn: () => fetchTenants({ limit: 150 }),
    });

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['admin-activity', { event: eventFilter, tenantId: teacherFilter, page }],
        queryFn:  () => fetchActivityFeed({
            event: eventFilter || undefined,
            tenantId: teacherFilter || undefined,
            page,
            limit: 30,
        }),
        refetchInterval: 30_000,
    });

    const logs       = data?.data ?? [];
    const pagination = data?.pagination;
    const teachers   = teachersData?.data ?? [];

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">سجل نشاط المنصة</h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {pagination ? `${pagination.total} حدث مسجل` : ''}
                            {' — '}يتحدث تلقائياً كل 30 ثانية
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary transition-colors bg-white border border-slate-200 rounded-xl px-3.5 py-2 disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    تحديث
                </button>
            </div>

            {/* Filter Bar with Teacher Selector */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">تصفية الأحداث بحسب المعلم أو نوع العملية:</span>
                    </div>

                    {/* Teacher Dropdown Selector */}
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                            value={teacherFilter}
                            onChange={(e) => { setTeacherFilter(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-60"
                        >
                            <option value="">كل المعلمين والسناتر</option>
                            {teachers.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name} {t.centerName ? `(${t.centerName})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Event Type Filter Chips */}
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => { setEventFilter(''); setPage(1); }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                            eventFilter === ''
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                        }`}
                    >
                        الكل
                    </button>
                    {ALL_EVENTS.map(evt => {
                        const cfg = EVENT_CONFIG[evt]!;
                        return (
                            <button
                                key={evt}
                                onClick={() => { setEventFilter(evt); setPage(1); }}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
                                    eventFilter === evt
                                        ? 'bg-primary text-white border-primary shadow-xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                                }`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-slate-50 p-4 space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 space-y-2">
                        <Activity className="h-10 w-10 mx-auto text-slate-200" />
                        <p className="text-sm font-semibold">لا توجد أحداث مسجلة مطابقة للفلتر</p>
                    </div>
                ) : (
                    <div>
                        {logs.map(entry => <ActivityRow key={entry._id} entry={entry} />)}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3.5 border-t border-slate-100 bg-slate-50/50">
                        <span className="text-xs text-slate-500 font-medium">
                            صفحة {pagination.page} من {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl h-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages} className="rounded-xl h-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Activity, RefreshCw, ChevronLeft, ChevronRight,
    LogIn, UserPlus, UserMinus, Wallet, Receipt,
    CheckCircle2, CalendarPlus, ShieldAlert,
} from 'lucide-react';
import { fetchActivityFeed } from '@/lib/api/admin';
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
    user_login:         { icon: LogIn,        color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100',   label: 'تسجيل دخول'       },
    user_login_failed:  { icon: ShieldAlert,  color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-100',    label: 'دخول فاشل'         },
    student_created:    { icon: UserPlus,     color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100',label: 'إضافة طالب'        },
    student_deleted:    { icon: UserMinus,    color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100', label: 'حذف طالب'          },
    payment_recorded:   { icon: Wallet,       color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-100',  label: 'تسجيل دفعة'       },
    expense_recorded:   { icon: Receipt,      color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-100',   label: 'تسجيل مصروف'      },
    session_completed:  { icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100', label: 'إنهاء حصة'        },
    sessions_generated: { icon: CalendarPlus, color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100', label: 'توليد حصص'        },
};

const ALL_EVENTS = Object.keys(EVENT_CONFIG);

// ── Relative time helper ────────────────────────────────────────
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60)   return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)   return `من ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)     return `من ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7)       return `من ${days} يوم`;
    return new Date(dateStr).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

// ── Build human-readable description from meta ──────────────────
function describeEvent(entry: ActivityLogEntry): string {
    const meta = entry.meta || {};
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
            return `دفعة ${(meta.paidAmount as number)?.toLocaleString('ar-EG') || '0'} ج.م — ${(meta.studentName as string) || 'طالب'}`;
        case 'expense_recorded':
            return `مصروف ${(meta.amount as number)?.toLocaleString('ar-EG') || '0'} ج.م — ${(meta.category as string) || ''}`;
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

// ── Single activity row ─────────────────────────────────────────
function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
    const config = EVENT_CONFIG[entry.event] || {
        icon: Activity,
        color: 'text-gray-600',
        bg: 'bg-gray-50',
        border: 'border-gray-100',
        label: entry.event,
    };
    const Icon = config.icon;

    return (
        <div className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
            {/* Icon */}
            <div className={`p-2 rounded-xl ${config.bg} border ${config.border} shrink-0 mt-0.5`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
                        {config.label}
                    </span>
                    {entry.teacherName && (
                        <span className="text-xs text-gray-400 truncate">
                            {entry.teacherName}
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                    {describeEvent(entry)}
                </p>
            </div>

            {/* Time */}
            <span className="text-xs text-gray-400 shrink-0 mt-1 whitespace-nowrap">
                {timeAgo(entry.createdAt)}
            </span>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ActivityFeedPage() {
    const [eventFilter, setEventFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['admin-activity', { event: eventFilter, page }],
        queryFn:  () => fetchActivityFeed({
            event: eventFilter || undefined,
            page,
            limit: 30,
        }),
        refetchInterval: 30_000,
    });

    const logs       = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                        <Activity className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">سجل النشاط</h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {pagination ? `${pagination.total} حدث مسجل` : ''}
                            {' — '}يتحدث كل 30 ثانية
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors bg-white border border-gray-200 rounded-xl px-4 py-2 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    تحديث
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { setEventFilter(''); setPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            eventFilter === ''
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
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
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                                    eventFilter === evt
                                        ? 'bg-primary text-white border-primary'
                                        : `bg-white text-gray-600 border-gray-200 hover:border-primary/40`
                                }`}
                            >
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Activity List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-gray-50">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-4">
                                <div className="h-9 w-9 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                                    <div className="h-3 w-48 bg-gray-50 rounded animate-pulse" />
                                </div>
                                <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 space-y-2">
                        <Activity className="h-10 w-10 mx-auto text-gray-200" />
                        <p>لا توجد أحداث مسجلة بعد</p>
                        <p className="text-xs">ستظهر هنا عند حدوث أي نشاط في النظام</p>
                    </div>
                ) : (
                    <div>
                        {logs.map(entry => <ActivityRow key={entry._id} entry={entry} />)}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                            صفحة {pagination.page} من {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

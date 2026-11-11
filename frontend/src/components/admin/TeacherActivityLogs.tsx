'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    LogIn,
    UserPlus,
    UserMinus,
    Wallet,
    Receipt,
    CheckCircle2,
    CalendarPlus,
    ShieldAlert,
    User,
} from 'lucide-react';
import { fetchTenantActivity } from '@/lib/api/admin';
import type { ActivityLogEntry } from '@/types/admin.types';
import { Button } from '@/components/ui/button';

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
            return `سجّل الدخول إلى النظام (${(meta.role as string) === 'teacher' ? 'المعلم' : (meta.role as string) === 'assistant' ? 'مساعد' : (meta.role as string) || ''})`;
        case 'user_login_failed':
            return `محاولة دخول فاشلة — ${(meta.reason as string) === 'invalid_password' ? 'كلمة مرور خاطئة' : 'سبب غير معروف'}`;
        case 'student_created':
            return `تم إضافة الطالب "${(meta.studentName as string) || ''}" (${(meta.studentCode as string) || ''}) في ${(meta.groupName as string) || 'مجموعة'}`;
        case 'student_deleted':
            return `تم حذف الطالب "${(meta.studentName as string) || ''}" (${(meta.studentCode as string) || ''})`;
        case 'payment_recorded':
            return `سداد مبلغ ${(meta.paidAmount as number)?.toLocaleString('en-US') || '0'} ج.م — للطالب ${(meta.studentName as string) || ''}`;
        case 'expense_recorded':
            return `تسجيل مصروف بقيمة ${(meta.amount as number)?.toLocaleString('en-US') || '0'} ج.م — بند: ${(meta.category as string) || ''}`;
        case 'session_completed': {
            const p = (meta.presentCount as number) ?? 0;
            const a = (meta.absentCount as number) ?? 0;
            return `تم إنهاء الحصة وتسجيل الحضور (${p} حاضر، ${a} غائب)`;
        }
        case 'sessions_generated': {
            const t = (meta.type as string) === 'week' ? 'أسبوعي' : 'شهري';
            return `توليد جدول حصص ${t} — ${(meta.createdCount as number) ?? 0} حصة جديدة`;
        }
        default:
            return entry.event;
    }
}

export function TeacherActivityLogs({ tenantId, teacherName }: { tenantId: string; teacherName?: string }) {
    const [eventFilter, setEventFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['admin-tenant-activity', tenantId, { event: eventFilter, page }],
        queryFn: () => fetchTenantActivity(tenantId, {
            event: eventFilter || undefined,
            page,
            limit: 20,
        }),
        refetchInterval: 30_000,
    });

    const logs = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-4" dir="rtl">
            {/* Header / Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">
                            سجل العمليات والنشاط الخاص بحساب: {teacherName || 'المعلم'}
                        </h3>
                        <p className="text-xs text-slate-400">
                            {pagination ? `${pagination.total} عملية مسجلة` : ''} — يتم التحديث كل 30 ثانية
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary transition-colors bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        تحديث
                    </button>
                </div>
            </div>

            {/* Event Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => { setEventFilter(''); setPage(1); }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                        eventFilter === ''
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                    }`}
                >
                    كل العمليات
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

            {/* Log Stream */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-slate-50 p-4 space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 space-y-2">
                        <Activity className="w-8 h-8 mx-auto text-slate-200" />
                        <p className="text-sm font-medium">لا توجد عمليات مسجلة لهذا المعلم بعد</p>
                        <p className="text-xs text-slate-400">أي حركة يقوم بها المعلم أو مساعدوه ستظهر هنا فورياً</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {logs.map((entry) => {
                            const config = EVENT_CONFIG[entry.event] || {
                                icon: Activity,
                                color: 'text-slate-600',
                                bg: 'bg-slate-50',
                                border: 'border-slate-100',
                                label: entry.event,
                            };
                            const Icon = config.icon;
                            const actorName = (entry as any).actorName || 'المعلم';

                            return (
                                <div
                                    key={entry._id}
                                    className="p-3.5 sm:p-4 hover:bg-slate-50/50 transition-colors flex items-start gap-3"
                                >
                                    <div className={`p-2 rounded-xl ${config.bg} border ${config.border} shrink-0 mt-0.5`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${config.bg} ${config.color} border ${config.border}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-400" />
                                                {actorName}
                                            </span>
                                            <span className="text-xs text-slate-400 mr-auto font-mono">
                                                {timeAgo(entry.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                                            {describeEvent(entry)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                        <span className="text-xs text-slate-500 font-medium">
                            صفحة {pagination.page} من {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded-xl h-8 text-xs"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= pagination.totalPages}
                                className="rounded-xl h-8 text-xs"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

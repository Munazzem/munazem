'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchActiveUsers, type ActiveUserSession } from '@/lib/api/admin';
import { Users, Activity, ExternalLink, Smartphone, Globe, Shield, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

function formatRoute(route?: string): string {
    if (!route) return 'لوحة التحكم';
    if (route.includes('/students')) return 'إدارة الطلاب';
    if (route.includes('/attendance')) return 'تسجيل الحضور';
    if (route.includes('/groups')) return 'المجموعات';
    if (route.includes('/sessions')) return 'الحصص';
    if (route.includes('/reports')) return 'التقارير المالية';
    if (route.includes('/exams')) return 'الامتحانات';
    if (route.includes('/smart-card')) return 'الكرت الذكي';
    if (route.includes('/admin')) return 'لوحة الإدارة';
    return route;
}

function timeSince(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 30) return 'متصل الآن 🟢';
    if (diff < 60) return 'منذ دقيقة';
    const mins = Math.floor(diff / 60);
    return `منذ ${mins} د`;
}

export function LiveActiveUsersWidget() {
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['admin-active-users'],
        queryFn: fetchActiveUsers,
        refetchInterval: 15_000, // Refresh every 15s
    });

    const activeUsers = data?.activeUsers ?? [];
    const totalActive = data?.totalActive ?? 0;

    const teacherCount = activeUsers.filter(u => u.role === 'teacher').length;
    const assistantCount = activeUsers.filter(u => u.role === 'assistant').length;
    const centerCount = activeUsers.filter(u => u.role === 'centerOwner' || u.role === 'centerSupervisor').length;

    return (
        <div className="bg-white rounded-3xl border border-slate-100/80 shadow-xs overflow-hidden transition-all hover:shadow-md" dir="rtl">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-l from-slate-50/70 to-white">
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <span className="absolute flex h-3 w-3 top-1 right-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">المتواجدون حالياً على المنصة</h2>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                                {totalActive} متصل
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">تحديث تلقائي وفوري كل 15 ثانية عبر الجلسات النشطة</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Role breakdown chips */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">معلمون: {teacherCount}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">مساعدون: {assistantCount}</span>
                        {centerCount > 0 && <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">سناتر: {centerCount}</span>}
                    </div>

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        title="تحديث فوري"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-primary' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Content List */}
            <div className="p-4 sm:p-5">
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
                        ))}
                    </div>
                ) : activeUsers.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 space-y-2">
                        <Activity className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">لا يوجد مستخدمون نشطون حالياً</p>
                        <p className="text-xs text-slate-400">ستظهر هنا أي جلسات مفتوحة للمعلمين أو المساعدين فور استخدامهم المنصة</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {activeUsers.map(session => {
                            const isTeacher = session.role === 'teacher';
                            const isAssistant = session.role === 'assistant';
                            const isCenter = session.role === 'centerOwner' || session.role === 'centerSupervisor';
                            const targetTenantId = isTeacher ? session.userId : session.teacherId;

                            return (
                                <div
                                    key={session.userId}
                                    className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-slate-300/80 hover:shadow-xs transition-all flex flex-col justify-between gap-3 group relative overflow-hidden"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                                            isTeacher ? 'bg-primary/10 text-primary border border-primary/20' :
                                            isAssistant ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                            'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                        }`}>
                                            {session.name?.charAt(0) || 'م'}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {session.name}
                                                </p>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                                    isTeacher ? 'bg-primary/10 text-primary' :
                                                    isAssistant ? 'bg-amber-100 text-amber-800' :
                                                    'bg-indigo-100 text-indigo-800'
                                                }`}>
                                                    {isTeacher ? 'معلم' : isAssistant ? 'مساعد' : 'سنتر'}
                                                </span>
                                            </div>

                                            {/* Sub text */}
                                            {isAssistant && session.teacherName && (
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    مساعد لدى: <span className="text-slate-600 font-medium">{session.teacherName}</span>
                                                </p>
                                            )}
                                            {session.centerName && (
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    {session.centerName}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                                                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 font-medium">
                                                    <Globe className="w-3 h-3 text-slate-400" />
                                                    {formatRoute(session.currentRoute)}
                                                </span>
                                                <span className="text-[10px] text-emerald-600 font-bold">
                                                    {timeSince(session.lastActiveAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Link to Logs */}
                                    {targetTenantId && (
                                        <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                                            <span className="text-[11px] text-slate-400 font-mono dir-ltr">{session.phone || ''}</span>
                                            <Link
                                                href={`/admin/tenants/${targetTenantId}?tab=logs`}
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark hover:underline transition-colors"
                                            >
                                                <span>عرض سجل النشاط</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

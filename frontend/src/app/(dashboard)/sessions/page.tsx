'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSessions, generateWeekSessions } from '@/lib/api/sessions';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { CreateSessionModal } from '@/components/sessions/CreateSessionModal';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    CalendarCheck,
    Clock,
    Filter,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Loader2,
    Wand2,
    ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { ISession, SessionStatus } from '@/types/session.types';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<SessionStatus, string> = {
    SCHEDULED: 'مجدولة',
    IN_PROGRESS: 'جارية',
    COMPLETED: 'منتهية',
    CANCELLED: 'ملغية',
};

const STATUS_COLORS: Record<SessionStatus, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-green-100 text-green-700 border-green-200',
    COMPLETED: 'bg-gray-100 text-gray-600 border-gray-200',
    CANCELLED: 'bg-red-100 text-red-600 border-red-200',
};

export default function SessionsPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const isAssistant = user?.role === 'assistant';

    const [page, setPage] = useState(1);
    const [groupFilter, setGroupFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['sessions', page, groupFilter, statusFilter, dateFilter],
        queryFn: () =>
            fetchSessions({
                page,
                limit: 15,
                groupId: groupFilter || undefined,
                status: statusFilter || undefined,
                date: dateFilter || undefined,
            }),
    });

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
    });

    const generateMutation = useMutation({
        mutationFn: generateWeekSessions,
        onSuccess: (result) => {
            toast.success(result.message);
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ');
        },
    });

    const handleGenerateWeek = () => {
        const today = new Date();
        const day = today.getDay();
        const diff = day >= 6 ? 0 : -(day + 1);
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + diff);
        const weekStart = saturday.toISOString().split('T')[0];
        generateMutation.mutate(weekStart!);
    };

    const sessions = data?.data ?? [];
    const pagination = data?.pagination;
    const groups = groupsData?.data ?? [];

    const hasActiveFilters = !!(groupFilter || statusFilter || dateFilter);

    const clearFilters = () => {
        setGroupFilter('');
        setStatusFilter('');
        setDateFilter('');
        setPage(1);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-EG', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDateShort = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-EG', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const getGroupName = (session: ISession) => {
        if (typeof session.groupId === 'object' && session.groupId !== null) {
            return (session.groupId as any).name;
        }
        const group = groups.find((g) => g._id === session.groupId);
        return group?.name ?? '—';
    };

    return (
        <div className="min-h-screen bg-gray-50/30 p-3 sm:p-4 lg:p-6" dir="rtl">
            {/* Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        الحصص والغياب
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        {isAssistant ? 'إدارة الحصص وتسجيل الحضور' : 'عرض الحصص وسجلات الحضور'}
                    </p>
                </div>
                {isAssistant && (
                    <div className="flex gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateWeek}
                            disabled={generateMutation.isPending}
                            className="gap-1.5 text-xs sm:text-sm"
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Wand2 className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">توليد حصص الأسبوع</span>
                            <span className="sm:hidden">توليد</span>
                        </Button>
                        <CreateSessionModal />
                    </div>
                )}
            </div>

            {/* Filters — collapsible on mobile */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
                {/* Filter toggle for mobile */}
                <button
                    className="flex items-center justify-between w-full px-4 py-3 sm:hidden text-sm font-medium text-gray-700"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <span className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        تصفية {hasActiveFilters && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">مفعّل</span>}
                    </span>
                    <ChevronLeft className={cn('h-4 w-4 transition-transform', showFilters && '-rotate-90')} />
                </button>

                {/* Filters content */}
                <div className={cn(
                    'sm:flex flex-wrap gap-3 items-end p-3 sm:p-4',
                    showFilters ? 'flex flex-col' : 'hidden sm:flex'
                )}>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 hidden sm:flex">
                        <Filter className="h-4 w-4" />
                        تصفية:
                    </div>

                    <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="h-9 text-sm w-full sm:w-48">
                            <SelectValue placeholder="كل المجموعات" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل المجموعات</SelectItem>
                            {groups.map((g) => (
                                <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="h-9 text-sm w-full sm:w-40">
                            <SelectValue placeholder="كل الحالات" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الحالات</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Input
                        type="date"
                        className="h-9 text-sm w-full sm:w-44"
                        value={dateFilter}
                        onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                    />

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="gap-1 text-gray-500 h-9 w-full sm:w-auto"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            مسح الفلاتر
                        </Button>
                    )}
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin ml-2" />
                    جارٍ التحميل...
                </div>
            )}

            {/* Empty */}
            {!isLoading && sessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <CalendarDays className="h-12 w-12 text-gray-200" />
                    <p className="text-sm">لا توجد حصص</p>
                    {isAssistant && (
                        <p className="text-xs text-gray-400">ابدأ بإنشاء حصة جديدة أو توليد حصص الأسبوع</p>
                    )}
                </div>
            )}

            {/* ── Mobile / Tablet: Card list ── */}
            {!isLoading && sessions.length > 0 && (
                <div className="lg:hidden space-y-3">
                    {sessions.map((session) => (
                        <button
                            key={session._id}
                            className="w-full text-right bg-white border border-gray-100 rounded-xl shadow-sm p-4 hover:border-primary/30 hover:shadow-md transition-all"
                            onClick={() => router.push(`/sessions/${session._id}`)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{getGroupName(session)}</p>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {formatDateShort(session.date)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {session.startTime}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[session.status])}>
                                        {STATUS_LABELS[session.status]}
                                    </span>
                                    <ArrowLeft className="h-4 w-4 text-gray-300" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Desktop: Table ── */}
            {!isLoading && sessions.length > 0 && (
                <div className="hidden lg:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">المجموعة</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الوقت</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sessions.map((session) => (
                                    <tr
                                        key={session._id}
                                        className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/sessions/${session._id}`)}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-800">{getGroupName(session)}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                                {formatDate(session.date)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                                {session.startTime}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', STATUS_COLORS[session.status])}>
                                                {STATUS_LABELS[session.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-left">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-primary hover:text-primary/80 gap-1 text-xs"
                                                onClick={(e) => { e.stopPropagation(); router.push(`/sessions/${session._id}`); }}
                                            >
                                                {isAssistant && session.status !== 'COMPLETED' && session.status !== 'CANCELLED'
                                                    ? 'تسجيل الحضور'
                                                    : 'عرض التفاصيل'}
                                                <ChevronLeft className="h-3.5 w-3.5" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="mt-3 border border-gray-100 bg-white rounded-xl px-4 py-3 flex items-center justify-between text-sm text-gray-600 shadow-sm">
                    <span className="text-xs sm:text-sm">
                        {pagination.total} حصة — صفحة {pagination.page} من {pagination.totalPages}
                    </span>
                    <div className="flex gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

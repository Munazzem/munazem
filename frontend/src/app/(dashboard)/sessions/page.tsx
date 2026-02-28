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

const STATUS_LABELS: Record<SessionStatus, string> = {
    SCHEDULED: 'مجدولة',
    IN_PROGRESS: 'جارية',
    COMPLETED: 'منتهية',
    CANCELLED: 'ملغية',
};

const STATUS_VARIANT: Record<SessionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    SCHEDULED: 'secondary',
    IN_PROGRESS: 'default',
    COMPLETED: 'outline',
    CANCELLED: 'destructive',
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
        // Start from today's Saturday (beginning of Egyptian week)
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-EG', {
            weekday: 'short',
            year: 'numeric',
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
        <div className="min-h-screen bg-gray-50/30 p-6" dir="rtl">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarCheck className="h-6 w-6 text-primary" />
                        الحصص والغياب
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
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
                            className="gap-2"
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4" />
                            )}
                            توليد حصص الأسبوع
                        </Button>
                        <CreateSessionModal />
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 flex flex-wrap gap-3 items-end shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <Filter className="h-4 w-4" />
                    تصفية:
                </div>

                <div className="min-w-[180px]">
                    <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="كل المجموعات" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل المجموعات</SelectItem>
                            {groups.map((g) => (
                                <SelectItem key={g._id} value={g._id}>
                                    {g.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-[150px]">
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="كل الحالات" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الحالات</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Input
                        type="date"
                        className="h-9 text-sm w-44"
                        value={dateFilter}
                        onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                    />
                </div>

                {(groupFilter || statusFilter || dateFilter) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setGroupFilter(''); setStatusFilter(''); setDateFilter(''); setPage(1); }}
                        className="gap-1 text-gray-500 h-9"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        مسح
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <Loader2 className="h-6 w-6 animate-spin ml-2" />
                        جارٍ التحميل...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                        <CalendarDays className="h-12 w-12 text-gray-200" />
                        <p className="text-sm">لا توجد حصص</p>
                        {isAssistant && (
                            <p className="text-xs text-gray-400">
                                ابدأ بإنشاء حصة جديدة أو توليد حصص الأسبوع
                            </p>
                        )}
                    </div>
                ) : (
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
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {getGroupName(session)}
                                        </td>
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
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[session.status]}`}
                                            >
                                                {STATUS_LABELS[session.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-left">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-primary hover:text-primary/80 gap-1 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/sessions/${session._id}`);
                                                }}
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
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm text-gray-600">
                        <span>
                            {pagination.total} حصة — صفحة {pagination.page} من {pagination.totalPages}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

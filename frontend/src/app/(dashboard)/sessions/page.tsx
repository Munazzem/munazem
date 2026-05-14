'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSessions, generateMonthSessions, updateSessionStatus } from '@/lib/api/sessions';
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
    ChevronDown,
    ChevronUp,
    XCircle,
    Calendar,
    CalendarX,
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';

    // Use local date (not UTC) to avoid timezone offset issues
    const _now = new Date();
    const today = [
        _now.getFullYear(),
        String(_now.getMonth() + 1).padStart(2, '0'),
        String(_now.getDate()).padStart(2, '0'),
    ].join('-');

    const [page, setPage] = useState(1);
    const [groupFilter, setGroupFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState(today);
    const [showFilters, setShowFilters] = useState(false);
    const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);
    const isViewingToday = dateFilter === today;

    // Month generation
    const now = new Date();
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [genYear,  setGenYear]  = useState(now.getFullYear());
    const [genMonth, setGenMonth] = useState(now.getMonth() + 1);

    const MONTH_NAMES = [
        'يناير','فبراير','مارس','أبريل','مايو','يونيو',
        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
    ];

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['sessions', page, groupFilter, statusFilter, dateFilter],
        queryFn: () =>
            fetchSessions({
                page,
                limit: 500,
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
        mutationFn: ({ year, month }: { year: number; month: number }) =>
            generateMonthSessions(year, month),
        onSuccess: (result) => {
            toast.success(result.message);
            setShowMonthPicker(false);
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
        onError: (err: any) => {
            
        },
    });

    const cancelMutation = useMutation({
        mutationFn: (sessionId: string) => updateSessionStatus(sessionId, 'CANCELLED'),
        onSuccess: () => {
            toast.success('تم إلغاء الحصة بنجاح');
            setCancelSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
        onError: () => {
            toast.error('حدث خطأ أثناء إلغاء الحصة');
            setCancelSessionId(null);
        },
    });

    const handleGenerateMonth = () => {
        generateMutation.mutate({ year: genYear, month: genMonth });
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

    const goToToday = () => {
        setDateFilter(today);
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

    // Grouping the sessions by Group Name
    const sessionsByGroup = sessions.reduce((acc, session) => {
        const gName = getGroupName(session);
        if (!acc[gName]) acc[gName] = [];
        acc[gName].push(session);
        return acc;
    }, {} as Record<string, ISession[]>);

    const groupKeys = Object.keys(sessionsByGroup);

    return (
        <div className="min-h-screen bg-gray-50/30 p-3 sm:p-4 lg:p-6" dir="rtl">
            {/* Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        {isViewingToday ? 'حصص اليوم' : 'الحصص والغياب'}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        {isViewingToday
                            ? new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                            : (canWrite ? 'إدارة الحصص وتسجيل الحضور' : 'عرض الحصص وسجلات الحضور')
                        }
                    </p>
                </div>
                {canWrite && (
                    <div className="relative flex gap-2 shrink-0">
                        <div className="relative">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowMonthPicker((v) => !v)}
                                disabled={generateMutation.isPending}
                                className="gap-1.5 text-xs sm:text-sm"
                            >
                                {generateMutation.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Wand2 className="h-3.5 w-3.5" />
                                )}
                                <span className="hidden sm:inline">توليد حصص الشهر</span>
                                <span className="sm:hidden">توليد</span>
                                {showMonthPicker ? (
                                    <ChevronUp className="h-3 w-3" />
                                ) : (
                                    <ChevronDown className="h-3 w-3" />
                                )}
                            </Button>

                            {showMonthPicker && (
                                <div className="absolute top-full mt-2 right-0 sm:left-0 sm:right-auto z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64" dir="rtl">
                                    <p className="text-xs font-bold text-gray-600 mb-3">اختر الشهر للتوليد</p>
                                    <div className="flex items-center justify-between mb-3">
                                        <button onClick={() => setGenYear((y) => y - 1)} className="p-1 hover:text-primary rounded">
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                        <span className="font-bold text-gray-800 text-sm">{genYear}</span>
                                        <button onClick={() => setGenYear((y) => y + 1)} className="p-1 hover:text-primary rounded">
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                                        {MONTH_NAMES.map((name, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setGenMonth(i + 1)}
                                                className={cn(
                                                    'py-1.5 rounded-lg text-xs font-medium transition-colors',
                                                    genMonth === i + 1
                                                        ? 'bg-primary text-white'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                )}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                    <Button
                                        className="w-full gap-1.5 text-xs"
                                        size="sm"
                                        onClick={handleGenerateMonth}
                                        disabled={generateMutation.isPending}
                                    >
                                        {generateMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-3.5 w-3.5" />
                                        )}
                                        توليد {MONTH_NAMES[genMonth - 1]} {genYear}
                                    </Button>
                                </div>
                            )}
                        </div>
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

                    {/* Today / All quick toggle */}
                    <div className="flex gap-1.5 w-full sm:w-auto">
                        <Button
                            variant={isViewingToday ? 'default' : 'outline'}
                            size="sm"
                            onClick={goToToday}
                            className="gap-1.5 h-9 flex-1 sm:flex-none text-xs"
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            اليوم
                        </Button>
                        <Button
                            variant={!dateFilter ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setDateFilter(''); setPage(1); }}
                            className="gap-1.5 h-9 flex-1 sm:flex-none text-xs"
                        >
                            كل الحصص
                        </Button>
                    </div>

                    <Input
                        type="date"
                        className="h-9 text-sm w-full sm:w-44"
                        value={dateFilter}
                        onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                    />

                    {(groupFilter || statusFilter) && (
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
                <div className="p-4 sm:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm mt-4">
                    <TableSkeleton rows={10} columns={4} />
                </div>
            )}

            {/* Empty */}
            {!isLoading && sessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <CalendarDays className="h-12 w-12 text-gray-200" />
                    <p className="text-sm font-medium">
                        {isViewingToday ? 'لا توجد حصص اليوم' : 'لا توجد حصص'}
                    </p>
                    {isViewingToday && canWrite && (
                        <p className="text-xs text-gray-400">يمكنك إنشاء حصة جديدة أو توليد حصص الشهر</p>
                    )}
                    {!isViewingToday && canWrite && (
                        <p className="text-xs text-gray-400">ابدأ بإنشاء حصة جديدة أو توليد حصص الأسبوع</p>
                    )}
                </div>
            )}

            {/* ── Desktop & Mobile Grouped View ── */}
            {!isLoading && groupKeys.length > 0 && (
                <Accordion type="multiple" className="space-y-4">
                    {groupKeys.map((groupName) => (
                        <AccordionItem value={groupName} key={groupName} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4">
                            <AccordionTrigger className="hover:no-underline py-4">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-primary">{groupName}</h2>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                        {sessionsByGroup[groupName].length} حصص
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                {/* Mobile View (Cards) */}
                                <div className="lg:hidden space-y-3 pt-4">
                                    {sessionsByGroup[groupName].map((session) => (
                                        <div key={session._id} className="relative">
                                            <button
                                                className="w-full text-right bg-white border border-gray-100 rounded-xl shadow-sm p-4 hover:border-primary/30 hover:shadow-md transition-all"
                                                onClick={() => router.push(`/sessions/${session._id}`)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <CalendarDays className="h-4 w-4 text-primary" />
                                                                <span className="font-bold text-gray-800 text-sm">{formatDateShort(session.date)}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-4 w-4 text-primary" />
                                                                <span className="font-bold text-gray-800 text-sm">{session.startTime}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[session.status])}>
                                                            {STATUS_LABELS[session.status]}
                                                        </span>
                                                        <ArrowLeft className="h-4 w-4 text-gray-300" />
                                                    </div>
                                                </div>
                                            </button>
                                            {/* Cancel button — only for SCHEDULED sessions */}
                                            {canWrite && session.status === 'SCHEDULED' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setCancelSessionId(session._id); }}
                                                    className="absolute top-2 left-2 flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded-full px-2 py-0.5 transition-colors"
                                                >
                                                    <CalendarX className="h-3 w-3" />
                                                    إلغاء
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop View (Table) */}
                                <div className="hidden lg:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الوقت</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
                                                    <th className="px-4 py-3 text-right font-medium text-gray-600"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {sessionsByGroup[groupName].map((session) => (
                                                    <tr
                                                        key={session._id}
                                                        className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                                                        onClick={() => router.push(`/sessions/${session._id}`)}
                                                    >
                                                        <td className="px-4 py-3 text-gray-700 font-bold">
                                                            <div className="flex items-center gap-1.5">
                                                                <CalendarDays className="h-4 w-4 text-primary" />
                                                                {formatDate(session.date)}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700 font-bold">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock className="h-4 w-4 text-primary" />
                                                                {session.startTime}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', STATUS_COLORS[session.status])}>
                                                                {STATUS_LABELS[session.status]}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-left">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                {canWrite && session.status === 'SCHEDULED' && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 text-xs"
                                                                        onClick={(e) => { e.stopPropagation(); setCancelSessionId(session._id); }}
                                                                    >
                                                                        <CalendarX className="h-3.5 w-3.5" />
                                                                        إلغاء
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-primary hover:text-primary/80 gap-1 text-xs"
                                                                    onClick={(e) => { e.stopPropagation(); router.push(`/sessions/${session._id}`); }}
                                                                >
                                                                    {canWrite && session.status !== 'COMPLETED' && session.status !== 'CANCELLED'
                                                                        ? 'تسجيل الحضور'
                                                                        : 'عرض التفاصيل'}
                                                                    <ChevronLeft className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
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
            {/* Cancel Session Confirmation Dialog */}
            <AlertDialog open={!!cancelSessionId} onOpenChange={(open) => { if (!open) setCancelSessionId(null); }}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CalendarX className="h-5 w-5 text-red-500" />
                            إلغاء الحصة
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من إلغاء هذه الحصة؟ لن يتم تسجيل حضور عليها.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>رجوع</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => cancelSessionId && cancelMutation.mutate(cancelSessionId)}
                            disabled={cancelMutation.isPending}
                        >
                            {cancelMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin ml-1" /> جارٍ الإلغاء...</>
                            ) : 'تأكيد الإلغاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

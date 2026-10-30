'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTenants, fetchActiveUsers } from '@/lib/api/admin';
import { TeacherActivityLogs } from './TeacherActivityLogs';
import {
    Search,
    GraduationCap,
    Users,
    ChevronLeft,
    CheckCircle2,
    Shield,
    ExternalLink,
    Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PartitionedTeacherLogs() {
    const [search, setSearch] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

    // 1. Fetch teachers list
    const { data: tenantsData, isLoading: loadingTenants } = useQuery({
        queryKey: ['admin-tenants-partitioned', search],
        queryFn: () => fetchTenants({ limit: 100, search: search.trim() || undefined }),
    });

    // 2. Fetch live presence to show who is online right now
    const { data: presenceData } = useQuery({
        queryKey: ['admin-active-users'],
        queryFn: fetchActiveUsers,
        refetchInterval: 15_000,
    });

    const activeUserTenantIds = new Set(
        (presenceData?.activeUsers ?? []).map((u) => u.teacherId || u.userId)
    );

    const teachers = tenantsData?.data ?? [];

    // Auto-select first teacher if none selected
    const activeTeacher = teachers.find((t) => t._id === selectedTeacherId) || teachers[0] || null;
    const currentTeacherId = selectedTeacherId || activeTeacher?._id || null;

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header info */}
            <div className="bg-gradient-to-r from-blue-900/10 via-primary/5 to-transparent border border-blue-100 rounded-3xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            سجلات النشاط المقسمة لكل معلم
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            سجلات منفصلة ومستقلة لكل حساب معلم لمنع تداخل الأحداث ومتابعة حركة كل أكونت على حدة.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="بحث باسم المعلم أو هاتفه..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-10 h-10 bg-white border-gray-200 rounded-2xl text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* Main Partitioned Grid: Left/Right layout on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Teachers Selector Sidebar (4 cols) */}
                <div className="lg:col-span-4 bg-white border border-gray-100 rounded-3xl p-3 sm:p-4 shadow-xs space-y-2 max-h-[720px] overflow-y-auto">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-gray-400">
                        <span>قائمة المعلمين ({teachers.length})</span>
                        <span className="text-[11px] font-medium text-emerald-600">
                            {teachers.filter((t) => activeUserTenantIds.has(t._id)).length} متصل الآن
                        </span>
                    </div>

                    {loadingTenants ? (
                        <div className="space-y-2 p-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : teachers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-xs">
                            لا يوجد معلمون يطابقون البحث
                        </div>
                    ) : (
                        teachers.map((teacher) => {
                            const isSelected = teacher._id === currentTeacherId;
                            const isOnline = activeUserTenantIds.has(teacher._id);

                            return (
                                <button
                                    key={teacher._id}
                                    onClick={() => setSelectedTeacherId(teacher._id)}
                                    className={cn(
                                        'w-full text-right p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs',
                                        isSelected
                                            ? 'bg-primary/5 border-primary/30 shadow-xs'
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="relative">
                                            <div
                                                className={cn(
                                                    'h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                                                    isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
                                                )}
                                            >
                                                {teacher.name.charAt(0)}
                                            </div>
                                            {isOnline && (
                                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className={cn('font-bold truncate', isSelected ? 'text-primary' : 'text-gray-900')}>
                                                    {teacher.name}
                                                </p>
                                                {isOnline && (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 h-4">
                                                        نشط
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-gray-400 truncate mt-0.5" dir="ltr">
                                                {teacher.phone || teacher.email || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-left shrink-0">
                                        <div className="flex items-center gap-1 text-[11px] text-gray-500 font-bold">
                                            <Users className="h-3 w-3 text-gray-400" />
                                            <span>{teacher.studentCount?.toLocaleString('en-US') || 0}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {(teacher as any).activeGroupsCount || 0} مجموعات
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Selected Teacher's Dedicated Logs Stream (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                    {activeTeacher ? (
                        <>
                            {/* Selected Teacher Card Header */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-lg">
                                        {activeTeacher.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-extrabold text-gray-900">
                                                سجل أحداث: {activeTeacher.name}
                                            </h3>
                                            {activeUserTenantIds.has(activeTeacher._id) && (
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    متواجد حالياً
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            الهاتف: <span dir="ltr">{activeTeacher.phone}</span> · المادة:{' '}
                                            {activeTeacher.subject || 'عام'} · الباقة: {activeTeacher.subscription?.planTier || 'أساسي'}
                                        </p>
                                    </div>
                                </div>

                                <Link
                                    href={`/admin/tenants/${activeTeacher._id}`}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors self-start sm:self-auto"
                                >
                                    <span>الملف الشامل للمعلم</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </div>

                            {/* Isolated Activity Logs for this Teacher */}
                            <div className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-6 shadow-xs">
                                <TeacherActivityLogs
                                    tenantId={activeTeacher._id}
                                    teacherName={activeTeacher.name}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400">
                            <GraduationCap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                            <p className="text-sm font-bold text-gray-700">اختر معلماً لعرض سجلاته المستقلة</p>
                            <p className="text-xs text-gray-400 mt-1">
                                سيتم إظهار كافة حركات السداد والإضافة والتحضير الخاصة بالمعلم وحده.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

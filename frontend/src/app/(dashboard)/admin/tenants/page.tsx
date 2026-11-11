'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Search,
    UserCheck,
    UserX,
    ChevronLeft,
    ChevronRight,
    Building2,
    GraduationCap,
    Activity,
    Phone,
    Calendar,
    Users,
} from 'lucide-react';
import { fetchTenants, suspendTenant, activateTenant } from '@/lib/api/admin';
import type { AdminTenant } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AddTeacherModal } from '@/components/users/AddTeacherModal';
import { AddCenterModal } from '@/components/center/AddCenterModal';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { DeleteTenantModal } from '@/components/admin/DeleteTenantModal';
import Link from 'next/link';

function StatusBadge({ isActive }: { isActive: boolean }) {
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
            isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
            {isActive ? 'نشط' : 'موقوف'}
        </span>
    );
}

function SubBadge({ sub }: { sub: AdminTenant['subscription'] }) {
    if (!sub) return <span className="text-xs text-slate-400">بدون اشتراك</span>;
    const isActive = sub.status === 'ACTIVE';
    return (
        <div className="flex flex-col gap-0.5">
            <span className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-amber-700'}`}>
                {sub.planTier} — {isActive ? 'نشط' : 'منتهي'}
            </span>
            <span className="text-[11px] text-slate-400">
                حتى {new Date(sub.endDate).toLocaleDateString('ar-EG')}
            </span>
        </div>
    );
}

export default function TenantsPage() {
    const router      = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch]   = useState('');
    const [status, setStatus]   = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'centerOwner'>('all');
    const [page, setPage]       = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-tenants', { search, status, roleFilter, page }],
        queryFn:  () => fetchTenants({
            search: search || undefined,
            status: status || undefined,
            role: roleFilter === 'all' ? undefined : roleFilter,
            page,
            limit: 20
        }),
    });

    const suspendMutation = useMutation({
        mutationFn: suspendTenant,
        onSuccess: () => { toast.success('تم تعليق الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
        onError:   () => {},
    });

    const activateMutation = useMutation({
        mutationFn: activateTenant,
        onSuccess: () => { toast.success('تم تفعيل الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
        onError:   () => {},
    });

    const tenants    = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">العملاء والمعلمون (Tenants)</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        {pagination ? `${pagination.total} حساب مسجل على المنصة` : 'إدارة ومتابعة المعلمين والسناتر'}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <AddSubscriptionModal />
                    <AddTeacherModal />
                    <AddCenterModal />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="ابحث بالاسم أو رقم الهاتف أو اسم السنتر..."
                        className="pr-9 rounded-2xl border-slate-200"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Role Filter Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => { setRoleFilter('all'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                roleFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            الكل
                        </button>
                        <button
                            type="button"
                            onClick={() => { setRoleFilter('teacher'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                roleFilter === 'teacher' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            <GraduationCap className="w-3.5 h-3.5" />
                            المعلمون
                        </button>
                        <button
                            type="button"
                            onClick={() => { setRoleFilter('centerOwner'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                roleFilter === 'centerOwner' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            السناتر
                        </button>
                    </div>

                    <select
                        value={status}
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">كل الحالات</option>
                        <option value="active">نشط فقط</option>
                        <option value="inactive">موقوف فقط</option>
                    </select>
                </div>
            </div>

            {/* List / Table Container */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-slate-50 p-4 space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-16 animate-pulse bg-slate-50 rounded-2xl" />
                        ))}
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                        <p className="text-sm font-semibold">لا يوجد عملاء يطابقون شروط البحث</p>
                    </div>
                ) : (
                    <>
                        {/* 1. Desktop Table View (Hidden on mobile) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 text-right text-slate-500 text-xs bg-slate-50/50">
                                        <th className="px-4 py-3 font-bold">العميل / الحساب</th>
                                        <th className="px-4 py-3 font-bold">النوع</th>
                                        <th className="px-4 py-3 font-bold">الهاتف</th>
                                        <th className="px-4 py-3 font-bold">الطلاب</th>
                                        <th className="px-4 py-3 font-bold">الاشتراك</th>
                                        <th className="px-4 py-3 font-bold">الحالة</th>
                                        <th className="px-4 py-3 font-bold">تاريخ التسجيل</th>
                                        <th className="px-4 py-3 font-bold text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {tenants.map((t) => (
                                        <tr
                                            key={t._id}
                                            className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/admin/tenants/${t._id}`)}
                                        >
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 ${
                                                        t.role === 'centerOwner' ? 'bg-indigo-100 text-indigo-700' : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        {t.role === 'centerOwner' ? <Building2 className="w-4 h-4" /> : t.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">
                                                            {t.role === 'centerOwner' ? (t.centerName || t.name) : t.name}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            {t.role === 'centerOwner' ? `المدير: ${t.name}` : (t.centerName || t.subject || 'معلم')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {t.role === 'centerOwner' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        <Building2 className="w-3 h-3" />
                                                        سنتر
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <GraduationCap className="w-3 h-3" />
                                                        معلم
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-600 font-mono dir-ltr">{t.phone}</td>
                                            <td className="px-4 py-3.5">
                                                <span className="font-extrabold text-slate-800">{t.studentCount}</span>
                                            </td>
                                            <td className="px-4 py-3.5"><SubBadge sub={t.subscription} /></td>
                                            <td className="px-4 py-3.5"><StatusBadge isActive={t.isActive} /></td>
                                            <td className="px-4 py-3.5 text-slate-400 text-xs">
                                                {new Date(t.createdAt).toLocaleDateString('ar-EG')}
                                            </td>
                                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* View Logs Button */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => router.push(`/admin/tenants/${t._id}?tab=logs`)}
                                                        className="text-primary hover:bg-primary/10 text-xs h-8 px-2 rounded-xl"
                                                        title="عرض سجل النشاط"
                                                    >
                                                        <Activity className="h-3.5 w-3.5 ml-1" />
                                                        السجلات
                                                    </Button>

                                                    {/* Suspend / Activate */}
                                                    {t.isActive ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => suspendMutation.mutate(t._id)}
                                                            disabled={suspendMutation.isPending}
                                                            className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs h-8 rounded-xl"
                                                        >
                                                            <UserX className="h-3 w-3 ml-1" />
                                                            تعليق
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => activateMutation.mutate(t._id)}
                                                            disabled={activateMutation.isPending}
                                                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs h-8 rounded-xl"
                                                        >
                                                            <UserCheck className="h-3 w-3 ml-1" />
                                                            تفعيل
                                                        </Button>
                                                    )}

                                                    {/* Add Subscription Modal */}
                                                    <AddSubscriptionModal tenantId={t._id} disabled={!t.isActive} />

                                                    {/* Delete Tenant Modal */}
                                                    <DeleteTenantModal tenantId={t._id} teacherName={t.name} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 2. Mobile Responsive Card View (Visible only on mobile < md) */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {tenants.map((t) => (
                                <div
                                    key={t._id}
                                    className="p-4 hover:bg-slate-50/60 transition-colors space-y-3 cursor-pointer"
                                    onClick={() => router.push(`/admin/tenants/${t._id}`)}
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${
                                                t.role === 'centerOwner' ? 'bg-indigo-100 text-indigo-700' : 'bg-primary/10 text-primary'
                                            }`}>
                                                {t.role === 'centerOwner' ? <Building2 className="w-5 h-5" /> : t.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-extrabold text-slate-900 text-sm">
                                                    {t.role === 'centerOwner' ? (t.centerName || t.name) : t.name}
                                                </h3>
                                                <p className="text-xs text-slate-400">
                                                    {t.role === 'centerOwner' ? `المدير: ${t.name}` : (t.centerName || t.subject || 'معلم')}
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge isActive={t.isActive} />
                                    </div>

                                    {/* Card Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-3 rounded-2xl border border-slate-100/80">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-mono dir-ltr">{t.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                            <span>الطلاب: <strong className="text-slate-900 font-extrabold">{t.studentCount}</strong></span>
                                        </div>
                                        <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                            <span className="text-slate-400 text-[11px]">الاشتراك:</span>
                                            <SubBadge sub={t.subscription} />
                                        </div>
                                    </div>

                                    {/* Card Actions Toolbar */}
                                    <div className="flex items-center justify-between gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.push(`/admin/tenants/${t._id}?tab=logs`)}
                                            className="text-primary border-primary/20 hover:bg-primary/10 text-xs h-8 rounded-xl flex-1"
                                        >
                                            <Activity className="h-3.5 w-3.5 ml-1" />
                                            السجلات
                                        </Button>

                                        {t.isActive ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => suspendMutation.mutate(t._id)}
                                                disabled={suspendMutation.isPending}
                                                className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs h-8 rounded-xl flex-1"
                                            >
                                                <UserX className="h-3 w-3 ml-1" />
                                                تعليق
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => activateMutation.mutate(t._id)}
                                                disabled={activateMutation.isPending}
                                                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs h-8 rounded-xl flex-1"
                                            >
                                                <UserCheck className="h-3 w-3 ml-1" />
                                                تفعيل
                                            </Button>
                                        )}

                                        <DeleteTenantModal tenantId={t._id} teacherName={t.name} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3.5 border-t border-slate-100 bg-slate-50/40">
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

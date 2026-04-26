'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchTenants, suspendTenant, activateTenant } from '@/lib/api/admin';
import type { AdminTenant } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function StatusBadge({ isActive }: { isActive: boolean }) {
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isActive
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50   text-red-700   border-red-200'
        }`}>
            {isActive ? 'نشط' : 'موقوف'}
        </span>
    );
}

function SubBadge({ sub }: { sub: AdminTenant['subscription'] }) {
    if (!sub) return <span className="text-xs text-gray-400">لا يوجد</span>;
    const isActive = sub.status === 'ACTIVE';
    return (
        <div className="flex flex-col gap-0.5">
            <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-orange-500'}`}>
                {sub.planTier} — {isActive ? 'نشط' : 'منتهي'}
            </span>
            <span className="text-xs text-gray-400">
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
    const [page, setPage]       = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-tenants', { search, status, page }],
        queryFn:  () => fetchTenants({ search: search || undefined, status: status || undefined, page, limit: 20 }),
    });

    const suspendMutation = useMutation({
        mutationFn: suspendTenant,
        onSuccess: () => { toast.success('تم تعليق الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
        onError:   () => toast.error('حدث خطأ'),
    });

    const activateMutation = useMutation({
        mutationFn: activateTenant,
        onSuccess: () => { toast.success('تم تفعيل الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }); },
        onError:   () => toast.error('حدث خطأ'),
    });

    const tenants    = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">المعلمون (Tenants)</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {pagination ? `${pagination.total} معلم مسجل` : ''}
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="ابحث بالاسم أو الهاتف..."
                        className="pr-9"
                    />
                </div>
                <select
                    value={status}
                    onChange={e => { setStatus(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="">الكل</option>
                    <option value="active">نشط</option>
                    <option value="inactive">موقوف</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-gray-50">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-16 animate-pulse bg-gray-50/50 mx-4 my-2 rounded-xl" />
                        ))}
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">لا يوجد معلمون يطابقون البحث</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-right text-gray-500 text-xs">
                                    <th className="px-4 py-3 font-semibold">المعلم</th>
                                    <th className="px-4 py-3 font-semibold">الهاتف</th>
                                    <th className="px-4 py-3 font-semibold">الطلاب</th>
                                    <th className="px-4 py-3 font-semibold">الاشتراك</th>
                                    <th className="px-4 py-3 font-semibold">الحالة</th>
                                    <th className="px-4 py-3 font-semibold">تاريخ التسجيل</th>
                                    <th className="px-4 py-3 font-semibold">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tenants.map((t) => (
                                    <tr
                                        key={t._id}
                                        className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                                        onClick={() => router.push(`/admin/tenants/${t._id}`)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                    {t.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{t.name}</p>
                                                    {t.centerName && <p className="text-xs text-gray-400">{t.centerName}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 dir-ltr">{t.phone}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-gray-800">{t.studentCount}</span>
                                        </td>
                                        <td className="px-4 py-3"><SubBadge sub={t.subscription} /></td>
                                        <td className="px-4 py-3"><StatusBadge isActive={t.isActive} /></td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {new Date(t.createdAt).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            {t.isActive ? (
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => suspendMutation.mutate(t._id)}
                                                    disabled={suspendMutation.isPending}
                                                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                                                >
                                                    <UserX className="h-3 w-3 ml-1" />
                                                    تعليق
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm" variant="outline"
                                                    onClick={() => activateMutation.mutate(t._id)}
                                                    disabled={activateMutation.isPending}
                                                    className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                                                >
                                                    <UserCheck className="h-3 w-3 ml-1" />
                                                    تفعيل
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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

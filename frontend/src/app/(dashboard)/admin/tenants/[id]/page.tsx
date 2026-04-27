'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowRight, Users, BookOpen, CalendarCheck,
    UserCheck, UserX, TrendingUp,
} from 'lucide-react';
import { fetchTenantDetail, suspendTenant, activateTenant } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
        </div>
    );
}

function StatPill({ icon: Icon, label, value, color }: {
    icon: any; label: string; value: number;
    color: 'blue' | 'green' | 'orange' | 'purple';
}) {
    const colors = {
        blue:   'bg-blue-50 text-blue-600',
        green:  'bg-green-50 text-green-600',
        orange: 'bg-orange-50 text-orange-600',
        purple: 'bg-purple-50 text-purple-600',
    };
    return (
        <div className={`rounded-2xl p-4 flex flex-col gap-2 ${colors[color]}`}>
            <Icon className="h-5 w-5 opacity-70" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-medium opacity-70">{label}</p>
        </div>
    );
}

export default function TenantDetailPage() {
    const { id }      = useParams<{ id: string }>();
    const router      = useRouter();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['admin-tenant', id],
        queryFn:  () => fetchTenantDetail(id),
        enabled:  !!id,
    });

    const suspendMutation = useMutation({
        mutationFn: () => suspendTenant(id),
        onSuccess: () => { toast.success('تم تعليق الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); },
        onError:   () => toast.error('حدث خطأ'),
    });

    const activateMutation = useMutation({
        mutationFn: () => activateTenant(id),
        onSuccess: () => { toast.success('تم تفعيل الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); },
        onError:   () => toast.error('حدث خطأ'),
    });

    if (isLoading) {
        return (
            <div className="p-6 space-y-4 max-w-4xl mx-auto animate-pulse" dir="rtl">
                <div className="h-8 w-40 bg-gray-100 rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
                </div>
                <div className="h-60 bg-gray-100 rounded-2xl" />
            </div>
        );
    }

    if (!data) return (
        <div className="p-6 text-center text-gray-400" dir="rtl">
            <p>معلم غير موجود</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/tenants')}>
                العودة
            </Button>
        </div>
    );

    const { teacher, studentCount, groupCount, sessionsThisMonth, subscription } = data;
    const isActive = teacher.isActive;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-4xl mx-auto" dir="rtl">
            {/* Back */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
            >
                <ArrowRight className="h-4 w-4" />
                العودة للمعلمين
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                    {teacher.name.charAt(0)}
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">{teacher.name}</h1>
                    {teacher.centerName && <p className="text-sm text-gray-500">{teacher.centerName}</p>}
                    <p className="text-sm text-gray-400 mt-0.5">
                        عضو منذ {new Date(teacher.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {isActive ? (
                        <Button
                            variant="outline" size="sm"
                            onClick={() => suspendMutation.mutate()}
                            disabled={suspendMutation.isPending}
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                        >
                            <UserX className="h-4 w-4" />
                            تعليق الحساب
                        </Button>
                    ) : (
                        <Button
                            variant="outline" size="sm"
                            onClick={() => activateMutation.mutate()}
                            disabled={activateMutation.isPending}
                            className="text-green-600 border-green-200 hover:bg-green-50 gap-1"
                        >
                            <UserCheck className="h-4 w-4" />
                            تفعيل الحساب
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatPill icon={Users}         label="إجمالي الطلاب"       value={studentCount}      color="blue"   />
                <StatPill icon={BookOpen}       label="المجموعات"            value={groupCount}        color="purple" />
                <StatPill icon={CalendarCheck}  label="حصص هذا الشهر"       value={sessionsThisMonth} color="green"  />
                <StatPill icon={TrendingUp}     label="حالة الاشتراك"
                    value={subscription?.status === 'ACTIVE' ? 1 : 0}
                    color={subscription?.status === 'ACTIVE' ? 'green' : 'orange'}
                />
            </div>

            {/* Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Contact */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">بيانات الحساب</h2>
                    <InfoRow label="الاسم"    value={teacher.name} />
                    <InfoRow label="الهاتف"   value={teacher.phone} />
                    <InfoRow label="البريد"   value={teacher.email} />
                    <InfoRow label="المرحلة"  value={teacher.stage} />
                    <InfoRow label="الحالة"   value={isActive ? 'نشط ✅' : 'موقوف ❌'} />
                </div>

                {/* Subscription */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">الاشتراك الحالي</h2>
                    {subscription ? (
                        <>
                            <InfoRow label="الخطة"      value={subscription.planTier} />
                            <InfoRow label="المدة"       value={`${subscription.durationMonths} شهر`} />
                            <InfoRow label="الحالة"      value={subscription.status === 'ACTIVE' ? 'نشط ✅' : 'منتهي ❌'} />
                            <InfoRow label="تنتهي في"   value={new Date(subscription.endDate).toLocaleDateString('ar-EG')} />
                        </>
                    ) : (
                        <p className="text-sm text-gray-400 py-4 text-center">لا يوجد اشتراك</p>
                    )}
                </div>
            </div>
        </div>
    );
}

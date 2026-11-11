'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowRight,
    Users,
    BookOpen,
    CalendarCheck,
    UserCheck,
    UserX,
    TrendingUp,
    Activity,
    FileText,
} from 'lucide-react';
import { fetchTenantDetail, suspendTenant, activateTenant } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AddSubscriptionModal } from '@/components/subscriptions/AddSubscriptionModal';
import { EditTeacherModal } from './EditTeacherModal';
import { DeleteTenantModal } from '@/components/admin/DeleteTenantModal';
import { TeacherActivityLogs } from '@/components/admin/TeacherActivityLogs';
import { formatStages } from '@/lib/utils/grades';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
            <span className="text-xs sm:text-sm text-slate-500">{label}</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-800">{value ?? '—'}</span>
        </div>
    );
}

function StatPill({ icon: Icon, label, value, color }: {
    icon: any; label: string; value: number;
    color: 'blue' | 'green' | 'orange' | 'purple';
}) {
    const colors = {
        blue:   'bg-blue-50 text-blue-700 border-blue-100',
        green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
        orange: 'bg-amber-50 text-amber-700 border-amber-100',
        purple: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    };
    return (
        <div className={`rounded-3xl p-4 sm:p-5 flex flex-col justify-between border shadow-2xs ${colors[color]}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold opacity-80">{label}</span>
                <Icon className="h-4 w-4 opacity-70" />
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight">{value.toLocaleString('en-US')}</p>
        </div>
    );
}

export default function TenantDetailPage() {
    const { id }         = useParams<{ id: string }>();
    const searchParams   = useSearchParams();
    const router         = useRouter();
    const queryClient    = useQueryClient();

    const initialTab = searchParams.get('tab') === 'logs' ? 'logs' : 'overview';
    const [activeTab, setActiveTab] = useState<'overview' | 'logs'>(initialTab);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-tenant', id],
        queryFn:  () => fetchTenantDetail(id),
        enabled:  !!id,
    });

    const suspendMutation = useMutation({
        mutationFn: () => suspendTenant(id),
        onSuccess: () => { toast.success('تم تعليق الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); },
        onError:   () => {},
    });

    const activateMutation = useMutation({
        mutationFn: () => activateTenant(id),
        onSuccess: () => { toast.success('تم تفعيل الحساب'); queryClient.invalidateQueries({ queryKey: ['admin-tenant', id] }); },
        onError:   () => {},
    });

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto animate-pulse" dir="rtl">
                <div className="h-8 w-40 bg-slate-100 rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
                </div>
                <div className="h-60 bg-slate-100 rounded-2xl" />
            </div>
        );
    }

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/admin/tenants');
        }
    };

    if (!data) return (
        <div className="p-6 text-center text-slate-400" dir="rtl">
            <p>معلم غير موجود</p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
                العودة
            </Button>
        </div>
    );

    const { teacher, studentCount, groupCount, sessionsThisMonth, subscription } = data;
    const isActive = teacher.isActive;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            {/* Back Button */}
            <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
            >
                <ArrowRight className="h-4 w-4" />
                العودة لقائمة العملاء
            </button>

            {/* Teacher Header Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-black text-primary shrink-0">
                        {teacher.name.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{teacher.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                                {isActive ? 'حساب نشط' : 'حساب موقوف'}
                            </span>
                        </div>
                        {teacher.centerName && <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{teacher.centerName}</p>}
                        <p className="text-xs text-slate-400 mt-1">
                            عضو منذ {new Date(teacher.createdAt).toLocaleDateString('ar-EG')}
                        </p>
                    </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <EditTeacherModal teacher={teacher} />
                    <AddSubscriptionModal tenantId={id} disabled={!isActive} />

                    {isActive ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => suspendMutation.mutate()}
                            disabled={suspendMutation.isPending}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50 rounded-xl text-xs h-9 gap-1"
                        >
                            <UserX className="h-3.5 w-3.5" />
                            تعليق
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activateMutation.mutate()}
                            disabled={activateMutation.isPending}
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-xl text-xs h-9 gap-1"
                        >
                            <UserCheck className="h-3.5 w-3.5" />
                            تفعيل
                        </Button>
                    )}

                    <DeleteTenantModal
                        tenantId={id}
                        teacherName={teacher.name}
                        trigger={
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl text-xs h-9 gap-1"
                            >
                                حذف المعلم
                            </Button>
                        }
                    />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        activeTab === 'overview'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    بيانات الحساب والاشتراك
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                        activeTab === 'logs'
                            ? 'bg-white text-primary shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    سجل النشاط والعمليات
                </button>
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-5">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <StatPill icon={Users}        label="إجمالي الطلاب"      value={studentCount}      color="blue"   />
                        <StatPill icon={BookOpen}      label="المجموعات"           value={groupCount}        color="purple" />
                        <StatPill icon={CalendarCheck} label="حصص هذا الشهر"      value={sessionsThisMonth} color="green"  />
                        <StatPill icon={TrendingUp}    label="حالة الاشتراك"
                            value={subscription?.status === 'ACTIVE' ? 1 : 0}
                            color={subscription?.status === 'ACTIVE' ? 'green' : 'orange'}
                        />
                    </div>

                    {/* Detailed Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        {/* Profile Info */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6">
                            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-50">
                                بيانات الحساب
                            </h2>
                            <InfoRow label="الاسم"    value={teacher.name} />
                            <InfoRow label="الهاتف"   value={teacher.phone} />
                            <InfoRow label="البريد"   value={teacher.email} />
                            <InfoRow label="المراحل"  value={formatStages(teacher.stages)} />
                            <InfoRow label="متابعة الواجبات" value={teacher.features?.homeworkTracking ? 'مفعلة 📚' : 'معطلة ⚪'} />
                            <InfoRow label="الحالة"   value={isActive ? 'نشط ✅' : 'موقوف ❌'} />
                        </div>

                        {/* Subscription Info */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 sm:p-6">
                            <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-50">
                                تفاصيل الاشتراك الحالي
                            </h2>
                            {subscription ? (
                                <>
                                    <InfoRow label="الخطة"      value={subscription.planTier} />
                                    <InfoRow label="المدة"       value={`${subscription.durationMonths} شهر`} />
                                    <InfoRow label="الحالة"      value={subscription.status === 'ACTIVE' ? 'نشط ✅' : 'منتهي ❌'} />
                                    <InfoRow label="تنتهي في"   value={new Date(subscription.endDate).toLocaleDateString('ar-EG')} />
                                </>
                            ) : (
                                <div className="py-8 text-center text-slate-400">
                                    <p className="text-sm">لا يوجد اشتراك نشط حالياً</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <TeacherActivityLogs tenantId={id} teacherName={teacher.name} />
            )}
        </div>
    );
}

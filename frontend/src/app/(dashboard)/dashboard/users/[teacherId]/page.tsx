'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '@/lib/api/users';
import { fetchTeacherSubscriptions } from '@/lib/api/subscriptions';
import { useAuthStore } from '@/lib/store/auth.store';
import type { IUser } from '@/types/user.types';
import type { ISubscription } from '@/types/subscription.types';
import { PLAN_LABELS, DURATION_LABELS } from '@/types/subscription.types';
import { RenewSubscriptionModal } from '@/components/subscriptions/RenewSubscriptionModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ArrowRight,
    Phone,
    GraduationCap,
    CreditCard,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    ACTIVE:  { label: 'نشط',   cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
    EXPIRED: { label: 'منتهي', cls: 'bg-red-100   text-red-600',    icon: XCircle      },
    PENDING: { label: 'معلق',  cls: 'bg-amber-100 text-amber-700',  icon: Clock        },
};

export default function TeacherDetailPage() {
    const params = useParams();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const teacherId = params['teacherId'] as string;

    const [renewSub, setRenewSub] = useState<ISubscription | null>(null);

    // Guard — superAdmin only
    if (user?.role !== 'superAdmin') {
        return (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                غير مصرح لك بالوصول.
            </div>
        );
    }

    // Fetch teacher from users list and find by id
    const { data: usersData, isLoading: loadingUsers } = useQuery({
        queryKey: ['users'],
        queryFn: () => fetchUsers(),
    });

    const { data: subscriptions = [], isLoading: loadingSubs, refetch: refetchSubs } = useQuery<ISubscription[]>({
        queryKey: ['teacherSubscriptions', teacherId],
        queryFn: () => fetchTeacherSubscriptions(teacherId),
        enabled: !!teacherId,
    });

    const allUsers = (usersData as any)?.data ?? (usersData as any) ?? [];
    const teacher: IUser | undefined = Array.isArray(allUsers)
        ? allUsers.find((u: IUser) => u._id === teacherId)
        : undefined;

    const isLoading = loadingUsers || loadingSubs;

    const activeSubscription = subscriptions.find((s) => s.status === 'ACTIVE');

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!teacher) {
        return (
            <div className="bg-amber-50 text-amber-700 p-6 rounded-xl border border-amber-100 text-center font-bold">
                المعلم غير موجود.
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Back */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
            >
                <ArrowRight className="h-4 w-4" />
                عودة
            </button>

            {/* Teacher Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
                            {teacher.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{teacher.name}</h1>
                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                                <span className="flex items-center gap-1 text-sm text-gray-500" dir="ltr">
                                    <Phone className="h-3.5 w-3.5" />
                                    {teacher.phone}
                                </span>
                                {teacher.stage && (
                                    <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <GraduationCap className="h-3.5 w-3.5" />
                                        {teacher.stage === 'PREPARATORY' ? 'إعدادي' : 'ثانوي'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge className={cn(
                            'text-xs font-semibold',
                            teacher.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        )}>
                            {teacher.isActive ? 'نشط' : 'غير نشط'}
                        </Badge>
                        <Button
                            size="sm"
                            className="gap-2 bg-primary hover:bg-primary/90"
                            onClick={() => setRenewSub(activeSubscription ?? {
                                _id: '',
                                teacherId,
                                planTier: 'BASIC',
                                durationMonths: 1,
                                startDate: new Date().toISOString(),
                                endDate: new Date().toISOString(),
                                amount: 0,
                                status: 'EXPIRED',
                                createdAt: '',
                                updatedAt: '',
                            } as ISubscription)}
                        >
                            <RefreshCw className="h-4 w-4" />
                            {activeSubscription ? 'تجديد الاشتراك' : 'إضافة اشتراك'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Subscription Summary */}
            {activeSubscription && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-xl border border-green-100 p-4">
                        <p className="text-xs text-green-600 mb-1">الباقة الحالية</p>
                        <p className="text-lg font-bold text-green-800">{PLAN_LABELS[activeSubscription.planTier]}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                        <p className="text-xs text-blue-600 mb-1">تنتهي في</p>
                        <p className="text-lg font-bold text-blue-800">
                            {new Date(activeSubscription.endDate).toLocaleDateString('ar-EG')}
                        </p>
                    </div>
                    <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
                        <p className="text-xs text-purple-600 mb-1">المبلغ المدفوع</p>
                        <p className="text-lg font-bold text-purple-800">{activeSubscription.amount.toLocaleString()} ج.م</p>
                    </div>
                </div>
            )}

            {/* Subscription History */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        سجل الاشتراكات ({subscriptions.length})
                    </h2>
                </div>

                {subscriptions.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">لا توجد اشتراكات مسجلة لهذا المعلم</div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-50">
                            {subscriptions.map((sub) => {
                                const cfg = STATUS_CONFIG[sub.status] ?? { label: sub.status, cls: 'bg-gray-100 text-gray-500', icon: Clock };
                                const StatusIcon = cfg.icon;
                                return (
                                    <div key={sub._id} className="px-4 py-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <span className="font-bold text-gray-900 text-sm">{PLAN_LABELS[sub.planTier]}</span>
                                                <span className="text-xs text-gray-500 mr-2">· {DURATION_LABELS[sub.durationMonths]}</span>
                                            </div>
                                            <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full', cfg.cls)}>
                                                <StatusIcon className="h-3 w-3" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>{new Date(sub.startDate).toLocaleDateString('ar-EG')} ← {new Date(sub.endDate).toLocaleDateString('ar-EG')}</span>
                                            <span className="font-bold text-gray-800">{sub.amount.toLocaleString()} ج</span>
                                        </div>
                                        <div className="mt-2">
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 w-full" onClick={() => setRenewSub(sub)}>
                                                <RefreshCw className="h-3 w-3" /> تجديد
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-right font-semibold text-gray-500 px-6 py-3">الباقة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">المدة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">المبلغ</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">من</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">إلى</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {subscriptions.map((sub) => {
                                        const cfg = STATUS_CONFIG[sub.status] ?? { label: sub.status, cls: 'bg-gray-100 text-gray-500', icon: Clock };
                                        const StatusIcon = cfg.icon;
                                        return (
                                            <tr key={sub._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-3 font-semibold text-gray-900">{PLAN_LABELS[sub.planTier]}</td>
                                                <td className="px-4 py-3 text-gray-600">{DURATION_LABELS[sub.durationMonths]}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{sub.amount.toLocaleString()} ج</td>
                                                <td className="px-4 py-3 text-gray-500">{new Date(sub.startDate).toLocaleDateString('ar-EG')}</td>
                                                <td className="px-4 py-3 text-gray-500">{new Date(sub.endDate).toLocaleDateString('ar-EG')}</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full', cfg.cls)}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {cfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setRenewSub(sub)}>
                                                        <RefreshCw className="h-3 w-3" /> تجديد
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Renew Modal */}
            <RenewSubscriptionModal
                open={renewSub !== null}
                onOpenChange={(v) => { if (!v) setRenewSub(null); }}
                subscription={renewSub}
            />
        </div>
    );
}

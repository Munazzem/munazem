'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Trash2,
    AlertTriangle,
    ShieldAlert,
    Users,
    BookOpen,
    CalendarCheck,
    Receipt,
    FileSpreadsheet,
    Loader2,
    Lock,
} from 'lucide-react';
import { fetchTenantDeletionImpact, deleteTenant, type TenantDeletionImpact } from '@/lib/api/admin';
import { toast } from 'sonner';

interface DeleteTenantModalProps {
    tenantId: string;
    teacherName: string;
    onDeleted?: () => void;
    trigger?: React.ReactNode;
}

export function DeleteTenantModal({
    tenantId,
    teacherName,
    onDeleted,
    trigger,
}: DeleteTenantModalProps) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'soft' | 'permanent'>('soft');
    const [confirmInput, setConfirmInput] = useState('');
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: impact, isLoading: loadingImpact } = useQuery({
        queryKey: ['admin-tenant-impact', tenantId],
        queryFn: () => fetchTenantDeletionImpact(tenantId),
        enabled: open,
    });

    const mutation = useMutation({
        mutationFn: () => deleteTenant(tenantId, { permanent: mode === 'permanent' }),
        onSuccess: (res) => {
            toast.success(res.message || 'تمت العملية بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            setOpen(false);
            if (onDeleted) {
                onDeleted();
            } else {
                router.push('/admin/tenants');
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء تنفيذ الحذف');
        },
    });

    const isConfirmed = mode === 'soft' || confirmInput.trim() === teacherName.trim();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? (
                    trigger
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-xs h-7 gap-1"
                    >
                        <Trash2 className="h-3 w-3" />
                        حذف
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-lg w-[95vw] p-5 sm:p-6" dir="rtl">
                <DialogHeader className="text-right">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900">
                                إدارة حذف حساب: {teacherName}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                يرجى قراءة تقرير الأثر قبل اتخاذ أي إجراء لحماية سلامة بيانات المنصة
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Deletion Mode Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl my-2">
                    <button
                        type="button"
                        onClick={() => setMode('soft')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                            mode === 'soft'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        تعطيل وأرشفة (موصى به)
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('permanent')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                            mode === 'permanent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-rose-600'
                        }`}
                    >
                        حذف نهائي شامل 🔥
                    </button>
                </div>

                {/* Impact Analysis Section */}
                <div className="space-y-3">
                    {loadingImpact ? (
                        <div className="p-6 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                            <p className="text-xs">جارٍ فحص وتحليل السجلات المرتبطة بالمعلم...</p>
                        </div>
                    ) : impact?.counts ? (
                        <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-3.5 space-y-2">
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                السجلات المرتبطة بهذا المعلم في قاعدة البيانات:
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">الطلاب</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.studentsCount}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">المساعدون</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.assistantsCount}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">المجموعات</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.groupsCount}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">الحصص</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.sessionsCount}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">حضور وغياب</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.attendancesCount}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="block text-slate-400 text-[10px]">معاملات مالية</span>
                                    <span className="font-extrabold text-slate-800 text-sm">{impact.counts.transactionsCount}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {mode === 'soft' ? (
                        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 leading-relaxed">
                            <span className="font-bold block mb-1">ماذا يعني التعطيل والأرشفة؟</span>
                            سيتم إيقاف حساب المعلم وحسابات جميع مساعديه فوراً، ولن يتمكن أي منهم من تسجيل الدخول. يتم إخفاء بياناته مع الاحتفاظ بجميع السجلات والبيانات المالية في الأرشيف الآمن.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 leading-relaxed">
                                <span className="font-bold block mb-1">تحذير أمني شديد:</span>
                                سيتم مسح المعلم وكافة الطلاب والمجموعات والحصص وسجلات الحضور والامتحانات والمعاملات المالية نهائياً وبلا رجعة. لا يمكن استعادة هذه البيانات بعد إتمام الحذف.
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">
                                    لتأكيد الحذف النهائي، اكتب اسم المعلم صراحة: <span className="text-rose-600 underline font-extrabold">{teacherName}</span>
                                </label>
                                <Input
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    placeholder={`اكتب "${teacherName}" للتأكيد`}
                                    className="border-rose-200 focus:ring-rose-500/20"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={mutation.isPending}
                        className="rounded-xl text-xs font-semibold"
                    >
                        إلغاء
                    </Button>
                    <Button
                        type="button"
                        onClick={() => mutation.mutate()}
                        disabled={!isConfirmed || mutation.isPending}
                        className={`rounded-xl text-xs font-bold gap-1.5 ${
                            mode === 'permanent'
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                    >
                        {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {mode === 'permanent' ? 'تأكيد الحذف النهائي الشامل' : 'تأكيد التعطيل والأرشفة'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

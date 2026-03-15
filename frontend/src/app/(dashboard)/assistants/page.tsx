'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, addUser, deleteUser, paySalary } from '@/lib/api/users';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from 'sonner';
import {
    UserPlus,
    Trash2,
    Loader2,
    Search,
    Users,
    Phone,
    ShieldCheck,
    AlertCircle,
    Banknote,
} from 'lucide-react';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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

// ─────────────────────────────────────────────────────────────────────────────
export default function AssistantsPage() {
    const user = useAuthStore((s) => s.user);

    // Only teachers can manage assistants
    if (user?.role !== 'teacher') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3" dir="rtl">
                <AlertCircle className="h-12 w-12 text-red-300" />
                <p className="text-gray-500 font-medium">غير مصرح لك بالوصول لهذه الصفحة</p>
            </div>
        );
    }

    return <AssistantsContent />;
}

function AssistantsContent() {
    const queryClient = useQueryClient();
    const [search,        setSearch]        = useState('');
    const [showAdd,       setShowAdd]        = useState(false);
    const [deleteTarget,  setDeleteTarget]   = useState<{ id: string; name: string } | null>(null);
    const [salaryTarget,  setSalaryTarget]   = useState<{ id: string; name: string; salary: number | null } | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['assistants', search],
        queryFn:  () => fetchUsers({ search }),
    });

    const assistants: any[] = Array.isArray((data as any)?.data)
        ? (data as any).data.filter((u: any) => u.role === 'assistant')
        : Array.isArray(data)
        ? (data as any[]).filter((u: any) => u.role === 'assistant')
        : [];

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            toast.success('تم حذف المساعد بنجاح');
            queryClient.invalidateQueries({ queryKey: ['assistants'] });
            setDeleteTarget(null);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        إدارة المساعدين
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        المساعدون لديهم نفس صلاحيات المدرس تقريباً، ماعدا التقارير المالية
                    </p>
                </div>
                <Button onClick={() => setShowAdd(true)} className="gap-2 shrink-0">
                    <UserPlus className="h-4 w-4" />
                    إضافة مساعد
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                <Input
                    placeholder="ابحث بالاسم أو الهاتف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 bg-white border-gray-200"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-4 sm:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <TableSkeleton rows={6} columns={4} />
                    </div>
                ) : assistants.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">لا يوجد مساعدون بعد</p>
                        <p className="text-xs text-gray-400 mt-1">اضغط "إضافة مساعد" للبدء</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <th className="text-right font-semibold text-gray-500 px-6 py-3">المساعد</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">رقم الهاتف</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الراتب الشهري</th>
                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                        <th className="text-center font-semibold text-gray-500 px-4 py-3 w-24">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {assistants.map((a: any) => (
                                        <tr key={a._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <span className="text-sm font-bold text-primary">
                                                            {a.name?.charAt(0) ?? '؟'}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium text-gray-900">{a.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600" dir="ltr">
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                                                    {a.phone ?? '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 font-medium">
                                                {a.salary != null ? `${a.salary.toLocaleString('ar-EG')} ج` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    className={cn('text-xs', a.isActive
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                                        : 'bg-red-100 text-red-600 hover:bg-red-100'
                                                    )}
                                                >
                                                    {a.isActive ? 'فعّال' : 'موقوف'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => setSalaryTarget({ id: a._id, name: a.name, salary: a.salary ?? null })}
                                                        title="دفع الراتب"
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                                                    >
                                                        <Banknote className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget({ id: a._id, name: a.name })}
                                                        title="حذف"
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {assistants.map((a: any) => (
                                <div key={a._id} className="p-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-bold text-primary">
                                                    {a.name?.charAt(0) ?? '؟'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate">{a.name}</p>
                                                <p className="text-xs text-gray-400 truncate" dir="ltr">{a.phone ?? '—'}</p>
                                                {a.salary != null && (
                                                    <p className="text-xs text-green-600 font-medium mt-0.5">
                                                        راتب: {a.salary.toLocaleString('ar-EG')} ج
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge className={cn('text-xs', a.isActive
                                                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                                : 'bg-red-100 text-red-600 hover:bg-red-100'
                                            )}>
                                                {a.isActive ? 'فعّال' : 'موقوف'}
                                            </Badge>
                                            <button
                                                onClick={() => setSalaryTarget({ id: a._id, name: a.name, salary: a.salary ?? null })}
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                                            >
                                                <Banknote className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget({ id: a._id, name: a.name })}
                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add Modal */}
            <AddAssistantModal
                open={showAdd}
                onOpenChange={setShowAdd}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['assistants'] });
                    setShowAdd(false);
                }}
            />

            {/* Pay Salary Modal */}
            {salaryTarget && (
                <PaySalaryModal
                    open={!!salaryTarget}
                    assistant={salaryTarget}
                    onOpenChange={(v) => !v && setSalaryTarget(null)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['assistants'] });
                        setSalaryTarget(null);
                    }}
                />
            )}

            {/* Delete Confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف المساعد</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف <strong>{deleteTarget?.name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Add Assistant Modal ───────────────────────────────────────────────────────
function AddAssistantModal({
    open, onOpenChange, onSuccess,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSuccess: () => void;
}) {
    const [name,     setName]     = useState('');
    const [phone,    setPhone]    = useState('');
    const [password, setPassword] = useState('');
    const [salary,   setSalary]   = useState('');
    const [errors,   setErrors]   = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: (data: any) => addUser(data),
        onSuccess: () => {
            toast.success('تم إضافة المساعد بنجاح');
            setName(''); setPhone(''); setPassword(''); setSalary('');
            onSuccess();
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    const validate = () => {
        const e: Record<string, string> = {};
        if (name.trim().length < 3)  e.name     = 'الاسم يجب أن يكون 3 أحرف على الأقل';
        if (phone.trim().length < 10) e.phone    = 'رقم الهاتف غير صحيح';
        if (password.length < 6)      e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        if (salary && isNaN(Number(salary))) e.salary = 'الراتب يجب أن يكون رقماً';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        mutation.mutate({
            name:     name.trim(),
            phone:    phone.trim(),
            password,
            role:     'assistant',
            salary:   salary ? Number(salary) : null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        إضافة مساعد جديد
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">الاسم *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="اسم المساعد"
                            autoComplete="off"
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">رقم الهاتف *</label>
                        <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                            autoComplete="off"
                        />
                        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">كلمة المرور *</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="6 أحرف على الأقل"
                            dir="ltr"
                            autoComplete="new-password"
                        />
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            الراتب الشهري <span className="text-gray-400 font-normal">(اختياري)</span>
                        </label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="0"
                                value={salary}
                                onChange={(e) => setSalary(e.target.value)}
                                placeholder="0"
                                dir="ltr"
                                className="pl-10"
                                autoComplete="off"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">ج</span>
                        </div>
                        {errors.salary && <p className="text-red-500 text-xs mt-1">{errors.salary}</p>}
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                        <strong>ملاحظة:</strong> المساعد سيتمكن من إدارة الطلاب، الحصص، الامتحانات، والمذكرات — لكن لن يرى التقارير المالية الشاملة.
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            إضافة
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Pay Salary Modal ──────────────────────────────────────────────────────────
function PaySalaryModal({
    open, assistant, onOpenChange, onSuccess,
}: {
    open: boolean;
    assistant: { id: string; name: string; salary: number | null };
    onOpenChange: (v: boolean) => void;
    onSuccess: () => void;
}) {
    const [amount, setAmount] = useState(assistant.salary != null ? String(assistant.salary) : '');
    const [notes,  setNotes]  = useState('');
    const [error,  setError]  = useState('');

    const mutation = useMutation({
        mutationFn: () => paySalary(assistant.id, { amount: Number(amount), notes: notes.trim() || undefined }),
        onSuccess: () => {
            toast.success(`تم تسجيل راتب ${assistant.name} بنجاح`);
            onSuccess();
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) { setError('أدخل مبلغاً صحيحاً'); return; }
        setError('');
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3 flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-green-600" />
                        دفع راتب — {assistant.name}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">المبلغ *</label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                dir="ltr"
                                className="pl-10"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">ج</span>
                        </div>
                        {assistant.salary != null && (
                            <p className="text-xs text-gray-400 mt-1">الراتب الشهري المحدد: {assistant.salary.toLocaleString('ar-EG')} ج</p>
                        )}
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات <span className="text-gray-400 font-normal">(اختياري)</span></label>
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={`راتب ${assistant.name}`}
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                        سيتم تسجيل هذا المبلغ كمصروف (راتب) في سجل الماليات.
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            تأكيد الدفع
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

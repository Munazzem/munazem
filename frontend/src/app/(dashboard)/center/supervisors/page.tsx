'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ShieldCheck,
    Plus,
    Edit2,
    Trash2,
    Lock,
    Phone,
    Building2,
    Check,
    Loader2,
    AlertCircle,
    UserCheck,
} from 'lucide-react';
import {
    fetchCenterSupervisors,
    createCenterSupervisor,
    updateCenterSupervisor,
    deleteCenterSupervisor,
    fetchMyCenters,
} from '@/lib/api/centers';
import { CenterSupervisorType, ISupervisorPermissions, ICenter } from '@/types/center.types';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

const DEFAULT_FINANCIAL_PERMS: ISupervisorPermissions = {
    canViewFinancials: true,
    canRecordPayments: true,
    canManageExpenses: true,
    canViewReports: true,
    canTakeAttendance: false,
    canEditAttendance: false,
    canViewAttendance: true,
    canManageStudents: true,
    canManageTeachers: false,
    canManagePackages: false,
    canCreateExams: false,
    canSendNotifications: false,
};

const DEFAULT_ATTENDANCE_PERMS: ISupervisorPermissions = {
    canViewFinancials: false,
    canRecordPayments: false,
    canManageExpenses: false,
    canViewReports: false,
    canTakeAttendance: true,
    canEditAttendance: true,
    canViewAttendance: true,
    canManageStudents: true,
    canManageTeachers: false,
    canManagePackages: false,
    canCreateExams: false,
    canSendNotifications: true,
};

const ALL_PERMISSION_KEYS: Array<{ key: keyof ISupervisorPermissions; label: string; group: string }> = [
    { key: 'canViewFinancials', label: 'الاطلاع على الحسابات والماليات', group: 'الماليات' },
    { key: 'canRecordPayments', label: 'تسجيل المقبوضات والمدفوعات', group: 'الماليات' },
    { key: 'canManageExpenses', label: 'إدارة المصروفات اليومية', group: 'الماليات' },
    { key: 'canViewReports', label: 'الاطلاع على التقارير المالية', group: 'الماليات' },

    { key: 'canTakeAttendance', label: 'تسجيل الحضور والغياب (باركود/يدوي)', group: 'الحضور والغياب' },
    { key: 'canEditAttendance', label: 'تعديل سجلات الحضور السابقة', group: 'الحضور والغياب' },
    { key: 'canViewAttendance', label: 'عرض كشوفات الحضور', group: 'الحضور والغياب' },

    { key: 'canManageStudents', label: 'إدارة الطلاب واشتراكاتهم', group: 'الإدارة العامة' },
    { key: 'canManageTeachers', label: 'إدارة المدرسين', group: 'الإدارة العامة' },
    { key: 'canManagePackages', label: 'إدارة الباقات التعليمية', group: 'الإدارة العامة' },
    { key: 'canSendNotifications', label: 'إرسال رسائل وإشعارات للطلاب', group: 'الإدارة العامة' },
];

export default function CenterSupervisorsPage() {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingSupervisor, setEditingSupervisor] = useState<any | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [supervisorType, setSupervisorType] = useState<CenterSupervisorType>('FINANCIAL');
    const [branchId, setBranchId] = useState('');
    const [permissions, setPermissions] = useState<ISupervisorPermissions>(DEFAULT_FINANCIAL_PERMS);

    const { data: supervisors = [], isLoading } = useQuery<any[]>({
        queryKey: ['center', 'supervisors'],
        queryFn: fetchCenterSupervisors,
    });

    const { data: centers = [] } = useQuery<ICenter[]>({
        queryKey: ['center', 'my-centers'],
        queryFn: fetchMyCenters,
    });

    const createMutation = useMutation({
        mutationFn: createCenterSupervisor,
        onSuccess: () => {
            toast.success('تم إنشاء حساب المشرف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'supervisors'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنشاء المشرف');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenterSupervisor(id, data),
        onSuccess: () => {
            toast.success('تم تعديل بيانات المشرف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'supervisors'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعديل المشرف');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterSupervisor,
        onSuccess: () => {
            toast.success('تم تعطيل حساب المشرف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'supervisors'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعطيل المشرف');
        },
    });

    const handleOpenAdd = () => {
        setEditingSupervisor(null);
        setName('');
        setPhone('');
        setPassword('');
        setSupervisorType('FINANCIAL');
        setBranchId(centers[0]?._id || '');
        setPermissions(DEFAULT_FINANCIAL_PERMS);
        setIsAddOpen(true);
    };

    const handleOpenEdit = (supervisor: any) => {
        setEditingSupervisor(supervisor);
        setName(supervisor.name);
        setPhone(supervisor.phone);
        setPassword('');
        setSupervisorType(supervisor.supervisorType || 'CUSTOM');
        setBranchId(supervisor.centerId?._id || supervisor.centerId || '');
        setPermissions(supervisor.supervisorPermissions || DEFAULT_FINANCIAL_PERMS);
        setIsAddOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddOpen(false);
        setEditingSupervisor(null);
    };

    const handleTypeChange = (type: CenterSupervisorType) => {
        setSupervisorType(type);
        if (type === 'FINANCIAL') setPermissions(DEFAULT_FINANCIAL_PERMS);
        else if (type === 'ATTENDANCE') setPermissions(DEFAULT_ATTENDANCE_PERMS);
    };

    const togglePermission = (key: keyof ISupervisorPermissions) => {
        setPermissions((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
            toast.error('يرجى ملء الاسم ورقم الهاتف');
            return;
        }

        if (!editingSupervisor && (!password || password.length < 6)) {
            toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        const payload: any = {
            name: name.trim(),
            phone: phone.trim(),
            supervisorType,
            supervisorPermissions: permissions,
            branchId: branchId || undefined,
        };

        if (password) {
            payload.password = password;
        }

        if (editingSupervisor) {
            updateMutation.mutate({ id: editingSupervisor._id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                        <span>مشرفو السنتر والفروع</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إدارة حسابات المشرفين الماليين ومشرفي الحضور والغياب وتعيين صلاحياتهم لكل فرع.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إضافة مشرف جديد</span>
                    </Button>
                </div>
            </div>

            {/* Supervisors Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : supervisors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center">
                    <ShieldCheck className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا يوجد مشرفين مسجلين بالسنتر بعد</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بإنشاء حسابات للمشرفين لمساعدتك في إدارة حضور الطلاب أو المعاملات المالية بالسنتر.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إضافة مشرف الآن
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {supervisors.map((supervisor) => {
                        const branchName =
                            typeof supervisor.centerId === 'object'
                                ? supervisor.centerId?.name
                                : 'الفرع الرئيسي';

                        const typeLabel =
                            supervisor.supervisorType === 'FINANCIAL'
                                ? 'مشرف مالي'
                                : supervisor.supervisorType === 'ATTENDANCE'
                                ? 'مشرف حضور وغياب'
                                : 'مشرف مخصص';

                        const typeColor =
                            supervisor.supervisorType === 'FINANCIAL'
                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : supervisor.supervisorType === 'ATTENDANCE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-700 border-gray-200';

                        return (
                            <div
                                key={supervisor._id}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all p-5 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                                                {supervisor.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-gray-900">{supervisor.name}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                                    <Phone className="h-3 w-3" />
                                                    <span>{supervisor.phone}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`text-xs font-bold ${typeColor}`}>
                                            {typeLabel}
                                        </Badge>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                        <span className="flex items-center gap-1 font-medium text-gray-600">
                                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                            {branchName}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={supervisor.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200 text-[11px]' : 'bg-red-50 text-red-600 border-red-200 text-[11px]'}
                                        >
                                            {supervisor.isActive ? 'حساب نشط' : 'معطل'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenEdit(supervisor)}
                                        className="h-8 px-2.5 text-xs font-bold text-gray-600 hover:text-primary rounded-lg"
                                    >
                                        <Edit2 className="h-3.5 w-3.5 ml-1" />
                                        تعديل الصلاحيات
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (confirm(`هل أنت متأكد من تعطيل حساب المشرف ${supervisor.name}؟`)) {
                                                deleteMutation.mutate(supervisor._id);
                                            }
                                        }}
                                        className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                                        تعطيل
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingSupervisor ? 'تعديل بيانات وصلاحيات المشرف' : 'إضافة مشرف جديد للسنتر'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم المشرف *</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: أحمد عبد الله"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">رقم الهاتف (اسم الدخول) *</label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="01XXXXXXXXX"
                                    className="rounded-xl border-gray-200"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    {editingSupervisor ? 'كلمة المرور (اتركها فارغة للتخطي)' : 'كلمة المرور *'}
                                </label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••"
                                    className="rounded-xl border-gray-200"
                                    required={!editingSupervisor}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">نوع المشرف *</label>
                                <select
                                    value={supervisorType}
                                    onChange={(e) => handleTypeChange(e.target.value as CenterSupervisorType)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    <option value="FINANCIAL">مشرف مالي (Financial)</option>
                                    <option value="ATTENDANCE">مشرف حضور وغياب (Attendance)</option>
                                    <option value="CUSTOM">مشرف مخصص (Custom Permissions)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">الفرع المعين عليه *</label>
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    {centers.map((c) => (
                                        <option key={c._id} value={c._id}>
                                            {c.name} {!c.parentCenterId ? '(الرئيسي)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Granular Permissions Checklist */}
                        <div className="pt-2 border-t border-gray-100">
                            <label className="text-xs font-bold text-gray-800 block mb-2">
                                الصلاحيات التفصيلية للمشرف:
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                                {ALL_PERMISSION_KEYS.map((perm) => {
                                    const isChecked = !!permissions[perm.key];
                                    return (
                                        <div
                                            key={perm.key}
                                            onClick={() => togglePermission(perm.key)}
                                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-bold ${
                                                isChecked
                                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                                    : 'bg-white hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            <span>{perm.label}</span>
                                            <div className={`h-4 w-4 rounded flex items-center justify-center border ${isChecked ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                                                {isChecked && <Check className="h-3 w-3" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {(createMutation.isPending || updateMutation.isPending) && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                {editingSupervisor ? 'حفظ التعديلات' : 'إنشاء المشرف'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseModal}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

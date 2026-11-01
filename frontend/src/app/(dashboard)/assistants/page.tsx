'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, addUser, deleteUser, paySalary, updateUser } from '@/lib/api/users';
import { toggleAssistantAccess } from '@/lib/api/auth';
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
    Lock,
    Unlock,
    Edit2,
    RotateCcw,
    Clock,
    Check,
} from 'lucide-react';
import { IAssistantPermissions, AssistantType } from '@/types/auth.types';
import { OfflineStorageService } from '@/lib/offline/storage.service';
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
const DEFAULT_ATTENDANCE_PERMS: IAssistantPermissions = {
    canTakeAttendance:    true,
    canEditAttendance:    true,
    canViewAttendance:    true,
    canManageSessions:    true,
    canRecordPayments:    false,
    canViewFinancials:    false,
    canManageStudents:    true,
    canManageGroups:      false,
    canCreateExams:       false,
    canGradeExams:        false,
    canManageNotebooks:   false,
    canSendNotifications: true,
};

const DEFAULT_FINANCIAL_PERMS: IAssistantPermissions = {
    canTakeAttendance:    false,
    canEditAttendance:    false,
    canViewAttendance:    true,
    canManageSessions:    false,
    canRecordPayments:    true,
    canViewFinancials:    true,
    canManageStudents:    true,
    canManageGroups:      false,
    canCreateExams:       false,
    canGradeExams:        false,
    canManageNotebooks:   true,
    canSendNotifications: false,
};

const DEFAULT_ACADEMIC_PERMS: IAssistantPermissions = {
    canTakeAttendance:    true,
    canEditAttendance:    false,
    canViewAttendance:    true,
    canManageSessions:    false,
    canRecordPayments:    false,
    canViewFinancials:    false,
    canManageStudents:    true,
    canManageGroups:      true,
    canCreateExams:       true,
    canGradeExams:        true,
    canManageNotebooks:   false,
    canSendNotifications: true,
};

const DEFAULT_FULL_PERMS: IAssistantPermissions = {
    canTakeAttendance:    true,
    canEditAttendance:    true,
    canViewAttendance:    true,
    canManageSessions:    true,
    canRecordPayments:    true,
    canViewFinancials:    true,
    canManageStudents:    true,
    canManageGroups:      true,
    canCreateExams:       true,
    canGradeExams:        true,
    canManageNotebooks:   true,
    canSendNotifications: true,
};

const ALL_ASSISTANT_PERMISSION_KEYS: Array<{ key: keyof IAssistantPermissions; label: string; group: string }> = [
    { key: 'canTakeAttendance', label: 'تسجيل الحضور والغياب (باركود/يدوي)', group: 'الحضور والحصص' },
    { key: 'canEditAttendance', label: 'تعديل سجلات الحضور السابقة', group: 'الحضور والحصص' },
    { key: 'canViewAttendance', label: 'عرض كشوفات وسجلات الحضور', group: 'الحضور والحصص' },
    { key: 'canManageSessions', label: 'بدء وإدارة وإنهاء الحصص', group: 'الحضور والحصص' },

    { key: 'canRecordPayments', label: 'تسجيل تحصيل المصاريف والاشتراكات', group: 'الماليات والاشتراكات' },
    { key: 'canViewFinancials', label: 'الاطلاع على ماليات ودفعات الطلاب', group: 'الماليات والاشتراكات' },

    { key: 'canManageStudents', label: 'إدارة وتعديل بيانات الطلاب والكروت', group: 'الطلاب والمجموعات' },
    { key: 'canManageGroups', label: 'إدارة وتعديل المجموعات الدراسية', group: 'الطلاب والمجموعات' },

    { key: 'canCreateExams', label: 'إنشاء وتعديل الامتحانات', group: 'الامتحانات والدرجات' },
    { key: 'canGradeExams', label: 'رصد وتعديل درجات الطلاب', group: 'الامتحانات والدرجات' },

    { key: 'canManageNotebooks', label: 'بيع وإدارة المذكرات والكتب', group: 'المذكرات والتواصل' },
    { key: 'canSendNotifications', label: 'إرسال إشعارات ورسائل للطلاب وأولياء الأمور', group: 'المذكرات والتواصل' },
];

const ASSISTANT_TYPE_LABELS: Record<AssistantType, { label: string; badgeClass: string }> = {
    ATTENDANCE: { label: 'مساعد حضور وغياب', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    FINANCIAL:  { label: 'مساعد مالي واشتراكات', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    ACADEMIC:   { label: 'مساعد أكاديمي وامتحانات', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    FULL:       { label: 'مساعد شامل', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    CUSTOM:     { label: 'صلاحيات مخصصة', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
};

function countActivePermissions(perms?: IAssistantPermissions): number {
    if (!perms) return 0;
    return Object.values(perms).filter(Boolean).length;
}

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
    const user = useAuthStore((s) => s.user);
    const loginStore = useAuthStore((s) => s.login);
    const token = useAuthStore((s) => s.token);

    const queryClient = useQueryClient();
    const [search,        setSearch]        = useState('');
    const [showAdd,       setShowAdd]        = useState(false);
    const [deleteTarget,  setDeleteTarget]   = useState<{ id: string; name: string } | null>(null);
    const [salaryTarget,  setSalaryTarget]   = useState<{ id: string; name: string; salary: number | null } | null>(null);
    const [editTarget,    setEditTarget]     = useState<{
        id: string;
        name: string;
        phone: string;
        salary: number | null;
        assistantType?: AssistantType;
        assistantPermissions?: IAssistantPermissions;
    } | null>(null);

    const [isAccessEnabled, setIsAccessEnabled] = useState(user?.assistantsAccessEnabled ?? true);

    const toggleMutation = useMutation({
        mutationFn: (enabled: boolean) => toggleAssistantAccess(enabled),
        onSuccess: (data) => {
            setIsAccessEnabled(data.assistantsAccessEnabled);
            if (user && token) {
                loginStore({ ...user, assistantsAccessEnabled: data.assistantsAccessEnabled }, token);
            }
            toast.success(data.assistantsAccessEnabled ? 'تم فتح النظام للمساعدين بنجاح' : 'تم إغلاق النظام وطرد المساعدين');
        },
        onError: () => {
            // Handled globally
        }
    });

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
        onSuccess: (res: any) => {
            const isOffline = typeof window !== 'undefined' && !navigator.onLine;
            if (isOffline) {
                if (res?.isPendingDelete) {
                    toast.warning(res?.message || 'تم تعليم المساعد للحذف: سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال');
                } else {
                    toast.success('تم مسح المساعد المحلي نهائياً');
                }
            } else {
                toast.success(res?.message || 'تم حذف المساعد بنجاح');
            }
            queryClient.invalidateQueries({ queryKey: ['assistants'] });
            setDeleteTarget(null);
        },
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
                <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                    <Button 
                        variant={isAccessEnabled ? "outline" : "destructive"}
                        onClick={() => toggleMutation.mutate(!isAccessEnabled)}
                        disabled={toggleMutation.isPending}
                        className={cn("gap-2 shrink-0 transition-all", isAccessEnabled ? "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800" : "")}
                    >
                        {toggleMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isAccessEnabled ? (
                            <Unlock className="h-4 w-4" />
                        ) : (
                            <Lock className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                            {isAccessEnabled ? 'النظام مفتوح للمساعدين' : 'النظام مغلق للمساعدين'}
                        </span>
                        <span className="sm:hidden">
                            {isAccessEnabled ? 'مفتوح' : 'مغلق'}
                        </span>
                    </Button>
                    <Button onClick={() => setShowAdd(true)} className="gap-2 shrink-0">
                        <UserPlus className="h-4 w-4" />
                        <span className="hidden sm:inline">إضافة مساعد</span>
                        <span className="sm:hidden">إضافة</span>
                    </Button>
                </div>
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
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">نوع وصلاحيات المساعد</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">رقم الهاتف</th>
                                        <th className="text-right font-semibold text-gray-500 px-4 py-3">الراتب الشهري</th>
                                        <th className="text-center font-semibold text-gray-500 px-4 py-3">الحالة</th>
                                        <th className="text-center font-semibold text-gray-500 px-4 py-3 w-24">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {assistants.map((a: any) => (
                                        <tr key={a._id} className={cn('hover:bg-gray-50/50 transition-colors', a.isPendingDelete && 'bg-red-50/70 border-r-4 border-r-red-500 opacity-90')}>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <span className="text-sm font-bold text-primary">
                                                            {a.name?.charAt(0) ?? '؟'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">
                                                            {a.isPendingDelete ? <del className="text-red-500">{a.name}</del> : a.name}
                                                        </span>
                                                        {a.isPendingDelete && (
                                                            <span className="text-[11px] font-semibold text-red-700 flex items-center gap-1 mt-0.5">
                                                                <Clock className="w-3 h-3 text-red-600 animate-pulse" />
                                                                معلق للحذف من السيرفر
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', (ASSISTANT_TYPE_LABELS[a.assistantType as AssistantType] || ASSISTANT_TYPE_LABELS.CUSTOM).badgeClass)}>
                                                        {(ASSISTANT_TYPE_LABELS[a.assistantType as AssistantType] || ASSISTANT_TYPE_LABELS.CUSTOM).label}
                                                    </span>
                                                    <span className="text-[11px] text-gray-400 font-medium">
                                                        {countActivePermissions(a.assistantPermissions)} من 12 صلاحية
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600" dir="ltr">
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                                                    {a.phone ?? '—'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 font-medium">
                                                {a.salary != null ? `${a.salary.toLocaleString('en-US')} ج` : '—'}
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
                                                {a.isPendingDelete ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 gap-1 rounded-lg"
                                                        onClick={async () => {
                                                            await OfflineStorageService.undoUserPendingDelete(a._id);
                                                            queryClient.invalidateQueries({ queryKey: ['assistants'] });
                                                            toast.success('تم التراجع عن حذف المساعد');
                                                        }}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        تراجع عن الحذف
                                                    </Button>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setSalaryTarget({ id: a._id, name: a.name, salary: a.salary ?? null })}
                                                            title="دفع الراتب"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                                                        >
                                                            <Banknote className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditTarget({
                                                                id: a._id,
                                                                name: a.name,
                                                                phone: a.phone,
                                                                salary: a.salary ?? null,
                                                                assistantType: a.assistantType || 'CUSTOM',
                                                                assistantPermissions: a.assistantPermissions,
                                                            })}
                                                            title="تعديل الصلاحيات والبيانات"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget({ id: a._id, name: a.name })}
                                                            title="حذف"
                                                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {assistants.map((a: any) => (
                                <div key={a._id} className={cn('p-4 flex items-center justify-between gap-3 transition-colors', a.isPendingDelete && 'bg-red-50/70 border-r-4 border-r-red-500 opacity-90')}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-bold text-primary">
                                                    {a.name?.charAt(0) ?? '؟'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate">
                                                    {a.isPendingDelete ? <del className="text-red-500">{a.name}</del> : a.name}
                                                </p>
                                                {a.isPendingDelete ? (
                                                    <span className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5 text-red-600 animate-pulse" />
                                                        معلق للحذف
                                                    </span>
                                                ) : (
                                                    <p className="text-xs text-gray-400 truncate" dir="ltr">{a.phone ?? '—'}</p>
                                                )}
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', (ASSISTANT_TYPE_LABELS[a.assistantType as AssistantType] || ASSISTANT_TYPE_LABELS.CUSTOM).badgeClass)}>
                                                        {(ASSISTANT_TYPE_LABELS[a.assistantType as AssistantType] || ASSISTANT_TYPE_LABELS.CUSTOM).label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        ({countActivePermissions(a.assistantPermissions)} صلاحية)
                                                    </span>
                                                </div>
                                                {a.salary != null && !a.isPendingDelete && (
                                                    <p className="text-xs text-green-600 font-medium mt-0.5">
                                                        راتب: {a.salary.toLocaleString('en-US')} ج
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {a.isPendingDelete ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 gap-1 rounded-lg"
                                                    onClick={async () => {
                                                        await OfflineStorageService.undoUserPendingDelete(a._id);
                                                        queryClient.invalidateQueries({ queryKey: ['assistants'] });
                                                        toast.success('تم التراجع عن حذف المساعد');
                                                    }}
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    تراجع
                                                </Button>
                                            ) : (
                                                <>
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
                                                        onClick={() => setEditTarget({
                                                            id: a._id,
                                                            name: a.name,
                                                            phone: a.phone,
                                                            salary: a.salary ?? null,
                                                            assistantType: a.assistantType || 'CUSTOM',
                                                            assistantPermissions: a.assistantPermissions,
                                                        })}
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget({ id: a._id, name: a.name })}
                                                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
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

            {/* Edit Modal */}
            {editTarget && (
                <EditAssistantModal
                    open={!!editTarget}
                    assistant={editTarget}
                    onOpenChange={(v) => !v && setEditTarget(null)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['assistants'] });
                        setEditTarget(null);
                    }}
                />
            )}

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
    const [name,          setName]          = useState('');
    const [phone,         setPhone]         = useState('');
    const [password,      setPassword]      = useState('');
    const [salary,        setSalary]        = useState('');
    const [assistantType, setAssistantType] = useState<AssistantType>('FULL');
    const [permissions,   setPermissions]   = useState<IAssistantPermissions>(DEFAULT_FULL_PERMS);
    const [errors,        setErrors]        = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: (data: any) => addUser(data),
        onSuccess: () => {
            toast.success('تم إضافة المساعد وتعيين صلاحياته بنجاح');
            setName(''); setPhone(''); setPassword(''); setSalary('');
            setAssistantType('FULL');
            setPermissions(DEFAULT_FULL_PERMS);
            onSuccess();
        },
    });

    const handleTypeChange = (type: AssistantType) => {
        setAssistantType(type);
        if (type === 'ATTENDANCE') setPermissions(DEFAULT_ATTENDANCE_PERMS);
        else if (type === 'FINANCIAL') setPermissions(DEFAULT_FINANCIAL_PERMS);
        else if (type === 'ACADEMIC') setPermissions(DEFAULT_ACADEMIC_PERMS);
        else if (type === 'FULL') setPermissions(DEFAULT_FULL_PERMS);
    };

    const togglePermission = (key: keyof IAssistantPermissions) => {
        setPermissions((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
        setAssistantType('CUSTOM');
    };

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
            name:                 name.trim(),
            phone:                phone.trim(),
            password,
            role:                 'assistant',
            salary:               salary ? Number(salary) : null,
            assistantType,
            assistantPermissions: permissions,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        إضافة مساعد جديد وتحديد صلاحياته
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">نوع المساعد وصلاحياته *</label>
                            <select
                                value={assistantType}
                                onChange={(e) => handleTypeChange(e.target.value as AssistantType)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="ATTENDANCE">مساعد حضور وغياب (تحضير وحصص)</option>
                                <option value="FINANCIAL">مساعد مالي واشتراكات (دفعات ومذكرات)</option>
                                <option value="ACADEMIC">مساعد أكاديمي (امتحانات ورصد درجات)</option>
                                <option value="FULL">مساعد شامل (جميع الصلاحيات)</option>
                                <option value="CUSTOM">صلاحيات مخصصة (تحديد يدوي)</option>
                            </select>
                        </div>
                    </div>

                    {/* Granular Permissions Checklist */}
                    <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-800">
                                الصلاحيات التفصيلية الممنوحة ({countActivePermissions(permissions)} من 12):
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleTypeChange('FULL')}
                                    className="text-[11px] text-primary hover:underline font-bold"
                                >
                                    تحديد الكل
                                </button>
                                <span className="text-gray-300">•</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAssistantType('CUSTOM');
                                        setPermissions({});
                                    }}
                                    className="text-[11px] text-gray-500 hover:underline font-bold"
                                >
                                    إلغاء الكل
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                            {ALL_ASSISTANT_PERMISSION_KEYS.map((perm) => {
                                const isChecked = !!permissions[perm.key];
                                return (
                                    <div
                                        key={perm.key}
                                        onClick={() => togglePermission(perm.key)}
                                        className={cn(
                                            'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-bold select-none',
                                            isChecked
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-white hover:bg-gray-100 text-gray-700 border border-transparent'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{perm.label}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">({perm.group})</span>
                                        </div>
                                        <div className={cn(
                                            'h-4 w-4 rounded flex items-center justify-center border transition-all',
                                            isChecked ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'
                                        )}>
                                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            إضافة المساعد
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Assistant Modal ───────────────────────────────────────────────────────
function EditAssistantModal({
    open, assistant, onOpenChange, onSuccess,
}: {
    open: boolean;
    assistant: {
        id: string;
        name: string;
        phone: string;
        salary: number | null;
        assistantType?: AssistantType;
        assistantPermissions?: IAssistantPermissions;
    };
    onOpenChange: (v: boolean) => void;
    onSuccess: () => void;
}) {
    const [name,          setName]          = useState(assistant.name);
    const [phone,         setPhone]         = useState(assistant.phone || '');
    const [password,      setPassword]      = useState('');
    const [salary,        setSalary]        = useState(assistant.salary != null ? String(assistant.salary) : '');
    const [assistantType, setAssistantType] = useState<AssistantType>(assistant.assistantType || 'CUSTOM');
    const [permissions,   setPermissions]   = useState<IAssistantPermissions>(assistant.assistantPermissions || DEFAULT_ATTENDANCE_PERMS);
    const [errors,        setErrors]        = useState<Record<string, string>>({});

    const mutation = useMutation({
        mutationFn: (data: any) => updateUser({ id: assistant.id, data }),
        onSuccess: () => {
            toast.success('تم تعديل بيانات وصلاحيات المساعد بنجاح');
            onSuccess();
        },
    });

    const handleTypeChange = (type: AssistantType) => {
        setAssistantType(type);
        if (type === 'ATTENDANCE') setPermissions(DEFAULT_ATTENDANCE_PERMS);
        else if (type === 'FINANCIAL') setPermissions(DEFAULT_FINANCIAL_PERMS);
        else if (type === 'ACADEMIC') setPermissions(DEFAULT_ACADEMIC_PERMS);
        else if (type === 'FULL') setPermissions(DEFAULT_FULL_PERMS);
    };

    const togglePermission = (key: keyof IAssistantPermissions) => {
        setPermissions((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
        setAssistantType('CUSTOM');
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (name.trim().length < 3)  e.name     = 'الاسم يجب أن يكون 3 أحرف على الأقل';
        if (phone.trim().length < 10) e.phone    = 'رقم الهاتف غير صحيح';
        if (password && password.length < 6) e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        if (salary && isNaN(Number(salary))) e.salary = 'الراتب يجب أن يكون رقماً';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        
        const data: any = {
            name:                 name.trim(),
            phone:                phone.trim(),
            salary:               salary ? Number(salary) : null,
            assistantType,
            assistantPermissions: permissions,
        };
        if (password) data.password = password;

        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3 flex items-center gap-2">
                        <Edit2 className="h-5 w-5 text-blue-600" />
                        تعديل بيانات وصلاحيات المساعد
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <label className="text-sm font-medium text-gray-700 block mb-1">كلمة المرور الجديدة <span className="text-gray-400 font-normal">(اتركها فارغة للتخطي)</span></label>
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                الراتب الشهري الثابت <span className="text-gray-400 font-normal">(اختياري)</span>
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

                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">نوع المساعد وصلاحياته *</label>
                            <select
                                value={assistantType}
                                onChange={(e) => handleTypeChange(e.target.value as AssistantType)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="ATTENDANCE">مساعد حضور وغياب (تحضير وحصص)</option>
                                <option value="FINANCIAL">مساعد مالي واشتراكات (دفعات ومذكرات)</option>
                                <option value="ACADEMIC">مساعد أكاديمي (امتحانات ورصد درجات)</option>
                                <option value="FULL">مساعد شامل (جميع الصلاحيات)</option>
                                <option value="CUSTOM">صلاحيات مخصصة (تحديد يدوي)</option>
                            </select>
                        </div>
                    </div>

                    {/* Granular Permissions Checklist */}
                    <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-800">
                                الصلاحيات التفصيلية الممنوحة ({countActivePermissions(permissions)} من 12):
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleTypeChange('FULL')}
                                    className="text-[11px] text-primary hover:underline font-bold"
                                >
                                    تحديد الكل
                                </button>
                                <span className="text-gray-300">•</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAssistantType('CUSTOM');
                                        setPermissions({});
                                    }}
                                    className="text-[11px] text-gray-500 hover:underline font-bold"
                                >
                                    إلغاء الكل
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                            {ALL_ASSISTANT_PERMISSION_KEYS.map((perm) => {
                                const isChecked = !!permissions[perm.key];
                                return (
                                    <div
                                        key={perm.key}
                                        onClick={() => togglePermission(perm.key)}
                                        className={cn(
                                            'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-bold select-none',
                                            isChecked
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-white hover:bg-gray-100 text-gray-700 border border-transparent'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{perm.label}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">({perm.group})</span>
                                        </div>
                                        <div className={cn(
                                            'h-4 w-4 rounded flex items-center justify-center border transition-all',
                                            isChecked ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'
                                        )}>
                                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            حفظ التعديلات
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
    const hasFixedSalary = assistant.salary != null && assistant.salary > 0;
    const [amount, setAmount] = useState(hasFixedSalary ? String(assistant.salary) : '');
    const [bonus, setBonus] = useState('');
    const [deduction, setDeduction] = useState('');
    const [notes,  setNotes]  = useState('');
    const [error,  setError]  = useState('');

    const netAmount = hasFixedSalary 
        ? Math.max(0, (assistant.salary || 0) + (Number(bonus) || 0) - (Number(deduction) || 0))
        : Number(amount) || 0;

    const mutation = useMutation({
        mutationFn: () => {
            const finalNotes = [];
            if (hasFixedSalary) {
                if (Number(bonus) > 0) finalNotes.push(`مكافأة: ${bonus} ج`);
                if (Number(deduction) > 0) finalNotes.push(`خصم: ${deduction} ج`);
            }
            if (notes.trim()) finalNotes.push(notes.trim());
            
            return paySalary(assistant.id, { 
                amount: netAmount, 
                notes: finalNotes.join(' | ') || undefined 
            });
        },
        onSuccess: () => {
            toast.success(`تم تسجيل راتب ${assistant.name} بنجاح`);
            onSuccess();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (netAmount <= 0) { setError('المبلغ الصافي غير صحيح'); return; }
        setError('');
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-sm bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3 flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-green-600" />
                        دفع راتب — {assistant.name}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {hasFixedSalary ? (
                        <div className="space-y-3">
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                                <span className="text-sm text-gray-500 font-medium">الراتب الأساسي</span>
                                <span className="text-sm font-bold text-gray-900">{assistant.salary?.toLocaleString('en-US')} ج</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">مكافأة (زيادة)</label>
                                    <div className="relative">
                                        <Input 
                                            type="number" min="0" value={bonus} onChange={(e) => setBonus(e.target.value)} 
                                            placeholder="0" dir="ltr" 
                                            className="pl-7 h-10 text-sm text-green-700 font-bold border-green-200 focus-visible:ring-green-500" 
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-1">خصم</label>
                                    <div className="relative">
                                        <Input 
                                            type="number" min="0" value={deduction} onChange={(e) => setDeduction(e.target.value)} 
                                            placeholder="0" dir="ltr" 
                                            className="pl-7 h-10 text-sm text-red-600 font-bold border-red-200 focus-visible:ring-red-500" 
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex justify-between items-center mt-2">
                                <span className="text-sm text-primary font-bold">الصافي للدفع</span>
                                <span className="text-lg font-black text-primary">{netAmount.toLocaleString('en-US')} ج</span>
                            </div>
                        </div>
                    ) : (
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
                                    className="pl-10 h-11"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">ج</span>
                            </div>
                        </div>
                    )}
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">ملاحظات إضافية <span className="text-gray-400 font-normal">(اختياري)</span></label>
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="أي تفاصيل أخرى..."
                            className="h-10"
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                        سيتم تسجيل الصافي كمصروف (راتب) في سجل الماليات، وسيتم تدوين الزيادات أو الخصومات في ملاحظات العملية.
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-11">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 h-11">
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            تأكيد الدفع
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentWithGroup } from '@/types/student.types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { recordSubscription } from '@/lib/api/payments';
import { fetchStudentReport, fetchStudentReportHtml } from '@/lib/api/reports';
import { fetchGroups } from '@/lib/api/groups';
import { updateStudent } from '@/lib/api/students';
import { printHtmlContent } from '@/lib/utils/print';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Phone,
    User,
    GraduationCap,
    Hash,
    Printer,
    CheckCircle2,
    XCircle,
    QrCode,
    CreditCard,
    Loader2,
    Calendar,
    BookOpen,
    TrendingUp,
    AlertCircle,
    Receipt,
    FileDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentProfileModalProps {
    student: StudentWithGroup | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function StudentProfileModal({ student, open, onOpenChange }: StudentProfileModalProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const user = useAuthStore((s) => s.user);
    const isAssistant = user?.role === 'assistant';
    const isTeacher   = user?.role === 'teacher';
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!student || !open) return;
        const qrValue = student.barcode || student.studentCode || student._id;
        QRCode.toDataURL(qrValue, {
            width: 180,
            margin: 1,
            color: { dark: '#0f4c81', light: '#f0f6ff' },
            errorCorrectionLevel: 'H',
        }).then(url => setQrDataUrl(url));
    }, [student, open]);

    // Fetch full student report when modal opens
    const { data: report, isLoading: reportLoading } = useQuery({
        queryKey: ['studentReport', student?._id],
        queryFn: () => fetchStudentReport(student!._id),
        enabled: !!student && open && (isTeacher === true),
        staleTime: 2 * 60 * 1000,
    });

    const subscribeMutation = useMutation({
        mutationFn: () => recordSubscription({ studentId: student!._id }),
        onSuccess: () => {
            toast.success(`تم تسجيل اشتراك ${student?.studentName} بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['studentReport', student?._id] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء تسجيل الاشتراك');
        },
    });

    const [pdfLoading, setPdfLoading] = useState(false);
    const handleDownloadPdf = async () => {
        if (!student) return;
        setPdfLoading(true);
        try {
            const html = await fetchStudentReportHtml(student._id);
            printHtmlContent(html);
        } catch {
            toast.error('فشل تحميل التقرير');
        } finally {
            setPdfLoading(false);
        }
    };

    // ── Group change (assistant only) ─────────────────────────────
    const currentGroupId =
        typeof student?.groupId === 'object' && student?.groupId !== null
            ? ((student.groupId as any)._id as string | undefined) ?? ''
            : typeof student?.groupId === 'string'
                ? student.groupId
                : '';

    const [isChangingGroup, setIsChangingGroup] = useState(false);
    const [newGroupId, setNewGroupId] = useState<string>(currentGroupId);

    useEffect(() => {
        if (open) {
            setIsChangingGroup(false);
            setNewGroupId(currentGroupId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, currentGroupId]);

    const { data: groupsData, isLoading: groupsLoading } = useQuery({
        queryKey: ['teacherGroups_reassignStudent', student?.gradeLevel],
        queryFn: () => fetchGroups({ limit: 100, gradeLevel: student?.gradeLevel }),
        enabled: isAssistant && open && !!student?.gradeLevel,
        staleTime: 5 * 60 * 1000,
    });

    const changeGroupMutation = useMutation({
        mutationFn: async () => {
            if (!newGroupId || newGroupId === currentGroupId) return null;
            return await updateStudent(student!._id, { groupId: newGroupId });
        },
        onSuccess: (updated) => {
            if (updated) {
                toast.success('تم نقل الطالب إلى المجموعة الجديدة بنجاح');
                queryClient.invalidateQueries({ queryKey: ['students'] });
                queryClient.invalidateQueries({ queryKey: ['studentReport', student?._id] });
            }
            setIsChangingGroup(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'حدث خطأ أثناء نقل الطالب للمجموعة الجديدة');
        },
    });

    if (!student) return null;

    const groupName =
        typeof student.groupId === 'object' && student.groupId !== null
            ? (student.groupId as { name: string }).name
            : student.groupDetails?.name || '—';

    const qrValue = student.barcode || student.studentCode || student._id;

    const hasActiveSub = report?.student?.hasActiveSubscription ?? student.hasActiveSubscription;

    const allGroups: { _id: string; name: string; gradeLevel: string }[] = groupsData?.data ?? [];
    const availableGroups = allGroups.filter(g => g.gradeLevel === student?.gradeLevel);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[720px] p-0 overflow-hidden rounded-2xl gap-0"
                dir="rtl"
            >
                {/* Top accent bar */}
                <div className="h-1 w-full bg-linear-to-r from-[#0f4c81] to-[#3b82f6]" />

                <DialogTitle className="sr-only">بروفايل الطالب</DialogTitle>

                {/* Header */}
                <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-gray-100">
                    <div className="h-12 w-12 rounded-xl bg-[#0f4c81] flex items-center justify-center shrink-0">
                        <span className="text-xl font-extrabold text-white">
                            {student.studentName.charAt(0)}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-extrabold text-gray-900 leading-tight truncate">
                            {student.studentName}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">{student.gradeLevel} · {groupName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Active status */}
                        <Badge className={cn(
                            'text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1',
                            student.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        )}>
                            {student.isActive
                                ? <><CheckCircle2 className="h-3 w-3" /> نشط</>
                                : <><XCircle className="h-3 w-3" /> موقوف</>
                            }
                        </Badge>
                        {/* Subscription status */}
                        {hasActiveSub === false && (
                            <Badge className="text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1 bg-red-50 text-red-600">
                                <AlertCircle className="h-3 w-3" /> غير مشترك
                            </Badge>
                        )}
                        {hasActiveSub === true && (
                            <Badge className="text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1 bg-blue-50 text-blue-700">
                                <CreditCard className="h-3 w-3" /> مشترك
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="w-full rounded-none border-b border-gray-100 bg-gray-50/50 px-4 h-10 justify-start gap-1">
                        <TabsTrigger value="profile" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                            <User className="h-3.5 w-3.5" /> البيانات
                        </TabsTrigger>
                        {isTeacher && (
                            <TabsTrigger value="attendance" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                                <Calendar className="h-3.5 w-3.5" /> الحضور
                            </TabsTrigger>
                        )}
                        {isTeacher && (
                            <TabsTrigger value="subscriptions" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                                <BookOpen className="h-3.5 w-3.5" /> الاشتراكات
                            </TabsTrigger>
                        )}
                        {isTeacher && (
                            <TabsTrigger value="payments" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                                <Receipt className="h-3.5 w-3.5" /> المدفوعات
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* ── Tab 1: Profile + QR ── */}
                    <TabsContent value="profile" className="m-0">
                        <div className="flex flex-row">
                            {/* QR Panel */}
                            <div className="w-[220px] shrink-0 bg-[#f0f6ff] flex flex-col items-center justify-center gap-3 p-5 border-l border-blue-100">
                                <div className="flex items-center gap-1.5 text-[#0f4c81]">
                                    <QrCode className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wide">كود الحضور</span>
                                </div>
                                <div className="rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                                    {qrDataUrl ? (
                                        <img src={qrDataUrl} alt="QR Code" width={180} height={180} />
                                    ) : (
                                        <div className="w-[180px] h-[180px] bg-white/60 flex items-center justify-center">
                                            <QrCode className="h-10 w-10 text-[#0f4c81]/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-400 mb-1">امسح للتسجيل</p>
                                    <p className="font-mono text-[10px] font-bold text-[#0f4c81] bg-white px-2 py-1 rounded-lg border border-blue-100 break-all" dir="ltr">
                                        {qrValue}
                                    </p>
                                </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.print()}
                            className="w-full gap-1.5 border-[#0f4c81]/30 text-[#0f4c81] hover:bg-[#0f4c81]/5 text-xs font-bold"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            طباعة
                        </Button>
                        {isTeacher && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading}
                                className="w-full gap-1.5 border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold"
                            >
                                {pdfLoading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <FileDown className="h-3.5 w-3.5" />
                                }
                                تقرير PDF
                            </Button>
                        )}
                        {isAssistant && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            if (window.confirm(`تسجيل اشتراك هذا الشهر لـ ${student.studentName}؟`)) {
                                                subscribeMutation.mutate();
                                            }
                                        }}
                                        disabled={subscribeMutation.isPending}
                                        className="w-full gap-1.5 bg-[#0f4c81] hover:bg-[#0a3357] text-white text-xs font-bold"
                                    >
                                        {subscribeMutation.isPending
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <CreditCard className="h-3.5 w-3.5" />
                                        }
                                        تسجيل اشتراك
                                    </Button>
                                )}
                            </div>

                            {/* Info panel */}
                            <div className="flex-1 px-6 py-5 space-y-3.5">
                                <InfoItem icon={User}          label="ولي الأمر"    value={student.parentName} />
                                <div className="space-y-1.5">
                                    <InfoItem icon={GraduationCap} label="المجموعة" value={groupName} />
                                    {isAssistant && (
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            {!isChangingGroup && (
                                                <Button
                                                    type="button"
                                                    size="xs"
                                                    variant="outline"
                                                    className="border-dashed border-gray-300 text-[11px] h-7 px-2 text-gray-700 hover:border-primary hover:text-primary self-start"
                                                    onClick={() => setIsChangingGroup(true)}
                                                >
                                                    نقل لمجموعة أخرى
                                                </Button>
                                            )}
                                            {isChangingGroup && (
                                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                    <Select
                                                        value={newGroupId}
                                                        onValueChange={setNewGroupId}
                                                        disabled={groupsLoading || changeGroupMutation.isPending}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs w-full sm:w-48">
                                                            <SelectValue placeholder={groupsLoading ? 'جارِ تحميل المجموعات...' : 'اختر مجموعة جديدة'} />
                                                        </SelectTrigger>
                                                        <SelectContent dir="rtl">
                                                            {availableGroups.map(g => (
                                                                <SelectItem key={g._id} value={g._id}>
                                                                    {g.name}
                                                                </SelectItem>
                                                            ))}
                                                            {availableGroups.length === 0 && !groupsLoading && (
                                                                <div className="px-3 py-2 text-[11px] text-gray-500">
                                                                    لا توجد مجموعات أخرى في نفس المرحلة
                                                                </div>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            type="button"
                                                            size="xs"
                                                            disabled={!newGroupId || newGroupId === currentGroupId || changeGroupMutation.isPending}
                                                            className="h-8 px-3 text-[11px]"
                                                            onClick={() => changeGroupMutation.mutate()}
                                                        >
                                                            {changeGroupMutation.isPending ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                'حفظ التحويل'
                                                            )}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="xs"
                                                            variant="ghost"
                                                            className="h-8 px-3 text-[11px] text-gray-500"
                                                            disabled={changeGroupMutation.isPending}
                                                            onClick={() => {
                                                                setIsChangingGroup(false);
                                                                setNewGroupId(currentGroupId);
                                                            }}
                                                        >
                                                            إلغاء
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <InfoItem icon={Phone}         label="هاتف الطالب" value={student.studentPhone} ltr />
                                <InfoItem icon={Phone}         label="هاتف الأسرة" value={student.parentPhone}  ltr />
                                {student.studentCode && (
                                    <InfoItem icon={Hash} label="الكود" value={student.studentCode} ltr />
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── Tab 2: Attendance ── */}
                    {isTeacher && (
                        <TabsContent value="attendance" className="m-0 p-5">
                            {reportLoading ? (
                                <div className="flex items-center justify-center py-10 text-gray-400">
                                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
                                </div>
                            ) : report ? (
                                <div className="space-y-4">
                                    {/* Summary stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-green-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-green-700">{report.attendance.presentCount}</p>
                                            <p className="text-xs text-gray-500 mt-1">حاضر</p>
                                        </div>
                                        <div className="bg-red-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-red-600">{report.attendance.absentCount}</p>
                                            <p className="text-xs text-gray-500 mt-1">غائب</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-bold text-blue-700">{report.attendance.attendanceRate}</p>
                                            <p className="text-xs text-gray-500 mt-1">نسبة الحضور</p>
                                        </div>
                                    </div>
                                    {/* History list */}
                                    {report.attendance.history?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 mb-2">آخر {report.attendance.history.length} حصة</p>
                                            <div className="flex flex-wrap gap-2">
                                                {report.attendance.history.map((h: any, i: number) => (
                                                    <div
                                                        key={i}
                                                        title={new Date(h.date).toLocaleDateString('ar-EG')}
                                                        className={cn(
                                                            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border',
                                                            h.status === 'PRESENT' ? 'bg-green-100 text-green-700 border-green-200' :
                                                            h.status === 'ABSENT'  ? 'bg-red-100 text-red-600 border-red-200' :
                                                            'bg-gray-100 text-gray-500 border-gray-200'
                                                        )}
                                                    >
                                                        {h.status === 'PRESENT' ? '✓' : h.status === 'ABSENT' ? '✗' : '—'}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-2">أخضر = حاضر · أحمر = غائب (من اليسار: الأقدم)</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 py-8 text-sm">لا توجد بيانات حضور</p>
                            )}
                        </TabsContent>
                    )}

                    {/* ── Tab 3: Subscriptions ── */}
                    {isTeacher && (
                        <TabsContent value="subscriptions" className="m-0 p-5">
                            {reportLoading ? (
                                <div className="flex items-center justify-center py-10 text-gray-400">
                                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
                                </div>
                            ) : report?.payments?.subscriptions?.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-500 mb-3">
                                        إجمالي الاشتراكات: <span className="font-bold text-gray-800">{report.payments.subscriptionsCount}</span>
                                    </p>
                                    {report.payments.subscriptions.map((sub: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {new Date(sub.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                                {sub.description && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-green-700">{sub.paidAmount.toLocaleString('ar-EG')} ج.م</p>
                                                {sub.discountAmount > 0 && (
                                                    <p className="text-xs text-gray-400">خصم {sub.discountAmount.toLocaleString('ar-EG')}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 py-8 text-sm">لا توجد اشتراكات مسجلة</p>
                            )}
                        </TabsContent>
                    )}

                    {/* ── Tab 4: Payments ── */}
                    {isTeacher && (
                        <TabsContent value="payments" className="m-0 p-5">
                            {reportLoading ? (
                                <div className="flex items-center justify-center py-10 text-gray-400">
                                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
                                </div>
                            ) : report?.payments?.history?.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-green-50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-green-700">
                                                {report.payments.totalPaid.toLocaleString('ar-EG')} ج.م
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">إجمالي المدفوع</p>
                                        </div>
                                        <div className="bg-orange-50 rounded-xl p-3 text-center">
                                            <p className="text-lg font-bold text-orange-600">
                                                {report.payments.totalDiscount.toLocaleString('ar-EG')} ج.م
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">إجمالي الخصومات</p>
                                        </div>
                                    </div>
                                    {report.payments.history.map((tx: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                                                    tx.category === 'SUBSCRIPTION' ? 'bg-blue-100' : 'bg-purple-100'
                                                )}>
                                                    {tx.category === 'SUBSCRIPTION'
                                                        ? <CreditCard className="h-4 w-4 text-blue-600" />
                                                        : <BookOpen className="h-4 w-4 text-purple-600" />
                                                    }
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {tx.category === 'SUBSCRIPTION' ? 'اشتراك' : 'مذكرة'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-green-700">
                                                {tx.paidAmount.toLocaleString('ar-EG')} ج.م
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 py-8 text-sm">لا توجد معاملات مالية</p>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

/* ── Small helper row ── */
function InfoItem({ icon: Icon, label, value, ltr }: {
    icon: React.ElementType;
    label: string;
    value: string;
    ltr?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-gray-400 font-medium leading-none mb-0.5">{label}</p>
                <p
                    className={cn('text-sm font-semibold text-gray-800 truncate', ltr && 'font-mono')}
                    dir={ltr ? 'ltr' : 'rtl'}
                >
                    {value || '—'}
                </p>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ArrowRight,
    User,
    Phone,
    Calendar,
    GraduationCap,
    Barcode,
    QrCode,
    CreditCard,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Edit2,
    Trash2,
    Printer,
    Copy,
    MessageCircle,
    Check,
    Layers,
    BookOpen,
    Users,
    DollarSign,
    Plus,
    History,
    FileSpreadsheet,
    ShieldCheck,
    Loader2,
    ExternalLink,
    Sparkles,
    Calculator,
} from 'lucide-react';
import {
    fetchCenterStudentById,
    updateCenterStudent,
    deleteCenterStudent,
    fetchStudentEnrollment,
    fetchStudentAttendanceHistory,
    fetchStudentFinancialReport,
    recordCenterPayment,
    fetchMyCenters,
} from '@/lib/api/centers';
import { ALL_GRADES } from '@/lib/constants/grade.constants';
import { ICenterStudent, ICenterEnrollment, ICenterAttendanceRecord } from '@/types/center.types';
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

export default function CenterStudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const studentId = params.studentId as string;

    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedBarcode, setCopiedBarcode] = useState(false);

    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editParentName, setEditParentName] = useState('');
    const [editStudentPhone, setEditStudentPhone] = useState('');
    const [editParentPhone, setEditParentPhone] = useState('');
    const [editGradeLevel, setEditGradeLevel] = useState('');
    const [editBarcode, setEditBarcode] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);

    // Quick Payment Modal State
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [payCategory, setPayCategory] = useState<'CENTER_PACKAGE' | 'CENTER_PRIVATE' | 'CENTER_COMBINED'>('CENTER_PACKAGE');
    const [payOriginalAmount, setPayOriginalAmount] = useState('');
    const [payDiscountAmount, setPayDiscountAmount] = useState('0');
    const [payPaidAmount, setPayPaidAmount] = useState('');
    const [payDescription, setPayDescription] = useState('');

    // 1. Fetch Student Details
    const { data: student, isLoading: studentLoading, error: studentError } = useQuery<ICenterStudent>({
        queryKey: ['center', 'student', studentId],
        queryFn: () => fetchCenterStudentById(studentId),
        enabled: !!studentId,
    });

    // 2. Fetch Center Enrollment
    const { data: enrollment, isLoading: enrollmentLoading, error: enrollmentError } = useQuery<ICenterEnrollment | null>({
        queryKey: ['center', 'enrollment', 'student', studentId],
        queryFn: async () => {
            try {
                return await fetchStudentEnrollment(studentId);
            } catch (err: any) {
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        retry: false,
        enabled: !!studentId,
    });

    // 3. Fetch Attendance History
    const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery<ICenterAttendanceRecord[]>({
        queryKey: ['center', 'attendance', 'student', studentId],
        queryFn: () => fetchStudentAttendanceHistory(studentId),
        enabled: !!studentId,
    });

    // 4. Fetch Financial Report
    const { data: financialReport, isLoading: financialLoading } = useQuery({
        queryKey: ['center', 'financials', 'student', studentId],
        queryFn: () => fetchStudentFinancialReport(studentId),
        enabled: !!studentId,
    });

    // 5. Fetch Centers for branding print
    const { data: centers = [] } = useQuery({
        queryKey: ['center', 'my-centers'],
        queryFn: fetchMyCenters,
    });
    const currentCenter = centers.find(c => c._id === student?.centerId) || centers[0];

    // Generate QR code for student
    useEffect(() => {
        if (!student) return;
        const qrValue = student.barcode || student.studentCode || student._id;
        QRCode.toDataURL(qrValue, {
            width: 200,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H',
        }).then(setQrDataUrl).catch(console.error);
    }, [student]);

    // Handle Edit Open
    const handleOpenEdit = () => {
        if (!student) return;
        setEditName(student.studentName);
        setEditParentName(student.parentName);
        setEditStudentPhone(student.studentPhone || '');
        setEditParentPhone(student.parentPhone || '');
        setEditGradeLevel(student.gradeLevel);
        setEditBarcode(student.barcode || '');
        setEditNotes(student.notes || '');
        setEditIsActive(student.isActive);
        setIsEditOpen(true);
    };

    // Edit Mutation
    const updateMutation = useMutation({
        mutationFn: (data: Partial<ICenterStudent>) => updateCenterStudent(studentId, data),
        onSuccess: (updated) => {
            toast.success('تم تحديث بيانات الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'student', studentId] });
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            setIsEditOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء التحديث');
        },
    });

    const handleSaveEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editName.trim()) {
            toast.error('اسم الطالب مطلوب');
            return;
        }
        const trimmedName = editName.trim();
        const parts = trimmedName.split(/\s+/);
        const derivedParent = editParentName.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : `ولي أمر ${trimmedName}`);

        updateMutation.mutate({
            studentName: trimmedName,
            parentName: derivedParent,
            studentPhone: editStudentPhone.trim() || null,
            parentPhone: editParentPhone.trim() || null,
            gradeLevel: editGradeLevel,
            barcode: editBarcode.trim() || null,
            notes: editNotes.trim() || null,
            isActive: editIsActive,
        });
    };

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: () => deleteCenterStudent(studentId),
        onSuccess: () => {
            toast.success('تم حذف الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            router.push('/center/students');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
        },
    });

    const handleDelete = () => {
        if (!student) return;
        if (confirm(`هل أنت متأكد من حذف الطالب ${student.studentName}؟`)) {
            deleteMutation.mutate();
        }
    };

    // Payment Mutation
    const paymentMutation = useMutation({
        mutationFn: (data: any) => recordCenterPayment(data),
        onSuccess: () => {
            toast.success('تم تسجيل الدفعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'financials', 'student', studentId] });
            queryClient.invalidateQueries({ queryKey: ['center', 'financials-summary'] });
            setIsPaymentOpen(false);
            setPayOriginalAmount('');
            setPayDiscountAmount('0');
            setPayPaidAmount('');
            setPayDescription('');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الدفعة');
        },
    });

    const handleSavePayment = (e: React.FormEvent) => {
        e.preventDefault();
        const orig = Number(payOriginalAmount);
        const paid = Number(payPaidAmount);
        const disc = Number(payDiscountAmount) || 0;
        if (isNaN(orig) || orig <= 0) {
            toast.error('يرجى إدخال المبلغ الأصلي بشكل صحيح');
            return;
        }
        if (isNaN(paid) || paid < 0) {
            toast.error('يرجى إدخال المبلغ المدفوع بشكل صحيح');
            return;
        }
        const remaining = Math.max(0, orig - disc - paid);

        paymentMutation.mutate({
            studentId,
            category: payCategory,
            originalAmount: orig,
            discountAmount: disc,
            paidAmount: paid,
            remainingAmount: remaining,
            description: payDescription.trim() || undefined,
            date: new Date().toISOString(),
        });
    };

    const handleOpenPaymentModal = () => {
        if (enrollment) {
            if (enrollment.type === 'PACKAGE') {
                setPayCategory('CENTER_PACKAGE');
                const base = enrollment.packageMonthlyPrice || enrollment.packageId?.monthlyPrice || 0;
                let disc = 0;
                if (enrollment.packageDiscount?.type === 'PERCENTAGE') {
                    disc = (base * (Number(enrollment.packageDiscount.value) || 0)) / 100;
                } else if (enrollment.packageDiscount?.type === 'FIXED') {
                    disc = Number(enrollment.packageDiscount.value) || 0;
                }
                setPayOriginalAmount(base.toString());
                setPayDiscountAmount(disc.toString());
                setPayPaidAmount(Math.max(0, base - disc).toString());
                setPayDescription(`سداد اشتراك باقة: ${enrollment.packageId?.name || ''}`);
            } else if (enrollment.type === 'PRIVATE') {
                setPayCategory('CENTER_PRIVATE');
                const base = (enrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                let disc = 0;
                if (enrollment.privateDiscount?.type === 'PERCENTAGE') {
                    disc = (base * (Number(enrollment.privateDiscount.value) || 0)) / 100;
                } else if (enrollment.privateDiscount?.type === 'FIXED') {
                    disc = Number(enrollment.privateDiscount.value) || 0;
                }
                setPayOriginalAmount(base.toString());
                setPayDiscountAmount(disc.toString());
                setPayPaidAmount(Math.max(0, base - disc).toString());
                setPayDescription('سداد اشتراك مجموعات خصوصي');
            } else if (enrollment.type === 'BOTH') {
                setPayCategory('CENTER_COMBINED');
                const pkgBase = enrollment.packageMonthlyPrice || enrollment.packageId?.monthlyPrice || 0;
                const pvtBase = (enrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                const totalBase = pkgBase + pvtBase;

                let totalDisc = 0;
                if (enrollment.packageDiscount?.type === 'PERCENTAGE') totalDisc += (pkgBase * (Number(enrollment.packageDiscount.value) || 0)) / 100;
                else if (enrollment.packageDiscount?.type === 'FIXED') totalDisc += Number(enrollment.packageDiscount.value) || 0;

                if (enrollment.privateDiscount?.type === 'PERCENTAGE') totalDisc += (pvtBase * (Number(enrollment.privateDiscount.value) || 0)) / 100;
                else if (enrollment.privateDiscount?.type === 'FIXED') totalDisc += Number(enrollment.privateDiscount.value) || 0;

                if (enrollment.combinedDiscount?.type === 'PERCENTAGE') totalDisc += (totalBase * (Number(enrollment.combinedDiscount.value) || 0)) / 100;
                else if (enrollment.combinedDiscount?.type === 'FIXED') totalDisc += Number(enrollment.combinedDiscount.value) || 0;

                setPayOriginalAmount(totalBase.toString());
                setPayDiscountAmount(totalDisc.toString());
                setPayPaidAmount(Math.max(0, totalBase - totalDisc).toString());
                setPayDescription('سداد اشتراك شامل (باقة + مجموعات خصوصي)');
            }
        } else {
            setPayCategory('CENTER_PACKAGE');
            setPayOriginalAmount('');
            setPayDiscountAmount('0');
            setPayPaidAmount('');
            setPayDescription('');
        }
        setIsPaymentOpen(true);
    };

    // Print Student ID Card
    const handlePrintCard = async () => {
        if (!student) return;
        const studentAdapter: any = {
            _id: student._id,
            studentName: student.studentName,
            studentCode: student.studentCode,
            barcode: student.barcode || student.studentCode,
            gradeLevel: student.gradeLevel,
            parentName: student.parentName,
            parentPhone: student.parentPhone || '',
            studentPhone: student.studentPhone || '',
            groupDetails: {
                name: enrollment?.packageId?.name || (enrollment?.privateTeachers?.length ? 'مدرسين خصوصي' : 'بدون باقة'),
            },
        };

        const html = await generateIdCardsHtml(
            [studentAdapter],
            currentCenter?.name || 'السنتر التعليمي',
            currentCenter?.logoUrl || undefined
        );
        printHtmlContent(html, `كارنيه - ${student.studentName}`);
    };

    const copyToClipboard = (text: string, type: 'code' | 'barcode') => {
        navigator.clipboard.writeText(text);
        if (type === 'code') {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } else {
            setCopiedBarcode(true);
            setTimeout(() => setCopiedBarcode(false), 2000);
        }
        toast.success('تم النسخ إلى الحافظة');
    };

    if (studentLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-gray-500">جاري تحميل بروفايل الطالب...</p>
            </div>
        );
    }

    if (studentError || !student) {
        return (
            <div className="p-6 max-w-lg mx-auto mt-10 text-center bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">تعذر العثور على الطالب</h2>
                <p className="text-sm text-gray-500">الطالب المطلوب غير مسجل في هذا السنتر أو تم حذفه مسبقاً.</p>
                <Button onClick={() => router.push('/center/students')} variant="outline" className="rounded-xl">
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                    العودة لقائمة الطلاب
                </Button>
            </div>
        );
    }

    // Calculations for Attendance
    const totalAttendanceCount = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
    const excusedCount = attendanceRecords.filter(r => r.status === 'EXCUSED').length;
    const attendancePercentage = totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : 0;

    // Formatting Phone for WhatsApp
    const getCleanPhone = (phone?: string | null) => {
        if (!phone) return '';
        let cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('01')) cleaned = '2' + cleaned;
        return cleaned;
    };

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => router.push('/center/students')}
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-gray-600 hover:text-gray-900 -mr-2"
                    >
                        <ArrowRight className="h-4 w-4 ml-1" />
                        العودة للطلاب
                    </Button>
                    <span className="text-gray-300">/</span>
                    <span className="text-xs font-semibold text-gray-500">بروفايل طالب السنتر</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleOpenPaymentModal}
                        size="sm"
                        className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                        <CreditCard className="h-4 w-4 ml-1.5" />
                        تسجيل دفعة نقدية
                    </Button>

                    <Button
                        onClick={handlePrintCard}
                        variant="outline"
                        size="sm"
                        className="rounded-xl font-bold bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                    >
                        <Printer className="h-4 w-4 ml-1.5 text-primary" />
                        طباعة الكارنيه
                    </Button>

                    <Button
                        onClick={handleOpenEdit}
                        variant="outline"
                        size="sm"
                        className="rounded-xl font-bold bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                    >
                        <Edit2 className="h-4 w-4 ml-1.5 text-amber-600" />
                        تعديل البيانات
                    </Button>

                    <Button
                        onClick={handleDelete}
                        variant="outline"
                        size="sm"
                        className="rounded-xl font-bold bg-white text-red-600 hover:bg-red-50 border-red-200"
                    >
                        <Trash2 className="h-4 w-4 ml-1.5" />
                        حذف
                    </Button>
                </div>
            </div>

            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-blue-500" />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mt-1">
                    {/* Student Info */}
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-extrabold text-2xl sm:text-3xl border border-primary/20 shrink-0 shadow-inner">
                            {student.studentName.charAt(0)}
                        </div>

                        <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                    {student.studentName}
                                </h1>
                                <Badge
                                    variant="outline"
                                    className={
                                        student.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                            : 'bg-red-50 text-red-700 border-red-200 font-bold'
                                    }
                                >
                                    {student.isActive ? 'طالب نشط' : 'حساب معطل'}
                                </Badge>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold">
                                    {student.gradeLevel}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-400">كود الطالب:</span>
                                    <button
                                        onClick={() => copyToClipboard(student.studentCode, 'code')}
                                        className="inline-flex items-center gap-1 font-mono font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors"
                                        title="نسخ الكود"
                                    >
                                        <span>{student.studentCode}</span>
                                        {copiedCode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-400" />}
                                    </button>
                                </div>

                                {student.barcode && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">الباركود:</span>
                                        <button
                                            onClick={() => copyToClipboard(student.barcode!, 'barcode')}
                                            className="inline-flex items-center gap-1 font-mono font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors"
                                            title="نسخ الباركود"
                                        >
                                            <Barcode className="h-3.5 w-3.5 text-gray-400" />
                                            <span>{student.barcode}</span>
                                            {copiedBarcode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-gray-400" />}
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-1 text-gray-400">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>تاريخ التسجيل: {new Date(student.createdAt || Date.now()).toLocaleDateString('ar-EG')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Badges / CTA */}
                    <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                        <Link
                            href={`/center/enrollments?studentId=${student._id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
                        >
                            <Layers className="h-4 w-4" />
                            <span>{enrollment ? 'تعديل الاشتراك' : 'تسجيل اشتراك الطالب'}</span>
                        </Link>

                        <Button
                            onClick={() => setIsPaymentOpen(true)}
                            size="sm"
                            className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                            <DollarSign className="h-4 w-4 ml-1" />
                            <span>تسجيل دفعة نقدية</span>
                        </Button>
                    </div>
                </div>

                {/* Communication Quick Ribbon */}
                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs">
                    {/* Parent contact */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
                        <span className="font-semibold text-gray-700">ولي الأمر: {student.parentName}</span>
                        {student.parentPhone && (
                            <div className="flex items-center gap-1.5 border-r border-gray-200 pr-2 mr-1">
                                <a
                                    href={`tel:${student.parentPhone}`}
                                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                                    title="اتصال هاتف ولي الأمر"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                </a>
                                <a
                                    href={`https://wa.me/${getCleanPhone(student.parentPhone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                                    title="مراسلة واتساب ولي الأمر"
                                >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                                <span className="font-mono text-gray-600" dir="ltr">{student.parentPhone}</span>
                            </div>
                        )}
                    </div>

                    {/* Student contact */}
                    {student.studentPhone && (
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
                            <span className="font-semibold text-gray-700">هاتف الطالب:</span>
                            <div className="flex items-center gap-1.5">
                                <a
                                    href={`tel:${student.studentPhone}`}
                                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                                    title="اتصال بهاتف الطالب"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                </a>
                                <a
                                    href={`https://wa.me/${getCleanPhone(student.studentPhone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                                    title="مراسلة واتساب الطالب"
                                >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                                <span className="font-mono text-gray-600" dir="ltr">{student.studentPhone}</span>
                            </div>
                        </div>
                    )}

                    {student.notes && (
                        <div className="text-gray-500 text-xs italic flex items-center gap-1 bg-amber-50/70 border border-amber-100 text-amber-800 rounded-xl px-3 py-1.5">
                            <span className="font-bold">ملاحظات:</span>
                            <span>{student.notes}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 font-medium">نسبة الحضور</p>
                        <p className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">{attendancePercentage}%</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{presentCount} من أصل {totalAttendanceCount} حصة</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 font-medium">حالة الاشتراك بالسنتر</p>
                        <p className="text-base sm:text-lg font-black text-gray-900 mt-1 truncate">
                            {enrollment ? (
                                enrollment.type === 'PACKAGE' ? 'باقة شاملة' :
                                enrollment.type === 'PRIVATE' ? 'مدرسين خصوصي' : 'باقة + خاص'
                            ) : (
                                <span className="text-amber-600">غير مسجل</span>
                            )}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {enrollment?.isActive ? 'اشتراك نشط' : 'بانتظار التسجيل'}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                        <Layers className="h-5 w-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 font-medium">إجمالي المدفوع بالسنتر</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">
                            {financialReport?.totalPaid || 0} <span className="text-xs font-normal text-gray-500">ج.م</span>
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{financialReport?.transactionCount || 0} معاملة مسجلة</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CreditCard className="h-5 w-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 font-medium">المتبقي / الديون</p>
                        <p className={`text-xl sm:text-2xl font-black mt-0.5 ${financialReport?.totalRemaining ? 'text-red-600' : 'text-gray-900'}`}>
                            {financialReport?.totalRemaining || 0} <span className="text-xs font-normal text-gray-500">ج.م</span>
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {financialReport?.totalRemaining ? 'مستحقات غير مسددة' : 'لا توجد ديون'}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-bold">
                        <DollarSign className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Profile Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50 mb-6 flex flex-wrap gap-1 h-auto">
                    <TabsTrigger
                        value="overview"
                        className="rounded-xl px-4 py-2 font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                        <Layers className="h-4 w-4 ml-1.5" />
                        الاشتراك والباقات
                    </TabsTrigger>
                    <TabsTrigger
                        value="attendance"
                        className="rounded-xl px-4 py-2 font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                        <CheckCircle2 className="h-4 w-4 ml-1.5" />
                        سجل الحضور والغياب
                        {attendanceRecords.length > 0 && (
                            <span className="mr-1.5 bg-gray-200/80 text-gray-700 px-1.5 py-0.2 rounded-full text-[10px]">
                                {attendanceRecords.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="financials"
                        className="rounded-xl px-4 py-2 font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                        <DollarSign className="h-4 w-4 ml-1.5" />
                        المدفوعات والمعاملات
                    </TabsTrigger>
                    <TabsTrigger
                        value="id-card"
                        className="rounded-xl px-4 py-2 font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                    >
                        <QrCode className="h-4 w-4 ml-1.5" />
                        الكارنيه والباركود
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: OVERVIEW & ENROLLMENTS */}
                <TabsContent value="overview" className="space-y-6">
                    {enrollmentLoading ? (
                        <div className="py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                            جاري تحميل بيانات الاشتراك...
                        </div>
                    ) : enrollment ? (
                        <div className="space-y-6">
                            {/* Package Details if applicable */}
                            {(enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH') && enrollment.packageId && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                <Layers className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-base">باقة السنتر المشترك بها</h3>
                                                <p className="text-xs text-gray-400">تفاصيل الباقة والمدرسين المتضمنين</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                                            باقة معتمدة
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                                        <div>
                                            <span className="text-xs text-gray-400 block">اسم الباقة</span>
                                            <span className="font-bold text-gray-800 text-sm">{enrollment.packageId.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-400 block">المرحلة</span>
                                            <span className="font-bold text-gray-800 text-sm">{enrollment.packageId.gradeLevel}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-400 block">السعر الشهري للباقة</span>
                                            <span className="font-bold text-primary text-sm">
                                                {enrollment.packageMonthlyPrice || enrollment.packageId.monthlyPrice} ج.م / شهر
                                            </span>
                                        </div>
                                    </div>

                                    {/* Discount if present */}
                                    {enrollment.packageDiscount?.value ? (
                                        <div className="mt-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-amber-800 text-xs flex items-center justify-between">
                                            <span>خصم مطبق على الباقة:</span>
                                            <span className="font-bold">
                                                {enrollment.packageDiscount.type === 'PERCENTAGE'
                                                    ? `${enrollment.packageDiscount.value}%`
                                                    : `${enrollment.packageDiscount.value} ج.م`}
                                            </span>
                                        </div>
                                    ) : null}

                                    {/* Enrolled Package Groups */}
                                    {enrollment.packageGroups && enrollment.packageGroups.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-700">
                                                    مجموعات مواد الباقة المسجل بها الطالب ({enrollment.packageGroups.length}):
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {enrollment.packageGroups.map((pg: any, idx: number) => {
                                                    const gName = typeof pg === 'object' ? pg.name : 'مجموعة';
                                                    const teacherName = typeof pg === 'object' && typeof pg.centerTeacherId === 'object'
                                                        ? pg.centerTeacherId?.name
                                                        : null;
                                                    const subject = typeof pg === 'object' && typeof pg.centerTeacherId === 'object'
                                                        ? pg.centerTeacherId?.subject
                                                        : null;
                                                    const scheduleStr = typeof pg === 'object' && pg.schedule?.length > 0
                                                        ? pg.schedule.map((s: any) => `${s.day} ${s.time}`).join('، ')
                                                        : null;

                                                    return (
                                                        <div key={idx} className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/40 flex items-center justify-between gap-2 text-xs">
                                                            <div>
                                                                <div className="flex items-center gap-1.5 font-bold text-gray-900">
                                                                    <span>{gName}</span>
                                                                    {subject && (
                                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1 font-bold">
                                                                            {subject}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 mt-0.5">
                                                                    {teacherName && <span>المدرس: {teacherName}</span>}
                                                                    {scheduleStr && <span className="mr-1.5">• {scheduleStr}</span>}
                                                                </div>
                                                            </div>
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                                                نشط
                                                            </Badge>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Private Teachers if applicable */}
                            {(enrollment.type === 'PRIVATE' || enrollment.type === 'BOTH') && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-base">المدرسون والمجموعات الخاصة</h3>
                                                <p className="text-xs text-gray-400">المواد والمجموعات المسجل بها الطالب فردياً بالسنتر</p>
                                            </div>
                                        </div>
                                    </div>

                                    {enrollment.privateTeachers && enrollment.privateTeachers.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-right text-xs">
                                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                                                    <tr>
                                                        <th className="py-2.5 px-3">المدرس</th>
                                                        <th className="py-2.5 px-3">المادة</th>
                                                        <th className="py-2.5 px-3">المجموعة</th>
                                                        <th className="py-2.5 px-3">السعر الشهري</th>
                                                        <th className="py-2.5 px-3">حصص/أسبوع</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {enrollment.privateTeachers.map((pt: any, idx: number) => {
                                                        const teacherName = typeof pt.centerTeacherId === 'object' ? pt.centerTeacherId?.name : 'مدرس بالسنتر';
                                                        const groupName = typeof pt.groupId === 'object' ? pt.groupId?.name : 'بدون مجموعة';
                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                                <td className="py-3 px-3 font-bold text-gray-800">{teacherName}</td>
                                                                <td className="py-3 px-3 text-gray-600">{pt.subject || '—'}</td>
                                                                <td className="py-3 px-3">
                                                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                                                        {groupName}
                                                                    </Badge>
                                                                </td>
                                                                <td className="py-3 px-3 font-bold text-primary">{pt.monthlyPrice ? `${pt.monthlyPrice} ج.م` : '—'}</td>
                                                                <td className="py-3 px-3 text-gray-500">{pt.sessionsPerWeek || 1}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 text-center py-4">لا يوجد مدرسين خاصين مسجلين للطالب.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                                <AlertCircle className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">الطالب غير مقيد في باقة أو مدرسين بعد</h3>
                                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                    قم بتسجيل الطالب في باقة مركز كاملة أو مع مدرسين ومجموعات محددة لبدء إدارة حضوره ومالياته.
                                </p>
                            </div>
                            <Link
                                href={`/center/enrollments?studentId=${student._id}`}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                <span>تسجيل اشتراك جديد الآن</span>
                            </Link>
                        </div>
                    )}
                </TabsContent>

                {/* TAB 2: ATTENDANCE HISTORY */}
                <TabsContent value="attendance" className="space-y-6">
                    {/* Summary Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-400 block">حاضر</span>
                                <span className="font-extrabold text-sm text-gray-800">{presentCount}</span>
                            </div>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center font-bold">
                                <XCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-400 block">غائب</span>
                                <span className="font-extrabold text-sm text-gray-800">{absentCount}</span>
                            </div>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                <Clock className="h-4 w-4" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-400 block">متأخر</span>
                                <span className="font-extrabold text-sm text-gray-800">{lateCount}</span>
                            </div>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-400 block">بعذر</span>
                                <span className="font-extrabold text-sm text-gray-800">{excusedCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-sm">سجل جلسات الحضور بالسنتر</h3>
                            <Link
                                href="/center/attendance"
                                className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                                <span>شاشة التحضير اليومي</span>
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        </div>

                        {attendanceLoading ? (
                            <div className="p-12 text-center text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                جاري تحميل سجل الحضور...
                            </div>
                        ) : attendanceRecords.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-xs">
                                لا توجد تسجيلات حضور سابقة لهذا الطالب بعد.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold">
                                        <tr>
                                            <th className="py-3 px-4">التاريخ</th>
                                            <th className="py-3 px-4">المجموعة</th>
                                            <th className="py-3 px-4">الحالة</th>
                                            <th className="py-3 px-4">طريقة التحضير</th>
                                            <th className="py-3 px-4">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {attendanceRecords.map((rec) => {
                                            const group = typeof rec.groupId === 'object' ? rec.groupId : null;
                                            return (
                                                <tr key={rec._id} className="hover:bg-gray-50/50">
                                                    <td className="py-3 px-4 font-bold text-gray-800">
                                                        {new Date(rec.date).toLocaleDateString('ar-EG', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                                            {group?.name || 'مجموعة عامة'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {rec.status === 'PRESENT' && (
                                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
                                                                حاضر
                                                            </Badge>
                                                        )}
                                                        {rec.status === 'ABSENT' && (
                                                            <Badge className="bg-red-50 text-red-700 border-red-200 border">
                                                                غائب
                                                            </Badge>
                                                        )}
                                                        {rec.status === 'LATE' && (
                                                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 border">
                                                                متأخر
                                                            </Badge>
                                                        )}
                                                        {rec.status === 'EXCUSED' && (
                                                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 border">
                                                                بعذر
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-500">
                                                        {rec.source === 'QR_SCAN' ? (
                                                            <span className="inline-flex items-center gap-1 text-primary font-medium">
                                                                <QrCode className="h-3.5 w-3.5" />
                                                                مسح الباركود
                                                            </span>
                                                        ) : (
                                                            <span>تسجيل يدوي</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-400">
                                                        {rec.notes || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* TAB 3: FINANCIALS & TRANSACTIONS */}
                <TabsContent value="financials" className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm">سجل المدفوعات والاشتراكات المالية</h3>
                            <p className="text-xs text-gray-400">جميع الدفعات والمبالغ المحصلة من الطالب بالسنتر</p>
                        </div>
                        <Button
                            onClick={handleOpenPaymentModal}
                            size="sm"
                            className="rounded-xl font-bold bg-primary text-white text-xs"
                        >
                            <Plus className="h-4 w-4 ml-1" />
                            تسجيل دفعة جديدة
                        </Button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {financialLoading ? (
                            <div className="p-12 text-center text-gray-400">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                جاري تحميل السجل المالي...
                            </div>
                        ) : !financialReport?.transactions || financialReport.transactions.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-xs">
                                لا توجد معاملات مالية مسجلة لهذا الطالب حتى الآن.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold">
                                        <tr>
                                            <th className="py-3 px-4">التاريخ</th>
                                            <th className="py-3 px-4">النوع / التصنيف</th>
                                            <th className="py-3 px-4">المبلغ المستحق</th>
                                            <th className="py-3 px-4">المدفوع</th>
                                            <th className="py-3 px-4">المتبقي</th>
                                            <th className="py-3 px-4">الوصف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {financialReport.transactions.map((tx: any) => (
                                            <tr key={tx._id} className="hover:bg-gray-50/50">
                                                <td className="py-3 px-4 font-bold text-gray-800">
                                                    {new Date(tx.date).toLocaleDateString('ar-EG')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                                        {tx.category === 'CENTER_PACKAGE' ? 'باقة سنتر' :
                                                         tx.category === 'CENTER_PRIVATE' ? 'حصة خاصة' :
                                                         tx.category === 'CENTER_COMBINED' ? 'شامل' : tx.category}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 font-semibold text-gray-800">
                                                    {tx.originalAmount} ج.م
                                                </td>
                                                <td className="py-3 px-4 font-bold text-emerald-600">
                                                    {tx.paidAmount} ج.م
                                                </td>
                                                <td className="py-3 px-4 font-bold text-red-600">
                                                    {tx.remainingAmount > 0 ? `${tx.remainingAmount} ج.م` : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-gray-500">
                                                    {tx.description || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* TAB 4: ID CARD & QR */}
                <TabsContent value="id-card" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* ID Card Visual */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-full max-w-sm rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-white p-6 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between border-b border-gray-200/60 pb-3 mb-4">
                                    <div className="text-right">
                                        <h4 className="font-extrabold text-sm text-primary">{currentCenter?.name || 'السنتر التعليمي'}</h4>
                                        <p className="text-[10px] text-gray-400">بطاقة تعريف طالب</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                        {student.studentName.charAt(0)}
                                    </div>
                                </div>

                                {qrDataUrl ? (
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 inline-block shadow-sm mb-3">
                                        <img src={qrDataUrl} alt="QR Code" className="w-36 h-36 mx-auto" />
                                    </div>
                                ) : (
                                    <div className="w-36 h-36 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                )}

                                <h3 className="font-black text-lg text-gray-900 mb-1">{student.studentName}</h3>
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <Badge variant="outline" className="font-mono text-xs font-bold bg-primary/5 text-primary border-primary/20">
                                        {student.studentCode}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                                        {student.gradeLevel}
                                    </Badge>
                                </div>

                                {student.barcode && (
                                    <div className="font-mono text-[11px] text-gray-500 bg-gray-50 py-1 px-3 rounded-lg inline-block border border-gray-100">
                                        {student.barcode}
                                    </div>
                                )}
                            </div>

                            <Button onClick={handlePrintCard} className="rounded-xl font-bold gap-2">
                                <Printer className="h-4 w-4" />
                                <span>طباعة الكارنيه الآن</span>
                            </Button>
                        </div>

                        {/* Scanner Guide */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <h3 className="font-bold text-gray-900 text-base">استخدام الباركود و QR Code</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                يُستخدم هذا الرمز لسرعة تحضير الطالب في جلسات السنتر اليومية عن طريق مسح الكاميرا أو قارئ الباركود اليدوي (Barcode Scanner).
                            </p>

                            <div className="space-y-3 pt-2">
                                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                        1
                                    </div>
                                    <p className="text-xs text-gray-600">
                                        اطبع البطاقة وسلمها للطالب أو أرسل الرمز لولي الأمر عبر الواتساب.
                                    </p>
                                </div>

                                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                        2
                                    </div>
                                    <p className="text-xs text-gray-600">
                                        عند دخول الطالب السنتر، يمكن للمشرف مسح الكود من شاشة <Link href="/center/attendance" className="text-primary font-bold hover:underline">تحضير السنتر</Link> ليتم تسجيل حضوره فوراً.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Student Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md rounded-2xl font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Edit2 className="h-4 w-4 text-primary" />
                            تعديل بيانات الطالب
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">اسم الطالب *</label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="rounded-xl text-xs"
                                placeholder="الاسم الثلاثي أو الرباعي"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">اسم ولي الأمر (اختياري)</label>
                            <Input
                                value={editParentName}
                                onChange={(e) => setEditParentName(e.target.value)}
                                className="rounded-xl text-xs"
                                placeholder="اسم ولي الأمر (تلقائي إن ترك فارغاً)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">هاتف الطالب</label>
                                <Input
                                    value={editStudentPhone}
                                    onChange={(e) => setEditStudentPhone(e.target.value)}
                                    className="rounded-xl text-xs"
                                    placeholder="01xxxxxxxxx"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">هاتف ولي الأمر</label>
                                <Input
                                    value={editParentPhone}
                                    onChange={(e) => setEditParentPhone(e.target.value)}
                                    className="rounded-xl text-xs"
                                    placeholder="01xxxxxxxxx"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">المرحلة الدراسية *</label>
                            <select
                                value={editGradeLevel}
                                onChange={(e) => setEditGradeLevel(e.target.value)}
                                className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white"
                            >
                                {ALL_GRADES.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">كود الباركود</label>
                            <Input
                                value={editBarcode}
                                onChange={(e) => setEditBarcode(e.target.value)}
                                className="rounded-xl text-xs font-mono"
                                placeholder="الباركود المطبوع"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">ملاحظات إضافية</label>
                            <Input
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="rounded-xl text-xs"
                                placeholder="أي ملاحظات خاصة بالطالب"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="editIsActive"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary"
                            />
                            <label htmlFor="editIsActive" className="text-xs font-medium text-gray-700 cursor-pointer">
                                حساب الطالب نشط في السنتر
                            </label>
                        </div>

                        <DialogFooter className="gap-2 pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditOpen(false)}
                                className="rounded-xl text-xs"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="rounded-xl text-xs font-bold"
                            >
                                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                                حفظ التعديلات
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Quick Payment Modal */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent className="max-w-md rounded-2xl font-cairo" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-600" />
                            تسجيل دفعة نقدية بالسنتر
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSavePayment} className="space-y-4 py-2">
                        {enrollment && (
                            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-1.5 text-xs">
                                <div className="flex items-center justify-between font-bold text-blue-900">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles className="h-4 w-4 text-blue-600" />
                                        اشتراك الطالب الحالي (مسعر تلقائياً):
                                    </span>
                                    <Badge className="bg-blue-600 text-white font-bold text-[10px]">
                                        {enrollment.type === 'PACKAGE' ? 'باقة سنتر' : enrollment.type === 'PRIVATE' ? 'مجموعات خصوصي' : 'باقة + خصوصي'}
                                    </Badge>
                                </div>
                                <div className="text-[11px] text-blue-800 space-y-1 pt-1 border-t border-blue-200/60">
                                    {enrollment.packageId && (
                                        <div className="flex items-center justify-between">
                                            <span>📦 الباقة: <strong>{enrollment.packageId.name}</strong></span>
                                            <span className="font-bold font-mono">{enrollment.packageMonthlyPrice || enrollment.packageId.monthlyPrice} ج.م</span>
                                        </div>
                                    )}
                                    {enrollment.privateTeachers && enrollment.privateTeachers.length > 0 && (
                                        <div>
                                            <span>👨‍🏫 مجموعات البرايفت: </span>
                                            <span className="font-medium">
                                                {enrollment.privateTeachers.map((pt: any) => `${pt.groupId?.name || 'مجموعة'} (${pt.monthlyPrice || 0} ج.م)`).join(' + ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">نوع الباقة / الحصة *</label>
                            <select
                                value={payCategory}
                                onChange={(e) => {
                                    const newCat = e.target.value as any;
                                    setPayCategory(newCat);
                                    if (enrollment) {
                                        if (newCat === 'CENTER_PACKAGE') {
                                            const base = enrollment.packageMonthlyPrice || enrollment.packageId?.monthlyPrice || 0;
                                            setPayOriginalAmount(base.toString());
                                            const disc = Number(payDiscountAmount) || 0;
                                            setPayPaidAmount(Math.max(0, base - disc).toString());
                                        } else if (newCat === 'CENTER_PRIVATE') {
                                            const base = (enrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                                            setPayOriginalAmount(base.toString());
                                            const disc = Number(payDiscountAmount) || 0;
                                            setPayPaidAmount(Math.max(0, base - disc).toString());
                                        } else if (newCat === 'CENTER_COMBINED') {
                                            const pkgBase = enrollment.packageMonthlyPrice || enrollment.packageId?.monthlyPrice || 0;
                                            const pvtBase = (enrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                                            const total = pkgBase + pvtBase;
                                            setPayOriginalAmount(total.toString());
                                            const disc = Number(payDiscountAmount) || 0;
                                            setPayPaidAmount(Math.max(0, total - disc).toString());
                                        }
                                    }
                                }}
                                className="w-full text-xs rounded-xl border border-gray-200 px-3 py-2 bg-white"
                            >
                                <option value="CENTER_PACKAGE">اشتراك باقة سنتر (Package)</option>
                                <option value="CENTER_PRIVATE">اشتراك مدرس خصوصي (Private)</option>
                                <option value="CENTER_COMBINED">اشتراك شامل (Combined)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">المبلغ الأصلي (ج.م) *</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={payOriginalAmount}
                                    onChange={(e) => {
                                        setPayOriginalAmount(e.target.value);
                                        const orig = Number(e.target.value) || 0;
                                        const disc = Number(payDiscountAmount) || 0;
                                        setPayPaidAmount(Math.max(0, orig - disc).toString());
                                    }}
                                    className="rounded-xl text-xs font-mono"
                                    placeholder="0"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">الخصم (ج.م)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={payDiscountAmount}
                                    onChange={(e) => {
                                        setPayDiscountAmount(e.target.value);
                                        const orig = Number(payOriginalAmount) || 0;
                                        const disc = Number(e.target.value) || 0;
                                        setPayPaidAmount(Math.max(0, orig - disc).toString());
                                    }}
                                    className="rounded-xl text-xs font-mono"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">المبلغ المدفوع الآن (ج.م) *</label>
                            <Input
                                type="number"
                                min="0"
                                value={payPaidAmount}
                                onChange={(e) => setPayPaidAmount(e.target.value)}
                                className="rounded-xl text-xs font-mono font-bold text-emerald-700"
                                placeholder="0"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700">بيان / وصف الدفعة</label>
                            <Input
                                value={payDescription}
                                onChange={(e) => setPayDescription(e.target.value)}
                                className="rounded-xl text-xs"
                                placeholder="مثلاً: قسط شهر أكتوبر، رسوم تسجيل..."
                            />
                        </div>

                        {/* Live Calculation Summary Banner */}
                        {Number(payOriginalAmount) > 0 && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between text-emerald-950 font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        المبلغ المطلوب تسديده:
                                    </span>
                                    <span className="font-mono text-sm font-black text-emerald-700">
                                        {payOriginalAmount} ج.م
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-emerald-800">
                                    <span>المسدد نقداً الآن:</span>
                                    <span className="font-mono font-bold">{payPaidAmount || 0} ج.م</span>
                                </div>
                                {Number(payOriginalAmount) - Number(payDiscountAmount || 0) - Number(payPaidAmount || 0) > 0 && (
                                    <div className="flex items-center justify-between text-[11px] text-red-600 font-bold pt-1 border-t border-emerald-200/60">
                                        <span>المتبقي دين / مستحق لاحقاً:</span>
                                        <span className="font-mono">
                                            {Math.max(0, Number(payOriginalAmount) - Number(payDiscountAmount || 0) - Number(payPaidAmount || 0))} ج.م
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsPaymentOpen(false)}
                                className="rounded-xl text-xs"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={paymentMutation.isPending}
                                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {paymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                                تأكيد وتسجيل الدفعة
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

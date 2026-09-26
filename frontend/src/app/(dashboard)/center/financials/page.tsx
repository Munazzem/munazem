'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Wallet,
    Plus,
    Calendar,
    ArrowUpRight,
    Search,
    CreditCard,
    DollarSign,
    GraduationCap,
    TrendingUp,
    Users,
    Loader2,
} from 'lucide-react';
import {
    fetchCenterFinancialSummary,
    fetchCenterTeachers,
    fetchTeacherFinancialReport,
    recordCenterPayment,
    fetchCenterEnrollments,
} from '@/lib/api/centers';
import { fetchStudents } from '@/lib/api/students';
import {
    ICenterFinancialSummary,
    ICenterTeacher,
    ITeacherFinancialReport,
    RecordPaymentDTO,
} from '@/types/center.types';
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

export default function CenterFinancialsPage() {
    const queryClient = useQueryClient();
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isPaymentOpen, setIsPaymentOpen] = useState(false);

    // Payment Form state
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [category, setCategory] = useState<'CENTER_PACKAGE' | 'CENTER_PRIVATE' | 'CENTER_COMBINED'>('CENTER_PACKAGE');
    const [centerTeacherId, setCenterTeacherId] = useState('');
    const [originalAmount, setOriginalAmount] = useState('');
    const [discountAmount, setDiscountAmount] = useState('0');
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');

    const { data: summary, isLoading: loadingSummary } = useQuery<ICenterFinancialSummary>({
        queryKey: ['center', 'financials-summary', startDate, endDate],
        queryFn: () => fetchCenterFinancialSummary(startDate || undefined, endDate || undefined),
    });

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: teacherReport, isLoading: loadingTeacherReport } = useQuery<ITeacherFinancialReport>({
        queryKey: ['center', 'teacher-report', selectedTeacherId, startDate, endDate],
        queryFn: () => fetchTeacherFinancialReport(selectedTeacherId, startDate || undefined, endDate || undefined),
        enabled: selectedTeacherId !== 'ALL' && !!selectedTeacherId,
    });

    const { data: searchedStudentsData } = useQuery({
        queryKey: ['students', 'search', studentSearch],
        queryFn: () => fetchStudents({ search: studentSearch, limit: 8 }),
        enabled: studentSearch.trim().length >= 2,
    });
    const studentOptions = searchedStudentsData?.data || [];

    const paymentMutation = useMutation({
        mutationFn: recordCenterPayment,
        onSuccess: () => {
            toast.success('تم تسجيل المعاملة المالية بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'financials-summary'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'teacher-report'] });
            handleClosePayment();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل المعاملة');
        },
    });

    const handleOpenPayment = () => {
        setSelectedStudentId('');
        setStudentSearch('');
        setCategory('CENTER_PACKAGE');
        setCenterTeacherId('');
        setOriginalAmount('');
        setDiscountAmount('0');
        setPaidAmount('');
        setDescription('');
        setIsPaymentOpen(true);
    };

    const handleClosePayment = () => {
        setIsPaymentOpen(false);
    };

    const handleOriginalAmountChange = (val: string) => {
        setOriginalAmount(val);
        const orig = Number(val) || 0;
        const disc = Number(discountAmount) || 0;
        setPaidAmount(Math.max(0, orig - disc).toString());
    };

    const handleDiscountChange = (val: string) => {
        setDiscountAmount(val);
        const orig = Number(originalAmount) || 0;
        const disc = Number(val) || 0;
        setPaidAmount(Math.max(0, orig - disc).toString());
    };

    const handleSubmitPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId) {
            toast.error('يرجى اختيار الطالب');
            return;
        }

        const orig = Number(originalAmount);
        const paid = Number(paidAmount);
        const disc = Number(discountAmount) || 0;

        if (!orig || orig <= 0) {
            toast.error('المبلغ الأصلي يجب أن يكون أكبر من صفر');
            return;
        }

        const remaining = Math.max(0, orig - disc - paid);

        const payload: RecordPaymentDTO = {
            studentId: selectedStudentId,
            category,
            centerTeacherId: category === 'CENTER_PRIVATE' ? centerTeacherId : null,
            originalAmount: orig,
            discountAmount: disc,
            paidAmount: paid,
            remainingAmount: remaining,
            description: description.trim() || undefined,
            date: paymentDate,
        };

        paymentMutation.mutate(payload);
    };

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-primary" />
                        الماليات وحسابات السنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        تقارير الإيرادات المجمعة، تحصيلات الباقات، وحسابات مدرسي البرايفت داخل السنتر.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BranchSwitcher />
                    <Button onClick={handleOpenPayment} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold">
                        <Plus className="h-4 w-4" />
                        تسجيل دفعة نقدية
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إجمالي الإيرادات المحصلة</span>
                    <h3 className="text-2xl font-black text-gray-900 mt-2">
                        {(summary?.totalRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>تحصيلات السنتر الإجمالية</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إيرادات الباقات</span>
                    <h3 className="text-2xl font-black text-blue-600 mt-2">
                        {(summary?.packageRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-gray-500 font-medium">
                        اشتراكات الباقات الشاملة
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إيرادات البرايفت</span>
                    <h3 className="text-2xl font-black text-purple-600 mt-2">
                        {(summary?.privateRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-gray-500 font-medium">
                        حصص المدرسين الخاصة
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">المبالغ المتبقية (الديون)</span>
                    <h3 className="text-2xl font-black text-rose-600 mt-2">
                        {(summary?.totalDebt || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-rose-600 font-bold">
                        مستحقات لم تُسدد بعد
                    </div>
                </div>
            </div>

            {/* Teacher Accounts Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            كشف حساب المدرسين داخل السنتر
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            اختر مدرساً لعرض إجمالي ما تم تحصيله لمجموعاته الخاصة وسجل المعاملات
                        </p>
                    </div>

                    <div className="w-full sm:w-64">
                        <select
                            value={selectedTeacherId}
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
                        >
                            <option value="ALL">اختر مدرساً لعرض كشف حسابه</option>
                            {teachers.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name} ({t.subject})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedTeacherId === 'ALL' ? (
                    <div className="py-12 text-center text-gray-400">
                        <GraduationCap className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-gray-600">اختر مدرساً من القائمة أعلاه لعرض كشف حسابه المالي</p>
                    </div>
                ) : loadingTeacherReport ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div>
                        {/* Teacher Summary bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl mb-4 text-center">
                            <div>
                                <span className="text-xs text-gray-400 font-bold block">إجمالي المحصل للمدرس</span>
                                <span className="text-xl font-black text-emerald-600">
                                    {(teacherReport?.totalPaid || 0).toLocaleString()} ج.م
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 font-bold block">المتبقي على طلابه</span>
                                <span className="text-xl font-black text-rose-600">
                                    {(teacherReport?.totalRemaining || 0).toLocaleString()} ج.م
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 font-bold block">عدد المعاملات</span>
                                <span className="text-xl font-black text-gray-800">
                                    {teacherReport?.transactionCount || 0}
                                </span>
                            </div>
                        </div>

                        {/* Transactions Table */}
                        {teacherReport?.transactions?.length === 0 ? (
                            <p className="text-center text-xs text-gray-400 py-6">لا توجد معاملات مسجلة لهذا المدرس حتى الآن</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-400 font-bold">
                                        <tr>
                                            <th className="py-3 px-4">الطالب</th>
                                            <th className="py-3 px-4">المبلغ الأصلي</th>
                                            <th className="py-3 px-4">المدفوع</th>
                                            <th className="py-3 px-4">المتبقي</th>
                                            <th className="py-3 px-4">التاريخ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {teacherReport?.transactions?.map((tx: any) => (
                                            <tr key={tx._id} className="hover:bg-gray-50/50">
                                                <td className="py-3 px-4 font-bold text-gray-900">
                                                    {tx.studentName || 'طالب'}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-gray-600">
                                                    {tx.originalAmount} ج.م
                                                </td>
                                                <td className="py-3 px-4 font-bold text-emerald-600">
                                                    {tx.paidAmount} ج.م
                                                </td>
                                                <td className="py-3 px-4 font-bold text-rose-600">
                                                    {tx.remainingAmount} ج.م
                                                </td>
                                                <td className="py-3 px-4 text-gray-400 font-medium">
                                                    {new Date(tx.date).toLocaleDateString('ar-EG')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Record Payment Dialog */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            تسجيل دفعة نقدية بالسنتر
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmitPayment} className="space-y-4 py-2">
                        {/* Student Search */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                البحث عن الطالب *
                            </label>
                            <Input
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                placeholder="اكتب اسم الطالب أو الكود..."
                                className="rounded-xl border-gray-200"
                            />
                            {studentOptions.length > 0 && (
                                <div className="mt-1 border border-gray-200 rounded-xl p-1.5 bg-gray-50/50 max-h-32 overflow-y-auto space-y-1">
                                    {studentOptions.map((st: any) => (
                                        <div
                                            key={st._id}
                                            onClick={() => {
                                                setSelectedStudentId(st._id);
                                                setStudentSearch(`${st.studentName} (${st.studentCode})`);
                                            }}
                                            className={`p-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                                selectedStudentId === st._id
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white hover:bg-gray-100 text-gray-800'
                                            }`}
                                        >
                                            {st.studentName} — كود: {st.studentCode}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">نوع المعاملة *</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as any)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                            >
                                <option value="CENTER_PACKAGE">اشتراك باقة سنتر (Package)</option>
                                <option value="CENTER_PRIVATE">اشتراك برايفت مدرس (Private)</option>
                                <option value="CENTER_COMBINED">اشتراك مجمع (Combined)</option>
                            </select>
                        </div>

                        {category === 'CENTER_PRIVATE' && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المدرس المستفيد *</label>
                                <select
                                    value={centerTeacherId}
                                    onChange={(e) => setCenterTeacherId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    required
                                >
                                    <option value="" disabled>اختر المدرس</option>
                                    {teachers.map((t) => (
                                        <option key={t._id} value={t._id}>
                                            {t.name} ({t.subject})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المبلغ المطلوب (ج.م) *</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={originalAmount}
                                    onChange={(e) => handleOriginalAmountChange(e.target.value)}
                                    placeholder="مثال: 500"
                                    className="rounded-xl border-gray-200"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">الخصم (إن وجد)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={discountAmount}
                                    onChange={(e) => handleDiscountChange(e.target.value)}
                                    className="rounded-xl border-gray-200"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">المبلغ المدفوع فعلياً (ج.م) *</label>
                            <Input
                                type="number"
                                min="0"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value)}
                                className="rounded-xl border-gray-200 font-bold text-emerald-700"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">ملاحظات أو بيان</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="مثال: سداد شهر أكتوبر"
                                className="rounded-xl border-gray-200 text-xs"
                            />
                        </div>

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={paymentMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {paymentMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                حفظ المعاملة
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClosePayment}
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

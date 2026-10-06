'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/lib/hooks/use-debounce';
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
    Calculator,
    BookOpen,
    CheckCircle2,
    Sparkles,
    Printer,
    FileText,
    History,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    ArrowDownRight,
    Receipt,
    CalendarDays,
    BarChart3,
    Filter,
} from 'lucide-react';
import {
    fetchCenterFinancialSummary,
    fetchCenterTeachers,
    fetchTeacherFinancialReport,
    recordCenterPayment,
    fetchCenterEnrollments,
    fetchCenterStudents,
    fetchCenterPackages,
    fetchCenterGroups,
    fetchStudentEnrollment,
    fetchCenterDailyTally,
    fetchCenterMonthlyTally,
    fetchCenterTransactions,
    fetchMyCenters,
} from '@/lib/api/centers';
import {
    ICenterFinancialSummary,
    ICenterTeacher,
    ITeacherFinancialReport,
    RecordPaymentDTO,
    ICenterPackage,
    ICenterGroup,
    ICenterEnrollment,
    ICenterStudent,
    ICenterTransaction,
    IDailyTallyReport,
    IMonthlyTallyReport,
    ICenter,
} from '@/types/center.types';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { printHtmlContent } from '@/lib/utils/print';

const MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function CenterFinancialsPage() {
    const queryClient = useQueryClient();

    // Active View Tab
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'transactions' | 'teachers'>('daily');

    // ── Centers for Branding Print ──────────────────────────────────────────
    const { data: centers = [] } = useQuery<ICenter[]>({
        queryKey: ['center', 'my-centers'],
        queryFn: fetchMyCenters,
    });
    const centerName = centers[0]?.name || 'سنتر تعليمي';

    // ── Tab 1: Daily Tally State ────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const [dailyDate, setDailyDate] = useState(todayStr);

    const {
        data: dailyTally,
        isLoading: loadingDaily,
        refetch: refetchDaily,
    } = useQuery<IDailyTallyReport>({
        queryKey: ['center', 'daily-tally', dailyDate],
        queryFn: () => fetchCenterDailyTally(dailyDate),
    });

    // ── Tab 2: Monthly Tally State ──────────────────────────────────────────
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

    const {
        data: monthlyTally,
        isLoading: loadingMonthly,
        refetch: refetchMonthly,
    } = useQuery<IMonthlyTallyReport>({
        queryKey: ['center', 'monthly-tally', selectedYear, selectedMonth],
        queryFn: () => fetchCenterMonthlyTally(selectedYear, selectedMonth),
    });

    // ── Tab 3: Transactions Ledger State ────────────────────────────────────
    const [txSearch, setTxSearch] = useState('');
    const [txCategory, setTxCategory] = useState('');
    const [txTeacherId, setTxTeacherId] = useState('');
    const [txStartDate, setTxStartDate] = useState('');
    const [txEndDate, setTxEndDate] = useState('');
    const [txPage, setTxPage] = useState(1);

    const {
        data: txData,
        isLoading: loadingTx,
        refetch: refetchTx,
    } = useQuery({
        queryKey: ['center', 'transactions', txSearch, txCategory, txTeacherId, txStartDate, txEndDate, txPage],
        queryFn: () => fetchCenterTransactions({
            search: txSearch || undefined,
            category: txCategory || undefined,
            centerTeacherId: txTeacherId || undefined,
            startDate: txStartDate || undefined,
            endDate: txEndDate || undefined,
            page: txPage,
            limit: 25,
        }),
    });

    // ── Tab 4: Teacher Reports State ────────────────────────────────────────
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
    const [teacherStartDate, setTeacherStartDate] = useState('');
    const [teacherEndDate, setTeacherEndDate] = useState('');

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: teacherReport, isLoading: loadingTeacherReport } = useQuery<ITeacherFinancialReport>({
        queryKey: ['center', 'teacher-report', selectedTeacherId, teacherStartDate, teacherEndDate],
        queryFn: () => fetchTeacherFinancialReport(selectedTeacherId, teacherStartDate || undefined, teacherEndDate || undefined),
        enabled: selectedTeacherId !== 'ALL' && !!selectedTeacherId,
    });

    // Overall summary for KPI header
    const { data: summary } = useQuery<ICenterFinancialSummary>({
        queryKey: ['center', 'financials-summary'],
        queryFn: () => fetchCenterFinancialSummary(),
    });

    // ── Payment Form Modal State ────────────────────────────────────────────
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [category, setCategory] = useState<'CENTER_PACKAGE' | 'CENTER_PRIVATE' | 'CENTER_COMBINED'>('CENTER_PACKAGE');
    const [centerTeacherId, setCenterTeacherId] = useState('');
    const [selectedManualPkgId, setSelectedManualPkgId] = useState('');
    const [selectedManualGroupId, setSelectedManualGroupId] = useState('');
    const [originalAmount, setOriginalAmount] = useState('');
    const [discountAmount, setDiscountAmount] = useState('0');
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(todayStr);
    const [description, setDescription] = useState('');

    const { data: packages = [] } = useQuery<ICenterPackage[]>({
        queryKey: ['center', 'packages'],
        queryFn: () => fetchCenterPackages({ isActive: true }),
    });

    const { data: groups = [] } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });

    const debouncedStudentSearch = useDebounce(studentSearch, 350);
    const { data: searchedStudentsData } = useQuery({
        queryKey: ['center', 'students', 'search', debouncedStudentSearch],
        queryFn: () => fetchCenterStudents({ search: debouncedStudentSearch, limit: 8 }),
        enabled: debouncedStudentSearch.trim().length >= 2,
    });
    const studentOptions = searchedStudentsData?.data || [];

    // Fetch Student Enrollment to auto-detect pricing & category
    const { data: studentEnrollment } = useQuery<ICenterEnrollment | null>({
        queryKey: ['center', 'enrollment', 'student', selectedStudentId],
        queryFn: async () => {
            if (!selectedStudentId) return null;
            try {
                return await fetchStudentEnrollment(selectedStudentId);
            } catch (err: any) {
                return null;
            }
        },
        enabled: !!selectedStudentId,
    });

    // Auto-calculate when student enrollment loads
    useEffect(() => {
        if (!selectedStudentId) return;
        if (studentEnrollment === undefined) return;

        if (studentEnrollment) {
            if (studentEnrollment.type === 'PACKAGE') {
                setCategory('CENTER_PACKAGE');
                const base = studentEnrollment.packageMonthlyPrice || studentEnrollment.packageId?.monthlyPrice || 0;
                let disc = 0;
                if (studentEnrollment.packageDiscount?.type === 'PERCENTAGE') {
                    disc = (base * (Number(studentEnrollment.packageDiscount.value) || 0)) / 100;
                } else if (studentEnrollment.packageDiscount?.type === 'FIXED') {
                    disc = Number(studentEnrollment.packageDiscount.value) || 0;
                }
                setSelectedManualPkgId(studentEnrollment.packageId?._id || '');
                setOriginalAmount(base.toString());
                setDiscountAmount(disc.toString());
                setPaidAmount(Math.max(0, base - disc).toString());
                setDescription(`سداد اشتراك باقة: ${studentEnrollment.packageId?.name || ''}`);
            } else if (studentEnrollment.type === 'PRIVATE') {
                setCategory('CENTER_PRIVATE');
                const base = (studentEnrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                let disc = 0;
                if (studentEnrollment.privateDiscount?.type === 'PERCENTAGE') {
                    disc = (base * (Number(studentEnrollment.privateDiscount.value) || 0)) / 100;
                } else if (studentEnrollment.privateDiscount?.type === 'FIXED') {
                    disc = Number(studentEnrollment.privateDiscount.value) || 0;
                }
                if (studentEnrollment.privateTeachers?.[0]?.centerTeacherId) {
                    const tId = typeof studentEnrollment.privateTeachers[0].centerTeacherId === 'object'
                        ? (studentEnrollment.privateTeachers[0].centerTeacherId as any)._id
                        : studentEnrollment.privateTeachers[0].centerTeacherId;
                    setCenterTeacherId(tId);
                }
                if (studentEnrollment.privateTeachers?.[0]?.groupId) {
                    const gId = typeof studentEnrollment.privateTeachers[0].groupId === 'object'
                        ? (studentEnrollment.privateTeachers[0].groupId as any)._id
                        : studentEnrollment.privateTeachers[0].groupId;
                    setSelectedManualGroupId(gId);
                }
                setOriginalAmount(base.toString());
                setDiscountAmount(disc.toString());
                setPaidAmount(Math.max(0, base - disc).toString());
                setDescription('سداد اشتراك مجموعات خصوصي');
            } else if (studentEnrollment.type === 'BOTH') {
                setCategory('CENTER_COMBINED');
                const pkgBase = studentEnrollment.packageMonthlyPrice || studentEnrollment.packageId?.monthlyPrice || 0;
                const pvtBase = (studentEnrollment.privateTeachers || []).reduce((acc: number, pt: any) => acc + (pt.monthlyPrice || 0), 0);
                const totalBase = pkgBase + pvtBase;

                let totalDisc = 0;
                if (studentEnrollment.packageDiscount?.type === 'PERCENTAGE') totalDisc += (pkgBase * (Number(studentEnrollment.packageDiscount.value) || 0)) / 100;
                else if (studentEnrollment.packageDiscount?.type === 'FIXED') totalDisc += Number(studentEnrollment.packageDiscount.value) || 0;

                if (studentEnrollment.privateDiscount?.type === 'PERCENTAGE') totalDisc += (pvtBase * (Number(studentEnrollment.privateDiscount.value) || 0)) / 100;
                else if (studentEnrollment.privateDiscount?.type === 'FIXED') totalDisc += Number(studentEnrollment.privateDiscount.value) || 0;

                if (studentEnrollment.combinedDiscount?.type === 'PERCENTAGE') totalDisc += (totalBase * (Number(studentEnrollment.combinedDiscount.value) || 0)) / 100;
                else if (studentEnrollment.combinedDiscount?.type === 'FIXED') totalDisc += Number(studentEnrollment.combinedDiscount.value) || 0;

                setSelectedManualPkgId(studentEnrollment.packageId?._id || '');
                setOriginalAmount(totalBase.toString());
                setDiscountAmount(totalDisc.toString());
                setPaidAmount(Math.max(0, totalBase - totalDisc).toString());
                setDescription('سداد اشتراك مجمع (باقة + مجموعات خصوصي)');
            }
        }
    }, [studentEnrollment, selectedStudentId]);

    const paymentMutation = useMutation({
        mutationFn: recordCenterPayment,
        onSuccess: (res: any) => {
            toast.success('تم تسجيل المعاملة المالية بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'financials-summary'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'daily-tally'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'monthly-tally'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'transactions'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'teacher-report'] });
            handleClosePayment();
            if (res) {
                printReceipt(centerName, res);
            }
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
        setSelectedManualPkgId('');
        setSelectedManualGroupId('');
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

    // ── Print Handlers ──────────────────────────────────────────────────────
    const handlePrintDailyTally = () => {
        if (!dailyTally) return;
        const rowsHtml = (dailyTally.transactions || []).map((tx, idx) => `
            <tr>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${idx + 1}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 10px; font-family: monospace;">${new Date(tx.date || tx.createdAt || '').toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">
                    ${tx.studentName || 'طالب'}
                    ${tx.studentCode ? `<div style="font-size: 9px; color: #64748b; font-family: monospace;">كود: ${tx.studentCode}</div>` : ''}
                </td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 10px;">
                    ${tx.category === 'CENTER_PACKAGE' ? 'باقة سنتر' : tx.category === 'CENTER_PRIVATE' ? 'برايفت' : 'شامل مجمع'}
                </td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 10px;">
                    ${tx.description || (tx.centerTeacherId?.name ? `مدرس: ${tx.centerTeacherId.name}` : '—')}
                </td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-family: monospace;">${tx.originalAmount || 0}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-family: monospace; color: #15803d;">${tx.discountAmount || 0}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-family: monospace; font-weight: bold; color: #047857;">${tx.paidAmount || 0}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-family: monospace; color: ${tx.remainingAmount > 0 ? '#b91c1c' : '#64748b'}; font-weight: ${tx.remainingAmount > 0 ? 'bold' : 'normal'};">${tx.remainingAmount || 0}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 10px;">${tx.createdBy?.name || 'السيستم'}</td>
            </tr>
        `).join('');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8"/>
            <title>جرد الخزينة اليومي - ${dailyTally.date}</title>
            <style>
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 15px; color: #0f172a; line-height: 1.4; font-size: 12px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
                .badge { display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 12px; font-weight: bold; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
                .card-title { font-size: 10px; color: #64748b; font-weight: bold; }
                .card-val { font-size: 16px; font-weight: 900; margin-top: 3px; font-family: monospace; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th { background: #f1f5f9; padding: 8px 6px; border: 1px solid #94a3b8; font-size: 11px; font-weight: bold; text-align: right; }
                .sign-section { display: flex; justify-content: space-between; margin-top: 35px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
                .sign-box { text-align: center; width: 180px; }
                .sign-line { border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 900;">${centerName}</h2>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">تقرير جرد الخزينة اليومي — تقفيل وردية</p>
                </div>
                <div style="text-align: left;">
                    <div class="badge">تاريخ الجرد: ${dailyTally.date}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 3px;">وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}</div>
                </div>
            </div>

            <div class="summary-grid">
                <div class="card" style="border-color: #6ee7b7; background: #f0fdf4;">
                    <div class="card-title" style="color: #065f46;">إجمالي النقدية المحصلة بالخزينة</div>
                    <div class="card-val" style="color: #047857;">${dailyTally.totalPaid.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">إيرادات الباقات</div>
                    <div class="card-val" style="color: #2563eb;">${dailyTally.packageRevenue.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">إيرادات البرايفت</div>
                    <div class="card-val" style="color: #7c3aed;">${dailyTally.privateRevenue.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">مستحقات آجلة (ديون اليوم)</div>
                    <div class="card-val" style="color: #e11d48;">${dailyTally.totalDebt.toLocaleString()} ج.م</div>
                </div>
            </div>

            <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                تفاصيل المقبوضات وحركات الخزينة (${dailyTally.transactionCount} معاملة):
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: center;">#</th>
                        <th>الوقت</th>
                        <th>الطالب</th>
                        <th>النوع</th>
                        <th>البيان / المدرس</th>
                        <th style="text-align: center;">المطلوب</th>
                        <th style="text-align: center;">الخصم</th>
                        <th style="text-align: center;">المدفوع</th>
                        <th style="text-align: center;">المتبقي</th>
                        <th>المسؤول</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد معاملات مسجلة في هذا اليوم</td></tr>'}
                </tbody>
            </table>

            <div class="sign-section">
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <span style="font-size: 11px; font-weight: bold;">توقيع أمين الخزينة / الكاشير</span>
                </div>
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <span style="font-size: 11px; font-weight: bold;">اعتماد إدارة السنتر</span>
                </div>
            </div>
        </body>
        </html>
        `;
        printHtmlContent(html, `جرد_خزينة_${dailyTally.date}`);
    };

    const handlePrintMonthlyTally = () => {
        if (!monthlyTally) return;
        const monthName = MONTHS_AR[monthlyTally.month - 1];

        const dailyRowsHtml = (monthlyTally.dailyBreakdown || []).map((d) => `
            <tr>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 11px;">يوم ${d.day} (${monthName})</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px;">${d.count}</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; color: #2563eb;">${d.packageRevenue.toLocaleString()} ج.م</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; color: #7c3aed;">${d.privateRevenue.toLocaleString()} ج.م</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; color: #d97706;">${(d.combinedRevenue || 0).toLocaleString()} ج.م</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; font-weight: bold; color: #047857;">${d.totalPaid.toLocaleString()} ج.م</td>
                <td style="padding: 7px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-size: 11px; color: ${d.totalDebt > 0 ? '#dc2626' : '#64748b'};">${d.totalDebt.toLocaleString()} ج.م</td>
            </tr>
        `).join('');

        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8"/>
            <title>الجرد الشهري - ${monthName} ${monthlyTally.year}</title>
            <style>
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 15px; color: #0f172a; line-height: 1.4; font-size: 12px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
                .badge { display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 12px; font-weight: bold; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
                .card-title { font-size: 10px; color: #64748b; font-weight: bold; }
                .card-val { font-size: 16px; font-weight: 900; margin-top: 3px; font-family: monospace; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th { background: #f1f5f9; padding: 8px 6px; border: 1px solid #94a3b8; font-size: 11px; font-weight: bold; text-align: center; }
                .sign-section { display: flex; justify-content: space-between; margin-top: 35px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
                .sign-box { text-align: center; width: 180px; }
                .sign-line { border-bottom: 1px solid #94a3b8; height: 30px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 900;">${centerName}</h2>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">تقرير الجرد والتقفيل المالي المعتمد لشهر ${monthName} ${monthlyTally.year}</p>
                </div>
                <div style="text-align: left;">
                    <div class="badge">الفترة: شهر ${monthName} ${monthlyTally.year}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 3px;">تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
            </div>

            <div class="summary-grid">
                <div class="card" style="border-color: #93c5fd; background: #eff6ff;">
                    <div class="card-title" style="color: #1e40af;">إجمالي إيرادات الشهر المحصلة</div>
                    <div class="card-val" style="color: #1d4ed8;">${monthlyTally.totalPaid.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">إجمالي إيراد الباقات</div>
                    <div class="card-val" style="color: #2563eb;">${monthlyTally.packageRevenue.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">إجمالي إيراد البرايفت</div>
                    <div class="card-val" style="color: #7c3aed;">${monthlyTally.privateRevenue.toLocaleString()} ج.م</div>
                </div>
                <div class="card">
                    <div class="card-title">إجمالي الديون والمستحقات</div>
                    <div class="card-val" style="color: #dc2626;">${monthlyTally.totalDebt.toLocaleString()} ج.م</div>
                </div>
            </div>

            <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                حركة الإيراد والتحصيل اليومي خلال الشهر (${monthlyTally.transactionCount} إجمالي المعاملات):
            </div>

            <table>
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>عدد العمليات</th>
                        <th>إيراد الباقات</th>
                        <th>إيراد البرايفت</th>
                        <th>إيراد المجمع</th>
                        <th>الإجمالي المحصل</th>
                        <th>المتبقيات (الديون)</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyRowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد معاملات مسجلة في هذا الشهر</td></tr>'}
                </tbody>
            </table>

            <div class="sign-section">
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <span style="font-size: 11px; font-weight: bold;">المحاسب المالي للسنتر</span>
                </div>
                <div class="sign-box">
                    <div class="sign-line"></div>
                    <span style="font-size: 11px; font-weight: bold;">اعتماد المدير العام</span>
                </div>
            </div>
        </body>
        </html>
        `;
        printHtmlContent(html, `جرد_شهري_${monthName}_${monthlyTally.year}`);
    };

    const printReceipt = (centerTitle: string, tx: ICenterTransaction) => {
        const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8"/>
            <title>إيصال سداد - ${tx.studentName || 'طالب'}</title>
            <style>
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 16px; width: 330px; color: #0f172a; font-size: 12px; }
                .ticket { border: 1.5px dashed #94a3b8; padding: 14px; border-radius: 12px; background: #fff; }
                .title { text-align: center; font-weight: 900; font-size: 16px; color: #0f172a; margin-bottom: 2px; }
                .subtitle { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 12px; }
                .divider { border-top: 1px dashed #cbd5e1; margin: 10px 0; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
                .total-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px; text-align: center; margin: 10px 0; }
                .total-val { font-size: 20px; font-weight: 900; color: #047857; font-family: monospace; }
                .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 12px; }
            </style>
        </head>
        <body>
            <div class="ticket">
                <div class="title">${centerTitle}</div>
                <div class="subtitle">إيصال سداد نقدي رسمي بالخزينة</div>
                <div class="row">
                    <span style="color: #64748b;">التاريخ:</span>
                    <span>${new Date(tx.date || tx.createdAt || '').toLocaleDateString('ar-EG')} - ${new Date(tx.date || tx.createdAt || '').toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="divider"></div>
                <div class="row">
                    <span style="color: #64748b;">اسم الطالب:</span>
                    <span style="font-weight: bold;">${tx.studentName || '—'}</span>
                </div>
                ${tx.studentCode ? `<div class="row"><span style="color: #64748b;">كود الطالب:</span><span style="font-family: monospace; font-weight: bold;">${tx.studentCode}</span></div>` : ''}
                ${tx.gradeLevel ? `<div class="row"><span style="color: #64748b;">المرحلة:</span><span>${tx.gradeLevel}</span></div>` : ''}
                <div class="row">
                    <span style="color: #64748b;">نوع الاشتراك:</span>
                    <span>${tx.category === 'CENTER_PACKAGE' ? 'باقة سنتر' : tx.category === 'CENTER_PRIVATE' ? 'برايفت مدرس' : 'شامل (مجمع)'}</span>
                </div>
                ${tx.description ? `<div class="row"><span style="color: #64748b;">البيان:</span><span>${tx.description}</span></div>` : ''}
                ${tx.centerTeacherId?.name ? `<div class="row"><span style="color: #64748b;">المدرس:</span><span>${tx.centerTeacherId.name}</span></div>` : ''}
                <div class="divider"></div>
                <div class="row">
                    <span>المبلغ الأصلي المطلوب:</span>
                    <span style="font-family: monospace;">${tx.originalAmount || 0} ج.م</span>
                </div>
                ${tx.discountAmount > 0 ? `<div class="row" style="color: #15803d;"><span>الخصم المطبق:</span><span style="font-family: monospace;">-${tx.discountAmount} ج.م</span></div>` : ''}
                <div class="total-box">
                    <div style="font-size: 10px; font-weight: bold; color: #065f46;">المبلغ المسدد نقدياً الآن</div>
                    <div class="total-val">${tx.paidAmount || 0} ج.م</div>
                </div>
                ${tx.remainingAmount > 0 ? `<div class="row" style="color: #dc2626; font-weight: bold;"><span>المتبقي دين / آجل:</span><span style="font-family: monospace;">${tx.remainingAmount} ج.م</span></div>` : ''}
                <div class="divider"></div>
                <div class="row" style="font-size: 10px; color: #64748b;">
                    <span>المسؤول: ${tx.createdBy?.name || 'الخزينة'}</span>
                    <span>معاملة #${tx._id.slice(-6).toUpperCase()}</span>
                </div>
                <div class="footer">شكراً لالتزامكم - نسعد بخدمتكم دائماً</div>
            </div>
        </body>
        </html>
        `;
        printHtmlContent(html, `إيصال_${tx.studentName || 'طالب'}`);
    };

    return (
        <div className="space-y-6 pb-12 font-sans" dir="rtl">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
                        <Wallet className="h-6 w-6 text-primary shrink-0" />
                        <span>الماليات وحسابات السنتر</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        تقفيل الجرد اليومي والشهري للخزينة، إيرادات الباقات والبرايفت، وسجل المقبوضات المعتمد.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button
                        onClick={handleOpenPayment}
                        className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 px-4 w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>تسجيل دفعة نقدية</span>
                    </Button>
                </div>
            </div>

            {/* Overall KPI Quick Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إجمالي الإيرادات المحصلة</span>
                    <h3 className="text-2xl font-black text-gray-900 mt-2 font-mono">
                        {(summary?.totalRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>تحصيلات السنتر الإجمالية</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إيرادات الباقات</span>
                    <h3 className="text-2xl font-black text-blue-600 mt-2 font-mono">
                        {(summary?.packageRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-gray-500 font-medium">
                        اشتراكات الباقات الشاملة
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">إيرادات البرايفت</span>
                    <h3 className="text-2xl font-black text-purple-600 mt-2 font-mono">
                        {(summary?.privateRevenue || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-gray-500 font-medium">
                        حصص المدرسين الخاصة
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-xs font-bold text-gray-400">المبالغ المتبقية (الديون)</span>
                    <h3 className="text-2xl font-black text-rose-600 mt-2 font-mono">
                        {(summary?.totalDebt || 0).toLocaleString()} ج.م
                    </h3>
                    <div className="mt-2 text-xs text-rose-600 font-bold">
                        مستحقات لم تُسدد بعد
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
                <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                    <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
                        <TabsTrigger
                            value="daily"
                            className="rounded-lg font-bold text-xs py-2.5 px-4 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm gap-2"
                        >
                            <CalendarDays className="h-4 w-4" />
                            الجرد اليومي (تقفيل الخزينة)
                        </TabsTrigger>

                        <TabsTrigger
                            value="monthly"
                            className="rounded-lg font-bold text-xs py-2.5 px-4 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            الجرد الشهري (التقفيل المالي)
                        </TabsTrigger>

                        <TabsTrigger
                            value="transactions"
                            className="rounded-lg font-bold text-xs py-2.5 px-4 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm gap-2"
                        >
                            <History className="h-4 w-4" />
                            سجل كافة المعاملات
                        </TabsTrigger>

                        <TabsTrigger
                            value="teachers"
                            className="rounded-lg font-bold text-xs py-2.5 px-4 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm gap-2"
                        >
                            <GraduationCap className="h-4 w-4" />
                            كشف حساب المدرسين
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ══════════════════════════════════════════════════════════════════
                    TAB 1: الجرد اليومي (Daily Tally & Cash Drawer)
                ══════════════════════════════════════════════════════════════════ */}
                <TabsContent value="daily" className="space-y-6 mt-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm space-y-6">
                        {/* Daily Controls Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5 text-emerald-600" />
                                    جرد الخزينة اليومي — تقفيل الوردية
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    متابعة المقبوضات النقدية اللحظية بالخزينة لليوم المحدد وطباعة كشف التقفيل.
                                </p>
                            </div>

                            {/* Date Quick Controls & Print Button */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setDailyDate(todayStr)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            dailyDate === todayStr ? 'bg-white shadow-sm text-primary font-black' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        اليوم
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const y = new Date();
                                            y.setDate(y.getDate() - 1);
                                            setDailyDate(y.toISOString().split('T')[0]);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            dailyDate !== todayStr ? 'bg-white shadow-sm text-primary font-black' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        أمس
                                    </button>
                                    <input
                                        type="date"
                                        value={dailyDate}
                                        onChange={(e) => setDailyDate(e.target.value)}
                                        className="h-8 px-2 bg-transparent text-xs font-mono font-bold text-gray-700 outline-none border-r border-gray-200"
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refetchDaily()}
                                    className="rounded-xl h-9 text-xs"
                                    title="تحديث البيانات"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                    onClick={handlePrintDailyTally}
                                    disabled={!dailyTally || dailyTally.transactionCount === 0}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9"
                                >
                                    <Printer className="h-4 w-4" />
                                    طباعة كشف جرد الخزينة اليومي
                                </Button>
                            </div>
                        </div>

                        {/* Daily KPI Badges */}
                        {loadingDaily ? (
                            <div className="py-12 text-center text-gray-400">
                                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2 text-primary" />
                                جاري تحميل تقرير جرد الخزينة اليومي...
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
                                        <span className="text-[11px] font-bold text-emerald-800 block">نقدية الخزينة المحصلة اليوم</span>
                                        <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                                            {(dailyTally?.totalPaid || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-emerald-600 mt-0.5 block">
                                            {dailyTally?.transactionCount || 0} عملية سداد
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
                                        <span className="text-[11px] font-bold text-blue-800 block">إيرادات الباقات اليوم</span>
                                        <div className="text-xl font-black text-blue-700 font-mono mt-1">
                                            {(dailyTally?.packageRevenue || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-blue-600 mt-0.5 block">اشتراكات باقات</span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100">
                                        <span className="text-[11px] font-bold text-purple-800 block">إيرادات البرايفت اليوم</span>
                                        <div className="text-xl font-black text-purple-700 font-mono mt-1">
                                            {(dailyTally?.privateRevenue || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-purple-600 mt-0.5 block">حصص مجموعات المدرسين</span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
                                        <span className="text-[11px] font-bold text-rose-800 block">مستحقات آجلة مسجلة اليوم</span>
                                        <div className="text-xl font-black text-rose-700 font-mono mt-1">
                                            {(dailyTally?.totalDebt || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-rose-600 mt-0.5 block">متبقيات ديون الطلاب</span>
                                    </div>
                                </div>

                                {/* Daily Transactions Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                            <span>حركات وسجلات الخزينة اليومية</span>
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                {dailyTally?.transactions?.length || 0} حركة
                                            </Badge>
                                        </h3>
                                    </div>

                                    {dailyTally?.transactions?.length === 0 ? (
                                        <div className="p-12 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                            <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-gray-600">لا توجد حركات نقدية مسجلة في هذا اليوم حتى الآن</p>
                                            <p className="text-[11px] text-gray-400 mt-1">يمكنك تسجيل دفعة نقدية جديدة من الزر أعلاه</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                                            <table className="w-full text-right text-xs">
                                                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                                    <tr>
                                                        <th className="py-3 px-3 text-center">#</th>
                                                        <th className="py-3 px-3">الوقت</th>
                                                        <th className="py-3 px-3">الطالب</th>
                                                        <th className="py-3 px-3">نوع الاشتراك</th>
                                                        <th className="py-3 px-3">البيان / المدرس</th>
                                                        <th className="py-3 px-3 text-center">المطلوب</th>
                                                        <th className="py-3 px-3 text-center">الخصم</th>
                                                        <th className="py-3 px-3 text-center">المدفوع نقداً</th>
                                                        <th className="py-3 px-3 text-center">المتبقي</th>
                                                        <th className="py-3 px-3">المسؤول</th>
                                                        <th className="py-3 px-3 text-center">إيصال</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {dailyTally?.transactions?.map((tx, idx) => (
                                                        <tr key={tx._id} className="hover:bg-gray-50/60 transition-colors">
                                                            <td className="py-3 px-3 text-center font-mono text-gray-400 font-bold">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="py-3 px-3 font-mono text-[11px] text-gray-500">
                                                                {new Date(tx.date || tx.createdAt || '').toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <div className="font-bold text-gray-900">{tx.studentName || 'طالب'}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                                    {tx.studentCode && <span>كود: {tx.studentCode}</span>}
                                                                    {tx.gradeLevel && <span>• {tx.gradeLevel}</span>}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        tx.category === 'CENTER_PACKAGE'
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                            : tx.category === 'CENTER_PRIVATE'
                                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    }
                                                                >
                                                                    {tx.category === 'CENTER_PACKAGE' ? 'باقة سنتر' : tx.category === 'CENTER_PRIVATE' ? 'برايفت' : 'شامل مجمع'}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-3 px-3 text-gray-600 font-medium">
                                                                {tx.description || (tx.centerTeacherId ? `مدرس: ${tx.centerTeacherId.name}` : '—')}
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                                                                {tx.originalAmount} ج.م
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">
                                                                {tx.discountAmount > 0 ? `-${tx.discountAmount} ج.م` : '—'}
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/40">
                                                                {tx.paidAmount} ج.م
                                                            </td>
                                                            <td className="py-3 px-3 text-center font-mono font-bold">
                                                                {tx.remainingAmount > 0 ? (
                                                                    <span className="text-rose-600">{tx.remainingAmount} ج.م</span>
                                                                ) : (
                                                                    <span className="text-gray-400">0</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-gray-500 text-[11px]">
                                                                {tx.createdBy?.name || 'السيستم'}
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => printReceipt(centerName, tx)}
                                                                    className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg gap-1"
                                                                    title="طباعة إيصال السداد"
                                                                >
                                                                    <Printer className="h-3.5 w-3.5" />
                                                                    <span>إيصال</span>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════════════
                    TAB 2: الجرد الشهري (Monthly Tally & Audit)
                ══════════════════════════════════════════════════════════════════ */}
                <TabsContent value="monthly" className="space-y-6 mt-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm space-y-6">
                        {/* Monthly Controls Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    الجرد والتقفيل المالي الشهري للسنتر
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    تجميع إيرادات الشهر، كشف حركة التحصيل اليومية، وتفصيل المقبوضات الشهرية.
                                </p>
                            </div>

                            {/* Month & Year Selectors + Print */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="h-8 px-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-800"
                                    >
                                        {MONTHS_AR.map((m, idx) => (
                                            <option key={idx + 1} value={idx + 1}>
                                                شهر {m} ({idx + 1})
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="h-8 px-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-800"
                                    >
                                        {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refetchMonthly()}
                                    className="rounded-xl h-9 text-xs"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                    onClick={handlePrintMonthlyTally}
                                    disabled={!monthlyTally || monthlyTally.transactionCount === 0}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5 h-9"
                                >
                                    <Printer className="h-4 w-4" />
                                    طباعة تقرير الجرد الشهري المعتمد
                                </Button>
                            </div>
                        </div>

                        {loadingMonthly ? (
                            <div className="py-12 text-center text-gray-400">
                                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2 text-primary" />
                                جاري استخراج تقرير الجرد الشهري...
                            </div>
                        ) : (
                            <>
                                {/* Monthly Summary Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
                                        <span className="text-[11px] font-bold text-blue-800 block">إجمالي محصل الشهر</span>
                                        <div className="text-xl font-black text-blue-700 font-mono mt-1">
                                            {(monthlyTally?.totalPaid || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-blue-600 mt-0.5 block">
                                            {monthlyTally?.transactionCount || 0} معاملة في {MONTHS_AR[selectedMonth - 1]}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
                                        <span className="text-[11px] font-bold text-emerald-800 block">إجمالي باقات الشهر</span>
                                        <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                                            {(monthlyTally?.packageRevenue || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-emerald-600 mt-0.5 block">إيرادات باقات السنتر</span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100">
                                        <span className="text-[11px] font-bold text-purple-800 block">إجمالي برايفت الشهر</span>
                                        <div className="text-xl font-black text-purple-700 font-mono mt-1">
                                            {(monthlyTally?.privateRevenue || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-purple-600 mt-0.5 block">حصص المدرسين البرايفت</span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
                                        <span className="text-[11px] font-bold text-rose-800 block">مستحقات آجلة لشهر {selectedMonth}</span>
                                        <div className="text-xl font-black text-rose-700 font-mono mt-1">
                                            {(monthlyTally?.totalDebt || 0).toLocaleString()} ج.م
                                        </div>
                                        <span className="text-[10px] text-rose-600 mt-0.5 block">ديون غير مسددة</span>
                                    </div>
                                </div>

                                {/* Daily Breakdown of the Month */}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-blue-600" />
                                        <span>حركة التحصيل اليومية خلال شهر {MONTHS_AR[selectedMonth - 1]} {selectedYear}</span>
                                    </h3>

                                    {monthlyTally?.dailyBreakdown?.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-xs">
                                            لا توجد معاملات مسجلة في هذا الشهر
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                                            <table className="w-full text-right text-xs">
                                                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                                    <tr>
                                                        <th className="py-2.5 px-3">اليوم</th>
                                                        <th className="py-2.5 px-3 text-center">عدد العمليات</th>
                                                        <th className="py-2.5 px-3 text-center">إيراد الباقات</th>
                                                        <th className="py-2.5 px-3 text-center">إيراد البرايفت</th>
                                                        <th className="py-2.5 px-3 text-center">إيراد المجمع</th>
                                                        <th className="py-2.5 px-3 text-center">المحصل لليوم</th>
                                                        <th className="py-2.5 px-3 text-center">المتبقيات (الديون)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {monthlyTally?.dailyBreakdown?.map((d) => (
                                                        <tr key={d.day} className="hover:bg-gray-50/60">
                                                            <td className="py-2.5 px-3 font-bold text-gray-900">
                                                                يوم {d.day} {MONTHS_AR[selectedMonth - 1]}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-700">
                                                                {d.count}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-blue-600 font-bold">
                                                                {d.packageRevenue.toLocaleString()} ج.م
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-purple-600 font-bold">
                                                                {d.privateRevenue.toLocaleString()} ج.م
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-amber-600 font-bold">
                                                                {(d.combinedRevenue || 0).toLocaleString()} ج.م
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">
                                                                {d.totalPaid.toLocaleString()} ج.م
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">
                                                                {d.totalDebt.toLocaleString()} ج.م
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════════════
                    TAB 3: سجل كافة المعاملات (Full Transactions Ledger)
                ══════════════════════════════════════════════════════════════════ */}
                <TabsContent value="transactions" className="space-y-6 mt-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm space-y-5">
                        {/* Filters Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" />
                                    سجل المعاملات والمدفوعات الشامل
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    البحث والفلترة في كل مدفوعات السنتر مع إمكانية إعادة طباعة أي إيصال.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="relative w-full sm:w-56">
                                    <Search className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        value={txSearch}
                                        onChange={(e) => {
                                            setTxSearch(e.target.value);
                                            setTxPage(1);
                                        }}
                                        placeholder="بحث باسم الطالب أو البيان..."
                                        className="h-9 pr-9 text-xs rounded-xl"
                                    />
                                </div>

                                <select
                                    value={txCategory}
                                    onChange={(e) => {
                                        setTxCategory(e.target.value);
                                        setTxPage(1);
                                    }}
                                    className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700"
                                >
                                    <option value="">كل أنواع المعاملات</option>
                                    <option value="CENTER_PACKAGE">اشتراكات باقة</option>
                                    <option value="CENTER_PRIVATE">اشتراكات برايفت</option>
                                    <option value="CENTER_COMBINED">اشتراكات مجمعة</option>
                                </select>

                                <select
                                    value={txTeacherId}
                                    onChange={(e) => {
                                        setTxTeacherId(e.target.value);
                                        setTxPage(1);
                                    }}
                                    className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700"
                                >
                                    <option value="">كل المدرسين</option>
                                    {teachers.map((t) => (
                                        <option key={t._id} value={t._id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Transactions Table */}
                        {loadingTx ? (
                            <div className="py-12 text-center text-gray-400">
                                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2 text-primary" />
                                جاري تحميل سجل المعاملات...
                            </div>
                        ) : txData?.transactions?.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-xs">
                                لا توجد معاملات مطابقة للبحث المحدد
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="overflow-x-auto rounded-xl border border-gray-100">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                            <tr>
                                                <th className="py-3 px-3">التاريخ والوقت</th>
                                                <th className="py-3 px-3">الطالب</th>
                                                <th className="py-3 px-3">النوع</th>
                                                <th className="py-3 px-3">البيان</th>
                                                <th className="py-3 px-3 text-center">المطلوب</th>
                                                <th className="py-3 px-3 text-center">الخصم</th>
                                                <th className="py-3 px-3 text-center">المدفوع</th>
                                                <th className="py-3 px-3 text-center">المتبقي</th>
                                                <th className="py-3 px-3">المسؤول</th>
                                                <th className="py-3 px-3 text-center">إيصال</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {txData?.transactions?.map((tx: any) => (
                                                <tr key={tx._id} className="hover:bg-gray-50/60">
                                                    <td className="py-3 px-3 font-mono text-[11px] text-gray-500">
                                                        <div>{new Date(tx.date || tx.createdAt).toLocaleDateString('ar-EG')}</div>
                                                        <div className="text-[10px] text-gray-400">{new Date(tx.date || tx.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="font-bold text-gray-900">{tx.studentName || 'طالب'}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                            {tx.studentCode && <span>كود: {tx.studentCode}</span>}
                                                            {tx.gradeLevel && <span> • {tx.gradeLevel}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                tx.category === 'CENTER_PACKAGE'
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : tx.category === 'CENTER_PRIVATE'
                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }
                                                        >
                                                            {tx.category === 'CENTER_PACKAGE' ? 'باقة سنتر' : tx.category === 'CENTER_PRIVATE' ? 'برايفت' : 'شامل مجمع'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-600 font-medium max-w-xs truncate">
                                                        {tx.description || (tx.centerTeacherId ? `مدرس: ${tx.centerTeacherId.name}` : '—')}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                                                        {tx.originalAmount} ج.م
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">
                                                        {tx.discountAmount > 0 ? `-${tx.discountAmount} ج.م` : '—'}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 bg-emerald-50/40">
                                                        {tx.paidAmount} ج.م
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono font-bold">
                                                        {tx.remainingAmount > 0 ? (
                                                            <span className="text-rose-600">{tx.remainingAmount} ج.م</span>
                                                        ) : (
                                                            <span className="text-gray-400">0</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-500 text-[11px]">
                                                        {tx.createdBy?.name || 'السيستم'}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => printReceipt(centerName, tx)}
                                                            className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg gap-1"
                                                        >
                                                            <Printer className="h-3.5 w-3.5" />
                                                            <span>طباعة</span>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {Boolean(txData && txData.totalPages > 1) && (
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs text-gray-500">
                                            صفحة {txPage} من {txData?.totalPages || 1} (إجمالي {txData?.total || 0} معاملة)
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={txPage <= 1}
                                                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                                                className="h-8 px-2.5 text-xs rounded-lg"
                                            >
                                                السابق
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={txPage >= (txData?.totalPages || 1)}
                                                onClick={() => setTxPage(p => p + 1)}
                                                className="h-8 px-2.5 text-xs rounded-lg"
                                            >
                                                التالي
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════════════════════════════════
                    TAB 4: كشف حساب المدرسين (Teacher Accounts)
                ══════════════════════════════════════════════════════════════════ */}
                <TabsContent value="teachers" className="space-y-6 mt-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
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
                                        <span className="text-xl font-black text-emerald-600 font-mono">
                                            {(teacherReport?.totalPaid || 0).toLocaleString()} ج.م
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold block">المتبقي على طلابه</span>
                                        <span className="text-xl font-black text-rose-600 font-mono">
                                            {(teacherReport?.totalRemaining || 0).toLocaleString()} ج.م
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold block">عدد المعاملات</span>
                                        <span className="text-xl font-black text-gray-800 font-mono">
                                            {teacherReport?.transactionCount || 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Transactions Table */}
                                {teacherReport?.transactions?.length === 0 ? (
                                    <p className="text-center text-xs text-gray-400 py-6">لا توجد معاملات مسجلة لهذا المدرس حتى الآن</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                                        <table className="w-full text-right text-xs">
                                            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-400 font-bold">
                                                <tr>
                                                    <th className="py-3 px-4">الطالب</th>
                                                    <th className="py-3 px-4">المبلغ الأصلي</th>
                                                    <th className="py-3 px-4">المدفوع</th>
                                                    <th className="py-3 px-4">المتبقي</th>
                                                    <th className="py-3 px-4">التاريخ</th>
                                                    <th className="py-3 px-4 text-center">إيصال</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {teacherReport?.transactions?.map((tx: any) => (
                                                    <tr key={tx._id} className="hover:bg-gray-50/50">
                                                        <td className="py-3 px-4 font-bold text-gray-900">
                                                            {tx.studentName || 'طالب'}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-gray-600 font-mono">
                                                            {tx.originalAmount} ج.م
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-emerald-600 font-mono">
                                                            {tx.paidAmount} ج.م
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-rose-600 font-mono">
                                                            {tx.remainingAmount} ج.م
                                                        </td>
                                                        <td className="py-3 px-4 text-gray-400 font-medium">
                                                            {new Date(tx.date).toLocaleDateString('ar-EG')}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => printReceipt(centerName, tx)}
                                                                className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg gap-1"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                                <span>إيصال</span>
                                                            </Button>
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
                </TabsContent>
            </Tabs>

            {/* ══════════════════════════════════════════════════════════════════
                Record Payment Dialog
            ══════════════════════════════════════════════════════════════════ */}
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
                                            {st.studentName} — كود: {st.studentCode} ({st.gradeLevel})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Active Enrollment Info Banner */}
                        {studentEnrollment ? (
                            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between font-bold text-blue-900">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                        اشتراك الطالب المسجل بالسنتر (تسعير آلي):
                                    </span>
                                    <Badge className="bg-blue-600 text-white text-[10px]">
                                        {studentEnrollment.type === 'PACKAGE' ? 'باقة سنتر' : studentEnrollment.type === 'PRIVATE' ? 'مجموعات خصوصي' : 'باقة + خصوصي'}
                                    </Badge>
                                </div>
                                <div className="text-[11px] text-blue-800 space-y-1 pt-1 border-t border-blue-200/60">
                                    {studentEnrollment.packageId && (
                                        <div className="flex items-center justify-between">
                                            <span>📦 الباقة: <strong>{studentEnrollment.packageId.name}</strong></span>
                                            <span className="font-bold font-mono">{studentEnrollment.packageMonthlyPrice || studentEnrollment.packageId.monthlyPrice} ج.م</span>
                                        </div>
                                    )}
                                    {studentEnrollment.privateTeachers && studentEnrollment.privateTeachers.length > 0 && (
                                        <div>
                                            <span>👨‍🏫 مجموعات البرايفت: </span>
                                            <span className="font-medium">
                                                {studentEnrollment.privateTeachers.map((pt: any) => `${pt.groupId?.name || 'مجموعة'} (${pt.monthlyPrice || 0} ج.م)`).join(' + ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : selectedStudentId ? (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                                ℹ️ الطالب غير مسجل في اشتراك رسمي بعد. اختر الباقة أو المجموعة بالأسفل ليتم وضع السعر تلقائياً.
                            </div>
                        ) : null}

                        {/* Category */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">نوع المعاملة *</label>
                            <select
                                value={category}
                                onChange={(e) => {
                                    const newCat = e.target.value as any;
                                    setCategory(newCat);
                                    if (newCat === 'CENTER_PACKAGE') {
                                        const p = packages.find(pkg => pkg._id === selectedManualPkgId) || (studentEnrollment?.packageId ? packages.find(pkg => pkg._id === (studentEnrollment.packageId as any)._id) : packages[0]);
                                        if (p) {
                                            setSelectedManualPkgId(p._id);
                                            setOriginalAmount(p.monthlyPrice.toString());
                                            const disc = Number(discountAmount) || 0;
                                            setPaidAmount(Math.max(0, p.monthlyPrice - disc).toString());
                                        }
                                    } else if (newCat === 'CENTER_PRIVATE') {
                                        const grp = groups.find(g => g._id === selectedManualGroupId) || groups.find(g => g.groupType === 'PRIVATE' || g.groupType === 'MIXED');
                                        if (grp) {
                                            setSelectedManualGroupId(grp._id);
                                            const tId = typeof grp.centerTeacherId === 'object' ? (grp.centerTeacherId as any)._id : grp.centerTeacherId;
                                            setCenterTeacherId(tId || '');
                                            setOriginalAmount((grp.privateMonthlyPrice || 0).toString());
                                            const disc = Number(discountAmount) || 0;
                                            setPaidAmount(Math.max(0, (grp.privateMonthlyPrice || 0) - disc).toString());
                                        }
                                    } else if (newCat === 'CENTER_COMBINED') {
                                        const p = packages.find(pkg => pkg._id === selectedManualPkgId) || packages[0];
                                        const grp = groups.find(g => g._id === selectedManualGroupId) || groups.find(g => g.groupType === 'PRIVATE' || g.groupType === 'MIXED');
                                        const total = (p?.monthlyPrice || 0) + (grp?.privateMonthlyPrice || 0);
                                        setOriginalAmount(total.toString());
                                        const disc = Number(discountAmount) || 0;
                                        setPaidAmount(Math.max(0, total - disc).toString());
                                    }
                                }}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                            >
                                <option value="CENTER_PACKAGE">اشتراك باقة سنتر (Package)</option>
                                <option value="CENTER_PRIVATE">اشتراك برايفت مدرس (Private)</option>
                                <option value="CENTER_COMBINED">اشتراك مجمع (Combined)</option>
                            </select>
                        </div>

                        {/* Package Selection Helper */}
                        {(category === 'CENTER_PACKAGE' || category === 'CENTER_COMBINED') && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    {category === 'CENTER_COMBINED' ? 'باقة السنتر المشمولة بالاشتراك المجمع *' : 'اختيار الباقة (لتحديد السعر تلقائياً) *'}
                                </label>
                                <select
                                    value={selectedManualPkgId}
                                    onChange={(e) => {
                                        const pId = e.target.value;
                                        setSelectedManualPkgId(pId);
                                        const p = packages.find(pkg => pkg._id === pId);
                                        const grp = groups.find(g => g._id === selectedManualGroupId);
                                        const pkgPrice = p?.monthlyPrice || 0;
                                        const grpPrice = category === 'CENTER_COMBINED' ? (grp?.privateMonthlyPrice || 0) : 0;
                                        const total = pkgPrice + grpPrice;
                                        setOriginalAmount(total.toString());
                                        const disc = Number(discountAmount) || 0;
                                        setPaidAmount(Math.max(0, total - disc).toString());
                                        if (p && category === 'CENTER_PACKAGE') {
                                            setDescription(`سداد اشتراك باقة: ${p.name}`);
                                        }
                                    }}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    <option value="" disabled>اختر الباقة</option>
                                    {packages.map((p) => (
                                        <option key={p._id} value={p._id}>
                                            {p.name} ({p.gradeLevel}) — {p.monthlyPrice} ج.م
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Private Group Selection Helper */}
                        {(category === 'CENTER_PRIVATE' || category === 'CENTER_COMBINED') && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    {category === 'CENTER_COMBINED' ? 'مجموعة البرايفت المشمولة بالاشتراك المجمع *' : 'اختيار مجموعة البرايفت (لتحديد السعر والمدرس تلقائياً) *'}
                                </label>
                                <select
                                    value={selectedManualGroupId}
                                    onChange={(e) => {
                                        const gId = e.target.value;
                                        setSelectedManualGroupId(gId);
                                        const grp = groups.find(g => g._id === gId);
                                        const p = packages.find(pkg => pkg._id === selectedManualPkgId);
                                        if (grp) {
                                            const teacherId = typeof grp.centerTeacherId === 'object' ? (grp.centerTeacherId as any)._id : grp.centerTeacherId;
                                            setCenterTeacherId(teacherId || '');
                                            const grpPrice = grp.privateMonthlyPrice || 0;
                                            const pkgPrice = category === 'CENTER_COMBINED' ? (p?.monthlyPrice || 0) : 0;
                                            const total = pkgPrice + grpPrice;
                                            setOriginalAmount(total.toString());
                                            const disc = Number(discountAmount) || 0;
                                            setPaidAmount(Math.max(0, total - disc).toString());
                                            if (category === 'CENTER_PRIVATE') {
                                                setDescription(`سداد اشتراك مجموعة: ${grp.name}`);
                                            }
                                        }
                                    }}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    required={category === 'CENTER_PRIVATE'}
                                >
                                    <option value="" disabled>اختر مجموعة البرايفت</option>
                                    {groups.filter(g => g.groupType === 'PRIVATE' || g.groupType === 'MIXED').map((g) => {
                                        const tName = typeof g.centerTeacherId === 'object' ? (g.centerTeacherId as any)?.name : teachers.find(t => t._id === g.centerTeacherId)?.name || 'مدرس';
                                        return (
                                            <option key={g._id} value={g._id}>
                                                {g.name} — {tName} ({g.privateMonthlyPrice || 0} ج.م)
                                            </option>
                                        );
                                    })}
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

                        {/* Live Calculation Summary Banner */}
                        {Number(originalAmount) > 0 && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between text-emerald-950 font-bold">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ملخص الحساب المطلوب:
                                    </span>
                                    <span className="font-mono text-sm font-black text-emerald-700">
                                        {originalAmount} ج.م
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-emerald-800">
                                    <span>المسدد نقداً بالخزينة:</span>
                                    <span className="font-mono font-bold">{paidAmount || 0} ج.م</span>
                                </div>
                                {Number(originalAmount) - Number(discountAmount || 0) - Number(paidAmount || 0) > 0 && (
                                    <div className="flex items-center justify-between text-[11px] text-red-600 font-bold pt-1 border-t border-emerald-200/60">
                                        <span>المتبقي دين / مستحق لاحقاً:</span>
                                        <span className="font-mono">
                                            {Math.max(0, Number(originalAmount) - Number(discountAmount || 0) - Number(paidAmount || 0))} ج.م
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={paymentMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {paymentMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                حفظ المعاملة وطباعة الإيصال
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

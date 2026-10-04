'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    fetchCenterReportsOverview,
    fetchCenterTeachersReport,
    fetchCenterGroupsReport,
    type CenterReportsOverview,
    type CenterTeacherReportItem,
    type CenterGroupReportItem,
} from '@/lib/api/centers';
import {
    Wallet,
    Users,
    GraduationCap,
    TrendingUp,
    Calendar,
    Printer,
    FileSpreadsheet,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Clock,
    Search,
    Filter,
    BarChart3,
    Layers,
    UserCheck,
    ChevronDown,
    Building2,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ActiveTab = 'financials' | 'teachers' | 'groups';

export default function CenterReportsPage() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('financials');

    // Date filters for Financials & Teachers
    const [dateRangePreset, setDateRangePreset] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(1); // 1st of current month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Preset handler
    const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
        setDateRangePreset(preset);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (preset === 'today') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (preset === 'week') {
            const lastWeek = new Date();
            lastWeek.setDate(today.getDate() - 7);
            setStartDate(lastWeek.toISOString().split('T')[0]);
            setEndDate(todayStr);
        } else if (preset === 'month') {
            const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(firstOfMonth.toISOString().split('T')[0]);
            setEndDate(todayStr);
        } else if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        }
    };

    // Filter states
    const [teacherSearch, setTeacherSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('ALL');
    const [selectedTeacherForModal, setSelectedTeacherForModal] = useState<CenterTeacherReportItem | null>(null);

    // Queries
    const {
        data: overview,
        isLoading: isOverviewLoading,
        refetch: refetchOverview,
    } = useQuery({
        queryKey: ['center-reports-overview', startDate, endDate],
        queryFn: () => fetchCenterReportsOverview(startDate || undefined, endDate || undefined),
    });

    const {
        data: teachersReport,
        isLoading: isTeachersLoading,
        refetch: refetchTeachers,
    } = useQuery({
        queryKey: ['center-reports-teachers', startDate, endDate],
        queryFn: () => fetchCenterTeachersReport(startDate || undefined, endDate || undefined),
    });

    const {
        data: groupsReport,
        isLoading: isGroupsLoading,
        refetch: refetchGroups,
    } = useQuery({
        queryKey: ['center-reports-groups'],
        queryFn: () => fetchCenterGroupsReport(),
    });

    // Print handler
    const handlePrint = () => {
        window.print();
    };

    // CSV Export handler
    const handleExportCsv = () => {
        try {
            let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
            if (activeTab === 'financials') {
                csvContent += 'البيان,القيمة\n';
                csvContent += `إجمالي الإيرادات,${overview?.revenue?.totalRevenue || 0}\n`;
                csvContent += `إيرادات الباكيدجات,${overview?.revenue?.packageRevenue || 0}\n`;
                csvContent += `إيرادات المجموعات الخاصة,${overview?.revenue?.privateRevenue || 0}\n`;
                csvContent += `إجمالي المديونيات المتبقية,${overview?.revenue?.totalDebt || 0}\n`;
                csvContent += `إجمالي الطلاب,${overview?.students?.total || 0}\n`;
                csvContent += `حضور البوابة اليوم,${overview?.todayCheckIns || 0}\n`;
            } else if (activeTab === 'teachers' && teachersReport) {
                csvContent += 'المعلم,المادة,الهاتف,عدد المجموعات,الطلاب المسجلين,الإيرادات,الحصص المنعقدة\n';
                teachersReport.forEach((t) => {
                    csvContent += `"${t.teacher.name}","${t.teacher.subject}","${t.teacher.phone}",${t.groupsCount},${t.enrolledStudentsCount},${t.revenue},${t.attendanceCount}\n`;
                });
            } else if (activeTab === 'groups' && groupsReport) {
                csvContent += 'المجموعة,المعلم,المادة,المرحلة,النوع,السعة,المسجلين,نسبة الامتلاء,الإيرادات,نسبة الحضور\n';
                groupsReport.forEach((g) => {
                    csvContent += `"${g.group.name}","${g.group.teacher}","${g.group.subject}","${g.group.gradeLevel}","${g.group.groupType}",${g.group.capacity || 0},${g.enrolledCount},"${g.fillRate || 0}%",${g.revenue},"${g.attendance.attendanceRate}%"\n`;
                });
            }

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `center-report-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('تم تصدير ملف الإكسل (CSV) بنجاح');
        } catch {
            toast.error('حدث خطأ أثناء تصدير التقرير');
        }
    };

    // Filtered Teachers
    const filteredTeachers = (teachersReport || []).filter((t) => {
        if (!teacherSearch) return true;
        const q = teacherSearch.toLowerCase();
        return t.teacher.name.toLowerCase().includes(q) || t.teacher.subject.toLowerCase().includes(q);
    });

    // Filtered Groups
    const filteredGroups = (groupsReport || []).filter((g) => {
        const matchesSearch =
            !groupSearch ||
            g.group.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
            g.group.teacher.toLowerCase().includes(groupSearch.toLowerCase()) ||
            g.group.subject.toLowerCase().includes(groupSearch.toLowerCase());

        const matchesGrade =
            selectedGrade === 'ALL' ||
            (selectedGrade === 'SEC' && /ثانوي|SEC/i.test(g.group.gradeLevel)) ||
            (selectedGrade === 'PREP' && /إعدادي|PREP/i.test(g.group.gradeLevel)) ||
            (selectedGrade === 'PRIM' && /ابتدائي|PRIM/i.test(g.group.gradeLevel));

        return matchesSearch && matchesGrade;
    });

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                        <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>منظومة تقارير السنتر الذكية</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                        التقارير الشاملة للسنتر
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        متابعة دقيقة للأداء المالي، إيرادات الحصص والباكيدجات، أداء المعلمين، وإحصائيات المجموعات
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        className="gap-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                        <Printer className="w-4 h-4" />
                        <span>طباعة التقرير</span>
                    </Button>

                    <Button
                        onClick={handleExportCsv}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>تصدير Excel (CSV)</span>
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-px">
                <button
                    onClick={() => setActiveTab('financials')}
                    className={cn(
                        'flex items-center gap-2.5 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap',
                        activeTab === 'financials'
                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    )}
                >
                    <Wallet className="w-4 h-4" />
                    <span>تقارير ماليات السنتر</span>
                    {overview?.revenue?.totalRevenue != null && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            {overview.revenue.totalRevenue.toLocaleString('en-US')} ج.م
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('teachers')}
                    className={cn(
                        'flex items-center gap-2.5 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap',
                        activeTab === 'teachers'
                            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    )}
                >
                    <GraduationCap className="w-4 h-4" />
                    <span>تقارير أداء المدرسين</span>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                        {teachersReport?.length || 0}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('groups')}
                    className={cn(
                        'flex items-center gap-2.5 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap',
                        activeTab === 'groups'
                            ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    )}
                >
                    <Layers className="w-4 h-4" />
                    <span>تقارير المجموعات والحضور</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                        {groupsReport?.length || 0}
                    </span>
                </button>
            </div>

            {/* TAB 1: FINANCIALS */}
            {activeTab === 'financials' && (
                <div className="space-y-6">
                    {/* Date Filters Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                            <span className="text-xs font-bold text-gray-500 ml-1">الفترة الزمنية:</span>
                            <Button
                                size="sm"
                                variant={dateRangePreset === 'today' ? 'default' : 'outline'}
                                onClick={() => applyDatePreset('today')}
                                className={cn('h-8 text-xs', dateRangePreset === 'today' && 'bg-emerald-600 hover:bg-emerald-700')}
                            >
                                اليوم
                            </Button>
                            <Button
                                size="sm"
                                variant={dateRangePreset === 'week' ? 'default' : 'outline'}
                                onClick={() => applyDatePreset('week')}
                                className={cn('h-8 text-xs', dateRangePreset === 'week' && 'bg-emerald-600 hover:bg-emerald-700')}
                            >
                                آخر 7 أيام
                            </Button>
                            <Button
                                size="sm"
                                variant={dateRangePreset === 'month' ? 'default' : 'outline'}
                                onClick={() => applyDatePreset('month')}
                                className={cn('h-8 text-xs', dateRangePreset === 'month' && 'bg-emerald-600 hover:bg-emerald-700')}
                            >
                                هذا الشهر
                            </Button>
                            <Button
                                size="sm"
                                variant={dateRangePreset === 'all' ? 'default' : 'outline'}
                                onClick={() => applyDatePreset('all')}
                                className={cn('h-8 text-xs', dateRangePreset === 'all' && 'bg-emerald-600 hover:bg-emerald-700')}
                            >
                                كل الفترات
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500 whitespace-nowrap">من:</span>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setDateRangePreset('custom');
                                    }}
                                    className="h-8 text-xs w-36"
                                />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500 whitespace-nowrap">إلى:</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setDateRangePreset('custom');
                                    }}
                                    className="h-8 text-xs w-36"
                                />
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Revenue */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md shadow-emerald-500/10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 -ml-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                            <div className="flex items-center justify-between">
                                <span className="text-emerald-100 text-xs font-semibold">إجمالي إيرادات السنتر</span>
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-3xl font-black tracking-tight">
                                    {isOverviewLoading ? '...' : (overview?.revenue?.totalRevenue || 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-xs text-emerald-200 mr-1.5 font-bold">ج.م</span>
                            </div>
                            <div className="mt-2 text-xs text-emerald-100/90 flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>التحصيلات الفعلية المؤكدة في الخزينة</span>
                            </div>
                        </div>

                        {/* Package Revenue */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-xs font-semibold">إيرادات الباكيدجات</span>
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-2xl font-black text-gray-900 tracking-tight">
                                    {isOverviewLoading ? '...' : (overview?.revenue?.packageRevenue || 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-xs text-gray-500 mr-1.5">ج.م</span>
                            </div>
                            <div className="mt-2 text-xs text-blue-600 font-medium">
                                اشتراكات الباقات المجمعة
                            </div>
                        </div>

                        {/* Private Revenue */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-xs font-semibold">إيرادات الحصص الخاصة</span>
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-2xl font-black text-gray-900 tracking-tight">
                                    {isOverviewLoading ? '...' : (overview?.revenue?.privateRevenue || 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-xs text-gray-500 mr-1.5">ج.م</span>
                            </div>
                            <div className="mt-2 text-xs text-purple-600 font-medium">
                                مجموعات المعلمين المنفردة
                            </div>
                        </div>

                        {/* Total Debt */}
                        <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-red-600 text-xs font-semibold">المديونيات المتبقية على الطلاب</span>
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-3">
                                <span className="text-2xl font-black text-red-600 tracking-tight">
                                    {isOverviewLoading ? '...' : (overview?.revenue?.totalDebt || 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-xs text-gray-500 mr-1.5">ج.م</span>
                            </div>
                            <div className="mt-2 text-xs text-red-500 font-medium">
                                مستحقات غير مسددة بالكامل
                            </div>
                        </div>
                    </div>

                    {/* Secondary Metrics: Students & Gate Attendance */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                    <UserCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">حضور البوابة اليوم</p>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                                        {overview?.todayCheckIns || 0} طالب
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-2">
                                إجمالي تسجيلات الدخول عند بوابة السنتر اليوم
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">إجمالي طلاب السنتر</p>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                                        {overview?.students?.total || 0} طالب
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-2">
                                الطلاب النشطون: {overview?.students?.active || 0} طالب
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500 font-bold mb-2">توزيع المراحل الدراسية</p>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>المرحلة الثانوية:</span>
                                    <span className="font-bold text-gray-900">{overview?.students?.secondary || 0} طالب</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>المرحلة الإعدادية:</span>
                                    <span className="font-bold text-gray-900">{overview?.students?.preparatory || 0} طالب</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>المرحلة الابتدائية:</span>
                                    <span className="font-bold text-gray-900">{overview?.students?.primary || 0} طالب</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">سجل أحدث المعاملات المالية</h3>
                                <p className="text-xs text-gray-500 mt-0.5">عرض أحدث 50 حركة سداد وتحصيل مالية تمت بالسنتر</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50/80 text-gray-600 text-xs font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="py-3 px-4">الطالب</th>
                                        <th className="py-3 px-4">نوع المعاملة والوصف</th>
                                        <th className="py-3 px-4">المعلم المستفيد</th>
                                        <th className="py-3 px-4">المبلغ المدفوع</th>
                                        <th className="py-3 px-4">طريقة الدفع</th>
                                        <th className="py-3 px-4">التاريخ والوقت</th>
                                        <th className="py-3 px-4">المسؤول</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {isOverviewLoading ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400">
                                                جاري تحميل المعاملات المالية...
                                            </td>
                                        </tr>
                                    ) : !overview?.recentTransactions || overview.recentTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400">
                                                لا توجد معاملات مالية مسجلة في هذه الفترة
                                            </td>
                                        </tr>
                                    ) : (
                                        overview.recentTransactions.map((tx: any) => (
                                            <tr key={tx._id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-gray-900">
                                                    {tx.centerStudentId?.name || tx.studentId?.studentName || 'طالب غير محدد'}
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium ml-1">
                                                        {tx.category === 'CENTER_PACKAGE' ? 'باكيدج' : tx.category === 'CENTER_PRIVATE' ? 'مجموعة خاصة' : 'حساب عام'}
                                                    </span>
                                                    {tx.description}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-gray-600">
                                                    {tx.centerTeacherId?.name || 'السنتر مباشرة'}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-emerald-600">
                                                    +{tx.paidAmount?.toLocaleString('en-US') || 0} ج.م
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <Badge variant="outline" className="text-[11px] font-normal">
                                                        {tx.paymentMethod === 'CASH' ? 'نقدي (كاش)' : tx.paymentMethod === 'VODAFONE_CASH' ? 'فودافون كاش' : 'إلكتروني'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-xs text-gray-500">
                                                    {new Date(tx.createdAt || tx.date).toLocaleString('en-GB')}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-gray-500">
                                                    {tx.createdBy?.name || 'النظام'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: TEACHERS REPORT */}
            {activeTab === 'teachers' && (
                <div className="space-y-6">
                    {/* Controls & Search */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-80">
                            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <Input
                                placeholder="بحث باسم المعلم أو المادة..."
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                className="pr-9 h-10 text-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>إجمالي المدرسين بالسنتر:</span>
                            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                                {teachersReport?.length || 0} معلماً
                            </span>
                        </div>
                    </div>

                    {/* Teachers Cards / Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {isTeachersLoading ? (
                            <div className="col-span-full py-16 text-center text-gray-400">
                                جاري تحميل تقارير المدرسين...
                            </div>
                        ) : filteredTeachers.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-gray-400">
                                لا توجد بيانات للمدرسين مطابقة للبحث
                            </div>
                        ) : (
                            filteredTeachers.map((t) => (
                                <div
                                    key={t.teacher._id}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
                                >
                                    <div className="p-5 border-b border-gray-50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-lg">
                                                    {t.teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base">{t.teacher.name}</h3>
                                                    <p className="text-xs text-indigo-600 font-semibold">{t.teacher.subject}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">{t.teacher.phone}</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-200">
                                                عمولة {t.teacher.commissionRate || 0}%
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="p-4 grid grid-cols-2 gap-3 bg-gray-50/50">
                                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                                            <p className="text-[11px] text-gray-400">عدد المجموعات</p>
                                            <p className="text-base font-bold text-gray-800 mt-0.5">{t.groupsCount}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                                            <p className="text-[11px] text-gray-400">الطلاب المسجلين</p>
                                            <p className="text-base font-bold text-gray-800 mt-0.5">{t.enrolledStudentsCount} طالب</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                                            <p className="text-[11px] text-gray-400">إجمالي الإيرادات</p>
                                            <p className="text-base font-black text-emerald-600 mt-0.5">
                                                {t.revenue.toLocaleString('en-US')} ج.م
                                            </p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                                            <p className="text-[11px] text-gray-400">الحصص المسجلة</p>
                                            <p className="text-base font-bold text-gray-800 mt-0.5">{t.attendanceCount} سجل</p>
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                                        <div className="text-xs text-gray-500">
                                            مستحقات المعلم التقديرية:{' '}
                                            <span className="font-bold text-gray-900">
                                                {Math.round((t.revenue * (t.teacher.commissionRate || 0)) / 100).toLocaleString('en-US')} ج.م
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setSelectedTeacherForModal(t)}
                                            className="text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                        >
                                            كشف الحساب
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: GROUPS REPORT */}
            {activeTab === 'groups' && (
                <div className="space-y-6">
                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <Input
                                    placeholder="بحث بالمجموعة أو المعلم أو المادة..."
                                    value={groupSearch}
                                    onChange={(e) => setGroupSearch(e.target.value)}
                                    className="pr-9 h-10 text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                    size="sm"
                                    variant={selectedGrade === 'ALL' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGrade('ALL')}
                                    className="h-8 text-xs"
                                >
                                    الكل
                                </Button>
                                <Button
                                    size="sm"
                                    variant={selectedGrade === 'SEC' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGrade('SEC')}
                                    className="h-8 text-xs"
                                >
                                    ثانوي
                                </Button>
                                <Button
                                    size="sm"
                                    variant={selectedGrade === 'PREP' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGrade('PREP')}
                                    className="h-8 text-xs"
                                >
                                    إعدادي
                                </Button>
                                <Button
                                    size="sm"
                                    variant={selectedGrade === 'PRIM' ? 'default' : 'outline'}
                                    onClick={() => setSelectedGrade('PRIM')}
                                    className="h-8 text-xs"
                                >
                                    ابتدائي
                                </Button>
                            </div>
                        </div>

                        <div className="text-xs text-gray-500">
                            عدد المجموعات المطابقة:{' '}
                            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                                {filteredGroups.length}
                            </span>
                        </div>
                    </div>

                    {/* Groups Table / Cards */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 text-gray-600 text-xs font-bold border-b border-gray-100">
                                    <tr>
                                        <th className="py-3 px-4">اسم المجموعة</th>
                                        <th className="py-3 px-4">المعلم والمادة</th>
                                        <th className="py-3 px-4">المرحلة والنوع</th>
                                        <th className="py-3 px-4">الطلاب والامتلاء</th>
                                        <th className="py-3 px-4">سعر الحصة/الشهر</th>
                                        <th className="py-3 px-4">نسبة الحضور</th>
                                        <th className="py-3 px-4">إجمالي الإيرادات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {isGroupsLoading ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400">
                                                جاري تحميل تقارير المجموعات...
                                            </td>
                                        </tr>
                                    ) : filteredGroups.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400">
                                                لا توجد مجموعات مطابقة لمعايير البحث
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredGroups.map((g) => {
                                            const fillPct = g.fillRate ?? 0;
                                            return (
                                                <tr key={g.group._id} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-gray-900">
                                                        {g.group.name}
                                                    </td>
                                                    <td className="py-3 px-4 text-xs">
                                                        <div className="font-semibold text-gray-900">{g.group.teacher}</div>
                                                        <div className="text-gray-400">{g.group.subject}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-xs">
                                                        <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 ml-1 font-medium">
                                                            {g.group.gradeLevel}
                                                        </span>
                                                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                                                            {g.group.groupType === 'PACKAGE' ? 'باكيدج' : g.group.groupType === 'PRIVATE' ? 'خاصة' : 'مشتركة'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-xs">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-bold text-gray-900">{g.enrolledCount} طالب</span>
                                                            <span className="text-gray-400">من {g.group.capacity || 50}</span>
                                                        </div>
                                                        <div className="w-28 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    'h-full rounded-full transition-all',
                                                                    fillPct >= 90
                                                                        ? 'bg-red-500'
                                                                        : fillPct >= 60
                                                                        ? 'bg-emerald-500'
                                                                        : 'bg-blue-500'
                                                                )}
                                                                style={{ width: `${Math.min(fillPct, 100)}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-xs font-semibold text-gray-800">
                                                        {g.group.privateMonthlyPrice ? `${g.group.privateMonthlyPrice} ج.م` : 'مشمول بالباكيدج'}
                                                    </td>
                                                    <td className="py-3 px-4 text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-gray-900">
                                                                {g.attendance.attendanceRate}%
                                                            </span>
                                                            <span className="text-gray-400 text-[11px]">
                                                                ({g.attendance.present} حاضر / {g.attendance.absent} غائب)
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-black text-emerald-600">
                                                        {g.revenue.toLocaleString('en-US')} ج.م
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Drilldown Modal: Teacher Account Details */}
            <Dialog open={!!selectedTeacherForModal} onOpenChange={() => setSelectedTeacherForModal(null)}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-indigo-600" />
                            <span>كشف حساب المعلم: {selectedTeacherForModal?.teacher.name}</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTeacherForModal && (
                        <div className="space-y-4 pt-2">
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-indigo-700 font-semibold">{selectedTeacherForModal.teacher.subject}</p>
                                    <p className="text-sm font-bold text-gray-900">{selectedTeacherForModal.teacher.phone}</p>
                                </div>
                                <Badge className="bg-indigo-600 text-white">
                                    نسبة العمولة: {selectedTeacherForModal.teacher.commissionRate}%
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400">إجمالي إيرادات المجموعات:</span>
                                    <p className="text-base font-bold text-emerald-600 mt-1">
                                        {selectedTeacherForModal.revenue.toLocaleString('en-US')} ج.م
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400">صافي مستحقات المعلم:</span>
                                    <p className="text-base font-bold text-indigo-600 mt-1">
                                        {Math.round(
                                            (selectedTeacherForModal.revenue * (selectedTeacherForModal.teacher.commissionRate || 0)) / 100
                                        ).toLocaleString('en-US')}{' '}
                                        ج.م
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400">صافي حصة السنتر:</span>
                                    <p className="text-base font-bold text-gray-900 mt-1">
                                        {Math.round(
                                            selectedTeacherForModal.revenue * (1 - (selectedTeacherForModal.teacher.commissionRate || 0) / 100)
                                        ).toLocaleString('en-US')}{' '}
                                        ج.م
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-gray-400">الطلاب المقيدون:</span>
                                    <p className="text-base font-bold text-gray-900 mt-1">
                                        {selectedTeacherForModal.enrolledStudentsCount} طالب
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedTeacherForModal(null)}
                                    className="text-xs"
                                >
                                    إغلاق
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

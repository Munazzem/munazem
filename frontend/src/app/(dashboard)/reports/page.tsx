'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileText,
    Users,
    GraduationCap,
    Wallet,
    CalendarCheck,
    Download,
    FileDown,
    Loader2,
    TrendingUp,
    TrendingDown,
    Search,
    BookOpen,
    CreditCard,
} from 'lucide-react';
import { ReportCardSkeleton } from '@/components/layout/skeletons/ReportCardSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { fetchStudents } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import {
    fetchStudentReport,
    fetchGroupReport,
    fetchFinancialMonthlyReport,
    fetchDailySummary,
    fetchDailySummaryHtml,
    fetchStudentReportHtml,
    fetchGroupReportHtml,
    fetchGroupAttendanceSheetHtml,
    fetchMonthlyReportHtml,
} from '@/lib/api/reports';
import { printHtmlContent } from '@/lib/utils/print';

// ── helpers ─────────────────────────────────────────────────────────────────
const MONTHS = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

// ── Tab type ─────────────────────────────────────────────────────────────────
type Tab = 'daily' | 'student' | 'group' | 'financial';

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const user = useAuthStore((s) => s.user);
    const isTeacher = user?.role === 'teacher';

    const [activeTab,   setActiveTab]   = useState<Tab>('group');
    const [dailyDate,   setDailyDate]   = useState(() => new Date().toISOString().slice(0, 10));
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
    const [groupSearch,   setGroupSearch]   = useState('');
    const [selectedGroup,   setSelectedGroup]   = useState<{ id: string; name: string } | null>(null);
    const [finYear,   setFinYear]   = useState(() => new Date().getFullYear());
    const [finMonth,  setFinMonth]  = useState(() => new Date().getMonth() + 1);
    const [pdfLoading, setPdfLoading] = useState(false);

    // ── Daily summary ──────────────────────────────────────────────────────
    const { data: dailyData, isLoading: dailyLoading } = useQuery({
        queryKey: ['daily-summary', dailyDate],
        queryFn:  () => fetchDailySummary(dailyDate),
        enabled:  activeTab === 'daily',
    });

    // ── Students list for picker ───────────────────────────────────────────
    const { data: studentsData } = useQuery({
        queryKey: ['students-picker', studentSearch],
        queryFn:  () => fetchStudents({ search: studentSearch, limit: 30 }),
        enabled:  activeTab === 'student',
    });
    const studentsList: any[] = (studentsData as any)?.data ?? [];

    // ── Student report ─────────────────────────────────────────────────────
    const { data: studentReport, isLoading: studentReportLoading } = useQuery({
        queryKey: ['student-report', selectedStudent?.id],
        queryFn:  () => fetchStudentReport(selectedStudent!.id),
        enabled:  !!selectedStudent?.id && activeTab === 'student',
    });

    // ── Groups list for picker ─────────────────────────────────────────────
    const { data: groupsData } = useQuery({
        queryKey: ['groups-picker', groupSearch],
        queryFn:  () => fetchGroups({ search: groupSearch, limit: 30 }),
        enabled:  activeTab === 'group',
    });
    const groupsList: any[] = (groupsData as any)?.data ?? [];

    // ── Group report ───────────────────────────────────────────────────────
    const { data: groupReport, isLoading: groupReportLoading } = useQuery({
        queryKey: ['group-report', selectedGroup?.id],
        queryFn:  () => fetchGroupReport(selectedGroup!.id),
        enabled:  !!selectedGroup?.id && activeTab === 'group',
    });

    // ── Financial monthly report ───────────────────────────────────────────
    const { data: finReport, isLoading: finLoading } = useQuery({
        queryKey: ['financial-report', finYear, finMonth],
        queryFn:  () => fetchFinancialMonthlyReport(finYear, finMonth),
        enabled:  activeTab === 'financial' && isTeacher,
    });

    // ── PDF downloads ──────────────────────────────────────────────────────
    const handleDailyPdf = async () => {
        setPdfLoading(true);
        try {
            const html = await fetchDailySummaryHtml(dailyDate);
            printHtmlContent(html);
        } catch { /* Handled by interceptor */ }
        finally { setPdfLoading(false); }
    };

    const handleStudentPdf = async () => {
        if (!selectedStudent) return;
        setPdfLoading(true);
        try {
            const html = await fetchStudentReportHtml(selectedStudent.id);
            printHtmlContent(html);
        } catch { /* Handled by interceptor */ }
        finally { setPdfLoading(false); }
    };

    const handleGroupPdf = async () => {
        if (!selectedGroup) return;
        setPdfLoading(true);
        try {
            const html = await fetchGroupReportHtml(selectedGroup.id);
            printHtmlContent(html);
        } catch { /* Handled by interceptor */ }
        finally { setPdfLoading(false); }
    };

    const handleGroupSheet = async () => {
        if (!selectedGroup) return;
        setPdfLoading(true);
        try {
            const html = await fetchGroupAttendanceSheetHtml(selectedGroup.id);
            printHtmlContent(html);
        } catch { /* Handled by interceptor */ }
        finally { setPdfLoading(false); }
    };

    const handleFinancialPdf = async () => {
        setPdfLoading(true);
        try {
            const html = await fetchMonthlyReportHtml(finYear, finMonth);
            printHtmlContent(html);
        } catch { /* Handled by interceptor */ }
        finally { setPdfLoading(false); }
    };

    // ── Tabs config ────────────────────────────────────────────────────────
    const tabs: { key: Tab; label: string; icon: React.ElementType; teacherOnly?: boolean }[] = [
        { key: 'group',     label: 'تقرير مجموعة',      icon: GraduationCap },
        { key: 'student',   label: 'تقرير طالب',        icon: Users         },
        { key: 'daily',     label: 'ملخص اليوم',       icon: CalendarCheck },
        { key: 'financial', label: 'التقرير المالي',    icon: Wallet, teacherOnly: true },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        التقارير الشاملة
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">استعراض، متابعة وطباعة تقارير المجموعات والطلاب والماليات</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-0">
                {tabs.filter(t => !t.teacherOnly || isTeacher).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                            activeTab === t.key
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        )}
                    >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── GROUP REPORT ──────────────────────────────────────────── */}
            {activeTab === 'group' && (
                <div className="space-y-5">
                    {/* Picker */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                        <label className="text-sm font-medium text-gray-700">اختر مجموعة لعرض التقرير</label>
                        <div className="relative">
                            <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                            <Input
                                placeholder="ابحث باسم المجموعة..."
                                value={groupSearch}
                                onChange={(e) => { setGroupSearch(e.target.value); setSelectedGroup(null); }}
                                className="pr-10 bg-gray-50 border-gray-200"
                            />
                        </div>
                        {groupsList.length > 0 && !selectedGroup && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50">
                                {groupsList.map((g: any) => (
                                    <button
                                        key={g._id}
                                        onClick={() => { setSelectedGroup({ id: g._id, name: g.name }); setGroupSearch(g.name); }}
                                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between"
                                    >
                                        <span className="font-medium text-gray-800">{g.name}</span>
                                        <span className="text-xs text-gray-400">{g.gradeLevel ?? '—'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedGroup && (
                            <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-2.5">
                                <span className="font-medium text-primary text-sm">المجموعة المختارة: {selectedGroup.name}</span>
                                <button
                                    onClick={() => { setSelectedGroup(null); setGroupSearch(''); }}
                                    className="text-xs text-gray-400 hover:text-red-500 font-semibold"
                                >تغيير المجموعة</button>
                            </div>
                        )}
                    </div>

                    {selectedGroup ? (
                        groupReportLoading ? (
                            <ReportCardSkeleton />
                        ) : groupReport ? (
                            <GroupReportCard
                                report={groupReport}
                                onDownloadPdf={handleGroupPdf}
                                onDownloadSheet={handleGroupSheet}
                                pdfLoading={pdfLoading}
                                isTeacher={isTeacher}
                            />
                        ) : null
                    ) : (
                        <EmptyState message="يرجى اختيار مجموعة من القائمة أعلاه لعرض تقريرها الشامل" />
                    )}
                </div>
            )}

            {/* ── STUDENT REPORT ────────────────────────────────────────── */}
            {activeTab === 'student' && (
                <div className="space-y-5">
                    {/* Picker */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                        <label className="text-sm font-medium text-gray-700">ابحث عن طالب</label>
                        <div className="relative">
                            <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                            <Input
                                placeholder="اكتب اسم الطالب أو كوده..."
                                value={studentSearch}
                                onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); }}
                                className="pr-10 bg-gray-50 border-gray-200"
                            />
                        </div>
                        {studentsList.length > 0 && !selectedStudent && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50">
                                {studentsList.map((s: any) => (
                                    <button
                                        key={s._id}
                                        onClick={() => { setSelectedStudent({ id: s._id, name: s.studentName }); setStudentSearch(s.studentName); }}
                                        className="w-full text-right px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between"
                                    >
                                        <span className="font-medium text-gray-800">{s.studentName}</span>
                                        <span className="text-xs text-gray-400">{(s.groupId as any)?.name ?? '—'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedStudent && (
                            <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-2.5">
                                <span className="font-medium text-primary text-sm">الطالب المختار: {selectedStudent.name}</span>
                                <button
                                    onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                                    className="text-xs text-gray-400 hover:text-red-500 font-semibold"
                                >تغيير الطالب</button>
                            </div>
                        )}
                    </div>

                    {selectedStudent ? (
                        studentReportLoading ? (
                            <ReportCardSkeleton />
                        ) : studentReport ? (
                            <StudentReportCard
                                report={studentReport}
                                onDownloadPdf={handleStudentPdf}
                                pdfLoading={pdfLoading}
                                isTeacher={isTeacher}
                            />
                        ) : null
                    ) : (
                        <EmptyState message="يرجى البحث عن طالب واختياره لعرض تقريره الشامل" />
                    )}
                </div>
            )}

            {/* ── DAILY SUMMARY ─────────────────────────────────────────── */}
            {activeTab === 'daily' && (
                <div className="space-y-5">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 shrink-0">اختر التاريخ:</label>
                            <Input
                                type="date"
                                value={dailyDate}
                                onChange={(e) => setDailyDate(e.target.value)}
                                className="w-full sm:w-48 bg-gray-50 border-gray-200"
                                dir="ltr"
                            />
                        </div>
                        <Button onClick={handleDailyPdf} disabled={pdfLoading} className="gap-2 shrink-0">
                            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            طباعة تقرير اليوم PDF
                        </Button>
                    </div>

                    {dailyLoading ? (
                        <ReportCardSkeleton />
                    ) : dailyData ? (
                        <DailySummaryCard report={dailyData} isTeacher={isTeacher} />
                    ) : (
                        <EmptyState message="لا توجد بيانات لهذا اليوم" />
                    )}
                </div>
            )}

            {/* ── FINANCIAL MONTHLY ─────────────────────────────────────── */}
            {activeTab === 'financial' && isTeacher && (
                <div className="space-y-5">
                    {/* Controls */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                            <div className="space-y-1 flex-1">
                                <label className="text-sm font-medium text-gray-600">الشهر</label>
                                <select
                                    value={finMonth}
                                    onChange={(e) => setFinMonth(Number(e.target.value))}
                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                    {MONTHS.map((m, i) => (
                                        <option key={i + 1} value={i + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1 flex-1">
                                <label className="text-sm font-medium text-gray-600">السنة</label>
                                <Input
                                    type="number"
                                    value={finYear}
                                    onChange={(e) => setFinYear(Number(e.target.value))}
                                    min={2020}
                                    max={2100}
                                    dir="ltr"
                                    className="bg-gray-50 border-gray-200"
                                />
                            </div>
                            <Button onClick={handleFinancialPdf} disabled={pdfLoading} className="gap-2 shrink-0">
                                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                طباعة التقرير المالي PDF
                            </Button>
                        </div>
                    </div>

                    {/* Data */}
                    {finLoading ? (
                        <ReportCardSkeleton />
                    ) : finReport ? (
                        <FinancialReportCard report={finReport} month={finMonth} year={finYear} />
                    ) : (
                        <EmptyState message="لا توجد بيانات مالية لهذا الشهر" />
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Group Report Card (Full Redesign according to sketch)
// ─────────────────────────────────────────────────────────────────────────────
function GroupReportCard({ report, onDownloadPdf, onDownloadSheet, pdfLoading, isTeacher }: {
    report: any; onDownloadPdf: () => void; onDownloadSheet: () => void; pdfLoading: boolean; isTeacher: boolean;
}) {
    const group      = report.group      ?? {};
    const stats      = report.stats      ?? {};
    const attendance = report.attendance ?? {};
    const students: any[] = report.students ?? [];
    const sessionsHistory: any[] = attendance.sessionsHistory ?? [];

    const scheduleText = Array.isArray(group.schedule) && group.schedule.length > 0
        ? group.schedule.map((s: any) => `${s.day ?? ''} ${s.time ?? ''}`).join(' | ')
        : group.schedule ? `${group.schedule}` : '—';

    return (
        <div className="space-y-4">
            {/* ── 3-Box Header ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Right Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 space-y-1 text-right">
                        <p className="text-xs text-gray-500 font-semibold">المرحلة الدراسية: <span className="text-gray-900 font-bold">{group.gradeLevel || '—'}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">المواعيد: <span className="text-gray-900 font-bold">{scheduleText}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">السعة المقررة: <span className="text-gray-900 font-bold">{group.capacity || 50} طالب</span></p>
                    </div>

                    {/* Center Title Box */}
                    <div className="text-center p-3.5 bg-primary/5 border border-primary/20 rounded-xl shadow-2xs">
                        <h2 className="text-xl font-extrabold text-primary">تقرير مجموعة: {group.name || '—'}</h2>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <Badge className="bg-primary text-white text-[11px]">الدورة {group.currentCycleNumber || 1}</Badge>
                            <span className="text-xs text-gray-500">منظومة مُنظِّم</span>
                        </div>
                    </div>

                    {/* Left Info Box + Actions */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 flex flex-col justify-between gap-2 text-right">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>تاريخ التقرير:</span>
                            <span className="text-gray-900 font-bold" dir="ltr">{new Date().toLocaleDateString('ar-EG')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>نسبة الحضور العامة:</span>
                            <span className="text-emerald-700 font-bold">{attendance.avgAttendanceRate || '0%'}</span>
                        </div>
                        {isTeacher && (
                            <div className="flex gap-2 pt-1">
                                <Button onClick={onDownloadSheet} disabled={pdfLoading} size="sm" variant="outline" className="flex-1 text-xs gap-1 h-8 border-primary text-primary hover:bg-primary hover:text-white">
                                    <FileDown className="h-3.5 w-3.5" /> كشف الحضور
                                </Button>
                                <Button onClick={onDownloadPdf} disabled={pdfLoading} size="sm" className="flex-1 text-xs gap-1 h-8 bg-primary hover:bg-primary/90 text-white">
                                    <Download className="h-3.5 w-3.5" /> طباعة PDF
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 4 KPI Summary Cards (Right to Left) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Students & Subscriptions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">حالة اشتراكات الطلاب</span>
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">عدد الطلاب:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.totalStudents || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-700 font-medium">الدافعين:</span>
                            <strong className="text-sm font-bold text-emerald-600">{stats.paidStudentsCount || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-red-700 font-medium">المتأخرين في الدفع:</span>
                            <strong className="text-sm font-bold text-red-600">{stats.unpaidStudentsCount || 0}</strong>
                        </div>
                    </div>
                </div>

                {/* Card 2: Notebooks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">مبيعات المذكرات</span>
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <BookOpen className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">إجمالي بيع المذكرات:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.notebooksSoldQuantity || 0} نسخة</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-purple-700 font-medium">إجمالي فلوس المذكرات:</span>
                            <strong className="text-sm font-bold text-purple-700">{(stats.notebooksRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 3: Subscriptions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">اشتراكات الدورة</span>
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">عمليات الاشتراك:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.subscriptionsCount || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-700 font-medium">إجمالي فلوس الاشتراكات:</span>
                            <strong className="text-sm font-bold text-emerald-700">{(stats.subscriptionsRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 4: Total Finances */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">إجمالي ماليات المجموعة</span>
                        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">المجموع الكلي للإيرادات:</span>
                            <strong className="text-base font-extrabold text-amber-700">{(stats.totalRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                        <p className="text-[10px] text-gray-400">(يشمل الاشتراكات ومبيعات المذكرات)</p>
                    </div>
                </div>
            </div>

            {/* ── Detailed Content Section ── */}
            {/* Table 1: Students Roster with Subscription & Attendance */}
            <SectionCard title={`كشف طلاب المجموعة وحالة الاشتراك للدورة الحالية (${students.length} طالب)`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/70 border-b border-gray-100">
                                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-12">م</th>
                                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">اسم الطالب</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الكود</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">رقم الهاتف</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">هاتف ولي الأمر</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">حالة الاشتراك</th>
                                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">نسبة الحضور</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                                        لا يوجد طلاب مسجلين في هذه المجموعة
                                    </td>
                                </tr>
                            ) : (
                                students.map((st: any, idx: number) => (
                                    <tr key={st._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-gray-900 font-semibold">{st.studentName}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{st.studentCode || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-600" dir="ltr">{st.studentPhone || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-600" dir="ltr">{st.parentPhone || '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {st.hasActiveSubscription ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs hover:bg-emerald-50">
                                                    تم السداد ✓
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                                                    لم يسدد بعد
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-800">
                                            {st.attendanceRate} <span className="text-gray-400 font-normal">({st.presentCount}ح / {st.absentCount}غ)</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* Table 2: Sessions History */}
            {sessionsHistory.length > 0 && (
                <SectionCard title={`سجل الحصص المنعقدة (${sessionsHistory.length} حصة)`}>
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100 sticky top-0">
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 w-16">حصة #</th>
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">تاريخ الحصة</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">حضور</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">غياب</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">نسبة الحضور</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sessionsHistory.map((s: any, i: number) => {
                                    const total = (s.presentCount || 0) + (s.absentCount || 0);
                                    const rate = total > 0 ? Math.round((s.presentCount / total) * 100) : 0;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-2.5 text-center text-xs text-gray-400">{sessionsHistory.length - i}</td>
                                            <td className="px-5 py-2.5 text-gray-700 text-xs font-medium" dir="ltr">
                                                {s.date ? new Date(s.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-emerald-700 font-bold">{s.presentCount ?? 0}</td>
                                            <td className="px-4 py-2.5 text-center text-red-500 font-bold">{s.absentCount ?? 0}</td>
                                            <td className="px-4 py-2.5 text-center text-xs font-bold text-primary">{rate}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Student Report Card (Unified Layout)
// ─────────────────────────────────────────────────────────────────────────────
function StudentReportCard({ report, onDownloadPdf, pdfLoading, isTeacher }: {
    report: any; onDownloadPdf: () => void; pdfLoading: boolean; isTeacher: boolean;
}) {
    const student    = report.student    ?? {};
    const attendance = report.attendance ?? {};
    const payments   = report.payments   ?? {};
    const grades     = report.grades     ?? {};

    const payHistory: any[]  = payments.history       ?? [];
    const gradesHistory: any[] = grades.history       ?? [];

    return (
        <div className="space-y-4">
            {/* ── 3-Box Header ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Right Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 space-y-1 text-right">
                        <p className="text-xs text-gray-500 font-semibold">المرحلة الدراسية: <span className="text-gray-900 font-bold">{student.gradeLevel || '—'}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">المجموعة: <span className="text-gray-900 font-bold">{student.groupName || '—'}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">حالة الطالب: <span className="text-emerald-700 font-bold">{student.isActive ? 'نشط' : 'غير نشط'}</span></p>
                    </div>

                    {/* Center Title Box */}
                    <div className="text-center p-3.5 bg-primary/5 border border-primary/20 rounded-xl shadow-2xs">
                        <h2 className="text-xl font-extrabold text-primary">تقرير الطالب: {student.studentName || '—'}</h2>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <Badge className="bg-primary text-white text-[11px]">كود الطالب: {(student as any).studentCode || '—'}</Badge>
                            <span className="text-xs text-gray-500">منظومة مُنظِّم</span>
                        </div>
                    </div>

                    {/* Left Info Box + Actions */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 flex flex-col justify-between gap-2 text-right">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>رقم الطالب:</span>
                            <span className="text-gray-900 font-bold" dir="ltr">{student.studentPhone || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>رقم ولي الأمر:</span>
                            <span className="text-gray-900 font-bold" dir="ltr">{(student as any).parentPhone || '—'}</span>
                        </div>
                        {isTeacher && (
                            <div className="pt-1">
                                <Button onClick={onDownloadPdf} disabled={pdfLoading} size="sm" className="w-full text-xs gap-1 h-8 bg-primary hover:bg-primary/90 text-white">
                                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    طباعة تقرير الطالب PDF
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 4 KPI Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Sessions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">الحصص والحضور</span>
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CalendarCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">إجمالي الحصص:</span>
                            <strong className="text-sm font-bold text-gray-900">{attendance.totalSessions || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-700 font-medium">حضور:</span>
                            <strong className="text-sm font-bold text-emerald-600">{attendance.presentCount || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-red-700 font-medium">غياب:</span>
                            <strong className="text-sm font-bold text-red-600">{attendance.absentCount || 0}</strong>
                        </div>
                    </div>
                </div>

                {/* Card 2: Attendance Rate */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">نسبة الانضباط</span>
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">نسبة الحضور:</span>
                            <strong className="text-base font-bold text-purple-700">{attendance.attendanceRate || '0%'}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">حالة الاشتراك:</span>
                            <span>{student.hasActiveSubscription ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">ساري ✓</Badge> : <Badge variant="outline" className="bg-red-50 text-red-700 text-[10px]">غير مسدد</Badge>}</span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Payments */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">المدفوعات والاشتراكات</span>
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">إجمالي المدفوع:</span>
                            <strong className="text-sm font-bold text-emerald-700">{(payments.totalPaid || 0).toLocaleString()} ج</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 font-medium">الخصومات:</span>
                            <strong className="text-sm font-bold text-gray-600">{(payments.totalDiscount || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 4: Exams */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">الامتحانات والتقييمات</span>
                        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <GraduationCap className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">عدد الامتحانات:</span>
                            <strong className="text-sm font-bold text-gray-900">{grades?.total || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-700 font-medium">متوسط الدرجات:</span>
                            <strong className="text-sm font-bold text-amber-700">
                                {gradesHistory.length > 0 ? Math.round(gradesHistory.reduce((a: any, b: any) => a + (b.percentage || 0), 0) / gradesHistory.length) : 0}%
                            </strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detailed Content ── */}
            {/* Table 1: Attendance History */}
            {attendance.history?.length > 0 && (
                <SectionCard title={`سجل الحضور والغياب (آخر ${attendance.history.length} حصة)`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 w-16">حصة #</th>
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">تاريخ الحصة</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">حالة الحضور</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">تسليم الواجب</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {attendance.history.map((h: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">{attendance.history.length - i}</td>
                                        <td className="px-5 py-2.5 text-gray-700 text-xs font-medium" dir="ltr">
                                            {h.date ? new Date(h.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {h.status === 'PRESENT' ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">حاضر ✓</Badge>
                                            ) : h.status === 'ABSENT' ? (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">غائب ✗</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">عذر / زائر</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-xs font-semibold">
                                            {h.homeworkDone === true ? <span className="text-emerald-700">تم التسليم ✓</span> : h.homeworkDone === false ? <span className="text-red-600">لم يسلم ✗</span> : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Table 2: Payments History */}
            {isTeacher && payHistory.length > 0 && (
                <SectionCard title={`سجل المدفوعات والاشتراكات (${payHistory.length} عملية)`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">التاريخ</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">نوع المعاملة</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">البيان والتفاصيل</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الخصم</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المبلغ المدفوع</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payHistory.map((p: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-2.5 text-xs text-gray-500" dir="ltr">
                                            {p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-800 font-medium">
                                            {p.category === 'SUBSCRIPTION' ? 'اشتراك دورة' : p.category === 'NOTEBOOK_SALE' ? 'شراء مذكرة' : 'معاملة مالية'}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-600 text-xs">{p.description || '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{(p.discountAmount || 0).toLocaleString()} ج</td>
                                        <td className="px-4 py-2.5 text-center font-bold text-emerald-700">{(p.paidAmount || 0).toLocaleString()} ج</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Table 3: Exam Grades */}
            {gradesHistory.length > 0 && (
                <SectionCard title={`درجات الامتحانات والتقييمات (${gradesHistory.length} امتحان)`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">اسم الامتحان</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">التاريخ</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الدرجة</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">النسبة المئوية</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">النتيجة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {gradesHistory.map((g: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-2.5 text-gray-900 font-semibold">{g.examTitle}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-500" dir="ltr">
                                            {g.date ? new Date(g.date).toLocaleDateString('ar-EG') : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-bold text-gray-800">{g.score} / {g.totalMarks}</td>
                                        <td className={cn('px-4 py-2.5 text-center font-bold', g.passed ? 'text-emerald-700' : 'text-red-600')}>
                                            {g.percentage}%
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {g.passed ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">ناجح ✓</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">راسب ✗</Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Daily Summary Card (Unified Layout)
// ─────────────────────────────────────────────────────────────────────────────
function DailySummaryCard({ report, isTeacher }: { report: any; isTeacher: boolean }) {
    const stats = report.stats ?? {};
    const financial = report.financial ?? {};
    const sessions: any[] = report.completedSessions ?? [];
    const transactions: any[] = report.transactions ?? [];

    return (
        <div className="space-y-4">
            {/* ── 3-Box Header ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Right Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 space-y-1 text-right">
                        <p className="text-xs text-gray-500 font-semibold">تاريخ التقرير: <span className="text-gray-900 font-bold" dir="ltr">{report.date}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">الحصص المكتملة اليوم: <span className="text-gray-900 font-bold">{report.sessionsCount || 0} حصة</span></p>
                        <p className="text-xs text-gray-500 font-semibold">إجمالي حضور اليوم: <span className="text-emerald-700 font-bold">{report.totalPresent || 0} طالب</span></p>
                    </div>

                    {/* Center Title Box */}
                    <div className="text-center p-3.5 bg-primary/5 border border-primary/20 rounded-xl shadow-2xs">
                        <h2 className="text-xl font-extrabold text-primary">التقرير اليومي ليوم {report.date}</h2>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <Badge className="bg-primary text-white text-[11px]">{report.sessionsCount || 0} حصص مكتملة</Badge>
                            <span className="text-xs text-gray-500">منظومة مُنظِّم</span>
                        </div>
                    </div>

                    {/* Left Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 flex flex-col justify-between gap-1 text-right">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>صافي إيراد اليوم:</span>
                            <span className="text-emerald-700 font-bold">{(financial.netBalance || 0).toLocaleString()} ج</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>إجمالي الغياب:</span>
                            <span className="text-red-600 font-bold">{report.totalAbsent || 0} طالب</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4 KPI Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Total Daily Income */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">إجمالي إيراد اليوم</span>
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">المجموع الكلي:</span>
                            <strong className="text-base font-extrabold text-emerald-700">{(financial.totalIncome || 0).toLocaleString()} ج</strong>
                        </div>
                        <p className="text-[10px] text-gray-400">(اشتراكات + مذكرات)</p>
                    </div>
                </div>

                {/* Card 2: Subscriptions Today */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">اشتراكات اليوم</span>
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">عمليات الاشتراك:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.subscriptionsCount || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-blue-700 font-medium">مبالغ الاشتراكات:</span>
                            <strong className="text-sm font-bold text-blue-700">{(stats.subscriptionsRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 3: Notebooks Today */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">مبيعات مذكرات اليوم</span>
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <BookOpen className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">مذكرات مباعة:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.notebooksSoldQuantity || 0} نسخة</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-purple-700 font-medium">فلوس المذكرات:</span>
                            <strong className="text-sm font-bold text-purple-700">{(stats.notebooksRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 4: Expenses & Net */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">مصروفات وصافي اليوم</span>
                        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-red-600 font-medium">المصروفات:</span>
                            <strong className="text-sm font-bold text-red-600">{(financial.totalExpenses || 0).toLocaleString()} ج</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-primary font-medium">الصافي:</span>
                            <strong className="text-sm font-bold text-primary">{(financial.netBalance || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detailed Content ── */}
            {/* Table 1: Completed Sessions Today */}
            {sessions.length > 0 && (
                <SectionCard title={`أولاً: حصص اليوم المنعقدة (${sessions.length} حصة)`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">اسم المجموعة</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المرحلة الدراسية</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">وقت البدء</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">حضور</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">غياب</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sessions.map((s: any) => (
                                    <tr key={s._id} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-2.5 text-gray-900 font-semibold">{s.groupName}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-600">{s.gradeLevel}</td>
                                        <td className="px-4 py-2.5 text-center text-xs text-gray-600" dir="ltr">{s.startTime || '—'}</td>
                                        <td className="px-4 py-2.5 text-center font-bold text-emerald-700">{s.presentCount}</td>
                                        <td className="px-4 py-2.5 text-center font-bold text-red-500">{s.absentCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Table 2: Daily Transactions */}
            {isTeacher && transactions.length > 0 && (
                <SectionCard title={`ثانياً: المعاملات المالية لليوم (${transactions.length} معاملة)`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">الطالب / الطرف</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">نوع المعاملة</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">البيان والتفاصيل</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المبلغ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {transactions.map((t: any) => (
                                    <tr key={t._id} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-2.5 text-gray-900 font-medium">{t.studentName}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {t.type === 'INCOME' ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">إيراد</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">مصروف</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-600 text-xs">{t.description}</td>
                                        <td className={cn('px-4 py-2.5 text-center font-bold', t.type === 'INCOME' ? 'text-emerald-700' : 'text-red-600')}>
                                            {(t.paidAmount || 0).toLocaleString()} ج
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Financial Monthly Report Card (Unified Layout)
// ─────────────────────────────────────────────────────────────────────────────
function FinancialReportCard({ report, month, year }: { report: any; month: number; year: number }) {
    const stats = report.stats ?? {};
    const breakdown: any[]      = report.breakdown      ?? [];
    const dailySummaries: any[] = report.dailySummaries ?? [];
    const monthName = MONTHS[month - 1] || `${month}`;

    return (
        <div className="space-y-4">
            {/* ── 3-Box Header ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* Right Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 space-y-1 text-right">
                        <p className="text-xs text-gray-500 font-semibold">الشهر المالي: <span className="text-gray-900 font-bold">{monthName} ({month})</span></p>
                        <p className="text-xs text-gray-500 font-semibold">السنة المالية: <span className="text-gray-900 font-bold">{year}</span></p>
                        <p className="text-xs text-gray-500 font-semibold">الأيام المسجلة: <span className="text-gray-900 font-bold">{dailySummaries.length} يوم</span></p>
                    </div>

                    {/* Center Title Box */}
                    <div className="text-center p-3.5 bg-primary/5 border border-primary/20 rounded-xl shadow-2xs">
                        <h2 className="text-xl font-extrabold text-primary">التقرير المالي لشهر {monthName} {year}</h2>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <Badge className="bg-primary text-white text-[11px]">سنة {year}</Badge>
                            <span className="text-xs text-gray-500">منظومة مُنظِّم</span>
                        </div>
                    </div>

                    {/* Left Info Box */}
                    <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 flex flex-col justify-between gap-1 text-right">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>صافي الأرباح:</span>
                            <span className="text-emerald-700 font-bold">{(report.netBalance || 0).toLocaleString()} ج</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                            <span>تاريخ التقرير:</span>
                            <span className="text-gray-900 font-bold" dir="ltr">{new Date().toLocaleDateString('ar-EG')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4 KPI Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Total Income */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">إجمالي الإيرادات</span>
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">إجمالي الدخل:</span>
                            <strong className="text-base font-extrabold text-emerald-700">{(report.totalIncome || 0).toLocaleString()} ج</strong>
                        </div>
                        <p className="text-[10px] text-gray-400">(اشتراكات + مذكرات)</p>
                    </div>
                </div>

                {/* Card 2: Subscriptions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">اشتراكات الشهر</span>
                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">عمليات الاشتراك:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.subscriptionsCount || 0}</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-blue-700 font-medium">مبالغ الاشتراكات:</span>
                            <strong className="text-sm font-bold text-blue-700">{(stats.subscriptionsRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 3: Notebooks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">مبيعات المذكرات</span>
                        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <BookOpen className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">المذكرات المباعة:</span>
                            <strong className="text-sm font-bold text-gray-900">{stats.notebooksSoldQuantity || 0} نسخة</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-purple-700 font-medium">فلوس المذكرات:</span>
                            <strong className="text-sm font-bold text-purple-700">{(stats.notebooksRevenue || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>

                {/* Card 4: Expenses & Net */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-right flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">المصروفات والصافي</span>
                        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-red-600 font-medium">المصروفات:</span>
                            <strong className="text-sm font-bold text-red-600">{(report.totalExpenses || 0).toLocaleString()} ج</strong>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-primary font-medium">صافي الربح:</span>
                            <strong className="text-sm font-bold text-primary">{(report.netBalance || 0).toLocaleString()} ج</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detailed Content ── */}
            {/* Table 1: Category Breakdown */}
            {breakdown.length > 0 && (
                <SectionCard title="أولاً: تصنيف الحركات المالية حسب البند">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="text-center px-5 py-2.5 text-xs font-semibold text-gray-500 w-28">النوع</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">البند / التصنيف</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">العدد</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المبلغ الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {breakdown.map((b: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-2.5 text-center">
                                            <Badge className={cn('text-xs', b._id?.type === 'INCOME'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-red-50 text-red-600 border-red-200'
                                            )}>
                                                {b._id?.type === 'INCOME' ? 'إيرادات' : 'مصروفات'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-800 font-medium">{b._id?.category ?? '—'}</td>
                                        <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{b.count ?? 0}</td>
                                        <td className={cn('px-4 py-2.5 text-center font-bold',
                                            b._id?.type === 'INCOME' ? 'text-emerald-700' : 'text-red-600'
                                        )}>
                                            {(b.total ?? 0).toLocaleString()} ج
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Table 2: Daily Summaries */}
            {dailySummaries.length > 0 && (
                <SectionCard title={`ثانياً: سجل الملخص اليومي للشهر (${dailySummaries.length} يوم)`}>
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100 sticky top-0">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">اليوم والتاريخ</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الإيرادات</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المصروفات</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الصافي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {dailySummaries.map((d: any, i: number) => {
                                    const inc = d.totalIncome ?? d.income ?? 0;
                                    const exp = d.totalExpenses ?? d.expense ?? 0;
                                    const net = inc - exp;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50/50">
                                            <td className="px-5 py-2.5 text-xs text-gray-700 font-medium" dir="ltr">
                                                {d.date ? new Date(d.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-emerald-700 font-semibold">
                                                {inc.toLocaleString()} ج
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-red-500 font-semibold">
                                                {exp.toLocaleString()} ج
                                            </td>
                                            <td className={cn('px-4 py-2.5 text-center font-bold', net >= 0 ? 'text-primary' : 'text-red-600')}>
                                                {net.toLocaleString()} ج
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-right">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">{message}</p>
        </div>
    );
}

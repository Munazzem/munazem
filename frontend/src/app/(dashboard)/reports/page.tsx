'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    FileText,
    Users,
    GraduationCap,
    Wallet,
    CalendarCheck,
    Download,
    Loader2,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    Search,
} from 'lucide-react';
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
    downloadStudentReportPdf,
    downloadGroupReportPdf,
    downloadMonthlyReportPdf,
} from '@/lib/api/reports';

// ── helpers ─────────────────────────────────────────────────────────────────
const MONTHS = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Tab type ─────────────────────────────────────────────────────────────────
type Tab = 'daily' | 'student' | 'group' | 'financial';

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const user = useAuthStore((s) => s.user);
    const isTeacher = user?.role === 'teacher';

    const [activeTab,   setActiveTab]   = useState<Tab>('daily');
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
    const handleStudentPdf = async () => {
        if (!selectedStudent) return;
        setPdfLoading(true);
        try {
            const blob = await downloadStudentReportPdf(selectedStudent.id);
            downloadBlob(blob, `تقرير-${selectedStudent.name}.pdf`);
        } catch { toast.error('فشل تحميل التقرير'); }
        finally { setPdfLoading(false); }
    };

    const handleGroupPdf = async () => {
        if (!selectedGroup) return;
        setPdfLoading(true);
        try {
            const blob = await downloadGroupReportPdf(selectedGroup.id);
            downloadBlob(blob, `تقرير-${selectedGroup.name}.pdf`);
        } catch { toast.error('فشل تحميل التقرير'); }
        finally { setPdfLoading(false); }
    };

    const handleFinancialPdf = async () => {
        setPdfLoading(true);
        try {
            const blob = await downloadMonthlyReportPdf(finYear, finMonth);
            downloadBlob(blob, `تقرير-مالي-${finYear}-${finMonth}.pdf`);
        } catch { toast.error('فشل تحميل التقرير'); }
        finally { setPdfLoading(false); }
    };

    // ── Tabs config ────────────────────────────────────────────────────────
    const tabs: { key: Tab; label: string; icon: React.ElementType; teacherOnly?: boolean }[] = [
        { key: 'daily',     label: 'ملخص اليوم',       icon: CalendarCheck },
        { key: 'student',   label: 'تقرير طالب',        icon: Users         },
        { key: 'group',     label: 'تقرير مجموعة',      icon: GraduationCap },
        { key: 'financial', label: 'التقرير المالي',    icon: Wallet, teacherOnly: true },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        التقارير
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">استعراض وتحميل التقارير الشاملة</p>
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

            {/* ── DAILY SUMMARY ─────────────────────────────────────────── */}
            {activeTab === 'daily' && (
                <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <label className="text-sm font-medium text-gray-600 shrink-0">اختر يوم:</label>
                        <Input
                            type="date"
                            value={dailyDate}
                            onChange={(e) => setDailyDate(e.target.value)}
                            className="w-full sm:w-48 bg-white border-gray-200"
                            dir="ltr"
                        />
                    </div>

                    {dailyLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : dailyData ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <StatCard icon={CalendarCheck} label="الحصص" value={dailyData.sessionsCount} color="blue" />
                            <StatCard icon={Users}         label="الحضور" value={dailyData.totalPresent}  color="green" />
                            <StatCard icon={FileText}      label="الاشتراكات" value={dailyData.subscriptionsCount} color="purple" />
                            {isTeacher && (
                                <>
                                    <StatCard icon={TrendingUp}   label="الإيرادات"  value={`${(dailyData.financial?.totalIncome ?? 0).toLocaleString()} ج`}  color="green" />
                                    <StatCard icon={TrendingDown} label="المصروفات" value={`${(dailyData.financial?.totalExpenses ?? 0).toLocaleString()} ج`} color="red" />
                                    <StatCard icon={Wallet}       label="الصافي"     value={`${(dailyData.financial?.netBalance ?? 0).toLocaleString()} ج`}   color="gray" />
                                </>
                            )}
                        </div>
                    ) : (
                        <EmptyState message="لا توجد بيانات لهذا اليوم" />
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
                                placeholder="اكتب اسم الطالب..."
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
                                <span className="font-medium text-primary text-sm">{selectedStudent.name}</span>
                                <button
                                    onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                >تغيير</button>
                            </div>
                        )}
                    </div>

                    {/* Report */}
                    {selectedStudent && (
                        studentReportLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : studentReport ? (
                            <StudentReportCard
                                report={studentReport}
                                onDownloadPdf={handleStudentPdf}
                                pdfLoading={pdfLoading}
                                isTeacher={isTeacher}
                            />
                        ) : null
                    )}
                </div>
            )}

            {/* ── GROUP REPORT ──────────────────────────────────────────── */}
            {activeTab === 'group' && (
                <div className="space-y-5">
                    {/* Picker */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                        <label className="text-sm font-medium text-gray-700">اختر مجموعة</label>
                        <div className="relative">
                            <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                            <Input
                                placeholder="اكتب اسم المجموعة..."
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
                                <span className="font-medium text-primary text-sm">{selectedGroup.name}</span>
                                <button
                                    onClick={() => { setSelectedGroup(null); setGroupSearch(''); }}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                >تغيير</button>
                            </div>
                        )}
                    </div>

                    {/* Report */}
                    {selectedGroup && (
                        groupReportLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : groupReport ? (
                            <GroupReportCard
                                report={groupReport}
                                onDownloadPdf={handleGroupPdf}
                                pdfLoading={pdfLoading}
                                isTeacher={isTeacher}
                            />
                        ) : null
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
                                تحميل PDF
                            </Button>
                        </div>
                    </div>

                    {/* Data */}
                    {finLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType; label: string; value: string | number;
    color: 'blue' | 'green' | 'red' | 'purple' | 'gray';
}) {
    const colors = {
        blue:   'bg-blue-50 text-blue-600',
        green:  'bg-green-50 text-green-600',
        red:    'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600',
        gray:   'bg-gray-100 text-gray-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', colors[color])}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">{message}</p>
        </div>
    );
}

function StudentReportCard({ report, onDownloadPdf, pdfLoading, isTeacher }: {
    report: any; onDownloadPdf: () => void; pdfLoading: boolean; isTeacher: boolean;
}) {
    const student = report.student ?? {};
    const attendance = report.attendanceSummary ?? {};
    const subscriptions: any[] = report.subscriptions ?? [];
    const payments: any[] = report.payments ?? [];
    const exams: any[] = report.examHistory ?? [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-2xl font-bold text-primary">
                                {(student.studentName ?? '؟').charAt(0)}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{student.studentName ?? '—'}</h2>
                            <p className="text-sm text-gray-500">{(student.groupId as any)?.name ?? '—'}</p>
                            {student.phone && (
                                <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{student.phone}</p>
                            )}
                        </div>
                    </div>
                    {isTeacher && (
                        <Button onClick={onDownloadPdf} disabled={pdfLoading} variant="outline" className="gap-2 shrink-0">
                            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            تحميل PDF
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={CalendarCheck} label="الحضور"  value={attendance.present ?? 0}   color="green" />
                <StatCard icon={CalendarCheck} label="الغياب"  value={attendance.absent  ?? 0}   color="red"   />
                <StatCard icon={FileText}      label="الاشتراكات" value={subscriptions.length}    color="blue"  />
                <StatCard icon={ClipboardListIcon} label="الامتحانات" value={exams.length}         color="purple" />
            </div>

            {/* Subscriptions */}
            {subscriptions.length > 0 && (
                <SectionCard title="الاشتراكات">
                    <div className="divide-y divide-gray-50">
                        {subscriptions.map((s: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-3 px-5 text-sm">
                                <div>
                                    <p className="font-medium text-gray-800">{s.planName ?? '—'}</p>
                                    <p className="text-xs text-gray-400">
                                        {s.startDate ? new Date(s.startDate).toLocaleDateString('ar-EG') : '—'}
                                        {' → '}
                                        {s.endDate   ? new Date(s.endDate).toLocaleDateString('ar-EG')   : '—'}
                                    </p>
                                </div>
                                <Badge variant={s.isActive ? 'default' : 'outline'} className="text-xs">
                                    {s.isActive ? 'فعّال' : 'منتهي'}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Payments */}
            {isTeacher && payments.length > 0 && (
                <SectionCard title="المدفوعات">
                    <div className="divide-y divide-gray-50">
                        {payments.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-3 px-5 text-sm">
                                <span className="text-gray-700">{p.description ?? p.type ?? '—'}</span>
                                <span className="font-bold text-green-600">{(p.amount ?? 0).toLocaleString()} ج</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Exams */}
            {exams.length > 0 && (
                <SectionCard title="الامتحانات">
                    <div className="divide-y divide-gray-50">
                        {exams.map((e: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-3 px-5 text-sm">
                                <div>
                                    <p className="font-medium text-gray-800">{e.examId?.title ?? '—'}</p>
                                    <p className="text-xs text-gray-400">
                                        {e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '—'}
                                    </p>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-gray-800">{e.score} / {e.totalMarks}</p>
                                    <Badge className={cn('text-xs', e.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                                        {e.passed ? 'ناجح' : 'راسب'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

function GroupReportCard({ report, onDownloadPdf, pdfLoading, isTeacher }: {
    report: any; onDownloadPdf: () => void; pdfLoading: boolean; isTeacher: boolean;
}) {
    const group     = report.group ?? {};
    const sessions: any[] = report.sessions ?? [];
    const students: any[] = report.students ?? [];
    const summary   = report.summary ?? {};

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{group.name ?? '—'}</h2>
                        <p className="text-sm text-gray-500">{group.gradeLevel ?? '—'} · {students.length} طالب</p>
                    </div>
                    {isTeacher && (
                        <Button onClick={onDownloadPdf} disabled={pdfLoading} variant="outline" className="gap-2 shrink-0">
                            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            تحميل PDF
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary stats */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={CalendarCheck} label="الحصص"      value={summary.totalSessions   ?? sessions.length}  color="blue"   />
                    <StatCard icon={Users}         label="الطلاب"      value={students.length}                             color="green"  />
                    <StatCard icon={TrendingUp}    label="متوسط الحضور" value={`${summary.avgAttendance ?? '—'}%`}          color="purple" />
                    {isTeacher && (
                        <StatCard icon={Wallet} label="الإيرادات" value={`${(summary.totalRevenue ?? 0).toLocaleString()} ج`} color="gray" />
                    )}
                </div>
            )}

            {/* Students table */}
            {students.length > 0 && (
                <SectionCard title="الطلاب">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-50">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">الطالب</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الحضور</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الغياب</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">الاشتراك</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {students.map((s: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-3 font-medium text-gray-800">{s.studentName ?? '—'}</td>
                                        <td className="px-4 py-3 text-center text-green-600 font-medium">{s.present ?? '—'}</td>
                                        <td className="px-4 py-3 text-center text-red-500 font-medium">{s.absent ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant={s.hasActiveSubscription ? 'default' : 'outline'} className="text-xs">
                                                {s.hasActiveSubscription ? 'فعّال' : 'منتهي'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
                <SectionCard title={`الحصص (${sessions.length})`}>
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        {sessions.map((s: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-3 px-5 text-sm">
                                <span className="text-gray-700">{s.title ?? `حصة ${i + 1}`}</span>
                                <span className="text-xs text-gray-400">
                                    {s.date ? new Date(s.date).toLocaleDateString('ar-EG') : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

function FinancialReportCard({ report, month, year }: { report: any; month: number; year: number }) {
    const summary    = report.summary ?? report;
    const entries: any[] = report.entries ?? report.transactions ?? [];

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-500 mb-1">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-green-600">{(summary.totalIncome ?? 0).toLocaleString()} ج</p>
                    <p className="text-xs text-gray-400 mt-1">{MONTHS[month - 1]} {year}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-500 mb-1">إجمالي المصروفات</p>
                    <p className="text-2xl font-bold text-red-500">{(summary.totalExpenses ?? 0).toLocaleString()} ج</p>
                    <p className="text-xs text-gray-400 mt-1">{MONTHS[month - 1]} {year}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-500 mb-1">الصافي</p>
                    <p className={cn('text-2xl font-bold', (summary.netBalance ?? 0) >= 0 ? 'text-primary' : 'text-red-500')}>
                        {(summary.netBalance ?? 0).toLocaleString()} ج
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{MONTHS[month - 1]} {year}</p>
                </div>
            </div>

            {/* Entries table */}
            {entries.length > 0 && (
                <SectionCard title="تفاصيل الحركات">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-50">
                                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500">الوصف</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">النوع</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المبلغ</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {entries.map((e: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-3 text-gray-700">{e.description ?? e.type ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="outline" className="text-xs">{e.type ?? '—'}</Badge>
                                        </td>
                                        <td className={cn('px-4 py-3 text-center font-bold',
                                            e.type === 'EXPENSE' ? 'text-red-500' : 'text-green-600'
                                        )}>
                                            {e.type === 'EXPENSE' ? '-' : '+'}{(e.amount ?? 0).toLocaleString()} ج
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs text-gray-400">
                                            {e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '—'}
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
            </div>
            {children}
        </div>
    );
}

// small icon used inside StudentReportCard
function ClipboardListIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
    );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyLedger, getMonthlyLedger } from '@/lib/api/payments';
import { fetchMonthlyReportHtml } from '@/lib/api/reports';
import { printHtmlContent } from '@/lib/utils/print';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth.store';
import { AddTransactionModal } from '@/components/payments/AddTransactionModal';
import { PriceSettingsModal } from '@/components/payments/PriceSettingsModal';
import { BatchSubscriptionModal } from '@/components/payments/BatchSubscriptionModal';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    Minus,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Receipt,
    FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, type TransactionCategory } from '@/types/payment.types';

type Tab = 'daily' | 'monthly' | 'prices';

// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    type,
    subValue,
}: {
    label: string;
    value: number;
    type: 'income' | 'expense' | 'net' | 'monthly_income' | 'monthly_expense';
    subValue?: string;
}) {
    const colors = {
        income:  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', icon: TrendingUp,   iconColor: 'text-green-500' },
        expense: { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-100',   icon: TrendingDown, iconColor: 'text-red-500' },
        net:     { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-100',  icon: Minus,        iconColor: 'text-blue-500' },
        monthly_income: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: TrendingUp, iconColor: 'text-emerald-500' },
        monthly_expense: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: TrendingDown, iconColor: 'text-orange-500' },
    };
    const c = colors[type];
    const Icon = c.icon;

    return (
        <div className={cn('rounded-xl border p-3 sm:p-4 shadow-sm h-full flex flex-col justify-between', c.bg, c.border)}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <Icon className={cn('h-4 w-4', c.iconColor)} />
            </div>
            <div>
                <p className={cn('text-lg sm:text-xl font-bold', c.text)}>
                    {value.toLocaleString('ar-EG')} <span className="text-xs sm:text-sm font-normal">ج</span>
                </p>
                {subValue && <p className="text-[10px] text-gray-400 mt-1">{subValue}</p>}
            </div>
        </div>
    );
}

function StatCardSkeleton() {
    return (
        <div className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm h-24">
            <div className="flex justify-between items-center mb-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-24" />
        </div>
    );
}

// ─── Daily Tab ────────────────────────────────────────────────────
function DailyTab({ canWrite }: { canWrite: boolean }) {
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
    const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

    const { data: ledger, isLoading, refetch } = useQuery({
        queryKey: ['daily-ledger', date],
        queryFn: () => getDailyLedger(date),
    });

    const txs = (ledger?.transactions ?? []).filter(tx => {
        if (filter === 'ALL') return true;
        return tx.type === filter;
    });

    const formatTime = (timeStr: string) =>
        new Date(timeStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-6">
            {/* Stats Summary Header */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {isLoading ? (
                    <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </>
                ) : (
                    <>
                        <StatCard label="إيرادات اليوم" value={ledger?.totalIncome ?? 0} type="income" />
                        <StatCard label="مصروفات اليوم" value={ledger?.totalExpenses ?? 0} type="expense" />
                        <StatCard label="إيرادات الشهر" value={ledger?.monthlyIncome ?? 0} type="monthly_income" subValue="إجمالي إيرادات الشهر الحالي" />
                        <StatCard label="إجمالي المصروفات" value={ledger?.monthlyExpenses ?? 0} type="monthly_expense" subValue="إجمالي مصروفات الشهر الحالي" />
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl"
                        onClick={() => {
                            const d = new Date(date);
                            d.setDate(d.getDate() - 1);
                            setDate(d.toISOString().split('T')[0]!);
                        }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="h-10 flex-1 sm:w-44 text-sm rounded-xl bg-white border-gray-100"
                    />
                    <Button
                        variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl"
                        onClick={() => {
                            const d = new Date(date);
                            d.setDate(d.getDate() + 1);
                            setDate(d.toISOString().split('T')[0]!);
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>

                {canWrite && (
                    <div className="flex gap-2">
                        <BatchSubscriptionModal />
                        <AddTransactionModal onSuccess={() => refetch()} />
                    </div>
                )}
            </div>

            {/* Transactions Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">المعاملات المالية</h3>
                            <p className="text-xs text-gray-500">{txs.length} معاملة مسجلة</p>
                        </div>
                    </div>

                    {/* Sub-tabs Filter */}
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto">
                        {[
                            { id: 'ALL', label: 'الكل' },
                            { id: 'INCOME', label: 'الإيرادات' },
                            { id: 'EXPENSE', label: 'المصروفات' },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setFilter(t.id as any)}
                                className={cn(
                                    'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex-1 sm:flex-none whitespace-nowrap',
                                    filter === t.id
                                        ? 'bg-white text-primary shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-6">
                        <TableSkeleton rows={8} columns={5} />
                    </div>
                ) : txs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                        <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center">
                            <Wallet className="h-8 w-8 text-gray-200" />
                        </div>
                        <p className="text-sm font-medium">لا توجد معاملات في هذا اليوم</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Cards */}
                        <div className="sm:hidden divide-y divide-gray-50">
                            {txs.map((tx, i) => (
                                <div key={i} className="px-5 py-4 hover:bg-gray-50/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={cn(
                                            'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider',
                                            tx.type === 'INCOME'
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : 'bg-red-50 text-red-600 border-red-100'
                                        )}>
                                            {tx.type === 'INCOME' ? '↑ دخل' : '↓ مصروف'}
                                        </span>
                                        <span className="font-black text-gray-900">
                                            {tx.paidAmount.toLocaleString('ar-EG')} ج
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category}
                                            </p>
                                            {tx.studentName && <p className="text-xs text-primary font-medium mt-0.5">{tx.studentName}</p>}
                                            {tx.description && (
                                                <p className="text-xs text-gray-400 mt-1 italic leading-relaxed">"{tx.description}"</p>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-medium">{formatTime(tx.time)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-50 bg-gray-50/30">
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">النوع</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الفئة / الملاحظات</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الطالب</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">المبلغ</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">الوقت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {txs.map((tx, i) => (
                                        <tr key={i} className="group hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    'inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold border uppercase',
                                                    tx.type === 'INCOME'
                                                        ? 'bg-green-50 text-green-700 border-green-100'
                                                        : 'bg-red-50 text-red-600 border-red-100'
                                                )}>
                                                    {tx.type === 'INCOME' ? '↑ دخل' : '↓ مصروف'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-gray-800">
                                                    {CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category}
                                                </p>
                                                {tx.description && (
                                                    <p className="text-xs text-gray-400 mt-1 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                                        {tx.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-gray-600">{tx.studentName ?? '—'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-base font-black text-gray-900">
                                                    {tx.paidAmount.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-gray-400">ج</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-xs font-medium">{formatTime(tx.time)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Monthly Tab ──────────────────────────────────────────────────
function MonthlyTab() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [pdfLoading, setPdfLoading] = useState(false);

    const { data: ledger, isLoading } = useQuery({
        queryKey: ['monthly-ledger', year, month],
        queryFn: () => getMonthlyLedger(year, month),
    });

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const html = await fetchMonthlyReportHtml(year, month);
            printHtmlContent(html);
        } catch {
            toast.error('فشل تحميل التقرير');
        } finally {
            setPdfLoading(false);
        }
    };

    const MONTH_NAMES = [
        'يناير','فبراير','مارس','أبريل','مايو','يونيو',
        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
    ];

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    };

    const chartData = (ledger?.dailySummaries ?? [])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d) => ({
            day: new Date(d.date).getDate().toString(),
            دخل: d.totalIncome,
            مصروف: d.totalExpenses,
        }));

    return (
        <div className="space-y-4">
            {/* Month Picker */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={prevMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700 flex-1 text-center sm:min-w-[120px]">
                        {MONTH_NAMES[month - 1]} {year}
                    </span>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={nextMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    className="gap-1.5 text-xs w-full sm:w-auto"
                >
                    {pdfLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FileDown className="h-3.5 w-3.5" />
                    }
                    تحميل PDF
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="إجمالي الدخل" value={ledger?.totalIncome ?? 0} type="income" />
                <StatCard label="إجمالي المصروفات" value={ledger?.totalExpenses ?? 0} type="expense" />
                <StatCard label="الصافي" value={ledger?.netBalance ?? 0} type="net" />
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
                <h3 className="font-semibold text-gray-800 mb-4 text-sm sm:text-base">الدخل والمصروفات يومياً</h3>
                {isLoading ? (
                    <div className="flex items-center justify-center h-40 sm:h-48 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        تحميل...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-40 sm:h-48 text-gray-400 text-sm">
                        لا توجد بيانات لهذا الشهر
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}`} width={40} />
                            <Tooltip
                                formatter={(value: any) => `${(value || 0).toLocaleString('ar-EG')} ج`}
                                labelFormatter={(label) => `يوم ${label}`}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="دخل" fill="#22c55e" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="مصروف" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

// ─── Prices Tab ───────────────────────────────────────────────────
function PricesTab() {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="text-center">
                <Wallet className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-700 mb-1">أسعار الاشتراك الشهري</h3>
                <p className="text-sm text-gray-500 mb-4">
                    حدد سعر كل مرحلة دراسية ليتم احتسابه تلقائياً عند تسجيل الاشتراك
                </p>
                <PriceSettingsModal />
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function PaymentsPage() {
    const user = useAuthStore((s) => s.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';
    const isTeacher = user?.role === 'teacher';

    const [activeTab, setActiveTab] = useState<Tab>('daily');

    const tabs: { id: Tab; label: string; show: boolean }[] = [
        { id: 'daily',   label: 'الجارد اليومي',  show: true },
        { id: 'monthly', label: 'الجارد الشهري',  show: isTeacher },
        { id: 'prices',  label: 'إعداد الأسعار',  show: isTeacher },
    ];

    return (
        <div className="min-h-screen bg-gray-50/30 p-3 sm:p-4 lg:p-6" dir="rtl">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    الماليات
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {canWrite ? 'تسجيل المعاملات المالية ومتابعة الجارد اليومي' : 'متابعة الإيرادات والمصروفات'}
                </p>
            </div>

            {/* Tabs — scrollable on mobile */}
            <div className="overflow-x-auto pb-1 mb-4 sm:mb-5">
                <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit min-w-full sm:min-w-0">
                    {tabs.filter((t) => t.show).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-none',
                                activeTab === tab.id
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'daily' && <DailyTab canWrite={canWrite} />}
            {activeTab === 'monthly' && isTeacher && <MonthlyTab />}
            {activeTab === 'prices' && isTeacher && <PricesTab />}
        </div>
    );
}

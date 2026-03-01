'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyLedger, getMonthlyLedger } from '@/lib/api/payments';
import { downloadMonthlyReportPdf } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/utils/download';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth.store';
import { AddTransactionModal } from '@/components/payments/AddTransactionModal';
import { PriceSettingsModal } from '@/components/payments/PriceSettingsModal';
import { BatchSubscriptionModal } from '@/components/payments/BatchSubscriptionModal';
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
}: {
    label: string;
    value: number;
    type: 'income' | 'expense' | 'net';
}) {
    const colors = {
        income:  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', icon: TrendingUp,   iconColor: 'text-green-500' },
        expense: { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-100',   icon: TrendingDown, iconColor: 'text-red-500' },
        net:     { bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-100',  icon: Minus,        iconColor: 'text-blue-500' },
    };
    const c = colors[type];
    const Icon = c.icon;

    return (
        <div className={cn('rounded-xl border p-4 shadow-sm', c.bg, c.border)}>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <Icon className={cn('h-4 w-4', c.iconColor)} />
            </div>
            <p className={cn('text-2xl font-bold', c.text)}>
                {value.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج</span>
            </p>
        </div>
    );
}

// ─── Daily Tab ────────────────────────────────────────────────────
function DailyTab({ isAssistant }: { isAssistant: boolean }) {
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);

    const { data: ledger, isLoading, refetch } = useQuery({
        queryKey: ['daily-ledger', date],
        queryFn: () => getDailyLedger(date),
    });

    const txs = ledger?.transactions ?? [];

    const formatTime = (timeStr: string) =>
        new Date(timeStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="icon" className="h-9 w-9"
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
                        className="h-9 w-40 text-sm"
                    />
                    <Button
                        variant="outline" size="icon" className="h-9 w-9"
                        onClick={() => {
                            const d = new Date(date);
                            d.setDate(d.getDate() + 1);
                            setDate(d.toISOString().split('T')[0]!);
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
                {isAssistant && (
                    <div className="flex gap-2">
                        <BatchSubscriptionModal />
                        <AddTransactionModal onSuccess={() => refetch()} />
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="إجمالي الدخل" value={ledger?.totalIncome ?? 0} type="income" />
                <StatCard label="إجمالي المصروفات" value={ledger?.totalExpenses ?? 0} type="expense" />
                <StatCard label="الصافي" value={ledger?.netBalance ?? 0} type="net" />
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        المعاملات
                    </h3>
                    <span className="text-sm text-gray-400">{txs.length} معاملة</span>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        تحميل...
                    </div>
                ) : txs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                        <Wallet className="h-10 w-10 text-gray-200" />
                        <p className="text-sm">لا توجد معاملات في هذا اليوم</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-50 bg-gray-50/50">
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">النوع</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الفئة</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الطالب</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">المبلغ</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-600">الوقت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {txs.map((tx, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border',
                                                tx.type === 'INCOME'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : 'bg-red-50 text-red-600 border-red-100'
                                            )}>
                                                {tx.type === 'INCOME' ? '↑ دخل' : '↓ مصروف'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {tx.studentName ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-gray-800">
                                            {tx.paidAmount.toLocaleString('ar-EG')} ج
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">
                                            {formatTime(tx.time)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
            const blob = await downloadMonthlyReportPdf(year, month);
            downloadBlob(blob, `التقرير-المالي-${year}-${month}.pdf`);
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                    </span>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    className="gap-1.5 text-xs"
                >
                    {pdfLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <FileDown className="h-3.5 w-3.5" />
                    }
                    تحميل PDF
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="إجمالي الدخل" value={ledger?.totalIncome ?? 0} type="income" />
                <StatCard label="إجمالي المصروفات" value={ledger?.totalExpenses ?? 0} type="expense" />
                <StatCard label="الصافي" value={ledger?.netBalance ?? 0} type="net" />
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">الدخل والمصروفات يومياً</h3>
                {isLoading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        تحميل...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                        لا توجد بيانات لهذا الشهر
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                            <Tooltip
                                formatter={(value: number) => [`${value.toLocaleString('ar-EG')} ج`]}
                                labelFormatter={(label) => `يوم ${label}`}
                            />
                            <Legend />
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
    const isAssistant = user?.role === 'assistant';
    const isTeacher = user?.role === 'teacher';

    const [activeTab, setActiveTab] = useState<Tab>('daily');

    const tabs: { id: Tab; label: string; show: boolean }[] = [
        { id: 'daily',   label: 'الجارد اليومي',  show: true },
        { id: 'monthly', label: 'الجارد الشهري',  show: isTeacher },
        { id: 'prices',  label: 'إعداد الأسعار',  show: isTeacher },
    ];

    return (
        <div className="min-h-screen bg-gray-50/30 p-6" dir="rtl">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-primary" />
                    الماليات
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {isAssistant ? 'تسجيل المعاملات المالية ومتابعة الجارد اليومي' : 'متابعة الإيرادات والمصروفات'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-5 shadow-sm w-fit">
                {tabs.filter((t) => t.show).map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'daily' && <DailyTab isAssistant={isAssistant} />}
            {activeTab === 'monthly' && isTeacher && <MonthlyTab />}
            {activeTab === 'prices' && isTeacher && <PricesTab />}
        </div>
    );
}

'use client';

import { Loader2, Receipt, TrendingUp, BookOpen, CreditCard, Tag, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Props {
    reportLoading: boolean;
    report: any;
}

const CATEGORY_LABELS: Record<string, string> = {
    SUBSCRIPTION:  'اشتراك منصة',
    NOTEBOOK_SALE: 'شراء مذكرة',
    EXPENSE:       'مصروف',
};

const CATEGORY_ICONS: Record<string, any> = {
    SUBSCRIPTION:  CreditCard,
    NOTEBOOK_SALE: BookOpen,
};

const CATEGORY_COLORS: Record<string, string> = {
    SUBSCRIPTION:  'bg-blue-50 border-blue-100 text-blue-600',
    NOTEBOOK_SALE: 'bg-purple-50 border-purple-100 text-purple-600',
    EXPENSE:       'bg-gray-50 border-gray-100 text-gray-600',
};

export function StudentPaymentsTab({ reportLoading, report }: Props) {
    const [typeFilter, setTypeFilter] = useState<string>('all');

    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    const history: any[] = report?.payments?.history ?? [];

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Receipt className="h-10 w-10 mb-3 text-gray-200" />
                <p className="font-medium">لا توجد مدفوعات مسجلة</p>
            </div>
        );
    }

    const totalPaid        = report?.payments?.totalPaid        ?? 0;
    const totalDiscount    = report?.payments?.totalDiscount    ?? 0;
    const subscriptionsCount = report?.payments?.subscriptionsCount ?? 0;
    const notebookSalesCount = report?.payments?.notebookSalesCount ?? 0;

    const filtered = typeFilter === 'all'
        ? history
        : history.filter((tx: any) => tx.category === typeFilter);

    return (
        <div className="space-y-5">

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Paid */}
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-3 sm:p-4 border border-green-100 relative overflow-hidden">
                    <div className="absolute left-[-8px] bottom-[-8px] opacity-10">
                        <Receipt className="w-16 h-16" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-green-800/60 mb-1">إجمالي المدفوع</p>
                        <p className="text-lg sm:text-2xl font-extrabold text-green-700 leading-none">
                            {totalPaid.toLocaleString('ar-EG')}
                            <span className="text-[10px] font-bold opacity-70 mr-1">ج.م</span>
                        </p>
                    </div>
                </div>

                {/* Total Discount */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-3 sm:p-4 border border-orange-100 relative overflow-hidden">
                    <div className="absolute left-[-8px] bottom-[-8px] opacity-10">
                        <Tag className="w-16 h-16" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-orange-800/60 mb-1">إجمالي الخصومات</p>
                        <p className="text-lg sm:text-2xl font-extrabold text-orange-600 leading-none">
                            {totalDiscount.toLocaleString('ar-EG')}
                            <span className="text-[10px] font-bold opacity-70 mr-1">ج.م</span>
                        </p>
                    </div>
                </div>

                {/* Subscriptions Count */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-3 sm:p-4 border border-blue-100 relative overflow-hidden">
                    <div className="absolute left-[-8px] bottom-[-8px] opacity-10">
                        <CreditCard className="w-16 h-16" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-blue-800/60 mb-1">الاشتراكات</p>
                        <p className="text-lg sm:text-2xl font-extrabold text-blue-700 leading-none">
                            {subscriptionsCount}
                            <span className="text-[10px] font-bold opacity-70 mr-1">اشتراك</span>
                        </p>
                    </div>
                </div>

                {/* Notebooks Count */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-3 sm:p-4 border border-purple-100 relative overflow-hidden">
                    <div className="absolute left-[-8px] bottom-[-8px] opacity-10">
                        <BookOpen className="w-16 h-16" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-purple-800/60 mb-1">مذكرات</p>
                        <p className="text-lg sm:text-2xl font-extrabold text-purple-700 leading-none">
                            {notebookSalesCount}
                            <span className="text-[10px] font-bold opacity-70 mr-1">مذكرة</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'all',           label: 'الكل' },
                    { key: 'SUBSCRIPTION',  label: 'اشتراكات' },
                    { key: 'NOTEBOOK_SALE', label: 'مذكرات' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTypeFilter(key)}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-bold transition-all border',
                            typeFilter === key
                                ? 'bg-[#0f4c81] text-white border-[#0f4c81]'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#0f4c81]/30'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Transaction History ── */}
            <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3 px-1">سجل المعاملات</h3>
                <div className="grid gap-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                            <p className="text-xs font-medium">لا توجد معاملات بهذا التصنيف</p>
                        </div>
                    ) : (
                        filtered.map((tx: any, i: number) => {
                            const Icon = CATEGORY_ICONS[tx.category] ?? Receipt;
                            const colorClass = CATEGORY_COLORS[tx.category] ?? 'bg-gray-50 border-gray-100 text-gray-500';
                            const hasDiscount = (tx.discountAmount ?? 0) > 0;

                            return (
                                <div
                                    key={i}
                                    className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">
                                                {CATEGORY_LABELS[tx.category] ?? tx.category}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 font-medium">
                                                {new Date(tx.date).toLocaleDateString('ar-EG', {
                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                })}
                                            </p>
                                            {tx.description && (
                                                <p className="text-[11px] text-gray-400 mt-0.5 italic">{tx.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amounts */}
                                    <div className="text-left shrink-0">
                                        <p className="text-[15px] font-bold text-gray-900">
                                            {(tx.paidAmount ?? 0).toLocaleString('ar-EG')} ج
                                        </p>
                                        {hasDiscount && (
                                            <p className="text-[11px] text-orange-500 font-medium flex items-center gap-0.5 justify-end">
                                                <ArrowDownLeft className="h-3 w-3" />
                                                خصم {(tx.discountAmount).toLocaleString('ar-EG')} ج
                                            </p>
                                        )}
                                        {tx.originalAmount && tx.originalAmount !== tx.paidAmount && (
                                            <p className="text-[10px] text-gray-300 line-through text-left">
                                                {(tx.originalAmount).toLocaleString('ar-EG')} ج
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

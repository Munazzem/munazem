import { Loader2, Receipt, TrendingUp, BookOpen, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    reportLoading: boolean;
    report: any;
}

export function StudentPaymentsTab({ reportLoading, report }: Props) {
    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    if (!report?.payments?.history?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Receipt className="h-10 w-10 mb-3 text-gray-200" />
                <p className="font-medium">لا توجد مدفوعات مسجلة</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-4 sm:p-5 border border-green-100 relative overflow-hidden">
                    <div className="absolute left-[-10px] bottom-[-10px] opacity-10"><Receipt className="w-20 h-20 sm:w-24 sm:h-24" /></div>
                    <div className="relative z-10">
                        <p className="text-xl sm:text-3xl font-extrabold text-green-700 drop-shadow-sm">
                            {report.payments.totalPaid.toLocaleString('ar-EG')} <span className="text-xs sm:text-sm font-bold opacity-70">ج.م</span>
                        </p>
                        <p className="text-[10px] sm:text-xs text-green-800/70 mt-1 font-bold">إجمالي المدفوعات للمنصة</p>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 sm:p-5 border border-orange-100 relative overflow-hidden">
                    <div className="absolute left-[-10px] bottom-[-10px] opacity-10"><TrendingUp className="w-20 h-20 sm:w-24 sm:h-24" /></div>
                    <div className="relative z-10">
                        <p className="text-xl sm:text-3xl font-extrabold text-orange-600 drop-shadow-sm">
                            {report.payments.totalDiscount.toLocaleString('ar-EG')} <span className="text-xs sm:text-sm font-bold opacity-70">ج.م</span>
                        </p>
                        <p className="text-[10px] sm:text-xs text-orange-800/70 mt-1 font-bold">إجمالي الخصومات</p>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 className="text-sm font-bold text-gray-700 mb-4 px-1">سجل المعاملات</h3>
                <div className="grid gap-3">
                    {report.payments.history.map((tx: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border',
                                    tx.category === 'SUBSCRIPTION' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-purple-50 border-purple-100 text-purple-600'
                                )}>
                                    {tx.category === 'SUBSCRIPTION'
                                        ? <CreditCard className="h-5 w-5" />
                                        : <BookOpen className="h-5 w-5" />
                                    }
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">
                                        {tx.category === 'SUBSCRIPTION' ? 'اشتراك منصة' : 'شراء مذكرة'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                        {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="text-[15px] font-bold text-gray-900">{tx.paidAmount.toLocaleString('ar-EG')} ج</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

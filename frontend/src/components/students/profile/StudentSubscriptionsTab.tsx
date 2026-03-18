import { Loader2, BookOpen } from 'lucide-react';

interface Props {
    reportLoading: boolean;
    report: any;
}

export function StudentSubscriptionsTab({ reportLoading, report }: Props) {
    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    if (!report?.payments?.subscriptions?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookOpen className="h-10 w-10 mb-3 text-gray-200" />
                <p className="font-medium">لا توجد اشتراكات مسجلة</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-gray-400" />
                <p className="text-sm font-bold text-gray-700">سجل الاشتراكات المشتراة <span className="text-gray-400 font-normal">({report.payments.subscriptionsCount})</span></p>
            </div>
            <div className="grid gap-3">
                {report.payments.subscriptions.map((sub: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm hover:border-gray-200 transition-colors">
                        <div>
                            <p className="text-sm font-bold text-gray-800">
                                {new Date(sub.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            {sub.description && (
                                <p className="text-xs text-gray-500 mt-1 font-medium bg-gray-50 inline-block px-2 py-0.5 rounded-md">{sub.description}</p>
                            )}
                        </div>
                        <div className="text-left bg-green-50/50 px-4 py-2 rounded-xl border border-green-50">
                            <p className="text-sm font-bold text-green-700">{sub.paidAmount.toLocaleString('ar-EG')} ج.م</p>
                            {sub.discountAmount > 0 && (
                                <p className="text-xs text-green-600/70 font-medium">خصم {sub.discountAmount.toLocaleString('ar-EG')}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

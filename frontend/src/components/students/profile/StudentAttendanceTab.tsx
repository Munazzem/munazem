import { Loader2, History, Check, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    reportLoading: boolean;
    report: any;
}

export function StudentAttendanceTab({ reportLoading, report }: Props) {
    if (reportLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> جاري التحميل...
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText className="h-10 w-10 mb-3 text-gray-200" />
                <p className="font-medium">لا توجد بيانات حضور</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-green-50/80 rounded-2xl p-3 sm:p-4 text-center border border-green-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-green-700">{report.attendance.presentCount}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">حاضر</p>
                </div>
                <div className="bg-red-50/80 rounded-2xl p-3 sm:p-4 text-center border border-red-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-red-600">{report.attendance.absentCount}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">غائب</p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-blue-50/80 rounded-2xl p-3 sm:p-4 text-center border border-blue-100">
                    <p className="text-xl sm:text-3xl font-extrabold text-blue-700 drop-shadow-sm">{report.attendance.attendanceRate}</p>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">نسبة الحضور</p>
                </div>
            </div>
            
            {report.attendance.history?.length > 0 && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-gray-400 shrink-0" />
                            <p className="text-sm font-bold text-gray-700">سجل آخر {report.attendance.history.length} حصة</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-2.5">
                        {report.attendance.history.map((h: any, i: number) => {
                            const isPresent = h.status === 'PRESENT';
                            const isAbsent = h.status === 'ABSENT';
                            return (
                                <div
                                    key={i}
                                    title={new Date(h.date).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    className={cn(
                                        'w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold border-2 transition-all cursor-help',
                                        isPresent ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' :
                                        isAbsent  ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' :
                                        'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                    )}
                                >
                                    {isPresent ? <Check className="h-5 w-5" /> : isAbsent ? <AlertCircle className="h-4 w-4" /> : '—'}
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium"><div className="w-2.5 h-2.5 rounded-full bg-green-400"></div> حاضر</span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> غائب</span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto mr-auto">(من اليمين: الأحدث)</span>
                    </div>
                </div>
            )}
        </div>
    );
}

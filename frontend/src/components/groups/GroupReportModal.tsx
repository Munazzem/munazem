'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGroupReport, fetchGroupReportHtml } from '@/lib/api/reports';
import { printHtmlContent } from '@/lib/utils/print';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Users,
    CalendarCheck,
    TrendingUp,
    FileDown,
    Loader2,
    Clock,
} from 'lucide-react';

interface GroupReportModalProps {
    groupId: string | null;
    groupName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CATEGORY_AR: Record<string, string> = {
    SUBSCRIPTION:  'اشتراكات',
    NOTEBOOK_SALE: 'مذكرات',
    OTHER_INCOME:  'أخرى',
};

export function GroupReportModal({ groupId, groupName, open, onOpenChange }: GroupReportModalProps) {
    const [pdfLoading, setPdfLoading] = useState(false);

    const { data: report, isLoading } = useQuery({
        queryKey: ['groupReport', groupId],
        queryFn: () => fetchGroupReport(groupId!),
        enabled: !!groupId && open,
        staleTime: 2 * 60 * 1000,
    });

    const handleDownloadPdf = async () => {
        if (!groupId) return;
        setPdfLoading(true);
        try {
            const html = await fetchGroupReportHtml(groupId);
            printHtmlContent(html);
        } catch {
            toast.error('فشل تحميل التقرير');
        } finally {
            setPdfLoading(false);
        }
    };

    const totalRevenue = report?.revenue?.breakdown?.reduce(
        (sum: number, b: any) => sum + b.total, 0
    ) ?? 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[560px] rounded-2xl" dir="rtl">
                {/* Accent bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-[#0f4c81] to-[#3b82f6] rounded-t-2xl" />

                <DialogHeader className="pt-3">
                    <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
                        <CalendarCheck className="h-5 w-5 text-primary" />
                        تقرير مجموعة: {groupName}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-14 text-gray-400">
                        <Loader2 className="h-7 w-7 animate-spin ml-2" />
                        جاري التحميل...
                    </div>
                ) : report ? (
                    <div className="space-y-4 mt-1">
                        {/* Group meta */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 text-xs">
                                {report.group.gradeLevel}
                            </Badge>
                            {report.group.schedule?.map((s: any, i: number) => (
                                <span key={i} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                    <Clock className="h-3 w-3" />
                                    {s.day} · {s.time}
                                </span>
                            ))}
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-blue-700">{report.group.totalStudents}</p>
                                <p className="text-xs text-gray-500 mt-0.5">طالب نشط</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 text-center">
                                <CalendarCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-green-700">{report.attendance.totalSessions}</p>
                                <p className="text-xs text-gray-500 mt-0.5">حصة مكتملة</p>
                            </div>
                            <div className="bg-indigo-50 rounded-xl p-4 text-center">
                                <TrendingUp className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-indigo-700">{report.attendance.avgAttendanceRate}</p>
                                <p className="text-xs text-gray-500 mt-0.5">متوسط الحضور</p>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                <TrendingUp className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-emerald-700">
                                    {totalRevenue.toLocaleString('ar-EG')}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">إجمالي الإيرادات (ج.م)</p>
                            </div>
                        </div>

                        {/* Attendance breakdown */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div className="text-center">
                                <p className="text-lg font-bold text-green-700">{report.attendance.totalPresences}</p>
                                <p className="text-xs text-gray-400">حضور</p>
                            </div>
                            <div className="h-8 w-px bg-gray-200" />
                            <div className="text-center">
                                <p className="text-lg font-bold text-red-600">{report.attendance.totalAbsences}</p>
                                <p className="text-xs text-gray-400">غياب</p>
                            </div>
                            <div className="h-8 w-px bg-gray-200" />
                            <div className="text-center">
                                <p className="text-lg font-bold text-gray-700">
                                    {report.attendance.totalPresences + report.attendance.totalAbsences}
                                </p>
                                <p className="text-xs text-gray-400">إجمالي</p>
                            </div>
                        </div>

                        {/* Revenue breakdown */}
                        {report.revenue?.breakdown?.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">تفاصيل الإيرادات</p>
                                {report.revenue.breakdown.map((b: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-sm text-gray-700">{CATEGORY_AR[b._id] ?? b._id}</span>
                                            <span className="text-xs text-gray-400">({b.count} معاملة)</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">
                                            {b.total.toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Download PDF */}
                        <div className="flex justify-end pt-1">
                            <Button
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading}
                                className="gap-2 bg-[#0f4c81] hover:bg-[#0a3357] text-white"
                            >
                                {pdfLoading
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <FileDown className="h-4 w-4" />
                                }
                                تحميل PDF
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-400 py-10 text-sm">لا توجد بيانات للمجموعة</p>
                )}
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { getStudentByCardToken } from '@/lib/api/cards';
import { Loader2, CreditCard, AlertCircle, Calendar, Wallet, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function CardPortalPage({ params }: { params: { token: string } }) {
    const { token } = params;

    const { data: student, isLoading, isError, error } = useQuery({
        queryKey: ['card-token-summary', token],
        queryFn: () => getStudentByCardToken(token),
        retry: 1, // Do not retry many times for public routes
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-gray-500 font-medium">جاري جلب بيانات الطالب...</p>
            </div>
        );
    }

    if (isError) {
        const msg = (error as any)?.response?.data?.message || 'لم يتم العثور على الكارت أو غير مربوط بطالب';
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">خطأ في قراءة الكارت</h2>
                    <p className="text-gray-500">{msg}</p>
                </div>
                <Link href="/parent" className="text-primary hover:underline text-sm mt-4 inline-block font-medium">
                    العودة لبوابة ولي الأمر
                </Link>
            </div>
        );
    }

    if (!student) return null;

    const debtColor = student.totalDebt > 0 ? 'text-red-600' : 'text-green-600';

    return (
        <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Page title */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-3 shadow-sm">
                    <CreditCard className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">الكارت الذكي</h2>
                <p className="text-sm text-gray-500 mt-1">ملخص بيانات الطالب</p>
            </div>

            {/* Student Card */}
            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-l from-primary/90 to-primary px-6 py-5 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black shadow-inner">
                            {student.studentName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-xl font-bold">{student.studentName}</p>
                            <p className="text-sm text-white/80 mt-0.5">{student.studentCode} · {student.gradeLevel}</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* Status badges */}
                    <div className="flex gap-2 mb-2">
                         <Badge className={cn(
                            'text-xs py-1 px-3',
                            student.hasActiveSubscription
                                ? 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200'
                                : 'bg-red-100 text-red-600 hover:bg-red-100 border-red-200'
                        )}>
                            {student.hasActiveSubscription ? 'اشتراك فعّال' : 'الاشتراك منتهي'}
                        </Badge>
                        <Badge variant="outline" className="text-xs py-1 px-3 border-gray-200 text-gray-600">
                            {student.groupName}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5 font-medium">
                                <Calendar className="h-3.5 w-3.5" /> الحصص المتبقية
                            </p>
                            <p className="text-lg font-black text-gray-800">{student.remainingSessions}</p>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5 font-medium">
                                <Wallet className="h-3.5 w-3.5" /> المديونية
                            </p>
                            <p className={cn('text-lg font-black', debtColor)}>
                                {student.totalDebt} <span className="text-xs font-normal">ج.م</span>
                            </p>
                        </div>
                    </div>

                    {(student.lastAttendanceDate || student.lastPaymentDate) && (
                        <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">آخر التحديثات</h3>
                            
                            {student.lastAttendanceDate && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80">
                                    <div className="flex items-center gap-2.5">
                                        {student.lastAttendanceStatus === 'PRESENT' 
                                            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            : <XCircle className="h-5 w-5 text-red-400" />
                                        }
                                        <span className="text-sm font-medium text-gray-700">آخر حصة</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900">
                                            {student.lastAttendanceStatus === 'PRESENT' ? 'حاضر' : 'غائب'}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {new Date(student.lastAttendanceDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {student.lastPaymentDate && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80">
                                    <div className="flex items-center gap-2.5">
                                        <Wallet className="h-5 w-5 text-blue-500" />
                                        <span className="text-sm font-medium text-gray-700">آخر دفعة</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900">
                                            {student.lastPaymentAmount} ج.م
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            {new Date(student.lastPaymentDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center">
                <Link href="/parent" className="text-primary hover:underline text-sm font-medium">
                    عرض التفاصيل الكاملة في بوابة ولي الأمر
                </Link>
            </div>
        </div>
    );
}

'use client';

import { CalendarDays, Activity, UserCheck, CreditCard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySummaryProps {
    data: {
        sessionsCount: number;
        totalPresent: number;
        subscriptionsCount: number;
        financial: {
            netBalance: number;
        };
    };
    isTeacher: boolean;
}

export function DailySummary({ data, isTeacher }: DailySummaryProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                    <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    ملخص اليوم
                </h3>
                <span className="text-xs text-gray-400">
                    {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-gray-50">
                <div className="p-3 sm:p-5 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.sessionsCount.toLocaleString('en-US')}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">حصص منتهية</p>
                </div>
                <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                    <div className="flex justify-center mb-2">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-green-50 flex items-center justify-center">
                            <UserCheck className="h-4 w-4 text-green-600" />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.totalPresent.toLocaleString('en-US')}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">طالب حضر</p>
                </div>
                <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                    <div className="flex justify-center mb-2">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-indigo-600" />
                        </div>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{data.subscriptionsCount.toLocaleString('en-US')}</p>
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">اشتراك سُجِّل</p>
                </div>
                {isTeacher && (
                    <div className="p-3 sm:p-5 text-center border-r border-gray-50">
                        <div className="flex justify-center mb-2">
                            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Wallet className="h-4 w-4 text-emerald-600" />
                            </div>
                        </div>
                        <p className={cn(
                            'text-2xl font-bold',
                            data.financial.netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                        )}>
                            {data.financial.netBalance.toLocaleString('en-US')}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">صافي مالي (ج.م)</p>
                    </div>
                )}
            </div>
        </div>
    );
}

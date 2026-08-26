'use client';

import { CalendarDays, Activity, UserCheck, CreditCard, Wallet, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySummaryProps {
    data?: {
        sessionsCount?: number;
        totalPresent?: number;
        subscriptionsCount?: number;
        notebooksSoldQuantity?: number;
        stats?: {
            subscriptionsCount?: number;
            notebooksSoldQuantity?: number;
            totalIncome?: number;
            totalExpenses?: number;
            netBalance?: number;
        };
        financial?: {
            totalIncome?: number;
            totalExpenses?: number;
            netBalance?: number;
        };
    };
    isTeacher: boolean;
}

export function DailySummary({ data, isTeacher }: DailySummaryProps) {
    if (!data) return null;

    const sessionsCount = data.sessionsCount ?? 0;
    const totalPresent = data.totalPresent ?? 0;
    const subscriptionsCount = data.subscriptionsCount ?? data.stats?.subscriptionsCount ?? 0;
    const notebooksCount = data.notebooksSoldQuantity ?? data.stats?.notebooksSoldQuantity ?? 0;
    const netBalance = data.financial?.netBalance ?? data.stats?.netBalance ?? 0;
    const totalIncome = data.financial?.totalIncome ?? data.stats?.totalIncome ?? 0;

    return (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-gray-100/80 shadow-xs overflow-hidden">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50/70 via-white to-primary/5 gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">ملخص نشاط اليوم</h3>
                        <p className="text-[11px] text-gray-400">مؤشرات الأداء المباشرة للحصص والماليات</p>
                    </div>
                </div>
                <span className="text-xs font-semibold text-gray-500 bg-white border border-gray-200/80 px-3 py-1 rounded-full shadow-2xs">
                    {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
            </div>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-gray-100">
                {/* 1. Completed Sessions */}
                <div className="p-4 sm:p-5 flex items-center justify-between sm:flex-col sm:items-center text-right sm:text-center hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center sm:flex-col gap-3 sm:gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500">حصص اليوم المنتهية</p>
                            <p className="text-2xl font-black text-gray-900 mt-0.5">{sessionsCount.toLocaleString('en-US')}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100/60">
                        مكتملة
                    </span>
                </div>

                {/* 2. Total Attendance */}
                <div className="p-4 sm:p-5 flex items-center justify-between sm:flex-col sm:items-center text-right sm:text-center hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center sm:flex-col gap-3 sm:gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                            <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500">حضور الطلاب اليوم</p>
                            <p className="text-2xl font-black text-gray-900 mt-0.5">{totalPresent.toLocaleString('en-US')}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100/60">
                        حاضر فعلياً
                    </span>
                </div>

                {/* 3. Subscriptions & Notebooks */}
                <div className="p-4 sm:p-5 flex items-center justify-between sm:flex-col sm:items-center text-right sm:text-center hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center sm:flex-col gap-3 sm:gap-2">
                        <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500">حركات الاشتراكات والمذكرات</p>
                            <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
                                <span className="text-2xl font-black text-gray-900">{subscriptionsCount + notebooksCount}</span>
                                <span className="text-[11px] text-gray-400 font-medium">({subscriptionsCount} اشتراك · {notebooksCount} مذكرة)</span>
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/60">
                        معاملات مسجلة
                    </span>
                </div>

                {/* 4. Net Balance (Teacher Only) */}
                {isTeacher ? (
                    <div className="p-4 sm:p-5 flex items-center justify-between sm:flex-col sm:items-center text-right sm:text-center hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center sm:flex-col gap-3 sm:gap-2">
                            <div className={cn(
                                "h-10 w-10 rounded-2xl flex items-center justify-center shadow-xs",
                                netBalance >= 0 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                            )}>
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500">صافي خزينة اليوم</p>
                                <p className={cn(
                                    'text-2xl font-black mt-0.5',
                                    netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                                )}>
                                    {netBalance.toLocaleString('en-US')} <span className="text-xs font-bold text-gray-500">ج.م</span>
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                            إيراد: {totalIncome.toLocaleString('en-US')} ج
                        </span>
                    </div>
                ) : (
                    <div className="p-4 sm:p-5 flex items-center justify-between sm:flex-col sm:items-center text-right sm:text-center hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center sm:flex-col gap-3 sm:gap-2">
                            <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500">مبيعات المذكرات</p>
                                <p className="text-2xl font-black text-gray-900 mt-0.5">{notebooksCount}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            نسخة مباعة
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

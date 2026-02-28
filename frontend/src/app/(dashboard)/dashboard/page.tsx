'use client';

import { useAuthStore } from '@/lib/store/auth.store';
import { Users, GraduationCap, ArrowUpRight, Activity, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { fetchDashboardStats, DashboardData } from '@/lib/api/dashboard';

export default function DashboardPage() {
    const user = useAuthStore((state) => state.user);

    const { data: stats, isLoading, isError } = useQuery<DashboardData>({
        queryKey: ['dashboardStats'],
        queryFn: fetchDashboardStats,
        refetchInterval: 5 * 60 * 1000, // Fetch every 5 minutes automatically
    });

    if (isLoading) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center text-primary">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="font-bold text-gray-500">جاري تحميل البيانات الحية...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100 font-bold">
                حدث خطأ أثناء تحميل بيانات لوحة التحكم
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Intro */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">نظرة عامة</h1>
                <p className="text-gray-500 mt-1">حالة المنصة التعليمية لليوم.</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat Card 1 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">إجمالي الطلاب</span>
                        <div className="h-10 w-10 bg-blue-50 text-primary flex items-center justify-center rounded-xl">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</span>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">مجموعات العمل</span>
                        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-xl">
                            <GraduationCap size={20} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-900">{stats?.totalGroups || 0}</span>
                    </div>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-500">حصص الشهر الحالي</span>
                        <div className="h-10 w-10 bg-orange-50 text-orange-600 flex items-center justify-center rounded-xl">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-900">{stats?.sessionsThisMonth || 0}</span>
                    </div>
                </div>

                {/* Stat Card 4 (Revenue - Teacher/SuperAdmin Only) */}
                {(user?.role === 'SUPER_ADMIN' || user?.role === 'TEACHER') && (
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400"></div>
                        
                        <div className="flex items-center justify-between relative z-10">
                            <span className="text-sm font-medium text-gray-500">إجمالي الدخل</span>
                            <div className="h-10 w-10 bg-green-50 text-green-600 flex items-center justify-center rounded-xl">
                                <ArrowUpRight size={20} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-end justify-between relative z-10">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-extrabold text-primary">{stats?.financial?.totalIncome?.toLocaleString() || 0}</span>
                                <span className="text-sm text-gray-500 font-medium">ج.م</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error handling for assistants */}
            {stats?.message && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-primary font-medium flex items-center gap-3">
                    <Activity size={20} />
                    {stats.message}
                </div>
            )}

            {/* Income & Group Charts Area */}
            {stats?.charts && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* Income Trend Chart (Bar-like representation) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                            <h3 className="font-bold text-gray-900 text-lg">اتجاه الأرباح (آخر 6 شهور)</h3>
                            <Activity className="h-5 w-5 text-gray-400" />
                        </div>
                        
                        {stats.charts.incomeTrend?.length > 0 ? (
                            <div className="flex items-end justify-between h-48 gap-2 pt-4">
                                {stats.charts.incomeTrend.map((trend, i) => {
                                    // Find max value to calculate percentage heights dynamically
                                    const maxIncome = Math.max(...(stats.charts?.incomeTrend.map(t => t.income) || [1]));
                                    const heightPercentage = Math.max((trend.income / maxIncome) * 100, 5); // Minimum 5% height

                                    return (
                                        <div key={i} className="flex flex-col items-center flex-1 group relative">
                                            {/* Tooltip on hover */}
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap transition-opacity pointer-events-none">
                                                {trend.income.toLocaleString()} جنيه
                                            </div>
                                            
                                            <div 
                                                className="w-full bg-primary/20 hover:bg-primary transition-colors duration-300 rounded-t-md cursor-pointer"
                                                style={{ height: `${heightPercentage}%` }}
                                            />
                                            <span className="text-xs text-gray-500 mt-2 font-medium">{trend.month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                لا توجد بيانات مالية سابقة لعرضها
                            </div>
                        )}
                    </div>

                    {/* Students Per Group Distribution */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4 text-lg">توزيع الطلاب</h3>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                            {stats.charts.studentsPerGroup?.length > 0 ? (
                                stats.charts.studentsPerGroup.map((group, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                                            <p className="text-sm font-medium text-gray-700">{group.groupName}</p>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded-md">
                                            {group.studentCount} طالب
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-400 mt-10">لا يوجد طلاب مسجلين بعد</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

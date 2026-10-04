'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
    Users,
    GraduationCap,
    BookOpen,
    CalendarCheck,
    Wallet,
    TrendingUp,
    ShieldCheck,
    Plus,
    ArrowUpRight,
    Sparkles,
    CreditCard,
    QrCode,
    CheckCircle2,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import {
    fetchCenterTeachers,
    fetchCenterPackages,
    fetchCenterGroups,
    fetchCenterEnrollments,
    fetchCenterFinancialSummary,
} from '@/lib/api/centers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CenterDashboardCalendar } from '@/components/dashboard/CenterDashboardCalendar';

export default function CenterDashboardPage() {
    const user = useAuthStore((s) => s.user);

    const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: packages = [], isLoading: loadingPackages } = useQuery({
        queryKey: ['center', 'packages'],
        queryFn: () => fetchCenterPackages({ isActive: true }),
    });

    const { data: groups = [], isLoading: loadingGroups } = useQuery({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });

    const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
        queryKey: ['center', 'enrollments'],
        queryFn: () => fetchCenterEnrollments({ isActive: true }),
    });

    const { data: financials, isLoading: loadingFinancials } = useQuery({
        queryKey: ['center', 'financials-summary'],
        queryFn: () => fetchCenterFinancialSummary(),
    });

    const isLoading = loadingTeachers || loadingPackages || loadingGroups || loadingEnrollments || loadingFinancials;


    const totalStudents = enrollments.length;
    const packageStudentsCount = enrollments.filter((e) => e.type === 'PACKAGE' || e.type === 'BOTH').length;
    const privateStudentsCount = enrollments.filter((e) => e.type === 'PRIVATE' || e.type === 'BOTH').length;

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* ── Top Header & Greeting ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            نظام إدارة المراكز التعليمية
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">
                        مرحباً بك، {user?.name}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        نظرة شاملة ومباشرة على أداء السنتر والفصول والماليات اليوم.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BranchSwitcher />
                    <Link href="/center/attendance">
                        <Button className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm">
                            <QrCode className="h-4 w-4" />
                            التحضير السريع
                        </Button>
                    </Link>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Students Card */}
                <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">إجمالي طلاب السنتر</span>
                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Users className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-gray-900 tracking-tight">
                            {isLoading ? '...' : totalStudents}
                        </span>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-medium">
                            <span className="text-blue-600 font-bold">{packageStudentsCount} باقات</span>
                            <span>•</span>
                            <span className="text-purple-600 font-bold">{privateStudentsCount} برايفت</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                </div>

                {/* 2. Teachers Card */}
                <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">طاقم المدرسين</span>
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <GraduationCap className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-gray-900 tracking-tight">
                            {isLoading ? '...' : teachers.length}
                        </span>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-medium">
                            <span className="text-emerald-600 font-bold">{groups.length} مجموعة دراسية</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                </div>

                {/* 3. Packages Card */}
                <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">الباقات التعليمية</span>
                        <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                            <BookOpen className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-gray-900 tracking-tight">
                            {isLoading ? '...' : packages.length}
                        </span>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-medium">
                            <span className="text-amber-600 font-bold">لجميع المراحل الدراسية</span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                </div>

                {/* 4. Revenue Card */}
                <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">إجمالي تحصيلات السنتر</span>
                        <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                            <Wallet className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-gray-900 tracking-tight">
                            {isLoading ? '...' : `${(financials?.totalRevenue || 0).toLocaleString()} ج.م`}
                        </span>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-medium">
                            {financials?.totalDebt ? (
                                <span className="text-rose-600 font-bold">متبقي: {financials.totalDebt.toLocaleString()} ج.م</span>
                            ) : (
                                <span className="text-emerald-600 font-bold">مكتمل التحصيل</span>
                            )}
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                </div>
            </div>

            {/* ── Quick Actions Grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link href="/center/attendance" className="bg-white hover:bg-primary/5 p-4 rounded-xl border border-gray-200/80 transition-all flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                        <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800">تسجيل حضور</h4>
                        <p className="text-[10px] text-gray-400">باركود أو يدوي</p>
                    </div>
                </Link>

                <Link href="/center/enrollments" className="bg-white hover:bg-emerald-50/50 p-4 rounded-xl border border-gray-200/80 transition-all flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800">اشتراك طالب</h4>
                        <p className="text-[10px] text-gray-400">باقة أو برايفت</p>
                    </div>
                </Link>

                <Link href="/center/financials" className="bg-white hover:bg-violet-50/50 p-4 rounded-xl border border-gray-200/80 transition-all flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800">دفع المصروفات</h4>
                        <p className="text-[10px] text-gray-400">تسجيل وتأكيد</p>
                    </div>
                </Link>

                <Link href="/center/groups" className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-gray-200/80 transition-all flex items-center gap-3 group">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Plus className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-800">إضافة مجموعة</h4>
                        <p className="text-[10px] text-gray-400">جدول ومواعيد</p>
                    </div>
                </Link>
            </div>

            {/* ── Interactive Calendar & Scheduling Hub ── */}
            <CenterDashboardCalendar groups={groups} teachers={teachers} isLoading={loadingGroups} />

            {/* ── Lower Section: Financials Breakdown & Center Insights ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Financial Overview (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    توزيع إيرادات وتحصيلات السنتر
                                </h3>
                                <p className="text-xs text-gray-500">تفصيل الإيراد بحسب نوع الاشتراك الدراسي</p>
                            </div>
                            <Badge variant="outline" className="text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                                إجمالي: {(financials?.totalRevenue || 0).toLocaleString()} ج.م
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                                <div className="flex items-center justify-between text-xs font-bold mb-1 text-blue-700">
                                    <span>اشتراكات الباقات</span>
                                    <span>{financials?.totalRevenue ? Math.min(100, Math.round(((financials?.packageRevenue || 0) / financials.totalRevenue) * 100)) : 0}%</span>
                                </div>
                                <p className="text-xl font-black text-blue-900">{(financials?.packageRevenue || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
                                <div className="h-1.5 rounded-full bg-blue-200/60 overflow-hidden mt-3">
                                    <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{
                                            width: `${financials?.totalRevenue ? Math.min(100, Math.round(((financials?.packageRevenue || 0) / financials.totalRevenue) * 100)) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                                <div className="flex items-center justify-between text-xs font-bold mb-1 text-purple-700">
                                    <span>اشتراكات البرايفت</span>
                                    <span>{financials?.totalRevenue ? Math.min(100, Math.round(((financials?.privateRevenue || 0) / financials.totalRevenue) * 100)) : 0}%</span>
                                </div>
                                <p className="text-xl font-black text-purple-900">{(financials?.privateRevenue || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
                                <div className="h-1.5 rounded-full bg-purple-200/60 overflow-hidden mt-3">
                                    <div
                                        className="h-full bg-purple-600 rounded-full"
                                        style={{
                                            width: `${financials?.totalRevenue ? Math.min(100, Math.round(((financials?.privateRevenue || 0) / financials.totalRevenue) * 100)) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                <div className="flex items-center justify-between text-xs font-bold mb-1 text-amber-700">
                                    <span>الاشتراكات المجمعة</span>
                                    <span>{financials?.totalRevenue ? Math.min(100, Math.round(((financials?.combinedRevenue || 0) / financials.totalRevenue) * 100)) : 0}%</span>
                                </div>
                                <p className="text-xl font-black text-amber-900">{(financials?.combinedRevenue || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span></p>
                                <div className="h-1.5 rounded-full bg-amber-200/60 overflow-hidden mt-3">
                                    <div
                                        className="h-full bg-amber-600 rounded-full"
                                        style={{
                                            width: `${financials?.totalRevenue ? Math.min(100, Math.round(((financials?.combinedRevenue || 0) / financials.totalRevenue) * 100)) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">للاطلاع على كشوف الحسابات وتفاصيل الديون والسندات</span>
                        <Link href="/center/financials">
                            <Button variant="outline" size="sm" className="text-xs font-bold text-gray-700 rounded-xl gap-2">
                                <span>تقرير الحسابات التفصيلي</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Center Quick Reports & Statistics (1 col) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            تقارير ومؤشرات سريعة
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">الوصول السريع إلى كشوفات السنتر الرئيسية</p>

                        <div className="space-y-2.5">
                            <Link href="/center/reports" className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all group">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">تقارير السنتر الشاملة</span>
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary transition-colors" />
                            </Link>

                            <Link href="/center/cards" className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-emerald-50/50 hover:border-emerald-200 border border-transparent transition-all group">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                                        <QrCode className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">إصدار وطباعة كروت الطلاب</span>
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                            </Link>

                            <Link href="/center/groups" className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-blue-50/50 hover:border-blue-200 border border-transparent transition-all group">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                                        <BookOpen className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-800">إدارة القاعات والمجموعات</span>
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                            </Link>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
                        <span>إجمالي المجموعات النشطة: {groups.length}</span>
                        <span>طاقم المدرسين: {teachers.length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

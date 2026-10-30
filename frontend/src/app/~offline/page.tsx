'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
    WifiOff, 
    RotateCw, 
    Users, 
    CalendarCheck, 
    Layers, 
    Send, 
    ShieldCheck, 
    ArrowLeft,
    CheckCircle2,
    BookOpen,
    Trash2,
    Building2,
    GraduationCap,
    QrCode,
    Wallet,
} from "lucide-react";
import { OfflineStorageService, OfflineStorageStats } from "@/lib/offline/storage.service";
import { useOfflineSyncStore } from "@/lib/store/offline-sync.store";
import { useAuthStore } from "@/lib/store/auth.store";
import { toast } from "sonner";

export default function OfflinePage() {
    const user = useAuthStore((s) => s.user);
    const isCenterRole = user?.role === 'centerOwner' || user?.role === 'centerSupervisor';

    const [stats, setStats] = useState<OfflineStorageStats>({
        studentsCount: 0,
        groupsCount: 0,
        sessionsCount: 0,
        examsCount: 0,
        pendingOutboxCount: 0,
        pendingMutationsCount: 0,
        lastPreloadAt: null,
    });
    const [loadingStats, setLoadingStats] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const flushQueue = useOfflineSyncStore((s) => s.flushQueue);

    const loadStats = async () => {
        try {
            const data = await OfflineStorageService.getOfflineStorageStats();
            setStats(data);
        } catch (e) {
            console.error("Failed to load offline stats:", e);
        } finally {
            setLoadingStats(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleManualSync = async () => {
        if (!navigator.onLine) {
            toast.error("لا يوجد اتصال بالإنترنت حالياً للمزامنة");
            return;
        }

        setSyncing(true);
        try {
            const result = await flushQueue();
            if (result.synced > 0) {
                toast.success(`تمت مزامنة ${result.synced} سجل بنجاح`);
            } else {
                toast.info("لا توجد سجلات جديدة تحتاج للمزامنة");
            }
            await loadStats();
        } catch {
            toast.error("تعذر إتمام المزامنة، حاول مجدداً");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-gray-950 px-4 py-8 flex flex-col justify-between items-center text-slate-800 dark:text-slate-100" dir="rtl">
            <div className="w-full max-w-2xl mx-auto space-y-6">
                
                {/* Header Status Card */}
                <div className="bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />
                    
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4 ring-8 ring-amber-500/5">
                        <WifiOff className="w-8 h-8 animate-pulse" />
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        أنت تعمل في الوضع غير المتصل (أوفلاين)
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                        لا تقلق! نظام مُنظِّم يدعم العمل الكامل بدون إنترنت. يمكنك تسجيل الحضور ومراجعة بياناتك المخزنة محلياً، وستتم مزامنة كل شيء تلقائياً فور عودة الاتصال.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                        >
                            <RotateCw className="w-4 h-4" />
                            إعادة فحص الاتصال
                        </button>

                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('munazem:preload-offline-data'));
                                setTimeout(loadStats, 2000);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition-all"
                        >
                            <RotateCw className="w-4 h-4" />
                            تحديث وتنزيل البيانات أوفلاين
                        </button>

                        {stats.pendingOutboxCount > 0 && (
                            <button
                                onClick={handleManualSync}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60"
                            >
                                <Send className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                مزامنة المعلق الآن ({stats.pendingOutboxCount})
                            </button>
                        )}
                    </div>
                </div>

                {/* Local Storage Health Overview */}
                <div className="bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            <h2 className="text-sm font-extrabold text-slate-800 dark:text-gray-100">
                                حالة البيانات المخزنة على هذا الجهاز
                            </h2>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                            IndexedDB v3
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        {isCenterRole ? (
                            <>
                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Users className="w-3.5 h-3.5 text-blue-500" />
                                        <span>طلاب السنتر</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.centerStudentsCount ?? stats.studentsCount)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                                        <span>مجموعات السنتر</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.centerGroupsCount ?? stats.groupsCount)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>مدرسي السنتر</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.centerTeachersCount ?? 0)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>باقات السنتر</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.centerPackagesCount ?? 0)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <QrCode className="w-3.5 h-3.5 text-amber-500" />
                                        <span>تسجيلات اليوم</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.centerCheckInsCount ?? 0)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Users className="w-3.5 h-3.5 text-teal-500" />
                                        <span>مشرفي السنتر</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.usersCount ?? 0)}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Users className="w-3.5 h-3.5 text-blue-500" />
                                        <span>الطلاب</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : stats.studentsCount}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                                        <span>المجموعات</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : stats.groupsCount}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>الحصص</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : stats.sessionsCount}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>الامتحانات</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : stats.examsCount}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                                        <span>المتجر والمذكرات</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.notebooksCount ?? 0)}
                                    </span>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                        <Users className="w-3.5 h-3.5 text-teal-500" />
                                        <span>المساعدين</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                                        {loadingStats ? "..." : (stats.usersCount ?? 0)}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                <Send className="w-3.5 h-3.5 text-amber-500" />
                                <span>قيد الرفع</span>
                            </div>
                            <span className={`text-lg font-black font-mono ${(stats.pendingOutboxCount + stats.pendingMutationsCount) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                {loadingStats ? "..." : (stats.pendingOutboxCount + stats.pendingMutationsCount)}
                            </span>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-gray-800/60 rounded-2xl border border-slate-100 dark:border-gray-700/50">
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 mb-1">
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>معلق للحذف</span>
                            </div>
                            <span className={`text-lg font-black font-mono ${(stats.pendingDeletionsCount ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                                {loadingStats ? "..." : (stats.pendingDeletionsCount ?? 0)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick Offline Shortcuts */}
                <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 px-1">
                        صفحات النظام المتاحة للعمل أوفلاين:
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {isCenterRole ? (
                            <>
                                <Link
                                    href="/center/attendance"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                                            <QrCode className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">بوابة التحضير</p>
                                            <p className="text-[10px] text-slate-400">باركود وبوابة السنتر</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/center/students"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">طلاب السنتر</p>
                                            <p className="text-[10px] text-slate-400">سجل وبحث الطلاب</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/center/financials"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                                            <Wallet className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الجرد والماليات</p>
                                            <p className="text-[10px] text-slate-400">اليومي والشهري</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/center/groups"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                                            <Layers className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">المجموعات</p>
                                            <p className="text-[10px] text-slate-400">الفصول والمواعيد</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/center/teachers"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                                            <GraduationCap className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">المدرسين</p>
                                            <p className="text-[10px] text-slate-400">طاقم التدريس</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/center/packages"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الباقات</p>
                                            <p className="text-[10px] text-slate-400">باقات السنتر الشهرية</p>
                                        </div>
                                    </div>
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/sessions"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                                            <CalendarCheck className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الحصص</p>
                                            <p className="text-[10px] text-slate-400">تسجيل الحضور</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/students"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الطلاب</p>
                                            <p className="text-[10px] text-slate-400">سجل وبروفايل الطلاب</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/dashboard/payments"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 group-hover:scale-105 transition-transform">
                                            <CalendarCheck className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الجرد والماليات</p>
                                            <p className="text-[10px] text-slate-400">اليومي والشهري</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/dashboard/notebooks"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">المتجر والمذكرات</p>
                                            <p className="text-[10px] text-slate-400">المخزون والحجوزات</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/assistants"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">المساعدين</p>
                                            <p className="text-[10px] text-slate-400">إدارة الفريق</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/exams"
                                    className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 rounded-2xl hover:border-primary/50 transition-all shadow-sm group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">الامتحانات</p>
                                            <p className="text-[10px] text-slate-400">النتائج والتقييم</p>
                                        </div>
                                    </div>
                                </Link>
                            </>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>نظام الحماية والمزامنة الذاتي نشط ومحمي</span>
            </div>
        </div>
    );
}

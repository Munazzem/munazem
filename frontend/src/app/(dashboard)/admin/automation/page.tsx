'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, MessageCircle, Play, Loader2, CheckCircle2, AlertCircle, RefreshCw, Server, RotateCcw, Trash2, Search, Filter } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTenants, fetchWhatsAppQueueStatus, retryAllFailedWhatsAppJobs, clearAllFailedWhatsAppJobs } from '@/lib/api/admin';
import { io, type Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { API_BASE_URL } from '@/lib/api/axios';

export default function AdminAutomationTestPage() {
    const user = useAuthStore(s => s.user);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState<'weekly_report' | 'payment_reminder' | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);
    const [teacherId, setTeacherId] = useState<string>('');

    // Queue filters state
    const [filterPhone,     setFilterPhone]     = useState('');
    const [filterTeacherId, setFilterTeacherId] = useState('');
    const [appliedFilters,  setAppliedFilters]  = useState<{ phone?: string; teacherId?: string }>({});

    // Fetch teachers for the dropdown
    const { data: teachersData, isLoading: teachersLoading } = useQuery({
        queryKey: ['admin-tenants-list'],
        queryFn: () => fetchTenants({ limit: 100 }),
    });

    const { data: queueData, isLoading: queueLoading, refetch: refetchQueue, isRefetching: queueRefetching } = useQuery({
        queryKey: ['admin-whatsapp-queue', appliedFilters],
        queryFn: () => fetchWhatsAppQueueStatus(appliedFilters),
        refetchInterval: 30000,
    });

    // Retry all failed jobs mutation
    const retryMutation = useMutation({
        mutationFn: retryAllFailedWhatsAppJobs,
        onSuccess: (data) => {
            toast.success(`تم إعادة محاولة ${data.retried} رسالة فاشلة`);
            queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-queue'] });
        },
    });

    // Clear all failed jobs mutation
    const clearMutation = useMutation({
        mutationFn: clearAllFailedWhatsAppJobs,
        onSuccess: (data) => {
            toast.success(`تم مسح ${data.cleared} رسالة فاشلة بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-queue'] });
        },
    });

    // Real-time synchronization
    const waSocketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (user?.role !== 'superAdmin') return;

        const token = Cookies.get('token');
        if (!token) return;

        const socket = io(`${API_BASE_URL}/whatsapp`, {
            auth: { token },
            transports: ['polling', 'websocket'],
            reconnection: true,
        });

        waSocketRef.current = socket;

        socket.on('connect', () => console.info('[SuperAdmin WA Sync] Connected:', socket.id));
        socket.on('wa:queue:updated', () => {
            refetchQueue();
        });

        return () => {
            socket.disconnect();
            waSocketRef.current = null;
        };
    }, [user?.role, refetchQueue]);

    if (user?.role !== 'superAdmin') {
        router.replace('/dashboard');
        return null;
    }

    const triggerAutomation = async (type: 'weekly_report' | 'payment_reminder') => {
        setLoading(type);
        setLastResult(null);
        try {
            const payload: any = { type };
            if (teacherId.trim()) payload.teacherId = teacherId.trim();
            const res: any = await apiClient.post('/admin/test-automation', payload);
            toast.success(res?.message || 'تم تشغيل الأتمتة بنجاح');
            setLastResult(`نجاح: ${res?.message}`);
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'حدث خطأ';
            setLastResult(`خطأ: ${msg}`);
        } finally {
            setLoading(null);
        }
    };

    const applyFilters = () => {
        setAppliedFilters({
            phone:     filterPhone.trim()     || undefined,
            teacherId: filterTeacherId.trim() || undefined,
        });
    };

    const resetFilters = () => {
        setFilterPhone('');
        setFilterTeacherId('');
        setAppliedFilters({});
    };

    const hasFilters = Object.keys(appliedFilters).some(k => (appliedFilters as any)[k]);

    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">اختبار الأتمتة (Automation)</h1>
                <p className="text-sm text-gray-500 mt-1">
                    هذه الصفحة مخصصة للمسؤولين فقط لتجربة وظائف الأتمتة بشكل فوري دون انتظار المجدول (Cron).
                </p>
            </div>

            {/* Target Teacher Input */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-800 mb-1">تحديد مدرس معين (اختياري)</label>
                    <p className="text-xs text-gray-500">إذا تركته فارغاً، سيتم تشغيل الأتمتة لجميع المدرسين النشطين (كن حذراً).</p>
                </div>
                <div className="w-full sm:w-72 relative">
                    <select
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        disabled={teachersLoading}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none bg-white cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                        <option value="">جميع المدرسين (All Teachers)</option>
                        {teachersData?.data?.map((t: any) => (
                            <option key={t._id} value={t._id}>
                                {t.name} {t.whatsappStatus === 'connected' ? '✅' : '❌'}
                            </option>
                        ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                
                {/* Weekly Report Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">التقرير الأسبوعي للمدرسين</h2>
                            <p className="text-xs text-gray-500">يُرسل عبر الإيميل (Email)</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-6 flex-1">
                        يقوم بجمع البيانات المالية (إيرادات ومصروفات) وحالة الحصص وعدد الطلاب لكل مدرس عن آخر 7 أيام، ويرسلها في إيميل منسق.
                    </p>
                    <button
                        onClick={() => triggerAutomation('weekly_report')}
                        disabled={loading !== null}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading === 'weekly_report' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        تشغيل التقرير الآن
                    </button>
                </div>

                {/* Payment Reminder Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <MessageCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">تذكير المصاريف</h2>
                            <p className="text-xs text-gray-500">يُرسل عبر الواتساب (WhatsApp)</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-6 flex-1">
                        يبحث عن المجموعات التي لديها حصة (ثانية) غداً، ويرسل رسالة تذكير على الواتساب لأولياء أمور الطلاب الذين لم يدفعوا مصاريف هذا الشهر.
                    </p>
                    <button
                        onClick={() => triggerAutomation('payment_reminder')}
                        disabled={loading !== null}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading === 'payment_reminder' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        إرسال التذكيرات الآن
                    </button>
                </div>
            </div>

            {/* Results Log */}
            {lastResult && (
                <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${lastResult.startsWith('نجاح') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {lastResult.startsWith('نجاح') ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                        <p className="font-medium text-sm">نتيجة آخر عملية:</p>
                        <p className="text-sm mt-1 opacity-90">{lastResult}</p>
                    </div>
                </div>
            )}

            {/* Queue Diagnosis Section */}
            <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">تشخيص طابور الواتساب (WhatsApp Queue)</h2>
                            <p className="text-xs text-gray-500">حالة الرسائل المعلقة والمكتملة · يتحدث تلقائياً كل 30 ثانية</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => refetchQueue()}
                        disabled={queueLoading || queueRefetching}
                        className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${queueRefetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                            <p className="text-xs text-gray-500 mb-1">في الانتظار</p>
                            <p className="text-xl font-bold text-gray-900">{queueData?.counts?.waiting ?? 0}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                            <p className="text-xs text-blue-600 mb-1">قيد التنفيذ</p>
                            <p className="text-xl font-bold text-blue-700">{queueData?.counts?.active ?? 0}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                            <p className="text-xs text-green-600 mb-1">مكتمل</p>
                            <p className="text-xl font-bold text-green-700">{queueData?.counts?.completed ?? 0}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                            <p className="text-xs text-red-600 mb-1">فشل</p>
                            <p className="text-xl font-bold text-red-700">{queueData?.counts?.failed ?? 0}</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                            <p className="text-xs text-orange-600 mb-1">مؤجل</p>
                            <p className="text-xl font-bold text-orange-700">{queueData?.counts?.delayed ?? 0}</p>
                        </div>
                    </div>

                    {/* Action Buttons — Retry & Clear */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => retryMutation.mutate()}
                            disabled={retryMutation.isPending || (queueData?.counts?.failed ?? 0) === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {retryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            إعادة محاولة الكل ({queueData?.counts?.failed ?? 0})
                        </button>
                        <button
                            onClick={() => {
                                if (!confirm('هل أنت متأكد من مسح جميع الرسائل الفاشلة؟ لا يمكن التراجع عن هذا الإجراء.')) return;
                                clearMutation.mutate();
                            }}
                            disabled={clearMutation.isPending || (queueData?.counts?.failed ?? 0) === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {clearMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            مسح الكل نهائياً
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700">فلتر الرسائل الفاشلة</p>
                            {hasFilters && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">فلتر مفعّل</span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={filterPhone}
                                    onChange={(e) => setFilterPhone(e.target.value)}
                                    placeholder="بحث برقم هاتف..."
                                    dir="ltr"
                                    className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={filterTeacherId}
                                    onChange={(e) => setFilterTeacherId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white appearance-none"
                                >
                                    <option value="">كل المدرسين</option>
                                    {teachersData?.data?.map((t: any) => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={applyFilters}
                                className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                تطبيق الفلتر
                            </button>
                            {hasFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="px-4 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء الفلتر
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recent Failed Jobs */}
                    {queueLoading ? (
                        <div className="flex justify-center items-center py-8 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : queueData?.recentFailed && queueData.recentFailed.length > 0 ? (
                        <div className="border border-red-100 rounded-xl overflow-hidden">
                            <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-red-800">
                                    الرسائل الفاشلة
                                    {hasFilters ? ` — نتائج الفلتر (${queueData.recentFailed.length})` : ` (${queueData.recentFailed.length})`}
                                </h3>
                            </div>
                            <div className="divide-y divide-red-50 max-h-80 overflow-y-auto">
                                {queueData.recentFailed.map((job: any) => (
                                    <div key={job.id} className="p-4 bg-white hover:bg-gray-50 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-gray-800">نوع الرسالة: {job.name}</span>
                                            <span className="text-xs text-gray-500" dir="ltr">
                                                {new Date(job.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        {job.data?.parentPhone && (
                                            <p className="text-xs text-gray-500 mb-1">
                                                📱 الهاتف: <span dir="ltr">{job.data.parentPhone}</span>
                                                {job.data?.teacherId && <> · المدرس: {job.data.teacherId}</>}
                                            </p>
                                        )}
                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 mb-2 font-mono break-words" dir="ltr">
                                            {JSON.stringify(job.data, null, 2)}
                                        </div>
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                            <strong>الخطأ:</strong> {job.failedReason || 'غير معروف'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-300" />
                            <p className="text-sm">
                                {hasFilters ? 'لا توجد رسائل فاشلة تطابق الفلتر المحدد' : 'لا توجد رسائل فاشلة 🎉'}
                            </p>
                        </div>
                    )}
                    {/* Recent Completed Jobs */}
                    {queueData?.recentCompleted && queueData.recentCompleted.length > 0 && (
                        <div className="mt-6 border border-emerald-100 rounded-xl overflow-hidden">
                            <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-emerald-800">
                                    الرسائل الناجحة مؤخراً
                                    {hasFilters ? ` — نتائج الفلتر (${queueData.recentCompleted.length})` : ` (${queueData.recentCompleted.length})`}
                                </h3>
                            </div>
                            <div className="divide-y divide-emerald-50 max-h-80 overflow-y-auto">
                                {queueData.recentCompleted.map((job: any) => (
                                    <div key={job.id} className="p-4 bg-white hover:bg-gray-50 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-gray-800 flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                نوع الرسالة: {job.name}
                                            </span>
                                            <span className="text-xs text-gray-500" dir="ltr">
                                                {new Date(job.finishedOn || job.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        {job.data?.parentPhone && (
                                            <p className="text-xs text-gray-500 mb-1">
                                                📱 الهاتف: <span dir="ltr">{job.data.parentPhone}</span>
                                                {job.data?.studentName && <> · الطالب: {job.data.studentName}</>}
                                            </p>
                                        )}
                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 mb-2 font-mono break-words" dir="ltr">
                                            {JSON.stringify(job.data, null, 2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

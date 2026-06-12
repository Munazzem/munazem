'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { fetchTenants } from '@/lib/api/admin';

export default function AdminAutomationTestPage() {
    const user = useAuthStore(s => s.user);
    const router = useRouter();
    const [loading, setLoading] = useState<'weekly_report' | 'payment_reminder' | null>(null);
    const [lastResult, setLastResult] = useState<string | null>(null);
    const [teacherId, setTeacherId] = useState<string>('');

    // Fetch teachers for the dropdown
    const { data: teachersData, isLoading: teachersLoading } = useQuery({
        queryKey: ['admin-tenants-list'],
        queryFn: () => fetchTenants({ limit: 100 }), // Get up to 100 teachers for the list
    });

    if (user?.role !== 'superAdmin') {
        router.replace('/dashboard');
        return null;
    }

    const triggerAutomation = async (type: 'weekly_report' | 'payment_reminder') => {
        setLoading(type);
        setLastResult(null);
        try {
            // The Axios interceptor already returns response.data
            // The API SuccessResponse format is { data: ..., message: ... }
            const payload: any = { type };
            if (teacherId.trim()) payload.teacherId = teacherId.trim();

            const res: any = await apiClient.post('/admin/test-automation', payload);
            toast.success(res?.message || 'تم تشغيل الأتمتة بنجاح');
            setLastResult(`نجاح: ${res?.message}`);
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'حدث خطأ';
            toast.error(msg);
            setLastResult(`خطأ: ${msg}`);
        } finally {
            setLoading(null);
        }
    };

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
                    {/* Custom Dropdown Arrow */}
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
                        {loading === 'weekly_report' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
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
                        {loading === 'payment_reminder' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
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
        </div>
    );
}

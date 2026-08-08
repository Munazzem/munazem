'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    MessageCircle, Play, Loader2, CheckCircle2, AlertCircle, 
    RefreshCw, Server, Search, Filter, Smartphone, Activity, BarChart2,
    CheckCircle, XCircle, Clock
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    fetchMonitoringStats, 
    fetchMonitoringMessages, 
    fetchMonitoringConnections, 
    fetchMonitoringTeacherStats,
    triggerWeeklyReport,
    fetchTenants,
    retryAllFailedWhatsAppJobs
} from '@/lib/api/admin';
import { io, type Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { API_BASE_URL } from '@/lib/api/axios';

export default function AdminMonitoringPage() {
    const user = useAuthStore(s => s.user);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'teachers'>('overview');
    const [loadingReport, setLoadingReport] = useState(false);
    const [targetTeacher, setTargetTeacher] = useState('');

    // Message Filters
    const [page, setPage] = useState(1);
    const [filterPhone, setFilterPhone] = useState('');
    const [filterTeacher, setFilterTeacher] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [appliedFilters, setAppliedFilters] = useState<{ search?: string; teacherId?: string; status?: string }>({});

    const { data: teachersData } = useQuery({
        queryKey: ['admin-tenants-list-short'],
        queryFn: () => fetchTenants({ limit: 200 }),
    });

    const { data: statsData, refetch: refetchStats } = useQuery({
        queryKey: ['admin-monitoring-stats'],
        queryFn: fetchMonitoringStats,
        refetchInterval: 30000,
    });

    const { data: connectionsData, refetch: refetchConnections } = useQuery({
        queryKey: ['admin-monitoring-connections'],
        queryFn: fetchMonitoringConnections,
        refetchInterval: 30000,
    });

    const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
        queryKey: ['admin-monitoring-messages', appliedFilters, page],
        queryFn: () => fetchMonitoringMessages({ ...appliedFilters, page, limit: 20 }),
    });

    const { data: teacherStatsData } = useQuery({
        queryKey: ['admin-monitoring-teacher-stats'],
        queryFn: () => fetchMonitoringTeacherStats(),
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
        socket.on('connect', () => console.info('[SuperAdmin WA Sync] Connected'));
        socket.on('wa:queue:updated', () => {
            refetchStats();
            if (activeTab === 'messages') refetchMessages();
        });

        return () => {
            socket.disconnect();
            waSocketRef.current = null;
        };
    }, [user?.role, activeTab, refetchStats, refetchMessages]);

    if (user?.role !== 'superAdmin') {
        router.replace('/dashboard');
        return null;
    }

    const handleTriggerReport = async () => {
        setLoadingReport(true);
        try {
            const res = await triggerWeeklyReport(targetTeacher || undefined);
            toast.success(res?.message || 'تم بدء إرسال التقارير بنجاح');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء تشغيل التقارير');
        } finally {
            setLoadingReport(false);
        }
    };

    const applyMessageFilters = () => {
        setPage(1);
        setAppliedFilters({
            search: filterPhone.trim() || undefined,
            teacherId: filterTeacher || undefined,
            status: filterStatus || undefined,
        });
    };

    const resetMessageFilters = () => {
        setFilterPhone('');
        setFilterTeacher('');
        setFilterStatus('');
        setPage(1);
        setAppliedFilters({});
    };

    const retryFailedMutation = useMutation({
        mutationFn: retryAllFailedWhatsAppJobs,
        onSuccess: (res) => {
            toast.success(`تم إعادة إرسال ${res?.retried || 0} رسالة بنجاح`);
            refetchStats();
            refetchMessages();
        },
        onError: () => toast.error('حدث خطأ أثناء إعادة الإرسال'),
    });

    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">مراقبة الرسائل والأتمتة</h1>
                <p className="text-sm text-gray-500 mt-1">
                    تابع حالة رسائل الواتساب، التوصيلات الخاصة بالمعلمين، وأرسل التقارير يدوياً.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> نظرة عامة</div>
                </button>
                <button
                    onClick={() => setActiveTab('messages')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === 'messages' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> سجل الرسائل</div>
                </button>
                <button
                    onClick={() => setActiveTab('teachers')}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${activeTab === 'teachers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4" /> إحصائيات المعلمين</div>
                </button>
            </div>

            {/* Tab Content: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                            <p className="text-sm text-gray-500 mb-1">إجمالي الرسائل (الشهر)</p>
                            <p className="text-3xl font-bold text-gray-900">{statsData?.messages?.thisMonth?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center">
                            <p className="text-sm text-blue-600 mb-1">قيد المعالجة (الآن)</p>
                            <p className="text-3xl font-bold text-blue-700">{statsData?.queue?.active || 0}</p>
                        </div>
                        <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 shadow-sm flex flex-col justify-center">
                            <p className="text-sm text-orange-600 mb-1">في الانتظار / مؤجل</p>
                            <p className="text-3xl font-bold text-orange-700">{(statsData?.queue?.waiting || 0) + (statsData?.queue?.delayed || 0)}</p>
                        </div>
                        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-center">
                            <p className="text-sm text-red-600 mb-1">فشل الإرسال</p>
                            <p className="text-3xl font-bold text-red-700">{statsData?.messages?.monthFailed || 0}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Weekly Report Trigger */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">إرسال التقرير الأسبوعي (Email)</h2>
                            <p className="text-sm text-gray-500 mb-4">
                                يتم إرسال هذا التقرير تلقائياً يوم الجمعة. يمكنك تشغيله يدوياً الآن لاختبار الخدمة أو إرساله لمعلم محدد.
                            </p>
                            <select
                                value={targetTeacher}
                                onChange={(e) => setTargetTeacher(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2 mb-4 text-sm outline-none focus:border-primary"
                            >
                                <option value="">كل المعلمين (إرسال للجميع)</option>
                                {teachersData?.data?.map((t: any) => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleTriggerReport}
                                disabled={loadingReport}
                                className="mt-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                {loadingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                إرسال التقرير الآن
                            </button>
                        </div>

                        {/* Live Connections */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[400px]">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">حالة جلسات الواتساب</h2>
                                <button onClick={() => refetchConnections()} className="text-gray-400 hover:text-primary">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                                {connectionsData?.teachers?.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center mt-10">لا يوجد معلمين حالياً</p>
                                ) : (
                                    connectionsData?.teachers?.map((conn: any) => (
                                        <div key={conn._id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${conn.whatsappStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{conn.name}</p>
                                                    <p className="text-xs text-gray-500">الهاتف: <span dir="ltr">{conn.phone}</span></p>
                                                </div>
                                            </div>
                                            {conn.isPremium ? (
                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">Premium</span>
                                            ) : (
                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">Free</span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content: MESSAGES */}
            {activeTab === 'messages' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
                    {/* Filters */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">رقم الهاتف</label>
                            <input 
                                type="text" 
                                value={filterPhone} 
                                onChange={(e) => setFilterPhone(e.target.value)} 
                                placeholder="بحث..." 
                                dir="ltr"
                                className="w-36 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">المعلم</label>
                            <select 
                                value={filterTeacher} 
                                onChange={(e) => setFilterTeacher(e.target.value)} 
                                className="w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                            >
                                <option value="">الكل</option>
                                {teachersData?.data?.map((t: any) => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">الحالة</label>
                            <select 
                                value={filterStatus} 
                                onChange={(e) => setFilterStatus(e.target.value)} 
                                className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                            >
                                <option value="">الكل</option>
                                <option value="queued">في الانتظار</option>
                                <option value="processing">جاري الإرسال</option>
                                <option value="sent">تم الإرسال</option>
                                <option value="failed">فشل</option>
                            </select>
                        </div>
                        <button 
                            onClick={applyMessageFilters} 
                            className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                        >
                            بحث
                        </button>
                        <button 
                            onClick={resetMessageFilters} 
                            className="bg-white border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                        >
                            إعادة ضبط
                        </button>
                        
                        <div className="flex-1" /> {/* Spacer */}
                        
                        <button
                            onClick={() => retryFailedMutation.mutate()}
                            disabled={retryFailedMutation.isPending || statsData?.queue?.failed === 0}
                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {retryFailedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            إعادة إرسال الرسائل الفاشلة ({statsData?.queue?.failed || 0})
                        </button>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-white sticky top-0 border-b border-gray-100 z-10 shadow-sm">
                                <tr className="text-gray-500 font-medium">
                                    <th className="py-3 px-4">التاريخ</th>
                                    <th className="py-3 px-4">المعلم</th>
                                    <th className="py-3 px-4">رقم ولي الأمر</th>
                                    <th className="py-3 px-4">النوع</th>
                                    <th className="py-3 px-4">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {messagesLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td>
                                    </tr>
                                ) : messagesData?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-gray-500">لا توجد رسائل مطابقة</td>
                                    </tr>
                                ) : (
                                    messagesData?.data?.map((msg: any) => (
                                        <tr key={msg._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 text-gray-500" dir="ltr">{new Date(msg.createdAt).toLocaleString('ar-EG')}</td>
                                            <td className="py-3 px-4 font-medium text-gray-900">{msg.teacherId?.name || 'مجهول'}</td>
                                            <td className="py-3 px-4 text-gray-600" dir="ltr">{msg.parentPhone}</td>
                                            <td className="py-3 px-4 text-gray-600">
                                                {msg.kind === 'session_absent' ? 'غياب حصة' : msg.kind === 'exam_result' ? 'نتيجة امتحان' : msg.kind}
                                            </td>
                                            <td className="py-3 px-4">
                                                {msg.status === 'sent' ? <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle className="w-3 h-3" /> تم الإرسال</span> :
                                                 msg.status === 'failed' ? <span className="flex items-center gap-1 text-red-600 text-xs font-bold" title={msg.failReason}><XCircle className="w-3 h-3" /> فشل</span> :
                                                 msg.status === 'processing' ? <span className="flex items-center gap-1 text-blue-600 text-xs font-bold"><Loader2 className="w-3 h-3 animate-spin" /> قيد الإرسال</span> :
                                                 <span className="flex items-center gap-1 text-orange-600 text-xs font-bold"><Clock className="w-3 h-3" /> في الانتظار</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {messagesData?.pagination?.totalPages > 1 && (
                        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
                            <span className="text-sm text-gray-500">صفحة {messagesData.pagination.page} من {messagesData.pagination.totalPages}</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                                    disabled={page === 1}
                                    className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                                >السابق</button>
                                <button 
                                    onClick={() => setPage(p => Math.min(messagesData.pagination.totalPages, p + 1))}
                                    disabled={page === messagesData.pagination.totalPages} 
                                    className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                                >التالي</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab Content: TEACHERS */}
            {activeTab === 'teachers' && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">إحصائيات إرسال المعلمين هذا الشهر</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.isArray(teacherStatsData) && teacherStatsData.map((ts: any) => (
                            <div key={ts.teacherId} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-gray-800 mb-2 truncate" title={ts.teacherName}>{ts.teacherName}</h3>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">الإجمالي:</span>
                                        <span className="font-semibold text-gray-900">{ts.total}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-600">تم الإرسال:</span>
                                        <span className="font-semibold text-green-700">{ts.sent}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-red-600">فشل الإرسال:</span>
                                        <span className="font-semibold text-red-700">{ts.failed}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

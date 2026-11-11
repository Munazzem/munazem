'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchCenterGroups,
    fetchCenterMessages,
    fetchCenterMessageAudience,
    createCenterMessage,
} from '@/lib/api/centers';
import { STAGE_HIERARCHY, getStageForGrade } from '@/lib/constants/grade.constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    Send,
    Users,
    GraduationCap,
    MessageSquare,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    Eye,
    Sparkles,
    Layers,
    Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function generateRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

const QUICK_TEMPLATES = [
    {
        label: 'تنبيه بموعد حصة',
        title: 'تنبيه هام بخصوص موعد الحصة',
        body: 'ولي الأمر الكريم، نود تذكيركم بموعد الحصة القادمة في السنتر، يرجى الالتزام بالحضور في الموعد المحدد.',
    },
    {
        label: 'تذكير بسداد المصروفات',
        title: 'تذكير بسداد اشتراك السنتر',
        body: 'ولي الأمر الكريم، نحيطكم علماً بوجود مستحقات مالية متبقية خاصة باشتراك الطالب في السنتر، نرجو التكرم بالسداد في أقرب وقت.',
    },
    {
        label: 'جدول امتحانات وشيتات',
        title: 'موعد الاختبار الأسبوعي بالسنتر',
        body: 'ولي الأمر الكريم، نود إبلاغكم بعقد اختبار تقييمي شامل خلال الحصة القادمة، نتمنى التوفيق لجميع الطلاب.',
    },
];

export default function CenterMessagesPage() {
    const queryClient = useQueryClient();

    // Target state
    const [targetType, setTargetType] = useState<'GROUP' | 'GRADE' | 'ALL'>('GROUP');
    const [selectedStageId, setSelectedStageId] = useState<string>('ALL');
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');

    // Compose state
    const [title, setTitle] = useState<string>('');
    const [body, setBody] = useState<string>('');
    const [clientRequestId, setClientRequestId] = useState<string>(() => generateRequestId());

    // Pagination & modals
    const [page, setPage] = useState<number>(1);
    const limit = 20;
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [audienceData, setAudienceData] = useState<{
        studentCount: number;
        reachedParentCount: number;
        unlinkedStudentCount: number;
    } | null>(null);
    const [isLoadingAudience, setIsLoadingAudience] = useState(false);
    const [viewingMessage, setViewingMessage] = useState<any | null>(null);

    useEffect(() => {
        setClientRequestId(generateRequestId());
    }, [targetType, selectedGroupId, selectedGrade, title, body]);

    // Fetch Center Classes (Groups)
    const { data: groups = [], isLoading: isLoadingGroups } = useQuery({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups(),
    });

    // Filtered grades by selected stage
    const stageGrades = useMemo(() => {
        if (selectedStageId === 'ALL') {
            return STAGE_HIERARCHY.flatMap((s) => s.grades);
        }
        const stage = STAGE_HIERARCHY.find((s) => s.id === selectedStageId);
        return stage ? stage.grades : [];
    }, [selectedStageId]);

    // Filtered classes by selected stage & grade
    const filteredGroups = useMemo(() => {
        return groups.filter((g) => {
            if (selectedStageId !== 'ALL' && getStageForGrade(g.gradeLevel) !== selectedStageId) {
                return false;
            }
            if (selectedGrade && g.gradeLevel !== selectedGrade) {
                return false;
            }
            return true;
        });
    }, [groups, selectedStageId, selectedGrade]);

    // Fetch messages history
    const {
        data: messagesData,
        isLoading: isLoadingMessages,
        isFetching: isFetchingMessages,
    } = useQuery({
        queryKey: ['center', 'messages', page, limit],
        queryFn: () => fetchCenterMessages(page, limit),
        refetchInterval: (query: any) => {
            const list = query.state.data?.messages || [];
            return Array.isArray(list) && list.some((m: any) => m.status === 'SENDING') ? 3000 : false;
        },
    });

    const messages = messagesData?.messages || [];
    const totalPages = messagesData?.totalPages || 1;

    // Send Mutation
    const sendMutation = useMutation({
        mutationFn: createCenterMessage,
        onSuccess: () => {
            toast.success('تم إرسال الرسالة إلى أولياء الأمور على التطبيق بنجاح!');
            queryClient.invalidateQueries({ queryKey: ['center', 'messages'] });
            setTitle('');
            setBody('');
            setIsPreviewOpen(false);
            setAudienceData(null);
            setClientRequestId(generateRequestId());
        },
        onError: (err: any) => {
            const msg = err.response?.data?.message || err.message || 'حدث خطأ أثناء إرسال الرسالة';
            toast.error(msg);
        },
    });

    const handleOpenPreview = async () => {
        if (targetType === 'GROUP' && !selectedGroupId) {
            toast.error('يرجى اختيار الحصة الدراسية المستهدفة');
            return;
        }
        if (targetType === 'GRADE' && !selectedGrade) {
            toast.error('يرجى اختيار الصف الدراسي المستهدف');
            return;
        }
        if (!body.trim()) {
            toast.error('يرجى كتابة نص الرسالة أولاً');
            return;
        }

        setIsLoadingAudience(true);
        try {
            const audience = await fetchCenterMessageAudience({
                targetType,
                groupId: targetType === 'GROUP' ? selectedGroupId : undefined,
                gradeLevel: targetType === 'GRADE' ? selectedGrade : undefined,
            });
            setAudienceData(audience);
            setIsPreviewOpen(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'تعذر احتساب الجمهور المستهدف');
        } finally {
            setIsLoadingAudience(false);
        }
    };

    const handleConfirmSend = () => {
        if (!audienceData || audienceData.reachedParentCount === 0) {
            toast.error('لا يوجد أولياء أمور مسجلين لهذا الجمهور حالياً');
            return;
        }

        sendMutation.mutate({
            targetType,
            groupId: targetType === 'GROUP' ? selectedGroupId : undefined,
            gradeLevel: targetType === 'GRADE' ? selectedGrade : undefined,
            title: title.trim() || undefined,
            body: body.trim(),
            clientRequestId,
        });
    };

    const selectedGroupObj = useMemo(
        () => groups.find((g) => g._id === selectedGroupId),
        [groups, selectedGroupId]
    );

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                            <MessageSquare className="h-6 w-6 text-primary" />
                            رسائل مخصصة لأولياء الأمور
                        </h1>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                            إشعارات تطبيق ولي الأمر
                        </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إرسال رسائل وإشعارات فورية مخصصة لأولياء الأمور حسب الحصة الدراسية أو الصف الدراسي أو السنتر بالكامل
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ── Compose Message Card ── */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5">
                    <div className="border-b border-gray-100 pb-3">
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Send className="h-4 w-4 text-primary" />
                            إنشاء رسالة أو إشعار مخصص
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            اختر الحصة أو الصف الدراسي واكتب رسالتك لتصل فوراً لولي الأمر
                        </p>
                    </div>

                    {/* Target Type Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-700">نوع الجمهور المستهدف</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setTargetType('GROUP')}
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all",
                                    targetType === 'GROUP'
                                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <Layers className="h-4 w-4" />
                                <span>حصة دراسية</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setTargetType('GRADE')}
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all",
                                    targetType === 'GRADE'
                                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <GraduationCap className="h-4 w-4" />
                                <span>صف دراسي</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setTargetType('ALL')}
                                className={cn(
                                    "flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all",
                                    targetType === 'ALL'
                                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <Building2 className="h-4 w-4" />
                                <span>كل السنتر</span>
                            </button>
                        </div>
                    </div>

                    {/* Stage & Grade Hierarchy Selectors */}
                    {targetType !== 'ALL' && (
                        <div className="space-y-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                    1. اختر المرحلة الدراسية
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedStageId('ALL');
                                            setSelectedGrade('');
                                            setSelectedGroupId('');
                                        }}
                                        className={cn(
                                            "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                            selectedStageId === 'ALL'
                                                ? "bg-gray-900 text-white border-gray-900"
                                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                                        )}
                                    >
                                        الكل
                                    </button>
                                    {STAGE_HIERARCHY.map((st) => (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedStageId(st.id);
                                                setSelectedGrade('');
                                                setSelectedGroupId('');
                                            }}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                selectedStageId === st.id
                                                    ? "bg-primary text-white border-primary"
                                                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                                            )}
                                        >
                                            {st.shortTitle}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    2. الصف الدراسي {targetType === 'GRADE' && <span className="text-rose-500">*</span>}
                                </label>
                                <select
                                    value={selectedGrade}
                                    onChange={(e) => {
                                        setSelectedGrade(e.target.value);
                                        setSelectedGroupId('');
                                    }}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
                                >
                                    <option value="">
                                        {targetType === 'GRADE' ? '— اختر الصف الدراسي المستهدف —' : 'كل الصفوف الدراسية'}
                                    </option>
                                    {stageGrades.map((grade) => (
                                        <option key={grade} value={grade}>
                                            {grade}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {targetType === 'GROUP' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">
                                        3. الحصة الدراسية المستهدفة <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={selectedGroupId}
                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
                                    >
                                        <option value="">
                                            {isLoadingGroups ? 'جاري تحميل الحصص...' : '— اختر الحصة الدراسية —'}
                                        </option>
                                        {filteredGroups.map((group) => (
                                            <option key={group._id} value={group._id}>
                                                {group.name} — {group.gradeLevel} ({(group.centerTeacherId as any)?.subject || 'عام'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Templates */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            <span>قوالب رسائل جاهزة سريعة:</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.label}
                                    type="button"
                                    onClick={() => {
                                        setTitle(tpl.title);
                                        setBody(tpl.body);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold transition-colors"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-700">عنوان الرسالة (اختياري)</label>
                            <span className="text-[11px] text-gray-400">{title.length}/80</span>
                        </div>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                            placeholder="مثال: تنبيه هام من إدارة السنتر"
                            className="rounded-xl text-xs"
                            maxLength={80}
                        />
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-gray-700">
                                نص الرسالة <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[11px] text-gray-400">{body.length}/1000</span>
                        </div>
                        <Textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
                            placeholder="اكتب رسالتك لأولياء الأمور هنا..."
                            rows={5}
                            className="rounded-xl resize-none text-xs leading-relaxed"
                            maxLength={1000}
                        />
                    </div>

                    <Button
                        type="button"
                        onClick={handleOpenPreview}
                        disabled={isLoadingAudience || !body.trim() || sendMutation.isPending}
                        className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2"
                    >
                        {isLoadingAudience ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>جاري احتساب أولياء الأمور...</span>
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                <span>معاينة وتأكيد إرسال الرسالة</span>
                            </>
                        )}
                    </Button>
                </div>

                {/* ── Sent Messages History Card ── */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-500" />
                                    <span>سجل الرسائل المرسلة لأولياء الأمور</span>
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    متابعة حالة وصول الرسائل المخصصة التي تم إرسالها من السنتر
                                </p>
                            </div>
                            {isFetchingMessages && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>

                        {isLoadingMessages ? (
                            <div className="py-16 text-center text-gray-400">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                                <p className="text-xs">جاري تحميل سجل الرسائل...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl p-6">
                                <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm font-bold text-gray-600">لا توجد رسائل مرسلة بعد</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    استخدم النموذج الجانبي لإرسال أول إشعار مخصص لأولياء الأمور.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards */}
                                <div className="sm:hidden space-y-2.5">
                                    {messages.map((msg: any) => (
                                        <div key={msg._id} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/40 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="bg-white text-xs font-bold">
                                                    {msg.targetType === 'GROUP'
                                                        ? `حصة: ${msg.groupNameSnapshot || 'حصة'}`
                                                        : msg.targetType === 'GRADE'
                                                        ? `صف: ${msg.gradeLevel}`
                                                        : 'كل طلاب السنتر'}
                                                </Badge>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {new Date(msg.createdAt).toLocaleDateString('ar-EG')}
                                                </span>
                                            </div>
                                            <div className="text-xs font-bold text-gray-900">{msg.title}</div>
                                            <p className="text-xs text-gray-600 line-clamp-2">{msg.body}</p>
                                            <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px]">
                                                <span className="text-emerald-700 font-bold">
                                                    وصل إلى {msg.reachedParentCount} ولي أمر ({msg.studentCount} طالب)
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setViewingMessage(msg)}
                                                    className="h-7 px-2 text-xs font-bold text-primary"
                                                >
                                                    <Eye className="h-3.5 w-3.5 ml-1" />
                                                    عرض
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                                            <tr>
                                                <th className="py-3 px-3">التاريخ</th>
                                                <th className="py-3 px-3">الجمهور المستهدف</th>
                                                <th className="py-3 px-3">الرسالة</th>
                                                <th className="py-3 px-3 text-center">الوصول</th>
                                                <th className="py-3 px-3 text-center">الحالة</th>
                                                <th className="py-3 px-2 text-center">عرض</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {messages.map((msg: any) => (
                                                <tr key={msg._id} className="hover:bg-gray-50/60">
                                                    <td className="py-3 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                                                        <div>{new Date(msg.createdAt).toLocaleDateString('ar-EG')}</div>
                                                        <div className="text-[10px] text-gray-400">
                                                            {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                                                            {msg.targetType === 'GROUP'
                                                                ? msg.groupNameSnapshot || 'حصة دراسية'
                                                                : msg.targetType === 'GRADE'
                                                                ? msg.gradeLevel
                                                                : 'كل طلاب السنتر'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-3 max-w-xs">
                                                        <div className="font-bold text-gray-900 truncate">{msg.title}</div>
                                                        <div className="text-gray-500 truncate mt-0.5">{msg.body}</div>
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-bold text-gray-700">
                                                        {msg.reachedParentCount} ولي أمر
                                                        <span className="block text-[10px] text-gray-400 font-normal">
                                                            من {msg.studentCount} طالب
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                msg.status === 'SENT'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : msg.status === 'SENDING'
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }
                                                        >
                                                            {msg.status === 'SENT' ? 'تم الإرسال' : msg.status === 'SENDING' ? 'جاري الإرسال' : 'تعذر جزئياً'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setViewingMessage(msg)}
                                                            className="h-7 w-7 p-0 text-primary hover:bg-primary/10 rounded-lg"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                                صفحة {page} من {totalPages}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="h-8 px-2.5 text-xs rounded-lg"
                                >
                                    السابق
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="h-8 px-2.5 text-xs rounded-lg"
                                >
                                    التالي
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Preview & Confirm Send Dialog ── */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[460px] rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-gray-900 flex items-center gap-2">
                            <Send className="h-5 w-5 text-primary" />
                            <span>تأكيد إرسال الرسالة لأولياء الأمور</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">
                            راجع تفاصيل الجمهور المستهدف ومحتوى الرسالة قبل الإرسال الفوري.
                        </DialogDescription>
                    </DialogHeader>

                    {audienceData && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
                                    <span className="text-[11px] font-bold text-blue-800 block">إجمالي الطلاب المستهدفين</span>
                                    <span className="text-xl font-black text-blue-700 font-mono mt-1 block">
                                        {audienceData.studentCount}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                                    <span className="text-[11px] font-bold text-emerald-800 block">أولياء الأمور المستلمين</span>
                                    <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                                        {audienceData.reachedParentCount}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5 text-xs">
                                <div className="text-gray-500 font-bold">
                                    الجمهور:{' '}
                                    <span className="text-gray-900">
                                        {targetType === 'GROUP'
                                            ? `حصة ${selectedGroupObj?.name || ''}`
                                            : targetType === 'GRADE'
                                            ? `صف ${selectedGrade}`
                                            : 'كل طلاب السنتر'}
                                    </span>
                                </div>
                                {title.trim() && (
                                    <div className="font-black text-gray-900 pt-1">{title}</div>
                                )}
                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed pt-1">{body}</p>
                            </div>

                            {audienceData.reachedParentCount === 0 && (
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                                    <span>لا يوجد طلاب لديهم رقم هاتف ولي أمر مسجل في هذه الفئة حالياً.</span>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-start">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPreviewOpen(false)}
                            className="rounded-xl"
                        >
                            تعديل الرسالة
                        </Button>
                        <Button
                            type="button"
                            disabled={sendMutation.isPending || !audienceData || audienceData.reachedParentCount === 0}
                            onClick={handleConfirmSend}
                            className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl gap-2 flex-1"
                        >
                            {sendMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span>إرسال الآن ({audienceData?.reachedParentCount || 0} ولي أمر)</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Sent Message Modal ── */}
            <Dialog open={!!viewingMessage} onOpenChange={(open) => !open && setViewingMessage(null)}>
                <DialogContent className="w-[95vw] sm:max-w-[460px] rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-gray-900">تفاصيل الرسالة المرسلة</DialogTitle>
                    </DialogHeader>
                    {viewingMessage && (
                        <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between text-gray-500">
                                <span>تاريخ الإرسال:</span>
                                <span className="font-mono">{new Date(viewingMessage.createdAt).toLocaleString('ar-EG')}</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                                <div className="font-black text-gray-900 text-sm">{viewingMessage.title}</div>
                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{viewingMessage.body}</p>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold">
                                <span>عدد أولياء الأمور المستلمين:</span>
                                <span>{viewingMessage.reachedParentCount} ولي أمر</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

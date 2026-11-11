'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth.store';
import { fetchGroups } from '@/lib/api/groups';
import {
  fetchTeacherMessages,
  fetchTeacherMessageAudience,
  createTeacherMessage,
} from '@/lib/api/teacher-messages';
import { QK } from '@/lib/query-keys';
import { getAllowedGrades } from '@/lib/utils/grades';
import type {
  TeacherMessageTargetType,
  TeacherMessageAudience,
  TeacherMessage,
} from '@/types/teacher-message.types';
import type { Group } from '@/types/group.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

/**
 * Generate a clientRequestId with a safe fallback for local/non-secure HTTP
 */
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

export default function TeacherMessagesPage() {
  const user = useAuthStore((s) => s.user);

  // Guard: Only teachers can access this page
  if (user?.role !== 'teacher') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3" dir="rtl">
        <AlertCircle className="h-12 w-12 text-red-300" />
        <p className="text-gray-500 font-medium">غير مصرح لك بالوصول لهذه الصفحة (خاصة بالمعلم فقط)</p>
      </div>
    );
  }

  return <TeacherMessagesContent />;
}

function TeacherMessagesContent() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Form State
  const [targetType, setTargetType] = useState<TeacherMessageTargetType>('GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [clientRequestId, setClientRequestId] = useState<string>(() => generateRequestId());

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  // Modals State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [audienceData, setAudienceData] = useState<TeacherMessageAudience | null>(null);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [viewingMessage, setViewingMessage] = useState<TeacherMessage | null>(null);

  // Regenerate clientRequestId whenever any input field changes (Requirement 3)
  useEffect(() => {
    setClientRequestId(generateRequestId());
  }, [targetType, selectedGroupId, selectedGrade, title, body]);

  // Allowed grades for this teacher
  const allowedGrades = useMemo(() => {
    return getAllowedGrades(user?.stages);
  }, [user?.stages]);

  // Fetch groups list
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: QK.groups.all,
    queryFn: () => fetchGroups({ limit: 100 }),
  });
  const groups: Group[] = groupsData?.data || [];

  // Fetch messages history
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    isFetching: isFetchingMessages,
  } = useQuery({
    queryKey: QK.teacherMessages.list({ page, limit }),
    queryFn: () => fetchTeacherMessages({ page, limit }),
    refetchInterval: (query: any) => {
      const list = query.state.data?.messages || query.state.data?.data;
      return Array.isArray(list) && list.some((m: any) => m.status === 'SENDING') ? 3000 : false;
    },
  });

  const messages = messagesData?.messages || [];
  const totalPages = messagesData?.totalPages || 1;

  // Send Message Mutation
  const sendMutation = useMutation({
    mutationFn: createTeacherMessage,
    onSuccess: () => {
      toast.success('تم إرسال الرسالة إلى أولياء الأمور بنجاح!');
      queryClient.invalidateQueries({ queryKey: QK.teacherMessages.all });
      // Reset form
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

  // Handle open preview
  const handleOpenPreview = async () => {
    if (targetType === 'GROUP' && !selectedGroupId) {
      toast.error('يرجى اختيار المجموعة الدراسية المستهدفة');
      return;
    }
    if (targetType === 'GRADE' && !selectedGrade) {
      toast.error('يرجى اختيار المرحلة الدراسية المستهدفة');
      return;
    }
    if (!body.trim()) {
      toast.error('يرجى كتابة نص الرسالة أولاً');
      return;
    }
    if (body.trim().length > 1000) {
      toast.error('نص الرسالة يجب ألا يتجاوز 1000 حرف');
      return;
    }

    setIsLoadingAudience(true);
    try {
      const audience = await fetchTeacherMessageAudience({
        targetType,
        groupId: targetType === 'GROUP' ? selectedGroupId : undefined,
        gradeLevel: targetType === 'GRADE' ? selectedGrade : undefined,
      });
      setAudienceData(audience);
      setIsPreviewOpen(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'تعذر جلب بيانات الجمهور المستهدف';
      toast.error(msg);
    } finally {
      setIsLoadingAudience(false);
    }
  };

  // Handle confirm send
  const handleConfirmSend = () => {
    if (!audienceData || audienceData.reachedParentCount === 0) {
      toast.error('لا يمكن الإرسال: لا يوجد أولياء أمور مربوطين');
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

  const selectedGroupName = useMemo(() => {
    if (targetType !== 'GROUP') return '';
    const g = groups.find((item) => item._id === selectedGroupId);
    return g ? g.name : '';
  }, [groups, selectedGroupId, targetType]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              رسائل أولياء الأمور
            </h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200">
              البث الفوري
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            إرسال إشعارات فورية ورسائل مخصصة لأولياء أمور الطلاب حسب المجموعة أو المرحلة الدراسية
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Form Card: Compose Message ── */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-5">
          <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-600" />
              إنشاء رسالة جديدة
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              حدد الجمهور المستهدف واكتب نص الرسالة
            </p>
          </div>

          {/* Target Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              نوع الاستهداف
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('GROUP')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  targetType === 'GROUP'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Users className="h-4 w-4" />
                مجموعة دراسية
              </button>

              <button
                type="button"
                onClick={() => setTargetType('GRADE')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  targetType === 'GRADE'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                مرحلة كاملة
              </button>
            </div>
          </div>

          {/* Target Selector Dropdown */}
          {targetType === 'GROUP' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                المجموعة المستهدفة <span className="text-red-500">*</span>
              </label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-full text-right" dir="rtl">
                  <SelectValue placeholder={isLoadingGroups ? 'جاري التحميل...' : 'اختر المجموعة'} />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {groups.map((group) => (
                    <SelectItem key={group._id} value={group._id}>
                      {group.name} ({group.gradeLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                المرحلة الدراسية <span className="text-red-500">*</span>
              </label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="w-full text-right" dir="rtl">
                  <SelectValue placeholder="اختر المرحلة الدراسية" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {allowedGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title (Optional) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                عنوان الرسالة (اختياري)
              </label>
              <span className="text-[11px] text-gray-400">{title.length}/80</span>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="مثال: تنبيه هام بخصوص موعد الامتحان"
              className="text-right"
              maxLength={80}
            />
          </div>

          {/* Message Body */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                نص الرسالة <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] ${body.length > 900 ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                {body.length}/1000
              </span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 1000))}
              placeholder="اكتب رسالتك لأولياء الأمور هنا..."
              rows={5}
              className="text-right resize-none text-sm leading-relaxed"
              maxLength={1000}
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              💡 سيصل ولي الأمر إشعار فوري (Push Notification) مع إمكانية قراءة الرسالة كاملة داخل التطبيق.
            </p>
          </div>

          {/* Action Button */}
          <Button
            type="button"
            onClick={handleOpenPreview}
            disabled={isLoadingAudience || !body.trim() || sendMutation.isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 flex items-center justify-center gap-2"
          >
            {isLoadingAudience ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري احتساب الجمهور...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                معاينة وتأكيد الإرسال
              </>
            )}
          </Button>
        </div>

        {/* ── Table Card: History ── */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  الرسائل المرسلة سابقاً
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">سجل الرسائل التي تم بثها لأولياء الأمور</p>
              </div>
              {isFetchingMessages && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>

            {isLoadingMessages ? (
              <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm">جاري تحميل سجل الرسائل...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-gray-400 gap-3 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-6">
                <MessageSquare className="h-10 w-10 text-gray-300 dark:text-gray-700" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">لا توجد رسائل سابقة</p>
                  <p className="text-xs text-gray-400 mt-1">
                    قم بإنشاء أول رسالة وبثها لأولياء الأمور من النموذج المقابل.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold bg-gray-50/50 dark:bg-gray-800/30">
                      <th className="py-3 px-3">التاريخ والوقت</th>
                      <th className="py-3 px-3">المستهدف</th>
                      <th className="py-3 px-3">الرسالة</th>
                      <th className="py-3 px-3">الحالة</th>
                      <th className="py-3 px-3">نسبة الوصول</th>
                      <th className="py-3 px-2 text-center">عرض</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {messages.map((msg) => {
                      const isGroup = msg.targetType === 'GROUP';
                      const dateFormatted = new Date(msg.createdAt).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });
                      const timeFormatted = new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={msg._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="py-3 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            <div>{dateFormatted}</div>
                            <div className="text-[10px] text-gray-400">{timeFormatted}</div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {isGroup ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 text-[10px]">
                                <Users className="h-3 w-3 ml-1" />
                                {msg.groupName || 'مجموعة'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 text-[10px]">
                                <GraduationCap className="h-3 w-3 ml-1" />
                                {msg.gradeLevel}
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-3 max-w-[200px]">
                            {msg.title && (
                              <div className="font-semibold text-gray-900 dark:text-white truncate">
                                {msg.title}
                              </div>
                            )}
                            <div className="text-gray-500 truncate" title={msg.body}>
                              {msg.body}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {msg.status === 'SENT' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                تم الإرسال
                              </Badge>
                            ) : msg.status === 'SENDING' ? (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                جاري الإرسال
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                تعذر الإرسال
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {msg.reachedParentCount}
                            </span>
                            <span className="text-gray-400 text-[11px]"> ولي أمر ({msg.targetStudentCount} طالب)</span>
                          </td>

                          <td className="py-3 px-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingMessage(msg)}
                              className="h-7 w-7 text-gray-500 hover:text-indigo-600"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-500">
              <div>
                صفحة <span className="font-bold text-gray-900 dark:text-white">{page}</span> من {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 px-2 text-xs"
                >
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 px-2 text-xs"
                >
                  التالي
                  <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview & Confirmation Dialog ── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-600" />
              معاينة وتأكيد إرسال الرسالة
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              يرجى مراجعة تفاصيل الاستهداف وأعداد المستلمين قبل التأكيد
            </DialogDescription>
          </DialogHeader>

          {audienceData && (
            <div className="space-y-4 py-2">
              {/* Audience Statistics Grid */}
              <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                <div>
                  <div className="text-[11px] text-gray-500">إجمالي الطلاب</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {audienceData.targetStudentCount}
                  </div>
                </div>
                <div className="border-x border-gray-200 dark:border-gray-700">
                  <div className="text-[11px] text-gray-500">أولياء الأمور المربوطين</div>
                  <div className={`text-base font-bold mt-0.5 ${audienceData.reachedParentCount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {audienceData.reachedParentCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">طلاب بدون ولي أمر</div>
                  <div className={`text-base font-bold mt-0.5 ${audienceData.studentsWithoutParentCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {audienceData.studentsWithoutParentCount}
                  </div>
                </div>
              </div>

              {/* Zero Audience Error Banner (Requirement 2) */}
              {audienceData.reachedParentCount === 0 && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <strong className="font-bold block">لا يمكن إرسال الرسالة:</strong>
                    لا يوجد أي أولياء أمور مربوطين بالطلاب المستهدفين في هذا النطاق حتى الآن.
                  </div>
                </div>
              )}

              {/* Unlinked Students Warning Notice */}
              {audienceData.reachedParentCount > 0 && audienceData.studentsWithoutParentCount > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    تنبيه: هناك <strong>{audienceData.studentsWithoutParentCount}</strong> طالب ليس لديهم ولي أمر مربوط، ولن تصلهم هذه الرسالة.
                  </div>
                </div>
              )}

              {/* Target & Content Summary */}
              <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-2 bg-white dark:bg-gray-900 text-xs">
                <div>
                  <span className="text-gray-400">النطاق: </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {targetType === 'GROUP' ? `مجموعة: ${selectedGroupName}` : `مرحلة: ${selectedGrade}`}
                  </span>
                </div>
                {title && (
                  <div>
                    <span className="text-gray-400">العنوان: </span>
                    <span className="font-bold text-gray-900 dark:text-white">{title}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400 block mb-1">النص:</span>
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {body}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              className="text-xs"
            >
              إلغاء وتعديل
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSend}
              // Disabled completely if reachedParentCount === 0 (Requirement 2)
              disabled={
                sendMutation.isPending ||
                !audienceData ||
                audienceData.reachedParentCount === 0
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  جاري البث...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  تأكيد وإرسال للجميع
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Sent Message Details Dialog ── */}
      <Dialog open={!!viewingMessage} onOpenChange={(open) => !open && setViewingMessage(null)}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              تفاصيل الرسالة المرسلة
            </DialogTitle>
          </DialogHeader>

          {viewingMessage && (
            <div className="space-y-3 py-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">تاريخ الإرسال:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {new Date(viewingMessage.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">نطاق الاستهداف:</span>
                <span>
                  {viewingMessage.targetType === 'GROUP'
                    ? `مجموعة: ${viewingMessage.groupName || 'مجموعة'}`
                    : `مرحلة: ${viewingMessage.gradeLevel}`}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-400">إحصائيات التسليم:</span>
                <span className="text-emerald-600 font-bold">
                  وصلت إلى {viewingMessage.reachedParentCount} ولي أمر (من إجمالي {viewingMessage.targetStudentCount} طالب)
                </span>
              </div>

              {viewingMessage.title && (
                <div>
                  <span className="text-gray-400 block mb-1">العنوان:</span>
                  <div className="font-bold text-gray-900 dark:text-white p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    {viewingMessage.title}
                  </div>
                </div>
              )}

              <div>
                <span className="text-gray-400 block mb-1">نص الرسالة:</span>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {viewingMessage.body}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewingMessage(null)}
              className="text-xs"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

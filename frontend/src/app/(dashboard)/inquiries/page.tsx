'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth.store';
import { QK } from '@/lib/query-keys';
import {
  fetchInquiryCounts,
  fetchStaffInquiries,
  fetchStaffInquiryById,
  replyToInquiry,
  escalateInquiry,
} from '@/lib/api/inquiries';
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type InquiryBoxFilter,
  type InquiryCategory,
  type InquiryStateFilter,
  type InquiryStatus,
} from '@/types/inquiry.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Inbox,
  Send,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  User,
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  ShieldAlert,
  MessageSquareText,
} from 'lucide-react';

function generateRequestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function extractApiError(
  err: unknown,
  fallbackMessage: string
): { code?: string; message: string } {
  if (typeof err === 'object' && err !== null) {
    const maybeAxios = err as {
      message?: string;
      response?: { data?: { code?: string; message?: string } };
    };
    const code = maybeAxios.response?.data?.code;
    const message =
      maybeAxios.response?.data?.message ||
      maybeAxios.message ||
      fallbackMessage;
    return { code, message };
  }
  return { message: fallbackMessage };
}

const CATEGORY_OPTIONS: Array<{ value: 'ALL' | InquiryCategory; label: string }> = [
  { value: 'ALL', label: 'كل التصنيفات' },
  { value: 'ABSENCE_EXCUSE', label: INQUIRY_CATEGORY_LABELS.ABSENCE_EXCUSE },
  { value: 'FINANCIAL', label: INQUIRY_CATEGORY_LABELS.FINANCIAL },
  { value: 'ACADEMIC_LEVEL', label: INQUIRY_CATEGORY_LABELS.ACADEMIC_LEVEL },
  { value: 'GROUP_CHANGE', label: INQUIRY_CATEGORY_LABELS.GROUP_CHANGE },
  { value: 'GENERAL', label: INQUIRY_CATEGORY_LABELS.GENERAL },
];

function getStatusBadgeConfig(status: InquiryStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: INQUIRY_STATUS_LABELS.PENDING,
        className:
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
        icon: Clock,
      };
    case 'ESCALATED':
      return {
        label: INQUIRY_STATUS_LABELS.ESCALATED,
        className:
          'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300',
        icon: ArrowUpRight,
      };
    case 'REPLIED':
      return {
        label: INQUIRY_STATUS_LABELS.REPLIED,
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
        icon: CheckCircle2,
      };
    case 'CANCELLED':
      return {
        label: INQUIRY_STATUS_LABELS.CANCELLED,
        className:
          'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
        icon: XCircle,
      };
  }
}

function getCategoryBadgeClass(category: InquiryCategory): string {
  switch (category) {
    case 'ABSENCE_EXCUSE':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'FINANCIAL':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ACADEMIC_LEVEL':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'GROUP_CHANGE':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'GENERAL':
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export default function InquiriesPage() {
  const user = useAuthStore((s) => s.user);
  const isAllowed =
    user?.role === 'teacher' ||
    (user?.role === 'assistant' &&
      user?.assistantPermissions?.canManageInquiries === true);

  if (!isAllowed) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6"
        dir="rtl"
      >
        <ShieldAlert className="h-12 w-12 text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          غير مصرح بالوصول
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          صفحة إدارة استفسارات وطلبات أولياء الأمور متاحة للمعلم أو للمساعد
          المخوّل بصلاحية إدارة الاستفسارات فقط.
        </p>
      </div>
    );
  }

  return <InquiriesDashboardContent />;
}

function InquiriesDashboardContent() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isAssistant = user?.role === 'assistant';

  // Filters & Pagination
  const [boxFilter, setBoxFilter] = useState<InquiryBoxFilter>(
    isAssistant ? 'assistant' : 'all'
  );
  const [stateFilter, setStateFilter] = useState<InquiryStateFilter>('open');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | InquiryCategory>(
    'ALL'
  );
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  // Selected Inquiry & Drafts
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    null
  );
  const [replyBody, setReplyBody] = useState<string>('');
  const [replyClientRequestId, setReplyClientRequestId] = useState<string>(() =>
    generateRequestId()
  );
  const [staleNotice, setStaleNotice] = useState<string | null>(null);

  // Escalate Dialog state
  const [isEscalateOpen, setIsEscalateOpen] = useState<boolean>(false);
  const [escalateNote, setEscalateNote] = useState<string>('');

  const handleChangeBoxFilter = (nextBox: InquiryBoxFilter) => {
    setBoxFilter(nextBox);
    setPage(1);
  };

  const handleChangeStateFilter = (nextState: InquiryStateFilter) => {
    setStateFilter(nextState);
    setPage(1);
  };

  const handleChangeCategoryFilter = (nextCat: 'ALL' | InquiryCategory) => {
    setCategoryFilter(nextCat);
    setPage(1);
  };

  const handleReplyBodyChange = (nextText: string) => {
    setReplyBody(nextText);
    setReplyClientRequestId(generateRequestId());
  };

  // Clear draft & stale banner when switching to a different inquiry
  const handleSelectInquiry = (id: string) => {
    if (id !== selectedInquiryId) {
      setSelectedInquiryId(id);
      setReplyBody('');
      setStaleNotice(null);
      setEscalateNote('');
      setReplyClientRequestId(generateRequestId());
    }
  };

  // 1. Fetch Counts
  const { data: countsData, isFetching: isFetchingCounts } = useQuery({
    queryKey: QK.inquiries.counts,
    queryFn: fetchInquiryCounts,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // 2. Fetch Inquiries List
  const listFilters = useMemo(
    () => ({
      box: boxFilter,
      state: stateFilter,
      category: categoryFilter === 'ALL' ? undefined : categoryFilter,
      page,
      limit,
    }),
    [boxFilter, stateFilter, categoryFilter, page, limit]
  );

  const {
    data: listData,
    isLoading: isLoadingList,
    isFetching: isFetchingList,
    isError: isListError,
    refetch: refetchList,
  } = useQuery({
    queryKey: QK.inquiries.list(listFilters),
    queryFn: () => fetchStaffInquiries(listFilters),
  });

  const inquiries = useMemo(() => listData?.inquiries ?? [], [listData]);
  const totalPages = listData?.totalPages || 1;
  const totalCount = listData?.total || 0;

  const effectiveSelectedId = selectedInquiryId ?? inquiries[0]?._id ?? null;

  // 3. Fetch Selected Inquiry Detail + Live Student Context
  const {
    data: detailData,
    isLoading: isLoadingDetail,
    isFetching: isFetchingDetail,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: QK.inquiries.detail(effectiveSelectedId || ''),
    queryFn: () => fetchStaffInquiryById(effectiveSelectedId!),
    enabled: !!effectiveSelectedId,
  });

  const activeInquiry = detailData?.inquiry;
  const studentContext = detailData?.studentContext;

  // 4. Reply Mutation
  const replyMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      body: string;
      clientRequestId: string;
      expectedEditCount?: number;
    }) =>
      replyToInquiry(payload.id, {
        body: payload.body,
        clientRequestId: payload.clientRequestId,
        expectedEditCount: payload.expectedEditCount,
      }),
    onSuccess: () => {
      toast.success('تم إرسال الرد وإشعار ولي الأمر بنجاح');
      setReplyBody('');
      setStaleNotice(null);
      setReplyClientRequestId(generateRequestId());
      queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
      if (effectiveSelectedId) {
        queryClient.invalidateQueries({
          queryKey: QK.inquiries.detail(effectiveSelectedId),
        });
      }
    },
    onError: (err: unknown) => {
      const { code, message: msg } = extractApiError(
        err,
        'حدث خطأ أثناء إرسال الرد'
      );

      if (code === 'STALE_INQUIRY') {
        // Keep replyBody draft intact, show warning banner, and refresh inquiry detail
        setStaleNotice(
          'قام ولي الأمر بتعديل نص الطلب أثناء كتابتك للرد. تم تحديث النص أدناه — يرجى مراجعته ثم الضغط على إرسال الرد مجدداً.'
        );
        toast.warning(
          'قام ولي الأمر بتعديل نص الطلب! تم تحديث النص مع الاحتفاظ بمسودة ردك.'
        );
        if (effectiveSelectedId) {
          queryClient.invalidateQueries({
            queryKey: QK.inquiries.detail(effectiveSelectedId),
          });
        }
        queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
        return;
      }

      if (code === 'ALREADY_REPLIED' || code === 'INQUIRY_CANCELLED') {
        toast.error(msg);
        if (effectiveSelectedId) {
          queryClient.invalidateQueries({
            queryKey: QK.inquiries.detail(effectiveSelectedId),
          });
        }
        queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
        return;
      }

      toast.error(msg);
    },
  });

  // 5. Escalate Mutation
  const escalateMutation = useMutation({
    mutationFn: (payload: { id: string; note?: string }) =>
      escalateInquiry(payload.id, { note: payload.note }),
    onSuccess: () => {
      toast.success('تم تحويل الطلب للمستر بنجاح');
      setIsEscalateOpen(false);
      setEscalateNote('');
      queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
      if (effectiveSelectedId) {
        queryClient.invalidateQueries({
          queryKey: QK.inquiries.detail(effectiveSelectedId),
        });
      }
    },
    onError: (err: unknown) => {
      const { message: msg } = extractApiError(
        err,
        'تعذر تحويل الطلب للمستر'
      );
      toast.error(msg);
      if (effectiveSelectedId) {
        queryClient.invalidateQueries({
          queryKey: QK.inquiries.detail(effectiveSelectedId),
        });
      }
      queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
    },
  });

  const handleSendReply = () => {
    if (!activeInquiry) return;
    const clean = replyBody.trim();
    if (!clean) {
      toast.error('يرجى كتابة نص الرد أولاً');
      return;
    }
    if (clean.length > 2000) {
      toast.error('نص الرد يجب ألا يتجاوز 2000 حرف');
      return;
    }

    replyMutation.mutate({
      id: activeInquiry._id,
      body: clean,
      clientRequestId: replyClientRequestId,
      expectedEditCount: activeInquiry.editCount,
    });
  };

  const handleConfirmEscalate = () => {
    if (!activeInquiry) return;
    const cleanNote = escalateNote.trim();
    if (cleanNote.length > 300) {
      toast.error('ملاحظة التحويل يجب ألا تتجاوز 300 حرف');
      return;
    }
    escalateMutation.mutate({
      id: activeInquiry._id,
      note: cleanNote || undefined,
    });
  };

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: QK.inquiries.all });
    if (effectiveSelectedId) {
      queryClient.invalidateQueries({
        queryKey: QK.inquiries.detail(effectiveSelectedId),
      });
    }
  };

  const assistantOpenCount = countsData?.assistantOpen ?? 0;
  const escalatedOpenCount = countsData?.escalatedOpen ?? 0;
  const totalOpenCount = countsData?.totalOpen ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">
      {/* ── Page Header & Summary Counters ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Inbox className="h-6 w-6 text-indigo-600" />
            استفسارات وطلبات أولياء الأمور
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            استقبال استفسارات واعتذارات أولياء الأمور والرد عليها مع إشعار فوري
            في تطبيق ولي الأمر
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setBoxFilter('assistant');
              setStateFilter('open');
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              boxFilter === 'assistant' && stateFilter === 'open'
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Clock className="h-4 w-4 text-amber-600" />
            <span>صندوق الأسيستنت</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px]">
              {assistantOpenCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBoxFilter('teacher');
              setStateFilter('open');
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              boxFilter === 'teacher' && stateFilter === 'open'
                ? 'bg-purple-50 border-purple-300 text-purple-800 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ArrowUpRight className="h-4 w-4 text-purple-600" />
            <span>المحوّلة للمستر</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px]">
              {escalatedOpenCount}
            </span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetchingList || isFetchingCounts}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                isFetchingList || isFetchingCounts ? 'animate-spin' : ''
              }`}
            />
            تحديث
          </Button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Box & State Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Box Filter */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-800/50">
            {[
              { id: 'all', label: `الكل (${totalOpenCount} مفتوح)` },
              { id: 'assistant', label: 'صندوق الأسيستنت' },
              { id: 'teacher', label: 'المحوّلة للمستر' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleChangeBoxFilter(b.id as InquiryBoxFilter)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  boxFilter === b.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* State Filter */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-800/50">
            {[
              { id: 'open', label: 'المفتوحة' },
              { id: 'replied', label: 'تم الرد' },
              { id: 'cancelled', label: 'الملغاة' },
              { id: 'all', label: 'كل الحالات' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  handleChangeStateFilter(s.id as InquiryStateFilter)
                }
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  stateFilter === s.id
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
            التصنيف:
          </span>
          <select
            value={categoryFilter}
            onChange={(e) =>
              handleChangeCategoryFilter(
                e.target.value as 'ALL' | InquiryCategory
              )
            }
            className="text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Two-Column Master/Detail Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Right Column: Inquiries List (5 cols) ── */}
        <div className="lg:col-span-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/60 dark:bg-gray-800/40">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              قائمة الطلبات ({totalCount})
            </span>
            {isFetchingList && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            )}
          </div>

          {isLoadingList ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              <p className="text-xs">جاري تحميل الاستفسارات...</p>
            </div>
          ) : isListError ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-xs text-gray-600">
                تعذر تحميل قائمة الاستفسارات
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchList()}
                className="text-xs mt-1"
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center text-gray-400 gap-2">
              <Inbox className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                لا توجد طلبات مطابقة للفلتر الحالي
              </p>
              <p className="text-xs text-gray-400">
                ستظهر هنا استفسارات واعتذارات أولياء الأمور فور إرسالها.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[640px] overflow-y-auto">
              {inquiries.map((inq) => {
                const isSelected = inq._id === effectiveSelectedId;
                const statusCfg = getStatusBadgeConfig(inq.status);
                const StatusIcon = statusCfg.icon;
                const createdDate = new Date(inq.createdAt).toLocaleDateString(
                  'ar-EG',
                  {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                );

                return (
                  <button
                    key={inq._id}
                    type="button"
                    onClick={() => handleSelectInquiry(inq._id)}
                    className={`w-full text-right p-4 transition-colors flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-r-4 border-indigo-600'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {inq.studentName || 'طالب'}
                        </div>
                        {inq.groupName && (
                          <div className="text-[11px] text-gray-500 truncate mt-0.5">
                            {inq.groupName}
                          </div>
                        )}
                      </div>

                      <Badge
                        className={`text-[10px] px-2 py-0.5 border gap-1 shrink-0 ${statusCfg.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
                          inq.category
                        )}`}
                      >
                        {INQUIRY_CATEGORY_LABELS[inq.category] || inq.category}
                      </span>

                      {inq.editCount > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Edit3 className="h-2.5 w-2.5" />
                          معدّل ({inq.editCount})
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {inq.body}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                      <span>{createdDate}</span>
                      {inq.editedAt && (
                        <span>
                          آخر تعديل:{' '}
                          {new Date(inq.editedAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/40 text-xs">
              <span className="text-gray-500">
                صفحة {page} من {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Left Column: Inquiry Details, Student Context & Reply (7 cols) ── */}
        <div className="lg:col-span-7 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 min-h-[480px]">
          {!effectiveSelectedId ? (
            <div className="h-96 flex flex-col items-center justify-center text-center text-gray-400 gap-2">
              <MessageSquareText className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                اختر طلباً من القائمة لعرض التفاصيل والرد
              </p>
            </div>
          ) : isLoadingDetail ? (
            <div className="h-96 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-xs">جاري تحميل تفاصيل الطلب وسياق الطالب...</p>
            </div>
          ) : isDetailError || !activeInquiry ? (
            <div className="h-96 flex flex-col items-center justify-center text-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-xs text-gray-600">
                تعذر تحميل تفاصيل هذا الطلب
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchDetail()}
                className="text-xs"
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Detail Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {activeInquiry.studentName || 'طالب'}
                    </h2>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(
                        activeInquiry.category
                      )}`}
                    >
                      {INQUIRY_CATEGORY_LABELS[activeInquiry.category] ||
                        activeInquiry.category}
                    </span>
                    {(() => {
                      const cfg = getStatusBadgeConfig(activeInquiry.status);
                      const Icon = cfg.icon;
                      return (
                        <Badge
                          className={`text-xs px-2.5 py-0.5 border gap-1 ${cfg.className}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span>
                      تاريخ الإرسال:{' '}
                      {new Date(activeInquiry.createdAt).toLocaleString(
                        'ar-EG'
                      )}
                    </span>
                    {activeInquiry.editCount > 0 && (
                      <span className="text-amber-700 font-semibold">
                        • تم تعديل النص {activeInquiry.editCount} مرة
                        {activeInquiry.editedAt
                          ? ` (آخر تعديل: ${new Date(
                              activeInquiry.editedAt
                            ).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })})`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>

                {isFetchingDetail && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>

              {/* ── Live Student Context Card (`studentContext`) ── */}
              {studentContext && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      <User className="h-4 w-4 text-indigo-600" />
                      <span>بطاقة سياق الطالب اللحظية</span>
                      {studentContext.studentCode && (
                        <span className="px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-indigo-200 text-indigo-700 font-mono text-[11px]">
                          كود: {studentContext.studentCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                      {studentContext.groupName && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          {studentContext.groupName}
                        </span>
                      )}
                      {studentContext.gradeLevel && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                          {studentContext.gradeLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* Attendance Last 30 Days */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-gray-400 flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3 text-emerald-600" />
                        حضور آخر 30 يوم
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white mt-1">
                        {studentContext.attendanceLast30Days.present} حاضر •{' '}
                        <span
                          className={
                            studentContext.attendanceLast30Days.absent > 0
                              ? 'text-rose-600'
                              : ''
                          }
                        >
                          {studentContext.attendanceLast30Days.absent} غائب
                        </span>
                      </div>
                    </div>

                    {/* Late / Excused / Consecutive */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-gray-400">
                        تأخير / اعتذار / متتالي
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white mt-1">
                        {studentContext.attendanceLast30Days.late} متأخر •{' '}
                        {studentContext.attendanceLast30Days.excused} مستأذن
                        {studentContext.attendanceLast30Days
                          .consecutiveAbsences > 0 && (
                          <span className="text-rose-600 mr-1">
                            ({studentContext.attendanceLast30Days.consecutiveAbsences}{' '}
                            متتالي)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial Debt */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-amber-600" />
                        الحالة المالية
                      </div>
                      <div
                        className={`font-bold mt-1 ${
                          studentContext.financial.hasOutstandingDebt
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {studentContext.financial.hasOutstandingDebt
                          ? `مديونية: ${studentContext.financial.totalDebt} ج.م`
                          : 'خالص الاشتراك'}
                      </div>
                    </div>

                    {/* Remaining Sessions */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800">
                      <div className="text-[11px] text-gray-400">
                        رصيد الحصص بالدورة
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white mt-1">
                        {studentContext.financial.remainingSessions} حصة متبقية
                        {studentContext.financial.cycleNumber > 0
                          ? ` (دورة ${studentContext.financial.cycleNumber})`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Stale Inquiry Warning Banner (409 STALE_INQUIRY) ── */}
              {staleNotice && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">تنبيه تحديث النص من ولي الأمر:</div>
                    <div>{staleNotice}</div>
                  </div>
                </div>
              )}

              {/* ── Escalation Notice Banner ── */}
              {(activeInquiry.status === 'ESCALATED' ||
                activeInquiry.escalatedAt) && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 dark:bg-purple-950/30 p-3.5 text-xs space-y-1">
                  <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4 text-purple-600" />
                    تم تحويل هذا الطلب للمستر
                    {activeInquiry.escalatedAt && (
                      <span className="text-[11px] font-normal text-purple-600">
                        ({new Date(activeInquiry.escalatedAt).toLocaleString('ar-EG')})
                      </span>
                    )}
                  </div>
                  {activeInquiry.escalationNote && (
                    <p className="text-purple-800 dark:text-purple-300">
                      ملاحظة التحويل: {activeInquiry.escalationNote}
                    </p>
                  )}
                </div>
              )}

              {/* ── Parent Inquiry Message Body ── */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-500">
                  رسالة ولي الأمر:
                </span>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 p-4 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                  {activeInquiry.body}
                </div>
              </div>

              {/* ── Reply / Status Section ── */}
              {activeInquiry.status === 'REPLIED' && activeInquiry.reply ? (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        تم الرد بواسطة: {activeInquiry.reply.repliedByName}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        {activeInquiry.reply.repliedByRole === 'teacher'
                          ? 'المستر'
                          : 'الأسيستنت'}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-emerald-700">
                      {new Date(activeInquiry.reply.repliedAt).toLocaleString(
                        'ar-EG'
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed pt-1">
                    {activeInquiry.reply.body}
                  </div>
                </div>
              ) : activeInquiry.status === 'CANCELLED' ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
                  <span>
                    قام ولي الأمر بإلغاء هذا الطلب
                    {activeInquiry.cancelledAt
                      ? ` بتاريخ ${new Date(
                          activeInquiry.cancelledAt
                        ).toLocaleString('ar-EG')}`
                      : ''}
                    .
                  </span>
                </div>
              ) : activeInquiry.status === 'ESCALATED' && isAssistant ? (
                /* Q4: Read-only view for Assistant on ESCALATED inquiries */
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 flex items-center gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <div className="font-bold">
                      هذا الطلب محوّل للمستر (للقراءة فقط)
                    </div>
                    <div className="text-amber-700 mt-0.5">
                      تم تصعيد الطلب للمعلم للرد عليه مباشرة، ولا يمكن للمساعد
                      إرسال رد عليه.
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Reply Form */
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      كتابة الرد لولي الأمر:
                    </label>
                    <span
                      className={`text-[11px] ${
                        replyBody.length > 2000
                          ? 'text-red-600 font-bold'
                          : 'text-gray-400'
                      }`}
                    >
                      {replyBody.length} / 2000 حرف
                    </span>
                  </div>

                  <Textarea
                    value={replyBody}
                    onChange={(e) => handleReplyBodyChange(e.target.value)}
                    placeholder="اكتب ردك الواضح هنا... سيصل إشعار فوري لولي الأمر فور الإرسال."
                    rows={4}
                    maxLength={2000}
                    className="text-sm resize-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {activeInquiry.status === 'PENDING' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEscalateOpen(true)}
                        disabled={
                          replyMutation.isPending || escalateMutation.isPending
                        }
                        className="text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        تحويل للمستر
                      </Button>
                    ) : (
                      <div />
                    )}

                    <Button
                      type="button"
                      onClick={handleSendReply}
                      disabled={
                        replyMutation.isPending ||
                        !replyBody.trim() ||
                        replyBody.trim().length > 2000
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 px-5"
                    >
                      {replyMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          جاري إرسال الرد...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          إرسال الرد وإشعار ولي الأمر
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Escalate to Teacher Modal ── */}
      <Dialog open={isEscalateOpen} onOpenChange={setIsEscalateOpen}>
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-purple-600" />
              تحويل الطلب للمستر
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              سينتقل الطلب إلى صندوق المستر للرد عليه مباشرة، ولن يتمكن ولي الأمر
              من تعديله أو إلغائه أثناء المراجعة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                ملاحظة للمستر (اختياري):
              </label>
              <span className="text-[11px] text-gray-400">
                {escalateNote.length} / 300
              </span>
            </div>
            <Textarea
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="مثال: ولي الأمر يطلب استثناء خاص بموعد المجموعة..."
              rows={3}
              maxLength={300}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEscalateOpen(false)}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEscalate}
              disabled={escalateMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
            >
              {escalateMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  جاري التحويل...
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  تأكيد التحويل للمستر
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

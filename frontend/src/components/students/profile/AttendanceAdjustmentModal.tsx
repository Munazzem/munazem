'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { adjustCompletedAttendance, deleteStudentSessionAttendance } from '@/lib/api/attendance';
import type { AttendanceStatus } from '@/types/session.types';
import { toast } from 'sonner';
import { Check, X, Clock, HelpCircle, Trash2, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceAdjustmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId?: string;
    studentId: string;
    studentName?: string;
    sessionDate?: string | Date;
    currentStatus?: string;
    currentNotes?: string;
    canWrite?: boolean;
}

export function AttendanceAdjustmentModal({
    open,
    onOpenChange,
    sessionId,
    studentId,
    studentName,
    sessionDate,
    currentStatus = 'PRESENT',
    currentNotes = '',
    canWrite = true,
}: AttendanceAdjustmentModalProps) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<string>(currentStatus);
    const [notes, setNotes] = useState<string>(currentNotes);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (open) {
            setStatus(currentStatus);
            setNotes(currentNotes || '');
        }
    }, [open, currentStatus, currentNotes]);

    const formattedDate = sessionDate
        ? new Date(sessionDate).toLocaleDateString('ar-EG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '—';

    // Adjust Mutation
    const adjustMutation = useMutation({
        mutationFn: async () => {
            if (!sessionId) throw new Error('رقم الحصة غير متوفر');
            return adjustCompletedAttendance(
                sessionId,
                studentId,
                status as AttendanceStatus,
                notes.trim() || undefined
            );
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'تم تعديل حالة الحضور بنجاح');
            queryClient.invalidateQueries({ queryKey: ['student-report', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student', studentId] });
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['session-snapshot', sessionId] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء تعديل الحضور');
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!sessionId) throw new Error('رقم الحصة غير متوفر');
            return deleteStudentSessionAttendance(sessionId, studentId);
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'تم حذف الحصة من سجل الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['student-report', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student', studentId] });
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['session-snapshot', sessionId] });
            setShowDeleteConfirm(false);
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء حذف الحصة');
        },
    });

    const statusOptions = [
        {
            value: 'PRESENT' as AttendanceStatus,
            label: 'حاضر',
            icon: Check,
            activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-md',
            inactiveColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70',
        },
        {
            value: 'ABSENT' as AttendanceStatus,
            label: 'غائب',
            icon: X,
            activeColor: 'bg-rose-600 text-white border-rose-600 shadow-md',
            inactiveColor: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70',
        },
        {
            value: 'EXCUSED' as AttendanceStatus,
            label: 'بعذر',
            icon: HelpCircle,
            activeColor: 'bg-blue-600 text-white border-blue-600 shadow-md',
            inactiveColor: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70',
        },
        {
            value: 'LATE' as AttendanceStatus,
            label: 'متأخر',
            icon: Clock,
            activeColor: 'bg-amber-600 text-white border-amber-600 shadow-md',
            inactiveColor: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70',
        },
    ];

    const isPending = adjustMutation.isPending || deleteMutation.isPending;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md p-6 rounded-2xl">
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
                            <span>تعديل حالة الحصة</span>
                            <span className="text-xs font-normal text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-primary" /> {formattedDate}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 mt-1">
                            {studentName ? `الطالب: ${studentName}` : 'تعديل أو حذف تسجيل الحصة للطالب'}
                        </DialogDescription>
                    </DialogHeader>

                    {!sessionId ? (
                        <div className="py-6 text-center text-sm text-gray-400">
                            لا يمكن تعديل هذه الحصة لعدم توفر معرّف الجلسة.
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {/* Status Selector Grid */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">
                                    حالة الحضور:
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {statusOptions.map((opt) => {
                                        const Icon = opt.icon;
                                        const isSelected = status === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                disabled={!canWrite || isPending}
                                                onClick={() => setStatus(opt.value)}
                                                className={cn(
                                                    'flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-bold text-xs transition-all cursor-pointer select-none',
                                                    isSelected ? opt.activeColor : opt.inactiveColor,
                                                    (!canWrite || isPending) && 'opacity-50 cursor-not-allowed'
                                                )}
                                            >
                                                <Icon className="h-4 w-4 shrink-0" />
                                                <span>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Notes Textarea */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    ملاحظات الحصة (اختياري):
                                </label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="مثال: حضر كتعويض لحصة سابقة، استأذن لظرف طارئ..."
                                    className="text-xs resize-none h-20 rounded-xl"
                                    disabled={!canWrite || isPending}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row-reverse items-center justify-between gap-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                                className="rounded-xl text-xs"
                            >
                                إلغاء
                            </Button>
                            {canWrite && sessionId && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => adjustMutation.mutate()}
                                    disabled={isPending}
                                    className="bg-primary hover:bg-primary/90 rounded-xl text-xs font-bold"
                                >
                                    {adjustMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" />
                                            جاري الحفظ...
                                        </>
                                    ) : (
                                        'حفظ التعديل'
                                    )}
                                </Button>
                            )}
                        </div>

                        {canWrite && sessionId && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isPending}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف الحصة
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog for Session Deletion */}
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="حذف الحصة من سجل الطالب؟"
                description="سيتم إزالة هذا الطالب من سجلات الحضور لهذه الحصة بالكامل وإعادة حساب إحصائيات الغياب والحضور. هل تريد الاستمرار؟"
                confirmLabel="نعم، حذف الحصة"
                cancelLabel="إلغاء"
                variant="danger"
                onConfirm={() => deleteMutation.mutate()}
            />
        </>
    );
}

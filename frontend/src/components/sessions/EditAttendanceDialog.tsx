'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Edit2, BookCheck, BookX } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { IAttendanceRecord, AttendanceStatus } from '@/types/session.types';

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
    PRESENT: 'حاضر',
    ABSENT: 'غائب',
    LATE: 'متأخر',
    EXCUSED: 'مُستأذن',
};

interface EditAttendanceDialogProps {
    record: IAttendanceRecord;
    showHomeworkTracking?: boolean;
    onClose: () => void;
    onSave: (status: AttendanceStatus, notes?: string, homeworkDone?: boolean) => void;
}

export function EditAttendanceDialog({
    record,
    showHomeworkTracking = false,
    onClose,
    onSave,
}: EditAttendanceDialogProps) {
    const [status, setStatus] = useState<AttendanceStatus>(record.status);
    const [homeworkDone, setHomeworkDone] = useState<boolean>(record.homeworkDone ?? true);

    const isAttending = status === 'PRESENT' || status === 'LATE';

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[360px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit2 className="h-4 w-4 text-primary" />
                        تعديل حضور الطالب
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2 space-y-4">
                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            الطالب: <span className="font-semibold text-gray-900">{(record.studentId as any)?.studentName ?? '—'}</span>
                        </p>
                        <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {ATTENDANCE_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {showHomeworkTracking && isAttending && (
                        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                            <div className="flex items-center gap-2">
                                {homeworkDone ? (
                                    <BookCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                                ) : (
                                    <BookX className="h-4 w-4 text-rose-600 shrink-0" />
                                )}
                                <div>
                                    <label htmlFor="hw-check" className="text-sm font-semibold text-gray-800 cursor-pointer block">
                                        تسليم الواجب
                                    </label>
                                    <p className="text-[11px] text-gray-500">
                                        {homeworkDone ? 'تم تسليم الواجب بنجاح' : 'لم يتم تسليم الواجب'}
                                    </p>
                                </div>
                            </div>
                            <Checkbox
                                id="hw-check"
                                checked={homeworkDone}
                                onCheckedChange={(checked) => setHomeworkDone(Boolean(checked))}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>إلغاء</Button>
                    <Button onClick={() => onSave(status, undefined, isAttending ? homeworkDone : undefined)}>حفظ</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

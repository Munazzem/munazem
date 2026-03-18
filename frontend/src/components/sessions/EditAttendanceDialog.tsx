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
import { Edit2 } from 'lucide-react';
import type { IAttendanceRecord, AttendanceStatus } from '@/types/session.types';

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
    PRESENT: 'حاضر',
    ABSENT: 'غائب',
    LATE: 'متأخر',
    EXCUSED: 'مُستأذن',
};

interface EditAttendanceDialogProps {
    record: IAttendanceRecord;
    onClose: () => void;
    onSave: (status: AttendanceStatus, notes?: string) => void;
}

export function EditAttendanceDialog({
    record,
    onClose,
    onSave,
}: EditAttendanceDialogProps) {
    const [status, setStatus] = useState<AttendanceStatus>(record.status);

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[360px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit2 className="h-4 w-4 text-primary" />
                        تعديل حضور الطالب
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <p className="text-sm text-gray-600 mb-3">
                        الطالب: <span className="font-semibold">{(record.studentId as any)?.studentName ?? '—'}</span>
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
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>إلغاء</Button>
                    <Button onClick={() => onSave(status)}>حفظ</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

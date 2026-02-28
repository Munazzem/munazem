'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { StudentWithGroup } from '@/types/student.types';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Phone,
    User,
    GraduationCap,
    Hash,
    Printer,
    CheckCircle2,
    XCircle,
    QrCode,
} from 'lucide-react';

interface StudentProfileModalProps {
    student: StudentWithGroup | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function StudentProfileModal({ student, open, onOpenChange }: StudentProfileModalProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    useEffect(() => {
        if (!student || !open) return;
        const qrValue = student.barcode || student.studentCode || student._id;
        QRCode.toDataURL(qrValue, {
            width: 200,
            margin: 1,
            color: { dark: '#0f4c81', light: '#f0f6ff' },
            errorCorrectionLevel: 'H',
        }).then(url => setQrDataUrl(url));
    }, [student, open]);

    if (!student) return null;

    const groupName =
        typeof student.groupId === 'object' && student.groupId !== null
            ? (student.groupId as { name: string }).name
            : student.groupDetails?.name || '—';

    const qrValue = student.barcode || student.studentCode || student._id;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[680px] p-0 overflow-hidden rounded-2xl gap-0"
                dir="rtl"
            >
                {/* ── Thin top accent bar ── */}
                <div className="h-1 w-full bg-linear-to-r from-[#0f4c81] to-[#3b82f6]" />

                {/* hidden title for a11y */}
                <DialogTitle className="sr-only">بروفايل الطالب</DialogTitle>

                {/* ── Two-column body ── */}
                <div className="flex flex-row">

                    {/* ── LEFT: QR + code ── */}
                    <div className="w-[240px] shrink-0 bg-[#f0f6ff] flex flex-col items-center justify-center gap-4 p-6 border-l border-blue-100">
                        {/* QR label */}
                        <div className="flex items-center gap-1.5 text-[#0f4c81]">
                            <QrCode className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wide">كود الحضور</span>
                        </div>

                        {/* QR code image */}
                        <div className="rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                            {qrDataUrl ? (
                                <img src={qrDataUrl} alt="QR Code" width={200} height={200} />
                            ) : (
                                <div className="w-[200px] h-[200px] bg-white/60 flex items-center justify-center">
                                    <QrCode className="h-12 w-12 text-[#0f4c81]/30" />
                                </div>
                            )}
                        </div>

                        {/* Barcode value under QR */}
                        <div className="text-center">
                            <p className="text-[11px] text-gray-400 mb-1">امسح للتسجيل</p>
                            <p className="font-mono text-xs font-bold text-[#0f4c81] bg-white px-3 py-1 rounded-lg border border-blue-100 break-all" dir="ltr">
                                {qrValue}
                            </p>
                        </div>

                        {/* Print button */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.print()}
                            className="w-full gap-2 border-[#0f4c81]/30 text-[#0f4c81] hover:bg-[#0f4c81]/5 text-xs font-bold"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            طباعة
                        </Button>
                    </div>

                    {/* ── RIGHT: info ── */}
                    <div className="flex-1 flex flex-col">

                        {/* Header strip */}
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <div className="h-12 w-12 rounded-xl bg-[#0f4c81] flex items-center justify-center shrink-0">
                                        <span className="text-xl font-extrabold text-white">
                                            {student.studentName.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-extrabold text-gray-900 leading-tight">
                                            {student.studentName}
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5">{student.gradeLevel}</p>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <Badge className={cn(
                                    'shrink-0 text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1',
                                    student.isActive
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-600'
                                )}>
                                    {student.isActive
                                        ? <><CheckCircle2 className="h-3 w-3" /> نشط</>
                                        : <><XCircle className="h-3 w-3" /> موقوف</>
                                    }
                                </Badge>
                            </div>
                        </div>

                        {/* Info list */}
                        <div className="px-6 py-4 space-y-3 flex-1">
                            <InfoItem icon={User}         label="ولي الأمر"    value={student.parentName} />
                            <InfoItem icon={GraduationCap} label="المجموعة"    value={groupName} />
                            <InfoItem icon={Phone}        label="هاتف الطالب" value={student.studentPhone} ltr />
                            <InfoItem icon={Phone}        label="هاتف الأسرة" value={student.parentPhone}  ltr />
                            {student.studentCode && (
                                <InfoItem icon={Hash} label="الكود" value={student.studentCode} ltr />
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ── Small helper row ── */
function InfoItem({ icon: Icon, label, value, ltr }: {
    icon: React.ElementType;
    label: string;
    value: string;
    ltr?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-gray-400 font-medium leading-none mb-0.5">{label}</p>
                <p
                    className={cn('text-sm font-semibold text-gray-800 truncate', ltr && 'font-mono')}
                    dir={ltr ? 'ltr' : 'rtl'}
                >
                    {value || '—'}
                </p>
            </div>
        </div>
    );
}

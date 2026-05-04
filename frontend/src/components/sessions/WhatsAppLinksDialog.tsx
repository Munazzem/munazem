'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWhatsAppLinks } from '@/lib/api/attendance';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Loader2,
    MessageSquare,
    UserX,
    UserCheck,
    Send,
    ExternalLink,
    CheckCheck,
} from 'lucide-react';

interface WhatsAppLinksDialogProps {
    sessionId: string;
    open: boolean;
    onClose: () => void;
}

export function WhatsAppLinksDialog({
    sessionId,
    open,
    onClose,
}: WhatsAppLinksDialogProps) {
    const { data: links = [], isLoading } = useQuery({
        queryKey: ['whatsapp-links', sessionId],
        queryFn: () => getWhatsAppLinks(sessionId),
        enabled: open,
    });

    const [notifying, setNotifying] = useState(false);
    const [notified, setNotified]   = useState(false);

    const notifyAllAbsent = () => {
        if (absent.length === 0 || notifying) return;
        setNotifying(true);
        absent.forEach((l, i) => {
            setTimeout(() => {
                window.open(l.whatsappLink, '_blank');
                if (i === absent.length - 1) {
                    setNotifying(false);
                    setNotified(true);
                }
            }, i * 600);
        });
    };

    const present = links.filter((l) => l.status === 'PRESENT');
    const absent  = links.filter((l) => l.status === 'ABSENT');

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-600" />
                        إرسال رسائل واتساب لأولياء الأمور
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin ml-2" />
                        جارٍ التحميل...
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 -mx-6 px-6">
                        {/* Summary */}
                        <div className="flex gap-3 mb-4">
                            <div className="flex-1 bg-green-50 rounded-lg p-3 text-center border border-green-100">
                                <p className="text-lg font-bold text-green-700">{present.length}</p>
                                <p className="text-xs text-green-600">حاضر</p>
                            </div>
                            <div className="flex-1 bg-red-50 rounded-lg p-3 text-center border border-red-100">
                                <p className="text-lg font-bold text-red-600">{absent.length}</p>
                                <p className="text-xs text-red-500">غائب</p>
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                <p className="text-lg font-bold text-gray-700">{links.length}</p>
                                <p className="text-xs text-gray-500">إجمالي</p>
                            </div>
                        </div>

                        {/* Absent first (priority) */}
                        {absent.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        الغائبون — {absent.length}
                                    </p>
                                    <button
                                        onClick={notifyAllAbsent}
                                        disabled={notifying || notified}
                                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                                            notified
                                                ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                                                : notifying
                                                ? 'bg-green-50 text-green-600 border border-green-200 cursor-wait'
                                                : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
                                        }`}
                                    >
                                        {notified ? (
                                            <><CheckCheck className="h-3.5 w-3.5" /> تم الإرسال</>
                                        ) : notifying ? (
                                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ الفتح...</>
                                        ) : (
                                            <><Send className="h-3.5 w-3.5" /> 📲 إبلاغ الكل ({absent.length})</>
                                        )}
                                    </button>
                                </div>
                                <ul className="space-y-1.5">
                                    {absent.map((l) => (
                                        <li key={l.studentId}>
                                            <a
                                                href={l.whatsappLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserX className="h-4 w-4 text-red-400 shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800">{l.studentName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Send className="h-3.5 w-3.5" />
                                                    فتح واتساب
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Present */}
                        {present.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    الحاضرون — {present.length}
                                </p>
                                <ul className="space-y-1.5">
                                    {present.map((l) => (
                                        <li key={l.studentId}>
                                            <a
                                                href={l.whatsappLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-green-100 bg-green-50 hover:bg-green-100 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800">{l.studentName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Send className="h-3.5 w-3.5" />
                                                    فتح واتساب
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 mt-2">
                    <p className="text-xs text-gray-400 text-center">
                        اضغط على اسم الطالب لفتح محادثة واتساب مع ولي الأمر
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

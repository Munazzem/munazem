'use client';

import { useState } from 'react';
import { parentLookup } from '@/lib/api/parent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Phone,
    Search,
    Loader2,
    BookOpen,
    CalendarCheck,
    Banknote,
    ClipboardList,
    CheckCircle2,
    XCircle,
    AlertCircle,
    GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceEntry { date: string; status: 'PRESENT' | 'ABSENT' | 'GUEST' }
interface PaymentEntry    { date: string; paidAmount: number; discountAmount: number; category: string }
interface ExamEntry       { examId: string; score: number; totalMarks: number; passingMarks: number; date: string; isPassed: boolean }

interface StudentSummary {
    studentId:            string;
    studentName:          string;
    studentCode:          string;
    gradeLevel:           string;
    groupName:            string;
    isActive:             boolean;
    hasActiveSubscription: boolean;
    attendance: {
        totalSessions:   number;
        presentCount:    number;
        absentCount:     number;
        attendanceRate:  string;
        history:         AttendanceEntry[];
    };
    payments: {
        totalPaid:          number;
        subscriptionsCount: number;
        lastSubscriptions:  PaymentEntry[];
    };
    exams: ExamEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function AttendanceDot({ status }: { status: string }) {
    return (
        <span
            title={status === 'PRESENT' ? 'حضر' : status === 'ABSENT' ? 'غاب' : 'ضيف'}
            className={cn(
                'inline-block h-3 w-3 rounded-full',
                status === 'PRESENT' ? 'bg-green-400' :
                status === 'ABSENT'  ? 'bg-red-400'   : 'bg-amber-400'
            )}
        />
    );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ s }: { s: StudentSummary }) {
    const [tab, setTab] = useState<'attendance' | 'payments' | 'exams'>('attendance');

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Header */}
            <div className="p-5 border-b border-gray-50">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-[#1e3a6e]/10 flex items-center justify-center shrink-0">
                            <span className="text-lg font-extrabold text-[#1e3a6e]">
                                {s.studentName.charAt(0)}
                            </span>
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-base">{s.studentName}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{s.gradeLevel} · {s.groupName}</p>
                        </div>
                    </div>
                    <Badge className={cn(
                        'text-xs shrink-0',
                        s.hasActiveSubscription
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-red-100 text-red-600 hover:bg-red-100'
                    )}>
                        {s.hasActiveSubscription ? 'اشتراك فعّال' : 'لم يُجدَّد'}
                    </Badge>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-[#1e3a6e]">{s.attendance.attendanceRate}</p>
                        <p className="text-xs text-gray-400 mt-0.5">الحضور</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-gray-800">{s.payments.totalPaid.toLocaleString('ar-EG')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">إجمالي المدفوع ج</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-gray-800">{s.exams.length}</p>
                        <p className="text-xs text-gray-400 mt-0.5">امتحانات</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
                {([
                    { key: 'attendance', label: 'الحضور',    icon: CalendarCheck },
                    { key: 'payments',   label: 'الماليات',  icon: Banknote },
                    { key: 'exams',      label: 'الامتحانات', icon: ClipboardList },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
                            tab === key
                                ? 'text-[#1e3a6e] border-b-2 border-[#1e3a6e] bg-blue-50/30'
                                : 'text-gray-400 hover:text-gray-600'
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="p-4">

                {/* Attendance Tab */}
                {tab === 'attendance' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                                حضر <strong className="text-green-600">{s.attendance.presentCount}</strong> من <strong>{s.attendance.totalSessions}</strong> حصة
                            </span>
                            <span className="text-gray-400 text-xs">آخر {s.attendance.history.length} حصة</span>
                        </div>

                        {s.attendance.history.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد بيانات حضور بعد</p>
                        ) : (
                            <>
                                {/* Dot grid */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[...s.attendance.history].reverse().map((h, i) => (
                                        <AttendanceDot key={i} status={h.status} />
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="flex gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block" /> حضر</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" /> غاب</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" /> ضيف</span>
                                </div>

                                {/* Last 5 entries list */}
                                <div className="divide-y divide-gray-50">
                                    {s.attendance.history.slice(0, 5).map((h, i) => (
                                        <div key={i} className="flex items-center justify-between py-2.5">
                                            <span className="text-sm text-gray-600">{formatDate(h.date)}</span>
                                            <span className={cn(
                                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                                h.status === 'PRESENT' ? 'bg-green-50 text-green-700' :
                                                h.status === 'ABSENT'  ? 'bg-red-50 text-red-600'    : 'bg-amber-50 text-amber-700'
                                            )}>
                                                {h.status === 'PRESENT' ? 'حضر' : h.status === 'ABSENT' ? 'غاب' : 'ضيف'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Payments Tab */}
                {tab === 'payments' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                إجمالي الاشتراكات: <strong className="text-gray-800">{s.payments.subscriptionsCount}</strong>
                            </span>
                            <span className={cn(
                                'text-xs font-medium px-2.5 py-1 rounded-full',
                                s.hasActiveSubscription
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-600'
                            )}>
                                {s.hasActiveSubscription ? 'مشترك هذا الشهر ✓' : 'لم يُجدَّد هذا الشهر'}
                            </span>
                        </div>

                        {s.payments.lastSubscriptions.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد مدفوعات مسجلة</p>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {s.payments.lastSubscriptions.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between py-2.5">
                                        <div>
                                            <p className="text-sm text-gray-700 font-medium">
                                                {p.paidAmount.toLocaleString('ar-EG')} ج
                                            </p>
                                            {p.discountAmount > 0 && (
                                                <p className="text-xs text-gray-400">خصم: {p.discountAmount} ج</p>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400">{formatDate(p.date)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Exams Tab */}
                {tab === 'exams' && (
                    <div className="space-y-2">
                        {s.exams.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد امتحانات مسجلة</p>
                        ) : (
                            s.exams.map((e, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        {e.isPassed
                                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                            : <XCircle     className="h-4 w-4 text-red-400  shrink-0" />
                                        }
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">
                                                {e.score} / {e.totalMarks}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatDate(e.date)}</p>
                                        </div>
                                    </div>
                                    <Badge className={cn(
                                        'text-xs',
                                        e.isPassed
                                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                            : 'bg-red-100 text-red-600 hover:bg-red-100'
                                    )}>
                                        {e.isPassed ? 'ناجح' : 'راسب'}
                                    </Badge>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ParentPortalPage() {
    const [phone,    setPhone]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const [students, setStudents] = useState<StudentSummary[] | null>(null);
    const [error,    setError]    = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim()) { setError('أدخل رقم الهاتف'); return; }
        setError('');
        setLoading(true);
        setStudents(null);
        try {
            const data = await parentLookup(phone.trim());
            setStudents(Array.isArray(data) ? data : []);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? 'لم يتم العثور على أي طالب بهذا الرقم';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page title */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#1e3a6e]/10 mb-3">
                    <GraduationCap className="h-7 w-7 text-[#1e3a6e]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">متابعة أداء الطالب</h2>
                <p className="text-sm text-gray-500 mt-1">أدخل رقم هاتفك لعرض بيانات أبنائك</p>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم هاتف ولي الأمر
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                            className="pr-10 h-12"
                            disabled={loading}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-12 px-6 bg-[#1e3a6e] hover:bg-[#152a52] gap-2"
                    >
                        {loading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Search className="h-4 w-4" />
                        }
                        {loading ? 'جاري البحث...' : 'بحث'}
                    </Button>
                </div>

                {error && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
            </form>

            {/* Results */}
            {students !== null && students.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p>لا توجد بيانات مرتبطة بهذا الرقم</p>
                </div>
            )}

            {students && students.length > 0 && (
                <div className="space-y-4">
                    {students.length > 1 && (
                        <p className="text-sm text-gray-500 font-medium">
                            تم العثور على <strong>{students.length}</strong> طلاب مرتبطين بهذا الرقم
                        </p>
                    )}
                    {students.map(s => (
                        <StudentCard key={s.studentId} s={s} />
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useMemo } from 'react';
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
    AlertCircle,
    GraduationCap,
    Users,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttendanceEntry { date: string; status: 'PRESENT' | 'ABSENT' | 'GUEST' | 'EXCUSED' | 'LATE'; homeworkDone?: boolean | null }
interface PaymentEntry    { date: string; paidAmount: number; discountAmount: number; category: string }
interface ExamEntry       { examId: string; examName: string; score: number; totalMarks: number; passingMarks: number; date: string; isPassed: boolean }

interface StudentSummary {
    studentId:            string;
    studentName:          string;
    studentCode:          string;
    gradeLevel:           string;
    groupName:            string;
    teacherId?:           string;
    teacherName?:         string;
    subject?:             string;
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

interface ChildGroup {
    childName: string;
    gradeLevel: string;
    enrollments: StudentSummary[];
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
            title={status === 'PRESENT' || status === 'LATE' ? 'حضر' : status === 'ABSENT' ? 'غاب' : status === 'EXCUSED' ? 'معوض' : 'ضيف'}
            className={cn(
                'inline-block h-3 w-3 rounded-full',
                status === 'PRESENT' || status === 'LATE' ? 'bg-green-400' :
                status === 'ABSENT'  ? 'bg-red-400'   :
                status === 'EXCUSED' ? 'bg-indigo-400' : 'bg-amber-400'
            )}
        />
    );
}

// ─── Unified Child Card with Teacher Tabs ─────────────────────────────────────
function UnifiedChildCard({ childGroup }: { childGroup: ChildGroup }) {
    const { childName, gradeLevel, enrollments } = childGroup;
    const [selectedTeacherIdx, setSelectedTeacherIdx] = useState(0);
    const [tab, setTab] = useState<'attendance' | 'payments' | 'exams'>('attendance');

    const s = enrollments[selectedTeacherIdx] || enrollments[0];

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all">
            {/* Child Header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-blue-50/20 to-transparent">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                        <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-[#1e3a6e] to-[#2a5298] flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                            {childName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-gray-900 text-lg">{childName}</h2>
                                {enrollments.length > 1 && (
                                    <span className="bg-blue-50 text-[#1e3a6e] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {enrollments.length} معلمين
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{gradeLevel}</p>
                        </div>
                    </div>
                </div>

                {/* Teacher Tabs (Separation for multi-teacher students) */}
                {enrollments.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-[#1e3a6e]" />
                            اختر المعلم لعرض بيانات الطالب معه:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {enrollments.map((enr, idx) => {
                                const isSelected = selectedTeacherIdx === idx;
                                return (
                                    <button
                                        key={enr.studentId}
                                        type="button"
                                        onClick={() => setSelectedTeacherIdx(idx)}
                                        className={cn(
                                            'p-2.5 rounded-xl border text-right transition-all cursor-pointer relative overflow-hidden',
                                            isSelected
                                                ? 'bg-[#1e3a6e] text-white border-[#1e3a6e] shadow-sm ring-2 ring-[#1e3a6e]/20'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#1e3a6e]/40 hover:bg-white'
                                        )}
                                    >
                                        <p className="font-bold text-xs truncate">
                                            {enr.teacherName ? `أ. ${enr.teacherName}` : 'المعلم'}
                                        </p>
                                        <p className={cn('text-[11px] truncate mt-0.5', isSelected ? 'text-blue-100' : 'text-gray-400')}>
                                            {enr.subject || enr.groupName}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Single Teacher Label */}
                {enrollments.length === 1 && s.teacherName && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                        <GraduationCap className="h-4 w-4 text-[#1e3a6e] shrink-0" />
                        <span>المعلم: <strong className="text-gray-900">أ. {s.teacherName}</strong> {s.subject ? `(${s.subject})` : ''}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">المجموعة: <strong className="text-gray-800">{s.groupName}</strong></span>
                    </div>
                )}

                {/* Selected Teacher Details & Quick Stats */}
                <div className="mt-4 pt-3 border-t border-gray-50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">المجموعة:</span>
                            <span className="text-xs font-bold text-[#1e3a6e] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                {s.groupName}
                            </span>
                        </div>
                        {s.hasActiveSubscription ? (
                            <Badge className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                                اشتراك فعّال ✓
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs bg-rose-50 text-rose-600 border-rose-200">
                                غير مشترك
                            </Badge>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100/60">
                            <p className="text-lg font-extrabold text-[#1e3a6e]">{s.attendance.attendanceRate}</p>
                            <p className="text-xs text-gray-400 mt-0.5">نسبة الحضور</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100/60">
                            <p className="text-lg font-extrabold text-gray-800">{s.payments.totalPaid.toLocaleString('ar-EG')}</p>
                            <p className="text-xs text-gray-400 mt-0.5">المدفوع (ج)</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100/60">
                            <p className="text-lg font-extrabold text-gray-800">{s.exams.length}</p>
                            <p className="text-xs text-gray-400 mt-0.5">امتحانات مسجلة</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inner Feature Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/50">
                {([
                    { key: 'attendance', label: 'الحضور والغياب', icon: CalendarCheck },
                    { key: 'payments',   label: 'الاشتراكات والماليات', icon: Banknote },
                    { key: 'exams',      label: 'الامتحانات والدرجات', icon: ClipboardList },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer',
                            tab === key
                                ? 'text-[#1e3a6e] border-b-2 border-[#1e3a6e] bg-white'
                                : 'text-gray-400 hover:text-gray-600'
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-5">
                {/* ── Attendance Tab ── */}
                {tab === 'attendance' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                                حضر <strong className="text-emerald-600">{s.attendance.presentCount}</strong> من إجمالي <strong>{s.attendance.totalSessions}</strong> حصة
                            </span>
                            <span className="text-gray-400 text-xs">آخر {s.attendance.history.length} حصة</span>
                        </div>

                        {s.attendance.history.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد بيانات حضور مسجلة مع هذا المعلم بعد</p>
                        ) : (
                            <>
                                {/* Dot grid */}
                                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    {[...s.attendance.history].reverse().map((h, i) => (
                                        <AttendanceDot key={i} status={h.status} />
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block" /> حضر</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" /> غاب</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400 inline-block" /> معوض</span>
                                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" /> ضيف</span>
                                </div>

                                {/* Entries list */}
                                <div className="divide-y divide-gray-100 mt-3">
                                    {s.attendance.history.map((h, i) => (
                                        <div key={i} className="flex items-center justify-between py-2.5">
                                            <span className="text-sm font-medium text-gray-700">{formatDate(h.date)}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {typeof h.homeworkDone === 'boolean' && (h.status === 'PRESENT' || h.status === 'LATE' || h.status === 'GUEST') && (
                                                    <span className={cn(
                                                        'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                                                        h.homeworkDone
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    )}>
                                                        {h.homeworkDone ? 'الواجب ✓' : 'لم يؤدِّ الواجب ✗'}
                                                    </span>
                                                )}
                                                <span className={cn(
                                                    'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                                                    h.status === 'PRESENT' || h.status === 'LATE' ? 'bg-emerald-50 text-emerald-700' :
                                                    h.status === 'ABSENT'  ? 'bg-rose-50 text-rose-600' :
                                                    h.status === 'EXCUSED' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                                )}>
                                                    {h.status === 'PRESENT' ? 'حاضر' : h.status === 'LATE' ? 'متأخر' : h.status === 'ABSENT' ? 'غائب' : h.status === 'EXCUSED' ? 'معوّض' : 'ضيف'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Payments Tab ── */}
                {tab === 'payments' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                الاشتراكات المسجلة مع المعلم: <strong className="text-gray-800">{s.payments.subscriptionsCount}</strong>
                            </span>
                            {s.hasActiveSubscription && (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    مشترك الدورة الحالية ✓
                                </span>
                            )}
                        </div>

                        {s.payments.lastSubscriptions.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد مدفوعات مسجلة مع هذا المعلم</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {s.payments.lastSubscriptions.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between py-3">
                                        <div>
                                            <p className="text-sm text-gray-800 font-bold">
                                                {p.paidAmount.toLocaleString('ar-EG')} ج
                                            </p>
                                            {p.discountAmount > 0 && (
                                                <p className="text-xs text-amber-600 font-medium">خصم: {p.discountAmount} ج</p>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium">{formatDate(p.date)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Exams Tab ── */}
                {tab === 'exams' && (
                    <div className="space-y-3">
                        {s.exams.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-6">لا توجد امتحانات مسجلة مع هذا المعلم</p>
                        ) : (
                            s.exams.map((e, i) => (
                                <div key={i} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">
                                            {e.examName}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">{formatDate(e.date)}</p>
                                    </div>
                                    <div className="text-left" dir="ltr">
                                        <p className="text-sm font-extrabold text-[#1e3a6e]">
                                            {e.score} <span className="text-gray-400 text-xs font-normal">/ {e.totalMarks}</span>
                                        </p>
                                        <span className={cn(
                                            'text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5',
                                            e.isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                                        )}>
                                            {e.isPassed ? 'ناجح' : 'راسب'}
                                        </span>
                                    </div>
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

    // Group students by child name so multi-teacher enrollments appear under one unified child card with teacher tabs
    const groupedChildren = useMemo<ChildGroup[]>(() => {
        if (!students || students.length === 0) return [];

        const map = new Map<string, ChildGroup>();

        for (const s of students) {
            const key = s.studentName.trim().toLowerCase();
            if (!map.has(key)) {
                map.set(key, {
                    childName: s.studentName.trim(),
                    gradeLevel: s.gradeLevel,
                    enrollments: [],
                });
            }
            map.get(key)!.enrollments.push(s);
        }

        return Array.from(map.values());
    }, [students]);

    return (
        <div className="space-y-6">
            {/* Page title */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#1e3a6e]/10 mb-3 shadow-xs">
                    <GraduationCap className="h-7 w-7 text-[#1e3a6e]" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">متابعة أداء الطالب</h2>
                <p className="text-sm text-gray-500 mt-1">أدخل رقم هاتفك لعرض بيانات أبنائك مع جميع المعلمين</p>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                    رقم هاتف ولي الأمر
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                            className="pr-10 h-12 rounded-2xl text-base"
                            disabled={loading}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-12 px-6 rounded-2xl bg-[#1e3a6e] hover:bg-[#152a52] text-white font-bold gap-2 shadow-sm"
                    >
                        {loading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Search className="h-4 w-4" />
                        }
                        {loading ? 'جاري البحث...' : 'بحث'}
                    </Button>
                </div>

                {error && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
            </form>

            {/* Empty Results */}
            {students !== null && students.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border border-gray-100">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">لا توجد بيانات مرتبطة بهذا الرقم</p>
                </div>
            )}

            {/* Grouped Results */}
            {groupedChildren.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
                        <span>
                            {groupedChildren.length === 1
                                ? 'بيانات الطالب'
                                : `تم العثور على (${groupedChildren.length}) أبناء`}
                        </span>
                    </div>

                    {groupedChildren.map((childGroup, i) => (
                        <UnifiedChildCard key={i} childGroup={childGroup} />
                    ))}
                </div>
            )}
        </div>
    );
}

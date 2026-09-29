'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
    CalendarCheck,
    QrCode,
    CheckCircle2,
    XCircle,
    Clock,
    Users,
    Camera,
    X,
} from 'lucide-react';
import {
    fetchCenterGroups,
    fetchGroupAttendance,
    recordCenterAttendance,
    bulkRecordCenterAttendance,
    fetchCenterEnrollments,
} from '@/lib/api/centers';
import { ICenterGroup, ICenterAttendanceRecord, ICenterEnrollment } from '@/types/center.types';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const QrScanner = dynamic(
    () => import('@/components/scanner/QrScanner').then((m) => m.QrScanner),
    { ssr: false }
);

export default function CenterAttendancePage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const paramGroupId = searchParams.get('groupId');

    const [selectedGroupId, setSelectedGroupId] = useState<string>(paramGroupId || '');
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // Barcode / QR input state
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [lastScannedStudent, setLastScannedStudent] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);

    const { data: groups = [], isLoading: loadingGroups } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });

    // Auto-select first group if not set
    useEffect(() => {
        if (!selectedGroupId && groups.length > 0) {
            setSelectedGroupId(paramGroupId || groups[0]._id);
        }
    }, [groups, selectedGroupId, paramGroupId]);

    const { data: attendanceList = [], isLoading: loadingAttendance } = useQuery<ICenterAttendanceRecord[]>({
        queryKey: ['center', 'attendance', selectedGroupId, selectedDate],
        queryFn: () => fetchGroupAttendance(selectedGroupId, selectedDate),
        enabled: !!selectedGroupId && !!selectedDate,
    });

    const { data: allEnrollments = [] } = useQuery<ICenterEnrollment[]>({
        queryKey: ['center', 'enrollments'],
        queryFn: () => fetchCenterEnrollments({ isActive: true }),
    });

    const currentGroup = groups.find((g) => g._id === selectedGroupId);

    // Filter students eligible for this group:
    // If groupType is PACKAGE: students enrolled in PACKAGE or BOTH with same gradeLevel
    // If groupType is PRIVATE: students enrolled with this teacher in privateTeachers
    // If groupType is MIXED: both
    const eligibleStudents = allEnrollments.filter((enrollment) => {
        if (!currentGroup) return false;
        const student = enrollment.studentId;
        if (!student) return false;

        const isSameGrade = student.gradeLevel === currentGroup.gradeLevel;

        if (currentGroup.groupType === 'PACKAGE') {
            const isPackage = isSameGrade && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH');
            if (!isPackage) return false;
            if (enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                return enrollment.packageGroups.some((pg: any) =>
                    (typeof pg === 'object' ? pg._id : pg) === currentGroup._id
                );
            }
            return true;
        }

        if (currentGroup.groupType === 'PRIVATE') {
            const currentTeacherId =
                typeof currentGroup.centerTeacherId === 'object'
                    ? (currentGroup.centerTeacherId as any)._id
                    : currentGroup.centerTeacherId;

            return enrollment.privateTeachers?.some(
                (pt) =>
                    (typeof pt.centerTeacherId === 'object'
                        ? (pt.centerTeacherId as any)._id
                        : pt.centerTeacherId) === currentTeacherId &&
                    (!pt.groupId || (typeof pt.groupId === 'object' ? (pt.groupId as any)._id : pt.groupId) === currentGroup._id)
            );
        }

        if (currentGroup.groupType === 'MIXED') {
            const currentTeacherId =
                typeof currentGroup.centerTeacherId === 'object'
                    ? (currentGroup.centerTeacherId as any)._id
                    : currentGroup.centerTeacherId;

            let isPackageMatch = isSameGrade && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH');
            if (isPackageMatch && enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                isPackageMatch = enrollment.packageGroups.some((pg: any) =>
                    (typeof pg === 'object' ? pg._id : pg) === currentGroup._id
                );
            }

            const isPrivateMatch = enrollment.privateTeachers?.some(
                (pt) =>
                    (typeof pt.centerTeacherId === 'object'
                        ? (pt.centerTeacherId as any)._id
                        : pt.centerTeacherId) === currentTeacherId &&
                    (!pt.groupId || (typeof pt.groupId === 'object' ? (pt.groupId as any)._id : pt.groupId) === currentGroup._id)
            );

            return Boolean(isPackageMatch || isPrivateMatch);
        }

        return false;
    });

    const recordMutation = useMutation({
        mutationFn: recordCenterAttendance,
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({
                queryKey: ['center', 'attendance', selectedGroupId, selectedDate],
            });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الحضور');
        },
    });

    const handleRecordSingle = (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
        if (!selectedGroupId) return;
        recordMutation.mutate({
            groupId: selectedGroupId,
            studentId,
            date: selectedDate,
            status,
            source: 'MANUAL',
        });
    };

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = barcodeInput.trim();
        if (!code) return;

        // Find student in eligible students by barcode or studentCode
        const matched = eligibleStudents.find(
            (e) =>
                e.studentId?.barcode === code ||
                e.studentId?.studentCode?.toLowerCase() === code.toLowerCase()
        );

        if (!matched) {
            toast.error(`لم يتم العثور على طالب بالكود: ${code} في هذه المجموعة`);
            setBarcodeInput('');
            return;
        }

        recordMutation.mutate(
            {
                groupId: selectedGroupId,
                studentId: matched.studentId._id,
                date: selectedDate,
                status: 'PRESENT',
                source: 'QR_SCAN',
            },
            {
                onSuccess: () => {
                    setLastScannedStudent(matched.studentId.studentName);
                    toast.success(`تم تحضير الطالب: ${matched.studentId.studentName}`);
                },
            }
        );

        setBarcodeInput('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    // Calculate statistics
    const presentCount = attendanceList.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendanceList.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendanceList.filter((a) => a.status === 'LATE').length;
    const excusedCount = attendanceList.filter((a) => a.status === 'EXCUSED').length;

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <QrCode className="h-6 w-6 text-primary" />
                        التحضير السريع للسنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        نظام التحضير الفوري بدون تعقيد (مسح باركود/QR أو ضغطة واحدة لحفظ حضور المجموعة).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BranchSwitcher />
                </div>
            </div>

            {/* Controls Bar: Group Select & Date Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">المجموعة الدراسية</label>
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800"
                    >
                        {groups.map((g) => {
                            const tch = typeof g.centerTeacherId === 'object' ? g.centerTeacherId : null;
                            return (
                                <option key={g._id} value={g._id}>
                                    {g.name} — {tch?.name} ({g.gradeLevel})
                                </option>
                            );
                        })}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">تاريخ الحصة</label>
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-10 rounded-xl border-gray-200 text-xs font-bold"
                    />
                </div>

                <div className="flex items-end">
                    <div className="w-full bg-gray-50 p-2 rounded-xl border border-gray-100 flex items-center justify-around text-center">
                        <div>
                            <span className="text-xs font-bold text-emerald-600 block">{presentCount}</span>
                            <span className="text-[10px] text-gray-400">حاضر</span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div>
                            <span className="text-xs font-bold text-rose-600 block">{absentCount}</span>
                            <span className="text-[10px] text-gray-400">غائب</span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div>
                            <span className="text-xs font-bold text-amber-600 block">{lateCount}</span>
                            <span className="text-[10px] text-gray-400">متأخر</span>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div>
                            <span className="text-xs font-bold text-blue-600 block">{eligibleStudents.length}</span>
                            <span className="text-[10px] text-gray-400">المسجلين</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR / Barcode Scanner Section */}
            <div className="bg-gradient-to-r from-primary/5 via-blue-50/30 to-transparent p-5 rounded-2xl border border-primary/20 shadow-sm space-y-4">

                {/* Camera toggle */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                        <QrCode className="h-4 w-4 text-primary" />
                        مسح باركود / QR الطالب
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCamera((v) => !v)}
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    >
                        {showCamera ? (
                            <><X className="h-3.5 w-3.5" /> إغلاق الكاميرا</>
                        ) : (
                            <><Camera className="h-3.5 w-3.5" /> فتح الكاميرا</>
                        )}
                    </Button>
                </div>

                {/* Camera QR Scanner */}
                {showCamera && (
                    <QrScanner
                        mode="attendance"
                        onScanned={(code) => {
                            setShowCamera(false);
                            // Reuse handleBarcodeSubmit logic inline
                            const matched = eligibleStudents.find(
                                (e) =>
                                    e.studentId?.barcode === code ||
                                    e.studentId?.studentCode?.toLowerCase() === code.toLowerCase()
                            );
                            if (!matched) {
                                toast.error(`لم يتم العثور على طالب بالكود: ${code} في هذه المجموعة`);
                                return;
                            }
                            recordMutation.mutate(
                                {
                                    groupId: selectedGroupId,
                                    studentId: matched.studentId._id,
                                    date: selectedDate,
                                    status: 'PRESENT',
                                    source: 'QR_SCAN',
                                },
                                {
                                    onSuccess: () => {
                                        setLastScannedStudent(matched.studentId.studentName);
                                        toast.success(`✅ تم تحضير: ${matched.studentId.studentName}`);
                                    },
                                }
                            );
                        }}
                    />
                )}

                {/* Manual barcode input */}
                <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                        <Input
                            ref={barcodeInputRef}
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            placeholder="أو امسح بقارئ الباركود / اكتب الكود واضغط Enter..."
                            className="pr-11 h-12 text-sm font-bold bg-white rounded-xl border-primary/30 focus:border-primary shadow-sm"
                            autoFocus={!showCamera}
                        />
                    </div>
                    <Button
                        type="submit"
                        className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold gap-2 w-full sm:w-auto shrink-0 shadow-md shadow-primary/20"
                    >
                        تحضير الطالب
                    </Button>
                </form>

                {lastScannedStudent && (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 w-fit">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>تم تسجيل آخر حضور لـ: <strong>{lastScannedStudent}</strong> بنجاح!</span>
                    </div>
                )}
            </div>

            {/* Students Attendance Roster */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            كشف طلاب المجموعة ({eligibleStudents.length} طالب)
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            اضغط على الحالة لتسجيلها مباشرة بنقرة واحدة
                        </p>
                    </div>
                </div>

                {eligibleStudents.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-gray-600">لا يوجد طلاب مسجلين في هذه المجموعة حالياً</p>
                        <p className="text-xs text-gray-400 mt-1">تأكد من تسجيل اشتراك الطلاب في هذه الباقة أو المجموعة</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {eligibleStudents.map((enrollment) => {
                            const student = enrollment.studentId;
                            const record = attendanceList.find(
                                (a) =>
                                    (typeof a.studentId === 'object'
                                        ? (a.studentId as any)._id
                                        : a.studentId) === student._id
                            );

                            const currentStatus = record?.status || null;

                            return (
                                <div
                                    key={enrollment._id}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gray-100 font-bold text-gray-700 flex items-center justify-center text-xs">
                                            {student.studentCode}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">{student.studentName}</h4>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                                                <span>كود: {student.studentCode}</span>
                                                {student.studentPhone && <span>• {student.studentPhone}</span>}
                                                {record?.source === 'QR_SCAN' && (
                                                    <span className="text-primary font-bold inline-flex items-center gap-0.5">
                                                        • <QrCode className="h-3 w-3" /> تم بالمسح
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Present, Absent, Late, Excused */}
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleRecordSingle(student._id, 'PRESENT')}
                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                currentStatus === 'PRESENT'
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            }`}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                                            حاضر
                                        </Button>

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleRecordSingle(student._id, 'ABSENT')}
                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                currentStatus === 'ABSENT'
                                                    ? 'bg-rose-600 text-white shadow-sm'
                                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                            }`}
                                        >
                                            <XCircle className="h-3.5 w-3.5 ml-1" />
                                            غائب
                                        </Button>

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleRecordSingle(student._id, 'LATE')}
                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                currentStatus === 'LATE'
                                                    ? 'bg-amber-600 text-white shadow-sm'
                                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                            }`}
                                        >
                                            <Clock className="h-3.5 w-3.5 ml-1" />
                                            متأخر
                                        </Button>

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleRecordSingle(student._id, 'EXCUSED')}
                                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all ${
                                                currentStatus === 'EXCUSED'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            }`}
                                        >
                                            مأذون
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ClipboardList,
    Plus,
    Search,
    Edit2,
    Trash2,
    Users,
    GraduationCap,
    BookOpen,
    Tag,
    CheckCircle2,
    Clock,
    Percent,
    Loader2,
} from 'lucide-react';
import {
    fetchCenterEnrollments,
    fetchCenterPackages,
    fetchCenterTeachers,
    fetchCenterGroups,
    enrollStudent,
    updateEnrollment,
} from '@/lib/api/centers';
import { fetchStudents } from '@/lib/api/students';
import {
    ICenterEnrollment,
    ICenterPackage,
    ICenterTeacher,
    ICenterGroup,
    CenterEnrollmentType,
} from '@/types/center.types';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

export default function CenterEnrollmentsPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingEnrollment, setEditingEnrollment] = useState<ICenterEnrollment | null>(null);

    // Form state
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [enrollmentType, setEnrollmentType] = useState<CenterEnrollmentType>('PACKAGE');
    const [packageId, setPackageId] = useState('');
    const [packageDiscountType, setPackageDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [packageDiscountVal, setPackageDiscountVal] = useState('0');

    // Private teachers selected
    const [selectedPrivateTeachers, setSelectedPrivateTeachers] = useState<
        Array<{ centerTeacherId: string; groupId?: string; monthlyPrice?: number }>
    >([]);
    const [privateDiscountType, setPrivateDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [privateDiscountVal, setPrivateDiscountVal] = useState('0');

    // Combined discount
    const [combinedDiscountType, setCombinedDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [combinedDiscountVal, setCombinedDiscountVal] = useState('0');

    const { data: enrollments = [], isLoading } = useQuery<ICenterEnrollment[]>({
        queryKey: ['center', 'enrollments', typeFilter],
        queryFn: () => fetchCenterEnrollments(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
    });

    const { data: packages = [] } = useQuery<ICenterPackage[]>({
        queryKey: ['center', 'packages'],
        queryFn: () => fetchCenterPackages({ isActive: true }),
    });

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: groups = [] } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
    });

    const { data: searchedStudentsData } = useQuery({
        queryKey: ['students', 'search', studentSearch],
        queryFn: () => fetchStudents({ search: studentSearch, limit: 10 }),
        enabled: studentSearch.trim().length >= 2,
    });
    const studentOptions = searchedStudentsData?.data || [];

    const enrollMutation = useMutation({
        mutationFn: enrollStudent,
        onSuccess: () => {
            toast.success('تم تسجيل اشتراك الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'enrollments'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تسجيل الاشتراك');
        },
    });

    const handleOpenAdd = () => {
        setEditingEnrollment(null);
        setSelectedStudentId('');
        setStudentSearch('');
        setEnrollmentType('PACKAGE');
        setPackageId(packages[0]?._id || '');
        setPackageDiscountType('');
        setPackageDiscountVal('0');
        setSelectedPrivateTeachers([]);
        setPrivateDiscountType('');
        setPrivateDiscountVal('0');
        setCombinedDiscountType('');
        setCombinedDiscountVal('0');
        setIsAddOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddOpen(false);
        setEditingEnrollment(null);
    };

    const togglePrivateTeacher = (teacherId: string) => {
        const existing = selectedPrivateTeachers.find((p) => p.centerTeacherId === teacherId);
        if (existing) {
            setSelectedPrivateTeachers(selectedPrivateTeachers.filter((p) => p.centerTeacherId !== teacherId));
        } else {
            const t = teachers.find((tch) => tch._id === teacherId);
            setSelectedPrivateTeachers([
                ...selectedPrivateTeachers,
                {
                    centerTeacherId: teacherId,
                    monthlyPrice: t?.privateMonthlyPrice || 0,
                },
            ]);
        }
    };

    const updatePrivateTeacherGroup = (teacherId: string, groupId: string) => {
        setSelectedPrivateTeachers((prev) =>
            prev.map((item) => (item.centerTeacherId === teacherId ? { ...item, groupId } : item))
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId) {
            toast.error('يرجى اختيار الطالب');
            return;
        }

        if ((enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && !packageId) {
            toast.error('يرجى اختيار الباقة التعليمية');
            return;
        }

        if ((enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && selectedPrivateTeachers.length === 0) {
            toast.error('يرجى اختيار مدرس برايفت واحد على الأقل');
            return;
        }

        const payload: any = {
            studentId: selectedStudentId,
            type: enrollmentType,
        };

        if (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') {
            payload.packageId = packageId;
            if (packageDiscountType) {
                payload.packageDiscount = {
                    type: packageDiscountType,
                    value: Number(packageDiscountVal) || 0,
                };
            }
        }

        if (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') {
            payload.privateTeachers = selectedPrivateTeachers;
            if (privateDiscountType) {
                payload.privateDiscount = {
                    type: privateDiscountType,
                    value: Number(privateDiscountVal) || 0,
                };
            }
        }

        if (enrollmentType === 'BOTH' && combinedDiscountType) {
            payload.combinedDiscount = {
                type: combinedDiscountType,
                value: Number(combinedDiscountVal) || 0,
            };
        }

        enrollMutation.mutate(payload);
    };

    const filteredEnrollments = enrollments.filter((e) => {
        if (!search) return true;
        const sName = e.studentId?.studentName || '';
        const sCode = e.studentId?.studentCode || '';
        const sPhone = e.studentId?.studentPhone || '';
        return (
            sName.includes(search) ||
            sCode.includes(search) ||
            sPhone.includes(search)
        );
    });

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        اشتراكات الطلاب بالسنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إدارة اشتراكات الطلاب في باقات المدرسين أو الحصص الخاصة (البرايفت) وتطبيق الخصومات.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold">
                        <Plus className="h-4 w-4" />
                        اشتراك طالب جديد
                    </Button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ابحث باسم الطالب أو الكود أو رقم الهاتف..."
                        className="pr-10 border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                        variant={typeFilter === 'ALL' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter('ALL')}
                        className="rounded-lg text-xs font-bold"
                    >
                        الكل
                    </Button>
                    <Button
                        variant={typeFilter === 'PACKAGE' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter('PACKAGE')}
                        className="rounded-lg text-xs font-bold"
                    >
                        باقة
                    </Button>
                    <Button
                        variant={typeFilter === 'PRIVATE' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter('PRIVATE')}
                        className="rounded-lg text-xs font-bold"
                    >
                        برايفت
                    </Button>
                    <Button
                        variant={typeFilter === 'BOTH' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTypeFilter('BOTH')}
                        className="rounded-lg text-xs font-bold"
                    >
                        كلاهما
                    </Button>
                </div>
            </div>

            {/* Enrollments Table / Cards */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : filteredEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center">
                    <ClipboardList className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا توجد اشتراكات مطابقة</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بتسجيل اشتراك أول طالب بالسنتر في باقة أو مع مدرس برايفت.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        اشتراك طالب الآن
                    </Button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-400 font-bold">
                                <tr>
                                    <th className="py-3.5 px-4">الطالب</th>
                                    <th className="py-3.5 px-4">نوع الاشتراك</th>
                                    <th className="py-3.5 px-4">تفاصيل الباقة / المدرسين</th>
                                    <th className="py-3.5 px-4">الخصومات المطبقة</th>
                                    <th className="py-3.5 px-4">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEnrollments.map((enrollment) => {
                                    const student = enrollment.studentId;
                                    const typeLabel =
                                        enrollment.type === 'PACKAGE'
                                            ? 'باقة'
                                            : enrollment.type === 'PRIVATE'
                                            ? 'برايفت'
                                            : 'باقة + برايفت';
                                    const typeColor =
                                        enrollment.type === 'PACKAGE'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : enrollment.type === 'PRIVATE'
                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                                    return (
                                        <tr key={enrollment._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-gray-900">
                                                    {student?.studentName || 'طالب غير معروف'}
                                                </div>
                                                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                                                    <span>كود: {student?.studentCode}</span>
                                                    {student?.studentPhone && <span>• {student.studentPhone}</span>}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <Badge variant="outline" className={`font-bold ${typeColor}`}>
                                                    {typeLabel}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <div className="space-y-1">
                                                    {enrollment.packageId && (
                                                        <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                                                            <BookOpen className="h-3.5 w-3.5" />
                                                            <span>{enrollment.packageId.name}</span>
                                                            <span className="text-[11px] text-gray-400 font-normal">
                                                                ({enrollment.packageId.monthlyPrice} ج.م)
                                                            </span>
                                                        </div>
                                                    )}
                                                    {enrollment.privateTeachers?.map((pt, idx) => {
                                                        const tch = typeof pt.centerTeacherId === 'object' ? pt.centerTeacherId : null;
                                                        return (
                                                            <div key={idx} className="flex items-center gap-1.5 text-purple-700 font-medium">
                                                                <GraduationCap className="h-3.5 w-3.5" />
                                                                <span>{tch ? `${tch.name} (${tch.subject})` : 'مدرس'}</span>
                                                                {pt.monthlyPrice && (
                                                                    <span className="text-[11px] text-gray-400">
                                                                        ({pt.monthlyPrice} ج.م)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                {enrollment.combinedDiscount?.value ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                                        خصم مجمع: {enrollment.combinedDiscount.value}
                                                        {enrollment.combinedDiscount.type === 'PERCENTAGE' ? '%' : ' ج.م'}
                                                    </span>
                                                ) : enrollment.packageDiscount?.value || enrollment.privateDiscount?.value ? (
                                                    <div className="space-y-0.5">
                                                        {enrollment.packageDiscount?.value ? (
                                                            <div className="text-[11px] text-blue-600 font-medium">
                                                                باقة: {enrollment.packageDiscount.value}
                                                                {enrollment.packageDiscount.type === 'PERCENTAGE' ? '%' : ' ج.م'}
                                                            </div>
                                                        ) : null}
                                                        {enrollment.privateDiscount?.value ? (
                                                            <div className="text-[11px] text-purple-600 font-medium">
                                                                برايفت: {enrollment.privateDiscount.value}
                                                                {enrollment.privateDiscount.type === 'PERCENTAGE' ? '%' : ' ج.م'}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 font-medium">لا يوجد خصم</span>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={enrollment.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}
                                                >
                                                    {enrollment.isActive ? 'نشط' : 'ملغي'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Enroll Student Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            تسجيل اشتراك طالب بالسنتر
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {/* Student Search & Select */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                البحث عن الطالب * (بالاسم أو الكود)
                            </label>
                            <Input
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                placeholder="اكتب اسم الطالب أو كوده..."
                                className="rounded-xl border-gray-200"
                            />
                            {studentOptions.length > 0 && (
                                <div className="mt-1 border border-gray-200 rounded-xl p-1.5 bg-gray-50/50 max-h-36 overflow-y-auto space-y-1">
                                    {studentOptions.map((st: any) => (
                                        <div
                                            key={st._id}
                                            onClick={() => {
                                                setSelectedStudentId(st._id);
                                                setStudentSearch(`${st.studentName} (${st.studentCode})`);
                                            }}
                                            className={`p-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                                selectedStudentId === st._id
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white hover:bg-gray-100 text-gray-800'
                                            }`}
                                        >
                                            {st.studentName} — كود: {st.studentCode} ({st.gradeLevel})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Enrollment Type */}
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">نوع الاشتراك *</label>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    type="button"
                                    variant={enrollmentType === 'PACKAGE' ? 'default' : 'outline'}
                                    onClick={() => setEnrollmentType('PACKAGE')}
                                    className="rounded-xl text-xs font-bold"
                                >
                                    باكيدج فقط
                                </Button>
                                <Button
                                    type="button"
                                    variant={enrollmentType === 'PRIVATE' ? 'default' : 'outline'}
                                    onClick={() => setEnrollmentType('PRIVATE')}
                                    className="rounded-xl text-xs font-bold"
                                >
                                    برايفت فقط
                                </Button>
                                <Button
                                    type="button"
                                    variant={enrollmentType === 'BOTH' ? 'default' : 'outline'}
                                    onClick={() => setEnrollmentType('BOTH')}
                                    className="rounded-xl text-xs font-bold"
                                >
                                    باكيدج + برايفت
                                </Button>
                            </div>
                        </div>

                        {/* Package Selection */}
                        {(enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && (
                            <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-blue-900 block mb-1">
                                        اختيار الباقة التعليمية *
                                    </label>
                                    <select
                                        value={packageId}
                                        onChange={(e) => setPackageId(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    >
                                        <option value="" disabled>اختر الباقة</option>
                                        {packages.map((pkg) => (
                                            <option key={pkg._id} value={pkg._id}>
                                                {pkg.name} ({pkg.gradeLevel}) — {pkg.monthlyPrice} ج.م/شهر
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">نوع خصم الباقة</label>
                                        <select
                                            value={packageDiscountType}
                                            onChange={(e) => setPackageDiscountType(e.target.value as any)}
                                            className="w-full h-9 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                                        >
                                            <option value="">بدون خصم</option>
                                            <option value="PERCENTAGE">نسبة مئوية (%)</option>
                                            <option value="FIXED">مبلغ ثابت (ج.م)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">قيمة الخصم</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={packageDiscountVal}
                                            onChange={(e) => setPackageDiscountVal(e.target.value)}
                                            disabled={!packageDiscountType}
                                            className="h-9 text-xs rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Private Teachers Selection */}
                        {(enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && (
                            <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                                <label className="text-xs font-bold text-purple-900 block">
                                    اختيار مدرسي البرايفت والمجموعات
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {teachers.map((teacher) => {
                                        const isSelected = selectedPrivateTeachers.some((p) => p.centerTeacherId === teacher._id);
                                        const teacherGroups = groups.filter((g) => {
                                            const gTeacherId = typeof g.centerTeacherId === 'object' ? (g.centerTeacherId as any)._id : g.centerTeacherId;
                                            return gTeacherId === teacher._id;
                                        });

                                        return (
                                            <div key={teacher._id} className="p-2 bg-white rounded-lg border border-gray-200 text-xs">
                                                <div
                                                    onClick={() => togglePrivateTeacher(teacher._id)}
                                                    className="flex items-center justify-between cursor-pointer font-bold"
                                                >
                                                    <span>{teacher.name} ({teacher.subject})</span>
                                                    <span className={`text-[11px] px-2 py-0.5 rounded ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                        {isSelected ? 'محدد' : 'إضافة'}
                                                    </span>
                                                </div>

                                                {isSelected && teacherGroups.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <select
                                                            onChange={(e) => updatePrivateTeacherGroup(teacher._id, e.target.value)}
                                                            className="w-full h-8 px-2 rounded border border-gray-200 text-[11px]"
                                                        >
                                                            <option value="">اختر المجموعة المحددة (اختياري)</option>
                                                            {teacherGroups.map((g) => (
                                                                <option key={g._id} value={g._id}>
                                                                    {g.name} ({g.schedule?.map((s) => s.day).join('، ')})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">نوع خصم البرايفت</label>
                                        <select
                                            value={privateDiscountType}
                                            onChange={(e) => setPrivateDiscountType(e.target.value as any)}
                                            className="w-full h-9 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                                        >
                                            <option value="">بدون خصم</option>
                                            <option value="PERCENTAGE">نسبة مئوية (%)</option>
                                            <option value="FIXED">مبلغ ثابت (ج.م)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">قيمة الخصم</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={privateDiscountVal}
                                            onChange={(e) => setPrivateDiscountVal(e.target.value)}
                                            disabled={!privateDiscountType}
                                            className="h-9 text-xs rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={enrollMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {enrollMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                تأكيد الاشتراك
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseModal}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

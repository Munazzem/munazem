'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/lib/hooks/use-debounce';
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
    Sparkles,
    Layers,
    DollarSign,
    Calendar,
    Calculator,
} from 'lucide-react';
import {
    fetchCenterEnrollments,
    fetchCenterPackages,
    fetchCenterTeachers,
    fetchCenterGroups,
    fetchCenterStudents,
    fetchCenterStudentById,
    createCenterStudent,
    enrollStudent,
    updateEnrollment,
} from '@/lib/api/centers';
import { ALL_GRADES } from '@/lib/constants/grade.constants';
import {
    ICenterEnrollment,
    ICenterPackage,
    ICenterTeacher,
    ICenterGroup,
    ICenterStudent,
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
    const [selectedPackageGroupIds, setSelectedPackageGroupIds] = useState<string[]>([]);
    const [packageDiscountType, setPackageDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [packageDiscountVal, setPackageDiscountVal] = useState('0');

    // Private teachers selected
    const [selectedPrivateTeachers, setSelectedPrivateTeachers] = useState<
        Array<{ centerTeacherId: string; groupId?: string; monthlyPrice?: number; subject?: string }>
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

    const searchParams = useSearchParams();
    const urlStudentId = searchParams?.get('studentId');

    // Quick Add Student State
    const [showQuickAddStudent, setShowQuickAddStudent] = useState(false);
    const [quickStudentName, setQuickStudentName] = useState('');
    const [quickParentName, setQuickParentName] = useState('');
    const [quickGradeLevel, setQuickGradeLevel] = useState<string>(ALL_GRADES[0]);
    const [quickStudentPhone, setQuickStudentPhone] = useState('');
    const [quickParentPhone, setQuickParentPhone] = useState('');

    useEffect(() => {
        if (urlStudentId) {
            setSelectedStudentId(urlStudentId);
            setIsAddOpen(true);
        }
    }, [urlStudentId]);

    const debouncedStudentSearch = useDebounce(studentSearch, 350);
    const { data: searchedStudentsData } = useQuery({
        queryKey: ['center', 'students', 'search', debouncedStudentSearch],
        queryFn: () => fetchCenterStudents({ search: debouncedStudentSearch, limit: 15 }),
        enabled: debouncedStudentSearch.trim().length >= 2,
    });
    const studentOptions = searchedStudentsData?.data || [];

    const quickCreateMutation = useMutation({
        mutationFn: createCenterStudent,
        onSuccess: (newStudent) => {
            toast.success(`تمت إضافة الطالب ${newStudent.studentName} بنجاح`);
            setSelectedStudentId(newStudent._id);
            setStudentSearch(`${newStudent.studentName} (${newStudent.studentCode})`);
            setShowQuickAddStudent(false);
            setQuickStudentName('');
            setQuickParentName('');
            setQuickStudentPhone('');
            setQuickParentPhone('');
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'فشل في إضافة الطالب');
        },
    });

    const handleQuickCreateStudent = () => {
        if (!quickStudentName.trim()) {
            toast.error('اسم الطالب مطلوب');
            return;
        }
        const trimmedStudent = quickStudentName.trim();
        const parts = trimmedStudent.split(/\s+/);
        const autoParentName = quickParentName.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : `ولي أمر ${trimmedStudent}`);

        quickCreateMutation.mutate({
            studentName: trimmedStudent,
            parentName: autoParentName,
            gradeLevel: quickGradeLevel,
            studentPhone: quickStudentPhone.trim() || null,
            parentPhone: quickParentPhone.trim() || null,
        });
    };

    const { data: selectedStudent } = useQuery<ICenterStudent>({
        queryKey: ['center', 'student', selectedStudentId],
        queryFn: () => fetchCenterStudentById(selectedStudentId),
        enabled: !!selectedStudentId,
    });

    const currentGradeLevel = selectedStudent?.gradeLevel || (showQuickAddStudent ? quickGradeLevel : undefined);

    const handleSelectPackage = (newPkgId: string) => {
        setPackageId(newPkgId);
        const pkg = packages.find((p) => p._id === newPkgId);
        if (!pkg) {
            setSelectedPackageGroupIds([]);
            return;
        }

        const pkgTeacherIds = (pkg.teachers || []).map((t) =>
            typeof t.teacherId === 'object' ? (t.teacherId as any)._id : t.teacherId
        );

        const matchingGroups = groups.filter((g) => {
            const teacherId = typeof g.centerTeacherId === 'object' ? (g.centerTeacherId as any)._id : g.centerTeacherId;
            const matchesTeacher = pkgTeacherIds.includes(teacherId);
            const matchesGrade = g.gradeLevel === pkg.gradeLevel;
            const matchesType = g.groupType === 'PACKAGE' || g.groupType === 'MIXED';
            return matchesTeacher && matchesGrade && matchesType;
        });

        // Automatically select all matching groups by default!
        setSelectedPackageGroupIds(matchingGroups.map((g) => g._id));
    };

    const togglePackageGroup = (groupId: string) => {
        setSelectedPackageGroupIds((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
        );
    };

    const togglePrivateGroup = (group: ICenterGroup) => {
        const teacherId = typeof group.centerTeacherId === 'object' ? (group.centerTeacherId as any)._id : group.centerTeacherId;
        const isSelected = selectedPrivateTeachers.some((p) => p.groupId === group._id);

        if (isSelected) {
            setSelectedPrivateTeachers((prev) => prev.filter((p) => p.groupId !== group._id));
        } else {
            const teacher = typeof group.centerTeacherId === 'object' ? (group.centerTeacherId as any) : teachers.find(t => t._id === teacherId);
            setSelectedPrivateTeachers((prev) => [
                ...prev,
                {
                    centerTeacherId: teacherId,
                    groupId: group._id,
                    monthlyPrice: group.privateMonthlyPrice ?? undefined,
                    subject: teacher?.subject || undefined,
                },
            ]);
        }
    };

    // Auto-select package when student's grade level is known
    useEffect(() => {
        if (currentGradeLevel && packages.length > 0) {
            const matchingPkg = packages.find((p) => p.gradeLevel === currentGradeLevel);
            if (matchingPkg && matchingPkg._id !== packageId) {
                handleSelectPackage(matchingPkg._id);
            } else if (!matchingPkg) {
                // No package for this grade level — clear
                setPackageId('');
                setSelectedPackageGroupIds([]);
            }
        }
    }, [currentGradeLevel, packages]);

    const selectedPkg = packages.find((p) => p._id === packageId);
    const pkgTeacherIds = (selectedPkg?.teachers || []).map((t) =>
        typeof t.teacherId === 'object' ? (t.teacherId as any)._id : t.teacherId
    );
    const packageMatchingGroups = selectedPkg
        ? groups.filter((g) => {
              const teacherId = typeof g.centerTeacherId === 'object' ? (g.centerTeacherId as any)._id : g.centerTeacherId;
              const matchesTeacher = pkgTeacherIds.includes(teacherId);
              const matchesGrade = g.gradeLevel === selectedPkg.gradeLevel;
              const matchesType = g.groupType === 'PACKAGE' || g.groupType === 'MIXED';
              return matchesTeacher && matchesGrade && matchesType;
          })
        : [];

    const availablePrivateGroups = groups.filter((g) => {
        const isPrivateOrMixed = g.groupType === 'PRIVATE' || g.groupType === 'MIXED';
        if (!currentGradeLevel) return isPrivateOrMixed;
        return isPrivateOrMixed && g.gradeLevel === currentGradeLevel;
    });

    // ── Live Pricing Calculation for Enrollment Modal ────────────────────
    const pkgBasePrice = (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && selectedPkg
        ? (selectedPkg.monthlyPrice || 0)
        : 0;

    let pkgDiscountAmount = 0;
    if (packageDiscountType === 'PERCENTAGE') {
        pkgDiscountAmount = (pkgBasePrice * (Number(packageDiscountVal) || 0)) / 100;
    } else if (packageDiscountType === 'FIXED') {
        pkgDiscountAmount = Number(packageDiscountVal) || 0;
    }
    const netPkgPrice = Math.max(0, pkgBasePrice - pkgDiscountAmount);

    const privateBasePrice = (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH')
        ? selectedPrivateTeachers.reduce((sum, p) => {
              const grp = groups.find((g) => g._id === p.groupId);
              return sum + (grp?.privateMonthlyPrice ?? p.monthlyPrice ?? 0);
          }, 0)
        : 0;

    let privateDiscountAmount = 0;
    if (privateDiscountType === 'PERCENTAGE') {
        privateDiscountAmount = (privateBasePrice * (Number(privateDiscountVal) || 0)) / 100;
    } else if (privateDiscountType === 'FIXED') {
        privateDiscountAmount = Number(privateDiscountVal) || 0;
    }
    const netPrivatePrice = Math.max(0, privateBasePrice - privateDiscountAmount);

    const grossCombinedPrice = pkgBasePrice + privateBasePrice;
    let combinedDiscountAmount = 0;
    if (enrollmentType === 'BOTH' && combinedDiscountType) {
        if (combinedDiscountType === 'PERCENTAGE') {
            combinedDiscountAmount = (grossCombinedPrice * (Number(combinedDiscountVal) || 0)) / 100;
        } else if (combinedDiscountType === 'FIXED') {
            combinedDiscountAmount = Number(combinedDiscountVal) || 0;
        }
    }

    const totalEnrollmentPrice = enrollmentType === 'PACKAGE'
        ? netPkgPrice
        : enrollmentType === 'PRIVATE'
        ? netPrivatePrice
        : Math.max(0, grossCombinedPrice - (pkgDiscountAmount + privateDiscountAmount + combinedDiscountAmount));

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
        // Don't pre-select a package — wait for student selection to know grade level
        setPackageId('');
        setSelectedPackageGroupIds([]);
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
            toast.error('يرجى اختيار مجموعة برايفت واحدة على الأقل');
            return;
        }

        const payload: any = {
            studentId: selectedStudentId,
            type: enrollmentType,
        };

        if (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') {
            payload.packageId = packageId;
            payload.packageGroups = selectedPackageGroupIds;
            if (packageDiscountType) {
                payload.packageDiscount = {
                    type: packageDiscountType,
                    value: Number(packageDiscountVal) || 0,
                };
            }
        }

        if (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') {
            payload.privateTeachers = selectedPrivateTeachers.map((p) => ({
                centerTeacherId: p.centerTeacherId,
                groupId: p.groupId,
                subject: p.subject,
            }));
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary shrink-0" />
                        <span>اشتراكات الطلاب بالسنتر</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إدارة اشتراكات الطلاب في باقات المدرسين أو الحصص الخاصة (البرايفت) وتطبيق الخصومات.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>اشتراك طالب جديد</span>
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
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-gray-700 block">
                                    البحث عن الطالب * (بالاسم أو الكود)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAddStudent(!showQuickAddStudent)}
                                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus className="h-3 w-3" />
                                    {showQuickAddStudent ? 'إلغاء الإضافة' : 'طالب غير مسجل؟ أضف للسنتر'}
                                </button>
                            </div>
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

                            {/* Quick Add Student Form */}
                            {showQuickAddStudent && (
                                <div className="mt-2.5 p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5">
                                    <div className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                        <span>إضافة طالب جديد للسنتر واختياره مباشرة:</span>
                                    </div>
                                    <div>
                                        <Input
                                            value={quickStudentName}
                                            onChange={(e) => setQuickStudentName(e.target.value)}
                                            placeholder="اسم الطالب *"
                                            className="h-8 text-xs bg-white rounded-lg border-blue-200"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <select
                                            value={quickGradeLevel}
                                            onChange={(e) => setQuickGradeLevel(e.target.value)}
                                            className="h-8 text-xs bg-white border border-blue-200 rounded-lg px-2"
                                        >
                                            {ALL_GRADES.map((g) => (
                                                <option key={g} value={g}>
                                                    {g}
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            value={quickStudentPhone}
                                            onChange={(e) => setQuickStudentPhone(e.target.value)}
                                            placeholder="هاتف الطالب"
                                            className="h-8 text-xs bg-white rounded-lg border-blue-200 font-mono text-left"
                                            dir="ltr"
                                        />
                                        <Input
                                            value={quickParentPhone}
                                            onChange={(e) => setQuickParentPhone(e.target.value)}
                                            placeholder="هاتف ولي الأمر"
                                            className="h-8 text-xs bg-white rounded-lg border-blue-200 font-mono text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleQuickCreateStudent}
                                            disabled={quickCreateMutation.isPending}
                                            className="h-7 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                                        >
                                            {quickCreateMutation.isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                'حفظ وتحديد الطالب'
                                            )}
                                        </Button>
                                    </div>
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
                                        اختيار الباقة التعليمية {currentGradeLevel ? `(${currentGradeLevel})` : ''} *
                                    </label>
                                    {/* Warn if no package for this grade */}
                                    {currentGradeLevel && packages.length > 0 && !packages.find((p) => p.gradeLevel === currentGradeLevel) && (
                                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs font-bold mb-2">
                                            <span>⚠️ لا توجد باقة مرتبطة بمرحلة ({currentGradeLevel}) — يمكنك تسجيل الطالب كـ برايفت فقط، أو إنشاء باقة لهذه المرحلة أولاً.</span>
                                        </div>
                                    )}
                                    <select
                                        value={packageId}
                                        onChange={(e) => handleSelectPackage(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    >
                                        <option value="">
                                            {!currentGradeLevel
                                                ? 'اختر الطالب أولاً لمعرفة المرحلة'
                                                : packages.find((p) => p.gradeLevel === currentGradeLevel)
                                                ? 'اختر الباقة'
                                                : 'لا توجد باقة لهذه المرحلة'}
                                        </option>
                                        {(currentGradeLevel
                                            ? packages.filter((pkg) => pkg.gradeLevel === currentGradeLevel)
                                            : packages
                                        ).map((pkg) => (
                                            <option key={pkg._id} value={pkg._id}>
                                                {pkg.name} — {pkg.monthlyPrice} ج.م/شهر
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Package Groups - Auto Selected by Default */}
                                {selectedPkg && (
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                                <span>مجموعات الباقة المشمولة (محددة بالكامل تلقائياً):</span>
                                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                                    {selectedPackageGroupIds.length} من {packageMatchingGroups.length} محدد
                                                </Badge>
                                            </label>
                                        </div>

                                        {packageMatchingGroups.length === 0 ? (
                                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                                                ⚠️ لم يتم العثور على مجموعات مسجلة لهذه الباقة في مرحلة ({selectedPkg.gradeLevel}). يمكنك إنشاء مجموعات للباقة من شاشة المجموعات.
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                                                {packageMatchingGroups.map((g) => {
                                                    const isChecked = selectedPackageGroupIds.includes(g._id);
                                                    const teacherName = typeof g.centerTeacherId === 'object'
                                                        ? (g.centerTeacherId as any)?.name
                                                        : (teachers.find((t) => t._id === g.centerTeacherId)?.name || 'مدرس بالسنتر');
                                                    const subject = typeof g.centerTeacherId === 'object'
                                                        ? (g.centerTeacherId as any)?.subject
                                                        : (teachers.find((t) => t._id === g.centerTeacherId)?.subject || '');

                                                    return (
                                                        <div
                                                            key={g._id}
                                                            onClick={() => togglePackageGroup(g._id)}
                                                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                                                isChecked
                                                                    ? 'bg-white border-blue-400 shadow-sm ring-1 ring-blue-300'
                                                                    : 'bg-white/60 border-gray-200 opacity-60 hover:opacity-100'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}}
                                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                />
                                                                <div>
                                                                    <div className="flex items-center gap-1.5 font-bold text-gray-900">
                                                                        <span>{g.name}</span>
                                                                        {subject && (
                                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1 font-bold">
                                                                                {subject}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                                                                        <span>المدرس: {teacherName}</span>
                                                                        {g.schedule && g.schedule.length > 0 && (
                                                                            <span>• المواعيد: {g.schedule.map((s) => `${s.day} ${s.time}`).join('، ')}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isChecked ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                {isChecked ? 'مشترك ✓' : 'مستبعد'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
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

                        {/* Private Groups Selection - Filtered by Student Grade Level */}
                        {(enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && (
                            <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-purple-900 block">
                                            اختيار مجموعات البرايفت بالسنتر {currentGradeLevel ? `(${currentGradeLevel})` : ''} *
                                        </label>
                                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                                            {selectedPrivateTeachers.length} مجموعة محددة
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-purple-600 mt-0.5">
                                        اختر المجموعات البرايفت التي ينضم إليها الطالب في مرحلته (يتم تحديد السعر الشهري لكل مجموعة):
                                    </p>
                                </div>

                                {availablePrivateGroups.length === 0 ? (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                                        ⚠️ لا توجد مجموعات برايفت مسجلة في السنتر لهذه المرحلة {currentGradeLevel ? `(${currentGradeLevel})` : ''}. يمكنك إضافة مجموعات برايفت من قسم المجموعات أولاً.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                                        {availablePrivateGroups.map((group) => {
                                            const isSelected = selectedPrivateTeachers.some((p) => p.groupId === group._id);
                                            const teacherId = typeof group.centerTeacherId === 'object'
                                                ? (group.centerTeacherId as any)._id
                                                : group.centerTeacherId;
                                            const teacherObj = typeof group.centerTeacherId === 'object'
                                                ? (group.centerTeacherId as any)
                                                : teachers.find((t) => t._id === teacherId);

                                            return (
                                                <div
                                                    key={group._id}
                                                    onClick={() => togglePrivateGroup(group)}
                                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                                                        isSelected
                                                            ? 'border-purple-400 bg-white shadow-sm ring-1 ring-purple-300'
                                                            : 'border-purple-100 bg-white/70 hover:bg-white hover:border-purple-200'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                        />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900">{group.name}</span>
                                                                {teacherObj?.subject && (
                                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0 px-1.5 font-bold">
                                                                        {teacherObj.subject}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                                                                <span>المدرس: {teacherObj?.name || 'مدرس بالسنتر'}</span>
                                                                {group.schedule && group.schedule.length > 0 && (
                                                                    <span>• المواعيد: {group.schedule.map((s) => `${s.day} ${s.time}`).join('، ')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-left shrink-0">
                                                        <span className="font-black text-purple-700 text-xs block">
                                                            {group.privateMonthlyPrice ? `${group.privateMonthlyPrice} ج.م` : 'مجاناً'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">شهرياً</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-100">
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

                        {/* Combined Discount if BOTH */}
                        {enrollmentType === 'BOTH' && (
                            <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                                <label className="text-xs font-bold text-emerald-900 block">
                                    خصم مجمع (للباقة والبرايفت معاً) - اختياري
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">نوع الخصم المجمع</label>
                                        <select
                                            value={combinedDiscountType}
                                            onChange={(e) => setCombinedDiscountType(e.target.value as any)}
                                            className="w-full h-9 px-2 rounded-lg border border-gray-200 bg-white text-xs"
                                        >
                                            <option value="">بدون خصم مجمع</option>
                                            <option value="PERCENTAGE">نسبة مئوية (%)</option>
                                            <option value="FIXED">مبلغ ثابت (ج.م)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-600 block mb-1">قيمة الخصم</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={combinedDiscountVal}
                                            onChange={(e) => setCombinedDiscountVal(e.target.value)}
                                            disabled={!combinedDiscountType}
                                            className="h-9 text-xs rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Live Pricing Summary Banner */}
                        <div className="bg-gradient-to-br from-slate-900 to-gray-900 text-white p-4 rounded-2xl shadow-md space-y-2.5">
                            <div className="flex items-center justify-between border-b border-gray-700/60 pb-2">
                                <div className="flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-emerald-400" />
                                    <span className="text-xs font-black text-gray-200">ملخص حساب الاشتراك المالي (تسعير آلي)</span>
                                </div>
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                    تسعير معتمد
                                </Badge>
                            </div>

                            <div className="space-y-1.5 text-xs">
                                {(enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && selectedPkg && (
                                    <div className="flex items-center justify-between text-gray-300">
                                        <span className="flex items-center gap-1.5">
                                            <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                                            سعر الباقة ({selectedPkg.name}):
                                        </span>
                                        <span className="font-bold font-mono text-white">{pkgBasePrice} ج.م</span>
                                    </div>
                                )}

                                {pkgDiscountAmount > 0 && (
                                    <div className="flex items-center justify-between text-emerald-400 text-[11px]">
                                        <span>خصم الباقة المطبق:</span>
                                        <span className="font-mono font-bold">-{pkgDiscountAmount} ج.م</span>
                                    </div>
                                )}

                                {(enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && (
                                    <div className="flex items-center justify-between text-gray-300">
                                        <span className="flex items-center gap-1.5">
                                            <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
                                            مجموع مجموعات البرايفت ({selectedPrivateTeachers.length} مجموعة):
                                        </span>
                                        <span className="font-bold font-mono text-white">{privateBasePrice} ج.م</span>
                                    </div>
                                )}

                                {privateDiscountAmount > 0 && (
                                    <div className="flex items-center justify-between text-purple-300 text-[11px]">
                                        <span>خصم البرايفت المطبق:</span>
                                        <span className="font-mono font-bold">-{privateDiscountAmount} ج.م</span>
                                    </div>
                                )}

                                {combinedDiscountAmount > 0 && (
                                    <div className="flex items-center justify-between text-amber-300 text-[11px]">
                                        <span>الخصم المجمع الإضافي:</span>
                                        <span className="font-mono font-bold">-{combinedDiscountAmount} ج.م</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-gray-700/60 flex items-center justify-between">
                                <span className="font-extrabold text-xs sm:text-sm text-gray-100">المبلغ المطلوب سداده شهرياً:</span>
                                <div className="text-left">
                                    <span className="text-lg font-black text-emerald-400 font-mono">{totalEnrollmentPrice}</span>
                                    <span className="text-xs text-gray-300 mr-1">ج.م / شهرياً</span>
                                </div>
                            </div>
                        </div>

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

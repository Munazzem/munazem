'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchCenterStudents,
    createCenterStudent,
    bulkCreateCenterStudents,
    updateCenterStudent,
    deleteCenterStudent,
    fetchCenterPackages,
    fetchCenterTeachers,
    fetchCenterGroups,
    enrollStudent,
} from '@/lib/api/centers';
import type {
    ICenterStudent,
    CreateCenterStudentDTO,
    ICenterPackage,
    ICenterTeacher,
    ICenterGroup,
    CenterEnrollmentType,
} from '@/types/center.types';
import { ALL_GRADES } from '@/lib/constants/grade.constants';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { toast } from 'sonner';
import {
    Users,
    UserPlus,
    Plus,
    Search,
    FileSpreadsheet,
    Edit2,
    Trash2,
    Loader2,
    CheckCircle2,
    XCircle,
    Phone,
    Barcode,
    ClipboardList,
    Sparkles,
    Copy,
    GraduationCap,
    Filter,
    User,
    BookOpen,
    Layers,
    Check,
} from 'lucide-react';
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

interface BulkRow {
    id: string;
    studentName: string;
    parentName: string;
    studentPhone: string;
    parentPhone: string;
}

export default function CenterStudentsPage() {
    const queryClient = useQueryClient();

    // Filters
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('ALL');
    const [page, setPage] = useState(1);

    // Single Add / Edit Modal State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<ICenterStudent | null>(null);

    // Form State
    const [studentName, setStudentName] = useState('');
    const [parentName, setParentName] = useState('');
    const [studentPhone, setStudentPhone] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(ALL_GRADES[0]);
    const [barcode, setBarcode] = useState('');
    const [notes, setNotes] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);

    // Optional Instant Enrollment on Student Creation
    const [enrollImmediately, setEnrollImmediately] = useState(false);
    const [enrollmentType, setEnrollmentType] = useState<CenterEnrollmentType>('PACKAGE');
    const [packageId, setPackageId] = useState('');
    const [selectedPackageGroupIds, setSelectedPackageGroupIds] = useState<string[]>([]);
    const [selectedPrivateTeachers, setSelectedPrivateTeachers] = useState<
        Array<{ centerTeacherId: string; groupId?: string; monthlyPrice?: number; subject?: string }>
    >([]);
    const [packageDiscountType, setPackageDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [packageDiscountVal, setPackageDiscountVal] = useState('0');
    const [privateDiscountType, setPrivateDiscountType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
    const [privateDiscountVal, setPrivateDiscountVal] = useState('0');

    // Packages, Teachers, Groups queries
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
            const teacher = typeof group.centerTeacherId === 'object' ? (group.centerTeacherId as any) : teachers.find((t) => t._id === teacherId);
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

    useEffect(() => {
        if (enrollImmediately && gradeLevel && packages.length > 0) {
            const matchingPkg = packages.find((p) => p.gradeLevel === gradeLevel);
            if (matchingPkg && matchingPkg._id !== packageId) {
                handleSelectPackage(matchingPkg._id);
            }
        }
    }, [gradeLevel, enrollImmediately, packages]);

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
        return isPrivateOrMixed && g.gradeLevel === gradeLevel;
    });

    // Bulk Add Modal State
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkGradeLevel, setBulkGradeLevel] = useState<string>(ALL_GRADES[0]);
    const [bulkPasteText, setBulkPasteText] = useState('');
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([
        { id: '1', studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
    ]);

    // Query Students
    const { data: studentsResponse, isLoading } = useQuery({
        queryKey: ['center', 'students', search, selectedGrade, page],
        queryFn: () =>
            fetchCenterStudents({
                search: search.trim() || undefined,
                gradeLevel: selectedGrade !== 'ALL' ? selectedGrade : undefined,
                page,
                limit: 50,
            }),
    });

    const students = studentsResponse?.data || [];
    const totalCount = studentsResponse?.total || 0;
    const totalPages = studentsResponse?.totalPages || 1;

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (payload: CreateCenterStudentDTO) => {
            const newStudent = await createCenterStudent(payload);
            if (enrollImmediately) {
                const enrollPayload: any = {
                    studentId: newStudent._id,
                    type: enrollmentType,
                };
                if (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') {
                    enrollPayload.packageId = packageId;
                    enrollPayload.packageGroups = selectedPackageGroupIds;
                    if (packageDiscountType) {
                        enrollPayload.packageDiscount = {
                            type: packageDiscountType,
                            value: Number(packageDiscountVal) || 0,
                        };
                    }
                }
                if (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') {
                    enrollPayload.privateTeachers = selectedPrivateTeachers.map((p) => ({
                        centerTeacherId: p.centerTeacherId,
                        groupId: p.groupId,
                        subject: p.subject,
                    }));
                    if (privateDiscountType) {
                        enrollPayload.privateDiscount = {
                            type: privateDiscountType,
                            value: Number(privateDiscountVal) || 0,
                        };
                    }
                }
                await enrollStudent(enrollPayload);
            }
            return newStudent;
        },
        onSuccess: (newStudent) => {
            toast.success(
                enrollImmediately
                    ? `تمت إضافة الطالب ${newStudent.studentName} وتسجيل اشتراكه في المجموعات بنجاح`
                    : 'تمت إضافة الطالب بنجاح'
            );
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'enrollments'] });
            handleCloseSingleModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'فشل في إضافة الطالب أو تسجيل الاشتراك');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateCenterStudentDTO & { isActive: boolean }> }) =>
            updateCenterStudent(id, data),
        onSuccess: () => {
            toast.success('تم تحديث بيانات الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            handleCloseSingleModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'فشل في تحديث بيانات الطالب');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterStudent,
        onSuccess: () => {
            toast.success('تم حذف الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'فشل في حذف الطالب');
        },
    });

    const bulkMutation = useMutation({
        mutationFn: bulkCreateCenterStudents,
        onSuccess: (data) => {
            toast.success(`تمت إضافة ${data.count} طالب بنجاح!`);
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            handleCloseBulkModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإضافة المتعددة');
        },
    });

    // Handlers Single Modal
    const handleOpenAdd = () => {
        setEditingStudent(null);
        setStudentName('');
        setParentName('');
        setStudentPhone('');
        setParentPhone('');
        setGradeLevel(ALL_GRADES[0]);
        setBarcode('');
        setNotes('');
        setEditIsActive(true);
        setEnrollImmediately(false);
        setEnrollmentType('PACKAGE');
        setPackageId('');
        setSelectedPackageGroupIds([]);
        setSelectedPrivateTeachers([]);
        setPackageDiscountType('');
        setPackageDiscountVal('0');
        setPrivateDiscountType('');
        setPrivateDiscountVal('0');
        setIsAddOpen(true);
    };

    const handleOpenEdit = (student: ICenterStudent) => {
        setEditingStudent(student);
        setStudentName(student.studentName);
        setParentName(student.parentName);
        setStudentPhone(student.studentPhone || '');
        setParentPhone(student.parentPhone || '');
        setGradeLevel(student.gradeLevel);
        setBarcode(student.barcode || '');
        setNotes(student.notes || '');
        setEditIsActive(student.isActive);
        setEnrollImmediately(false);
        setIsAddOpen(true);
    };

    const handleCloseSingleModal = () => {
        setIsAddOpen(false);
        setEditingStudent(null);
        setEnrollImmediately(false);
    };

    const handleSingleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName.trim() || !parentName.trim()) {
            toast.error('اسم الطالب واسم ولي الأمر مطلوبان');
            return;
        }

        const payload: CreateCenterStudentDTO = {
            studentName: studentName.trim(),
            parentName: parentName.trim(),
            gradeLevel,
            studentPhone: studentPhone.trim() || null,
            parentPhone: parentPhone.trim() || null,
            barcode: barcode.trim() || null,
            notes: notes.trim() || null,
        };

        if (editingStudent) {
            updateMutation.mutate({
                id: editingStudent._id,
                data: { ...payload, isActive: editIsActive },
            });
        } else {
            if (enrollImmediately) {
                if ((enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && !packageId) {
                    toast.error('يرجى اختيار الباقة التعليمية');
                    return;
                }
                if ((enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && selectedPrivateTeachers.length === 0) {
                    toast.error('يرجى اختيار مجموعة برايفت واحدة على الأقل');
                    return;
                }
            }
            createMutation.mutate(payload);
        }
    };

    // Handlers Bulk Modal
    const handleOpenBulk = () => {
        setBulkGradeLevel(ALL_GRADES[0]);
        setBulkPasteText('');
        setBulkRows([
            { id: '1', studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
            { id: '2', studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
            { id: '3', studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
        ]);
        setIsBulkOpen(true);
    };

    const handleCloseBulkModal = () => {
        setIsBulkOpen(false);
        setBulkRows([]);
        setBulkPasteText('');
    };

    const handleAddBulkRow = () => {
        setBulkRows((prev) => [
            ...prev,
            { id: Date.now().toString(), studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
        ]);
    };

    const handleRemoveBulkRow = (id: string) => {
        setBulkRows((prev) => prev.filter((r) => r.id !== id));
    };

    const handleUpdateBulkRow = (id: string, field: keyof BulkRow, val: string) => {
        setBulkRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
        );
    };

    const handleParsePasteText = () => {
        if (!bulkPasteText.trim()) return;

        const lines = bulkPasteText.trim().split('\n');
        const newRows: BulkRow[] = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            // Split by tab (Excel copy) or comma
            const parts = line.includes('\t') ? line.split('\t') : line.split(',');
            const sName = parts[0]?.trim() || '';
            const pName = parts[1]?.trim() || (sName ? `ولي أمر ${sName}` : '');
            const sPhone = parts[2]?.trim() || '';
            const pPhone = parts[3]?.trim() || '';

            if (sName) {
                newRows.push({
                    id: Math.random().toString(),
                    studentName: sName,
                    parentName: pName,
                    studentPhone: sPhone,
                    parentPhone: pPhone,
                });
            }
        }

        if (newRows.length > 0) {
            setBulkRows(newRows);
            setBulkPasteText('');
            toast.success(`تم استخراج ${newRows.length} طالب من النص`);
        } else {
            toast.error('لم نتمكن من استخراج بيانات الطلاب من النص');
        }
    };

    const handleBulkSubmit = () => {
        const validRows = bulkRows.filter((r) => r.studentName.trim());
        if (validRows.length === 0) {
            toast.error('يرجى ملء بيانات طالب واحد على الأقل');
            return;
        }

        const studentsPayload: CreateCenterStudentDTO[] = validRows.map((r) => ({
            studentName: r.studentName.trim(),
            parentName: r.parentName.trim() || `ولي أمر ${r.studentName.trim()}`,
            studentPhone: r.studentPhone.trim() || null,
            parentPhone: r.parentPhone.trim() || null,
            gradeLevel: bulkGradeLevel,
        }));

        bulkMutation.mutate({ students: studentsPayload });
    };

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        دليل طلاب السنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إضافة وإدارة بيانات الطلاب وتوليد الأكواد والباركود وربطهم بالباقات والمجموعات.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <BranchSwitcher />
                    <Button
                        onClick={handleOpenBulk}
                        variant="outline"
                        className="gap-2 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold shadow-sm"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        إضافة طلاب متعددين (Excel)
                    </Button>
                    <Button
                        onClick={handleOpenAdd}
                        className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold"
                    >
                        <Plus className="h-4 w-4" />
                        إضافة طالب جديد
                    </Button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="ابحث باسم الطالب، كود الطالب، رقم هاتف الطالب أو ولي الأمر، أو الباركود..."
                            className="pr-10 border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:bg-white"
                        />
                    </div>

                    <div className="w-full sm:w-auto">
                        <select
                            value={selectedGrade}
                            onChange={(e) => {
                                setSelectedGrade(e.target.value);
                                setPage(1);
                            }}
                            className="w-full sm:w-48 text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50 focus:bg-white focus:outline-none"
                        >
                            <option value="ALL">جميع المراحل الدراسية</option>
                            {ALL_GRADES.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
                    <span className="font-medium">
                        إجمالي الطلاب: <strong className="text-gray-900 font-bold">{totalCount}</strong> طالب
                    </span>
                    {selectedGrade !== 'ALL' && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[11px]">
                            مصفى حسب: {selectedGrade}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Students Table */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-bold text-gray-500">جاري تحميل دليل الطلاب...</p>
                </div>
            ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <Users className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-gray-800">لا يوجد طلاب مسجلين بالسنتر بعد</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        ابدأ بإضافة أول طالب أو استورد دفعة كاملة من ملف إكسيل بكل سهولة.
                    </p>
                    <div className="flex gap-2 mt-4">
                        <Button onClick={handleOpenAdd} size="sm" className="rounded-xl font-bold">
                            <Plus className="h-4 w-4 ml-1" />
                            إضافة أول طالب
                        </Button>
                        <Button onClick={handleOpenBulk} variant="outline" size="sm" className="rounded-xl font-bold">
                            <FileSpreadsheet className="h-4 w-4 ml-1" />
                            استيراد من إكسيل
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold">
                                <tr>
                                    <th className="py-3.5 px-4">الطالب</th>
                                    <th className="py-3.5 px-4">كود الطالب</th>
                                    <th className="py-3.5 px-4">المرحلة الدراسية</th>
                                    <th className="py-3.5 px-4">ولي الأمر والهواتف</th>
                                    <th className="py-3.5 px-4">الباركود</th>
                                    <th className="py-3.5 px-4">الحالة</th>
                                    <th className="py-3.5 px-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map((st) => (
                                    <tr key={st._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-gray-900">
                                            <Link
                                                href={`/center/students/${st._id}`}
                                                className="flex items-center gap-2 group hover:text-primary transition-colors cursor-pointer"
                                                title="عرض بروفايل الطالب"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                                                    {st.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-gray-900 font-bold group-hover:text-primary transition-colors underline-offset-4 group-hover:underline">
                                                        {st.studentName}
                                                    </div>
                                                    {st.notes && (
                                                        <div className="text-[11px] text-gray-400 font-normal">
                                                            ملاحظات: {st.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        </td>

                                        <td className="py-3.5 px-4">
                                            <Badge variant="outline" className="font-mono font-bold bg-blue-50 text-blue-700 border-blue-200">
                                                {st.studentCode}
                                            </Badge>
                                        </td>

                                        <td className="py-3.5 px-4">
                                            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 font-medium">
                                                {st.gradeLevel}
                                            </Badge>
                                        </td>

                                        <td className="py-3.5 px-4">
                                            <div className="space-y-0.5">
                                                <div className="text-gray-700 font-medium">{st.parentName}</div>
                                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                                    {st.studentPhone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3 text-gray-400" />
                                                            طالب: {st.studentPhone}
                                                        </span>
                                                    )}
                                                    {st.parentPhone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3 text-gray-400" />
                                                            ولي أمر: {st.parentPhone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                                            {st.barcode ? (
                                                <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                                                    <Barcode className="h-3 w-3" />
                                                    {st.barcode}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>

                                        <td className="py-3.5 px-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateMutation.mutate({
                                                        id: st._id,
                                                        data: { isActive: !st.isActive } as any,
                                                    });
                                                }}
                                                title={`اضغط لـ ${st.isActive ? 'تعطيل' : 'تنشيط'} الطالب`}
                                                className="cursor-pointer transition-transform hover:scale-105"
                                            >
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        st.isActive
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 font-bold'
                                                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-bold'
                                                    }
                                                >
                                                    {st.isActive ? 'نشط' : 'معطل'}
                                                </Badge>
                                            </button>
                                        </td>

                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Link
                                                    href={`/center/students/${st._id}`}
                                                    title="عرض الملف التعريفي للطالب"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors"
                                                >
                                                    <User className="h-3.5 w-3.5" />
                                                    <span>بروفايل</span>
                                                </Link>

                                                <Link
                                                    href={`/center/enrollments?studentId=${st._id}`}
                                                    title="تسجيل اشتراك"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors"
                                                >
                                                    <ClipboardList className="h-3.5 w-3.5" />
                                                    <span>اشتراك</span>
                                                </Link>

                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleOpenEdit(st)}
                                                    className="h-7 w-7 text-gray-500 hover:text-gray-900 rounded-lg"
                                                    title="تعديل البيانات"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (confirm(`هل أنت متأكد من حذف الطالب ${st.studentName} نهائياً من السنتر؟ سيتم حذف جميع سجلاته واشتراكاته.`)) {
                                                            deleteMutation.mutate(st._id);
                                                        }
                                                    }}
                                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                                    title="حذف الطالب نهائياً"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                            <div>
                                صفحة {page} من {totalPages}
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="h-7 text-xs rounded-lg"
                                >
                                    السابق
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="h-7 text-xs rounded-lg"
                                >
                                    التالي
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Single Add / Edit Modal ─────────────────────────────── */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-xl text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد للسنتر'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSingleSubmit} className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم الطالب رباعي *</label>
                            <Input
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="مثال: أحمد محمد علي حسن"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم ولي الأمر *</label>
                            <Input
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                placeholder="مثال: محمد علي حسن"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المرحلة الدراسية *</label>
                                <select
                                    value={gradeLevel}
                                    onChange={(e) => setGradeLevel(e.target.value)}
                                    className="w-full text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
                                >
                                    {ALL_GRADES.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">الباركود (اختياري)</label>
                                <Input
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    placeholder="توليد تلقائي إن ترك فارغاً"
                                    className="rounded-xl border-gray-200 font-mono text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">هاتف الطالب (اختياري)</label>
                                <Input
                                    value={studentPhone}
                                    onChange={(e) => setStudentPhone(e.target.value)}
                                    placeholder="01xxxxxxxxx"
                                    className="rounded-xl border-gray-200 font-mono text-xs text-left"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">هاتف ولي الأمر (اختياري)</label>
                                <Input
                                    value={parentPhone}
                                    onChange={(e) => setParentPhone(e.target.value)}
                                    placeholder="01xxxxxxxxx"
                                    className="rounded-xl border-gray-200 font-mono text-xs text-left"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">ملاحظات (اختياري)</label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="ملاحظات إضافية عن الطالب..."
                                className="rounded-xl border-gray-200 text-xs"
                            />
                        </div>

                        {editingStudent && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">حالة الحساب</label>
                                <select
                                    value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                                    onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                                    className="w-full text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
                                >
                                    <option value="ACTIVE">نشط</option>
                                    <option value="INACTIVE">معطل</option>
                                </select>
                            </div>
                        )}

                        {!editingStudent && (
                            <div className="pt-2 border-t border-gray-100 space-y-3">
                                <div
                                    onClick={() => {
                                        const next = !enrollImmediately;
                                        setEnrollImmediately(next);
                                        if (next && gradeLevel && packages.length > 0) {
                                            const matchingPkg = packages.find((p) => p.gradeLevel === gradeLevel);
                                            if (matchingPkg) handleSelectPackage(matchingPkg._id);
                                        }
                                    }}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                        enrollImmediately
                                            ? 'bg-blue-50/70 border-blue-300 shadow-sm'
                                            : 'bg-gray-50/70 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            checked={enrollImmediately}
                                            onChange={() => {}}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-gray-900 text-xs block">
                                                تسجيل باقة / مجموعات للطالب فوراً مع الإضافة
                                            </span>
                                            <span className="text-[11px] text-gray-500">
                                                تحديد باقة ومجموعات الطالب مباشرة دون الحاجة للذهاب لقسم الاشتراكات
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] font-bold ${enrollImmediately ? 'bg-primary text-white border-primary' : 'bg-gray-100 text-gray-600'}`}>
                                        {enrollImmediately ? 'مفعل ✓' : 'اختياري'}
                                    </Badge>
                                </div>

                                {enrollImmediately && (
                                    <div className="space-y-3 p-3.5 bg-gray-50/60 border border-gray-200 rounded-xl animate-in fade-in-50 duration-200">
                                        {/* Enrollment Type */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                                نوع الاشتراك المطلوب للطالب:
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={enrollmentType === 'PACKAGE' ? 'default' : 'outline'}
                                                    onClick={() => setEnrollmentType('PACKAGE')}
                                                    className="rounded-xl text-xs font-bold"
                                                >
                                                    باكيدج فقط
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={enrollmentType === 'PRIVATE' ? 'default' : 'outline'}
                                                    onClick={() => setEnrollmentType('PRIVATE')}
                                                    className="rounded-xl text-xs font-bold"
                                                >
                                                    برايفت فقط
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
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
                                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5">
                                                <div>
                                                    <label className="text-xs font-bold text-blue-900 block mb-1">
                                                        اختيار الباقة التعليمية ({gradeLevel}) *
                                                    </label>
                                                    <select
                                                        value={packageId}
                                                        onChange={(e) => handleSelectPackage(e.target.value)}
                                                        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold"
                                                    >
                                                        <option value="" disabled>اختر الباقة</option>
                                                        {packages.map((pkg) => (
                                                            <option key={pkg._id} value={pkg._id}>
                                                                {pkg.name} ({pkg.gradeLevel}) — {pkg.monthlyPrice} ج.م/شهر
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Auto-selected package groups */}
                                                {selectedPkg && (
                                                    <div className="space-y-1.5 pt-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                                                                <span>مجموعات الباقة المشمولة (محددة بالكامل تلقائياً):</span>
                                                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                                                    {selectedPackageGroupIds.length} من {packageMatchingGroups.length} محدد
                                                                </Badge>
                                                            </label>
                                                        </div>

                                                        {packageMatchingGroups.length === 0 ? (
                                                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                                                                ⚠️ لا توجد مجموعات مسجلة لهذه الباقة في مرحلة ({selectedPkg.gradeLevel}).
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
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
                                                                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                                                                isChecked
                                                                                    ? 'bg-white border-blue-400 shadow-sm ring-1 ring-blue-300'
                                                                                    : 'bg-white/60 border-gray-200 opacity-60 hover:opacity-100'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => {}}
                                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                                />
                                                                                <div>
                                                                                    <div className="flex items-center gap-1.5 font-bold text-gray-900 text-[11px]">
                                                                                        <span>{g.name}</span>
                                                                                        {subject && (
                                                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] py-0 px-1 font-bold">
                                                                                                {subject}
                                                                                            </Badge>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                                                                        <span>المدرس: {teacherName}</span>
                                                                                        {g.schedule && g.schedule.length > 0 && (
                                                                                            <span>• {g.schedule.map((s) => `${s.day} ${s.time}`).join('، ')}</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isChecked ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                                {isChecked ? 'مشترك ✓' : 'مستبعد'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Private Selection */}
                                        {(enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && (
                                            <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-purple-900 block">
                                                        اختيار مجموعات البرايفت بالسنتر ({gradeLevel}) *
                                                    </label>
                                                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                                                        {selectedPrivateTeachers.length} محددة
                                                    </Badge>
                                                </div>

                                                {availablePrivateGroups.length === 0 ? (
                                                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                                                        ⚠️ لا توجد مجموعات برايفت مسجلة في السنتر لمرحلة ({gradeLevel}).
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
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
                                                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                                                                        isSelected
                                                                            ? 'border-purple-400 bg-white shadow-sm ring-1 ring-purple-300'
                                                                            : 'border-purple-100 bg-white/70 hover:bg-white hover:border-purple-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => {}}
                                                                            className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                                        />
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-[11px]">
                                                                                <span>{group.name}</span>
                                                                                {teacherObj?.subject && (
                                                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] py-0 px-1 font-bold">
                                                                                        {teacherObj.subject}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                                                                <span>المدرس: {teacherObj?.name || 'مدرس بالسنتر'}</span>
                                                                                {group.schedule && group.schedule.length > 0 && (
                                                                                    <span>• {group.schedule.map((s) => `${s.day} ${s.time}`).join('، ')}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-left shrink-0">
                                                                        <span className="font-bold text-purple-700 text-xs block">
                                                                            {group.privateMonthlyPrice ? `${group.privateMonthlyPrice} ج.م` : 'مجاناً'}
                                                                        </span>
                                                                        <span className="text-[9px] text-gray-400">شهرياً</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseSingleModal}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-white"
                            >
                                {createMutation.isPending || updateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editingStudent ? (
                                    'حفظ التعديلات'
                                ) : (
                                    'إضافة الطالب'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Bulk Add Modal ───────────────────────────────────────── */}
            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                <DialogContent className="sm:max-w-2xl text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            إضافة طلاب متعددين (Excel / قائمة)
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        {/* Grade Level Selector */}
                        <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1.5">
                            <label className="font-bold text-emerald-900 block">
                                المرحلة الدراسية للدفعة المضافة:
                            </label>
                            <select
                                value={bulkGradeLevel}
                                onChange={(e) => setBulkGradeLevel(e.target.value)}
                                className="w-full text-xs font-bold border border-emerald-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                            >
                                {ALL_GRADES.map((g) => (
                                    <option key={g} value={g}>
                                        {g}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-emerald-700">
                                سيتم توليد أكواد متسلسلة للطلاب تلقائياً بناءً على هذه المرحلة.
                            </p>
                        </div>

                        {/* Paste from Excel box */}
                        <div className="space-y-1.5">
                            <label className="font-bold text-gray-700 block">
                                لصق سريع من Excel (اختياري):
                            </label>
                            <textarea
                                value={bulkPasteText}
                                onChange={(e) => setBulkPasteText(e.target.value)}
                                placeholder="انسخ صفوف الطلاب من إكسيل والصقها هنا مباشرة:&#10;اسم الطالب [Tab] اسم ولي الأمر [Tab] هاتف الطالب [Tab] هاتف ولي الأمر"
                                rows={3}
                                className="w-full p-2.5 rounded-xl border border-gray-200 text-xs font-mono bg-gray-50/50 focus:bg-white focus:outline-none"
                            />
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleParsePasteText}
                                    disabled={!bulkPasteText.trim()}
                                    className="rounded-lg text-xs font-bold gap-1.5"
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    تعبئة الجدول من النص المنسوخ
                                </Button>
                            </div>
                        </div>

                        {/* Dynamic Rows Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between font-bold text-gray-700">
                                <span>قائمة الطلاب ({bulkRows.filter((r) => r.studentName.trim()).length} جاهز للإضافة):</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleAddBulkRow}
                                    className="h-7 text-xs text-primary font-bold gap-1"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    إضافة سطر جديد
                                </Button>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-2 w-8">#</th>
                                            <th className="p-2">اسم الطالب *</th>
                                            <th className="p-2">اسم ولي الأمر</th>
                                            <th className="p-2">هاتف الطالب</th>
                                            <th className="p-2">هاتف ولي الأمر</th>
                                            <th className="p-2 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {bulkRows.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-gray-50/50">
                                                <td className="p-2 text-center text-gray-400 font-mono text-[11px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="p-1.5">
                                                    <Input
                                                        value={row.studentName}
                                                        onChange={(e) =>
                                                            handleUpdateBulkRow(row.id, 'studentName', e.target.value)
                                                        }
                                                        placeholder="اسم الطالب"
                                                        className="h-8 text-xs rounded-lg border-gray-200"
                                                    />
                                                </td>
                                                <td className="p-1.5">
                                                    <Input
                                                        value={row.parentName}
                                                        onChange={(e) =>
                                                            handleUpdateBulkRow(row.id, 'parentName', e.target.value)
                                                        }
                                                        placeholder="اسم ولي الأمر"
                                                        className="h-8 text-xs rounded-lg border-gray-200"
                                                    />
                                                </td>
                                                <td className="p-1.5">
                                                    <Input
                                                        value={row.studentPhone}
                                                        onChange={(e) =>
                                                            handleUpdateBulkRow(row.id, 'studentPhone', e.target.value)
                                                        }
                                                        placeholder="01xxxxxxxxx"
                                                        className="h-8 text-xs rounded-lg border-gray-200 font-mono text-left"
                                                        dir="ltr"
                                                    />
                                                </td>
                                                <td className="p-1.5">
                                                    <Input
                                                        value={row.parentPhone}
                                                        onChange={(e) =>
                                                            handleUpdateBulkRow(row.id, 'parentPhone', e.target.value)
                                                        }
                                                        placeholder="01xxxxxxxxx"
                                                        className="h-8 text-xs rounded-lg border-gray-200 font-mono text-left"
                                                        dir="ltr"
                                                    />
                                                </td>
                                                <td className="p-1.5 text-center">
                                                    {bulkRows.length > 1 && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleRemoveBulkRow(row.id)}
                                                            className="h-7 w-7 text-gray-400 hover:text-red-500 rounded-lg"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseBulkModal}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="button"
                                onClick={handleBulkSubmit}
                                disabled={bulkMutation.isPending}
                                className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {bulkMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    `إضافة الطلاب (${bulkRows.filter((r) => r.studentName.trim()).length})`
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

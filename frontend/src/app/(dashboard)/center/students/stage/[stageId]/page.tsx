'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { getStageConfig } from '@/lib/constants/stage-sections';
import { toast } from 'sonner';
import {
    ArrowRight,
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
    Copy,
    GraduationCap,
    Filter,
    User,
    Check,
    X,
    ChevronLeft,
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

export default function StageStudentsPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();

    const stageId = (params?.stageId as string) || '';
    const stageConfig = getStageConfig(stageId);

    // State
    const [localSearch, setLocalSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Debounce search by 400ms to avoid spamming the server while typing
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(localSearch.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [localSearch]);

    // Single Add / Edit Modal
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<ICenterStudent | null>(null);

    // Single Student Form fields
    const [studentName, setStudentName] = useState('');
    const [parentName, setParentName] = useState('');
    const [studentPhone, setStudentPhone] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(stageConfig?.defaultAddGrade || '');
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

    // Bulk Add Modal
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkGradeLevel, setBulkGradeLevel] = useState<string>(stageConfig?.defaultAddGrade || '');
    const [bulkPasteText, setBulkPasteText] = useState('');
    const [bulkRows, setBulkRows] = useState<BulkRow[]>([
        { id: '1', studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
    ]);

    // Delete Student Dialog
    const [deletingStudent, setDeletingStudent] = useState<ICenterStudent | null>(null);

    // Update default grade if stageConfig loads
    useEffect(() => {
        if (stageConfig) {
            setGradeLevel(stageConfig.defaultAddGrade);
            setBulkGradeLevel(stageConfig.defaultAddGrade);
        }
    }, [stageConfig]);

    // Effective search & status
    const effectiveSearch = debouncedSearch || undefined;
    const isActiveParam = statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

    // Fetch students for this stage (Paginated & Cached to prevent heavy server load)
    const { data: response, isLoading, isFetching } = useQuery({
        queryKey: [
            'center',
            'students',
            'stage-page',
            stageConfig?.key,
            effectiveSearch,
            selectedGrade,
            isActiveParam,
            page,
            pageSize,
        ],
        queryFn: () =>
            fetchCenterStudents({
                stage: stageConfig?.key,
                gradeLevel: selectedGrade !== 'ALL' ? selectedGrade : undefined,
                isActive: isActiveParam,
                search: effectiveSearch,
                page,
                limit: pageSize,
            }),
        enabled: !!stageConfig,
        staleTime: 30000,
        refetchOnWindowFocus: false,
    });

    const students = response?.data || [];
    const totalResults = response?.total ?? 0;
    const totalPages = response?.totalPages || 1;

    // Packages, Teachers, Groups queries (lazy-loaded only when modal is open)
    const { data: packages = [] } = useQuery<ICenterPackage[]>({
        queryKey: ['center', 'packages'],
        queryFn: () => fetchCenterPackages({ isActive: true }),
        enabled: isAddOpen,
        staleTime: 5 * 60 * 1000,
    });

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
        enabled: isAddOpen,
        staleTime: 5 * 60 * 1000,
    });

    const { data: groups = [] } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups'],
        queryFn: () => fetchCenterGroups({ isActive: true }),
        enabled: isAddOpen,
        staleTime: 5 * 60 * 1000,
    });

    // Package Auto-Select
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

    const instantPkgPrice = (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && selectedPkg
        ? (selectedPkg.monthlyPrice || 0)
        : 0;
    const instantPrivatePrice = (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH')
        ? selectedPrivateTeachers.reduce((sum, p) => {
              const grp = groups.find((g) => g._id === p.groupId);
              return sum + (grp?.privateMonthlyPrice ?? p.monthlyPrice ?? 0);
          }, 0)
        : 0;
    const instantTotalPrice = instantPkgPrice + instantPrivatePrice;

    // Copy student code helper
    const handleCopy = (code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`تم نسخ كود الطالب: ${code}`);
        setTimeout(() => setCopiedCode(null), 2500);
    };

    // Open add modal
    const handleOpenAdd = (targetGrade?: string) => {
        setEditingStudent(null);
        setStudentName('');
        setParentName('');
        setStudentPhone('');
        setParentPhone('');
        setGradeLevel(targetGrade || stageConfig?.defaultAddGrade || '');
        setBarcode('');
        setNotes('');
        setEditIsActive(true);
        setEnrollImmediately(false);
        setEnrollmentType('PACKAGE');
        setPackageId('');
        setSelectedPackageGroupIds([]);
        setSelectedPrivateTeachers([]);
        setIsAddOpen(true);
    };

    // Open edit modal
    const handleOpenEdit = (student: ICenterStudent) => {
        setEditingStudent(student);
        setStudentName(student.studentName);
        setParentName(student.parentName || '');
        setStudentPhone(student.studentPhone || '');
        setParentPhone(student.parentPhone || '');
        setGradeLevel(student.gradeLevel);
        setBarcode(student.barcode || '');
        setNotes(student.notes || '');
        setEditIsActive(student.isActive);
        setEnrollImmediately(false);
        setIsAddOpen(true);
    };

    // Single Add/Edit Mutation
    const singleMutation = useMutation({
        mutationFn: async () => {
            if (editingStudent) {
                return await updateCenterStudent(editingStudent._id, {
                    studentName,
                    parentName: parentName || undefined,
                    studentPhone: studentPhone || undefined,
                    parentPhone: parentPhone || undefined,
                    gradeLevel: gradeLevel as any,
                    barcode: barcode || undefined,
                    notes: notes || undefined,
                    isActive: editIsActive,
                });
            } else {
                const created = await createCenterStudent({
                    studentName,
                    parentName: parentName || undefined,
                    studentPhone: studentPhone || undefined,
                    parentPhone: parentPhone || undefined,
                    gradeLevel: gradeLevel as any,
                    barcode: barcode || undefined,
                    notes: notes || undefined,
                });

                if (enrollImmediately && created?._id) {
                    try {
                        const pDiscVal = parseFloat(packageDiscountVal) || 0;
                        const prDiscVal = parseFloat(privateDiscountVal) || 0;

                        await enrollStudent({
                            studentId: created._id,
                            type: enrollmentType,
                            packageId: (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && packageId ? packageId : undefined,
                            packageGroups: (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && selectedPackageGroupIds.length > 0 ? selectedPackageGroupIds : undefined,
                            packageDiscount: (enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && packageDiscountType ? {
                                type: packageDiscountType,
                                value: pDiscVal,
                            } : undefined,
                            privateTeachers: (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && selectedPrivateTeachers.length > 0
                                ? selectedPrivateTeachers.map((t) => ({
                                      centerTeacherId: t.centerTeacherId,
                                      groupId: t.groupId,
                                      monthlyPrice: t.monthlyPrice,
                                      subject: t.subject,
                                  }))
                                : undefined,
                            privateDiscount: (enrollmentType === 'PRIVATE' || enrollmentType === 'BOTH') && privateDiscountType ? {
                                type: privateDiscountType,
                                value: prDiscVal,
                            } : undefined,
                        });
                        toast.success('تم تسجيل الطالب وتفعيل الاشتراك والمجموعات فوراً بنجاح ✅');
                    } catch {
                        toast.error('تم إنشاء الطالب بنجاح، ولكن تعذر تفعيل الاشتراك التلقائي.');
                    }
                }

                return created;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            setIsAddOpen(false);
            if (!enrollImmediately || editingStudent) {
                toast.success(editingStudent ? 'تم تعديل بيانات الطالب بنجاح' : 'تم إضافة الطالب بنجاح');
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات');
        },
    });

    const handleSingleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName.trim()) {
            toast.error('يرجى إدخال اسم الطالب');
            return;
        }
        singleMutation.mutate();
    };

    // Toggle Active/Disabled status
    const toggleActiveMutation = useMutation({
        mutationFn: async (student: ICenterStudent) => {
            return await updateCenterStudent(student._id, {
                isActive: !student.isActive,
            });
        },
        onSuccess: (_data, student) => {
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            toast.success(student.isActive ? 'تم تعطيل حساب الطالب' : 'تم تنشيط حساب الطالب');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'تعذر تغيير حالة الطالب');
        },
    });

    // Delete Student Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await deleteCenterStudent(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            setDeletingStudent(null);
            toast.success('تم حذف الطالب بنجاح');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'تعذر حذف الطالب');
        },
    });

    // Bulk Add Helpers
    const handlePasteExcel = (text: string) => {
        setBulkPasteText(text);
        if (!text.trim()) return;

        const lines = text.trim().split(/\r\n|\n|\r/);
        const parsedRows: BulkRow[] = [];

        lines.forEach((line, idx) => {
            if (!line.trim()) return;
            const parts = line.split('\t');
            parsedRows.push({
                id: String(idx + 1),
                studentName: parts[0]?.trim() || '',
                parentName: parts[1]?.trim() || '',
                studentPhone: parts[2]?.trim() || '',
                parentPhone: parts[3]?.trim() || '',
            });
        });

        if (parsedRows.length > 0) {
            setBulkRows(parsedRows);
            toast.success(`تم استيراد ${parsedRows.length} طالب من النص الملصق`);
        }
    };

    const addBulkRow = () => {
        setBulkRows((prev) => [
            ...prev,
            { id: String(Date.now()), studentName: '', parentName: '', studentPhone: '', parentPhone: '' },
        ]);
    };

    const removeBulkRow = (id: string) => {
        setBulkRows((prev) => prev.filter((r) => r.id !== id));
    };

    const updateBulkRow = (id: string, field: keyof BulkRow, val: string) => {
        setBulkRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
    };

    const bulkMutation = useMutation({
        mutationFn: async () => {
            const validStudents = bulkRows
                .filter((r) => r.studentName.trim().length > 0)
                .map((r) => ({
                    studentName: r.studentName.trim(),
                    parentName: r.parentName.trim() || undefined,
                    studentPhone: r.studentPhone.trim() || undefined,
                    parentPhone: r.parentPhone.trim() || undefined,
                    gradeLevel: bulkGradeLevel as any,
                }));

            if (validStudents.length === 0) {
                throw new Error('يرجى ملء اسم طالب واحد على الأقل');
            }

            return await bulkCreateCenterStudents({ students: validStudents });
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['center', 'students'] });
            setIsBulkOpen(false);
            setBulkPasteText('');
            setBulkRows([{ id: '1', studentName: '', parentName: '', studentPhone: '', parentPhone: '' }]);
            toast.success(`تمت إضافة ${res.count} طالب بنجاح`);
        },
        onError: (err: any) => {
            toast.error(err?.message || err?.response?.data?.message || 'حدث خطأ أثناء إضافة الطلاب');
        },
    });

    // If stageConfig does not exist
    if (!stageConfig) {
        return (
            <div className="w-full max-w-4xl mx-auto py-16 px-4 text-center space-y-4 font-sans" dir="rtl">
                <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mx-auto text-2xl font-bold">
                    !
                </div>
                <h2 className="text-xl font-black text-gray-900">المرحلة الدراسية المطلوبة غير موجودة</h2>
                <p className="text-sm text-gray-500">
                    تأكد من اختيار مرحلة صحيحة (الثانوية، الإعدادية، أو الابتدائية).
                </p>
                <Button onClick={() => router.push('/center/students')} className="gap-2 rounded-xl font-bold">
                    <ArrowRight className="w-4 h-4 ml-1" />
                    العودة إلى دليل الطلاب
                </Button>
            </div>
        );
    }

    const StageIcon = stageConfig.icon;
    const theme = stageConfig.theme;

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 font-sans pb-16 animate-in fade-in duration-300" dir="rtl">
            {/* ── Breadcrumbs & Back Navigation ──────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <Link href="/center/students" className="hover:text-primary transition-colors flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>دليل الطلاب</span>
                    </Link>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-900 font-black">{stageConfig.title}</span>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/center/students')}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-50 gap-1.5 shadow-2xs"
                >
                    <ArrowRight className="w-3.5 h-3.5 text-primary ml-0.5" />
                    <span>العودة لكافة المراحل</span>
                </Button>
            </div>

            {/* ── Stage Hero Banner & Action Header ──────────────────────────── */}
            <div className={`rounded-3xl border p-5 sm:p-7 shadow-xs ${theme.headerBg} ${theme.headerBorder}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    {/* Right: Icon, Title, Subtitle, Count */}
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${theme.iconBg} ${theme.iconColor}`}>
                            <StageIcon className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                                    {stageConfig.title}
                                </h1>
                                <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
                                    {totalResults} طالب مسجل
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 font-medium">
                                {stageConfig.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Left: Action Buttons */}
                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setBulkGradeLevel(stageConfig.defaultAddGrade);
                                setIsBulkOpen(true);
                            }}
                            className="h-10 px-3.5 rounded-xl text-xs font-bold bg-white border-gray-200 text-gray-700 hover:bg-gray-50 gap-2 shadow-2xs"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>إضافة دفعة طلاب</span>
                        </Button>

                        <Button
                            type="button"
                            onClick={() => handleOpenAdd()}
                            className="h-10 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white gap-2 shadow-md shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span>إضافة طالب جديد للمرحلة</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Toolbar: Search, Grade Pills & Status Filters ─────────────── */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                {/* Search Bar & Status Pills */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        {isFetching ? (
                            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                        ) : (
                            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        )}
                        <Input
                            value={localSearch}
                            onChange={(e) => {
                                setLocalSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder={`بحث في ${stageConfig.title} بالاسم، كود الطالب، رقم الهاتف، أو الباركود...`}
                            className="pr-10 pl-9 border-gray-200 rounded-xl text-xs sm:text-sm bg-gray-50/60 focus:bg-white h-10 shadow-2xs"
                        />
                        {localSearch && (
                            <button
                                type="button"
                                onClick={() => {
                                    setLocalSearch('');
                                    setPage(1);
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Active/Disabled Pills */}
                    <div className="flex items-center gap-1 bg-gray-100/70 p-1 rounded-xl self-stretch sm:self-auto shrink-0 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter('ALL');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === 'ALL'
                                    ? 'bg-white text-gray-900 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            الكل
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter('ACTIVE');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === 'ACTIVE'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-gray-500 hover:text-emerald-700'
                            }`}
                        >
                            نشط
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter('INACTIVE');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                statusFilter === 'INACTIVE'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'text-gray-500 hover:text-red-700'
                            }`}
                        >
                            معطل
                        </button>
                    </div>
                </div>

                {/* Sub-Grade Pills Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 ml-1 flex items-center gap-1">
                            <Filter className="w-3 h-3 text-gray-400" />
                            الصفوف:
                        </span>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedGrade('ALL');
                                setPage(1);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                selectedGrade === 'ALL'
                                    ? `${theme.pillActive} shadow-xs font-black`
                                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            جميع الصفوف
                        </button>

                        {stageConfig.grades.map((grade) => (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => {
                                    setSelectedGrade(grade);
                                    setPage(1);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedGrade === grade
                                        ? `${theme.pillActive} shadow-xs font-black`
                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                {grade}
                            </button>
                        ))}
                    </div>

                    <div className="text-[11px] font-bold text-gray-400 mr-auto sm:mr-0 flex items-center gap-2">
                        {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                        <span>
                            النتائج: <strong className="text-gray-700 font-black">{totalResults}</strong> طالب
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Students Data Table / Empty State ───────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-3 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-xs font-bold text-gray-500">جاري تحميل طلاب {stageConfig.title}...</p>
                    </div>
                ) : students.length === 0 ? (
                    <div className="py-20 px-4 text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto border border-gray-100">
                            <Users className="w-7 h-7" />
                        </div>
                        <div className="space-y-1 max-w-md mx-auto">
                            <h3 className="text-base font-bold text-gray-900">
                                {effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL'
                                    ? 'لا توجد نتائج مطابقة لخيارات البحث'
                                    : `لا يوجد طلاب مسجلين في ${stageConfig.title} حتى الآن`}
                            </h3>
                            <p className="text-xs text-gray-400">
                                {effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL'
                                    ? 'جرّب إعادة ضبط الفلاتر أو البحث بكلمات أخرى.'
                                    : 'ابدأ بإضافة أول طالب لهذه المرحلة مباشرة لتوليد الأكواد وتفعيل الاشتراكات.'}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            {(effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL') && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setLocalSearch('');
                                        setSelectedGrade('ALL');
                                        setStatusFilter('ALL');
                                        setPage(1);
                                    }}
                                    className="h-9 text-xs rounded-xl font-bold"
                                >
                                    إعادة ضبط الفلاتر
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleOpenAdd(selectedGrade !== 'ALL' ? selectedGrade : undefined)}
                                className="h-9 text-xs rounded-xl font-bold bg-primary hover:bg-primary/95 text-white gap-1.5 shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>إضافة طالب جديد</span>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold">
                                <tr>
                                    <th className="py-3.5 px-4">الطالب</th>
                                    <th className="py-3.5 px-4">كود الطالب</th>
                                    <th className="py-3.5 px-4">الصف الدراسي</th>
                                    <th className="py-3.5 px-4">ولي الأمر والهواتف</th>
                                    <th className="py-3.5 px-4">الباركود</th>
                                    <th className="py-3.5 px-4">الحالة</th>
                                    <th className="py-3.5 px-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map((st) => (
                                    <tr key={st._id} className="hover:bg-gray-50/60 transition-colors">
                                        {/* Student Name & Avatar */}
                                        <td className="py-3.5 px-4 font-bold text-gray-900">
                                            <Link
                                                href={`/center/students/${st._id}`}
                                                className="flex items-center gap-2.5 group hover:text-primary transition-colors cursor-pointer"
                                                title="عرض الملف التعريفي للطالب"
                                            >
                                                <div
                                                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
                                                >
                                                    {st.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-gray-900 font-bold group-hover:text-primary transition-colors underline-offset-4 group-hover:underline text-sm">
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

                                        {/* Student Code */}
                                        <td className="py-3.5 px-4">
                                            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs shadow-2xs">
                                                <span>{st.studentCode}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopy(st.studentCode, e)}
                                                    title="نسخ كود الطالب"
                                                    className="hover:text-blue-900 p-0.5 transition-colors cursor-pointer"
                                                >
                                                    {copiedCode === st.studentCode ? (
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="w-3 h-3 text-blue-400 hover:text-blue-700" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>

                                        {/* Grade Level */}
                                        <td className="py-3.5 px-4">
                                            <Badge
                                                variant="outline"
                                                className={`font-semibold ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                                            >
                                                {st.gradeLevel}
                                            </Badge>
                                        </td>

                                        {/* Parent & Phone Numbers */}
                                        <td className="py-3.5 px-4">
                                            <div className="space-y-0.5">
                                                <div className="text-gray-700 font-medium">{st.parentName || '—'}</div>
                                                <div className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-wrap">
                                                    {st.studentPhone && (
                                                        <a
                                                            href={`tel:${st.studentPhone}`}
                                                            className="flex items-center gap-1 hover:text-primary transition-colors"
                                                            title="اتصال بالطالب"
                                                        >
                                                            <Phone className="h-3 w-3 text-gray-400" />
                                                            طالب: {st.studentPhone}
                                                        </a>
                                                    )}
                                                    {st.parentPhone && (
                                                        <a
                                                            href={`tel:${st.parentPhone}`}
                                                            className="flex items-center gap-1 hover:text-primary transition-colors"
                                                            title="اتصال بولي الأمر"
                                                        >
                                                            <Phone className="h-3 w-3 text-gray-400" />
                                                            ولي أمر: {st.parentPhone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Barcode */}
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

                                        {/* Active / Inactive Status Toggle */}
                                        <td className="py-3.5 px-4">
                                            <button
                                                type="button"
                                                onClick={() => toggleActiveMutation.mutate(st)}
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

                                        {/* Actions */}
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
                                                    className="h-7 w-7 text-gray-500 hover:text-gray-900 rounded-lg cursor-pointer"
                                                    title="تعديل البيانات"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setDeletingStudent(st)}
                                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
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
                )}

                {/* Pagination & Page Size Control */}
                {totalResults > 0 && (
                    <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div>
                                عرض <strong className="text-gray-800 font-black">{Math.min(totalResults, (page - 1) * pageSize + 1)}</strong> -{' '}
                                <strong className="text-gray-800 font-black">{Math.min(totalResults, page * pageSize)}</strong> من إجمالي{' '}
                                <strong className="text-primary font-black">{totalResults}</strong> طالب
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600 mr-2">
                                <span className="text-[11px]">في الصفحة:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:border-primary shadow-2xs cursor-pointer"
                                >
                                    <option value={15}>15</option>
                                    <option value={20}>20</option>
                                    <option value={30}>30</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="h-8 px-3 text-xs rounded-xl font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    السابق
                                </Button>
                                <span className="px-2 font-bold text-gray-700">
                                    صفحة {page} من {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="h-8 px-3 text-xs rounded-xl font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    التالي
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Single Add / Edit Modal ────────────────────────────────────── */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-xl text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingStudent ? 'تعديل بيانات الطالب' : `إضافة طالب جديد إلى ${stageConfig.title}`}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSingleSubmit} className="space-y-3.5 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم الطالب *</label>
                            <Input
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="مثال: يوسف أحمد محمود"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">المرحلة الدراسية والصف *</label>
                            <select
                                value={gradeLevel}
                                onChange={(e) => setGradeLevel(e.target.value)}
                                className="w-full text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
                            >
                                {stageConfig.grades.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
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

                        {editingStudent && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">اسم ولي الأمر (اختياري)</label>
                                <Input
                                    value={parentName}
                                    onChange={(e) => setParentName(e.target.value)}
                                    placeholder="مثال: أحمد محمود"
                                    className="rounded-xl border-gray-200"
                                />
                            </div>
                        )}

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

                        {/* Optional Instant Enrollment */}
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
                                            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-gray-900 block">
                                                تسجيل اشتراك للطالب فوراً
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium">
                                                إلحاق الطالب بباكيدج أو مجموعات وتوليد الاستحقاقات المالية مباشرة
                                            </span>
                                        </div>
                                    </div>
                                    {enrollImmediately && instantTotalPrice > 0 && (
                                        <Badge className="bg-blue-600 text-white font-bold text-xs">
                                            {instantTotalPrice} ج.م/شهر
                                        </Badge>
                                    )}
                                </div>

                                {enrollImmediately && (
                                    <div className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200 space-y-3">
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEnrollmentType('PACKAGE')}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    enrollmentType === 'PACKAGE'
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-white border text-gray-700'
                                                }`}
                                            >
                                                باكيدج كامل
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEnrollmentType('PRIVATE')}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    enrollmentType === 'PRIVATE'
                                                        ? 'bg-primary text-white shadow-xs'
                                                        : 'bg-white border text-gray-700'
                                                }`}
                                            >
                                                مجموعات فردية
                                            </button>
                                        </div>

                                        {(enrollmentType === 'PACKAGE' || enrollmentType === 'BOTH') && (
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-600 block mb-1">اختر الباكيدج</label>
                                                <select
                                                    value={packageId}
                                                    onChange={(e) => handleSelectPackage(e.target.value)}
                                                    className="w-full text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-white"
                                                >
                                                    <option value="">-- اختر الباكيدج المناسب --</option>
                                                    {packages
                                                        .filter((p) => p.gradeLevel === gradeLevel)
                                                        .map((p) => (
                                                            <option key={p._id} value={p._id}>
                                                                {p.name} ({p.monthlyPrice} ج.م)
                                                            </option>
                                                        ))}
                                                </select>
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
                                onClick={() => setIsAddOpen(false)}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={singleMutation.isPending}
                                className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-white gap-2"
                            >
                                {singleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب'}</span>
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Bulk Add Modal ─────────────────────────────────────────────── */}
            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
                <DialogContent className="sm:max-w-2xl text-right font-sans max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                            <span>إضافة دفعة طلاب ({stageConfig.title})</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">الصف الدراسي الموحد *</label>
                            <select
                                value={bulkGradeLevel}
                                onChange={(e) => setBulkGradeLevel(e.target.value)}
                                className="w-full text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-white"
                            >
                                {stageConfig.grades.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>

                        {/* Excel Paste Box */}
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                            <label className="text-xs font-bold text-gray-700 block">لصق مباشر من Excel أو جدول</label>
                            <textarea
                                value={bulkPasteText}
                                onChange={(e) => handlePasteExcel(e.target.value)}
                                placeholder="انسخ الأعمدة من Excel (اسم الطالب [tab] اسم ولي الأمر [tab] هاتف الطالب [tab] هاتف ولي الأمر) والصقها هنا..."
                                rows={3}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2.5 bg-white font-mono"
                            />
                        </div>

                        {/* Rows Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700">بيانات الطلاب ({bulkRows.length})</span>
                                <Button type="button" size="sm" variant="outline" onClick={addBulkRow} className="h-7 text-xs rounded-lg gap-1">
                                    <Plus className="w-3 h-3" /> إضافة صف
                                </Button>
                            </div>

                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                                {bulkRows.map((row, idx) => (
                                    <div key={row.id} className="p-2.5 flex items-center gap-2 bg-white">
                                        <span className="text-xs font-bold text-gray-400 w-5 text-center shrink-0">{idx + 1}</span>
                                        <Input
                                            placeholder="اسم الطالب *"
                                            value={row.studentName}
                                            onChange={(e) => updateBulkRow(row.id, 'studentName', e.target.value)}
                                            className="h-8 text-xs rounded-lg"
                                        />
                                        <Input
                                            placeholder="هاتف ولي الأمر"
                                            value={row.parentPhone}
                                            onChange={(e) => updateBulkRow(row.id, 'parentPhone', e.target.value)}
                                            className="h-8 text-xs rounded-lg font-mono"
                                            dir="ltr"
                                        />
                                        <Input
                                            placeholder="هاتف الطالب"
                                            value={row.studentPhone}
                                            onChange={(e) => updateBulkRow(row.id, 'studentPhone', e.target.value)}
                                            className="h-8 text-xs rounded-lg font-mono"
                                            dir="ltr"
                                        />
                                        {bulkRows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeBulkRow(row.id)}
                                                className="text-red-400 hover:text-red-600 p-1"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)} className="rounded-xl">
                                إلغاء
                            </Button>
                            <Button
                                type="button"
                                onClick={() => bulkMutation.mutate()}
                                disabled={bulkMutation.isPending}
                                className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-white gap-2"
                            >
                                {bulkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>إضافة {bulkRows.filter((r) => r.studentName.trim()).length} طالب</span>
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Delete Student Confirmation Dialog ─────────────────────────── */}
            <Dialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-red-600 flex items-center gap-2">
                            <Trash2 className="w-5 h-5" />
                            <span>تأكيد حذف الطالب</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-3 space-y-2 text-xs text-gray-600">
                        <p>
                            هل أنت متأكد من حذف الطالب <strong className="text-gray-900 font-bold">{deletingStudent?.studentName}</strong> نهائياً؟
                        </p>
                        <p className="text-red-500">
                            سيؤدي هذا الإجراء إلى حذف كافة سجلات الحضور والاشتراكات وفك ربط الكارت المرتبط به.
                        </p>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeletingStudent(null)} className="rounded-xl">
                            إلغاء
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingStudent && deleteMutation.mutate(deletingStudent._id)}
                            disabled={deleteMutation.isPending}
                            className="rounded-xl font-bold gap-2"
                        >
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>تأكيد الحذف</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

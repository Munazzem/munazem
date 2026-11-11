'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    Clock,
    GraduationCap,
    Loader2,
    QrCode,
    Layers,
    BookOpen,
} from 'lucide-react';
import {
    fetchCenterGroups,
    fetchCenterTeachers,
    createCenterGroup,
    updateCenterGroup,
    deleteCenterGroup,
} from '@/lib/api/centers';
import { ICenterGroup, ICenterTeacher, CenterGroupType } from '@/types/center.types';
import { ALL_GRADES, STAGE_HIERARCHY, getStageForGrade } from '@/lib/constants/grade.constants';
import { OfflineStorageService } from '@/lib/offline/storage.service';
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

const DAYS_OF_WEEK = [
    'السبت',
    'الأحد',
    'الإثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
];

export default function CenterGroupsPage() {
    const queryClient = useQueryClient();
    const [selectedStage, setSelectedStage] = useState<'ALL' | 'SECONDARY' | 'PREPARATORY' | 'PRIMARY'>('ALL');
    const [filterGrade, setFilterGrade] = useState<string>('ALL');
    const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ICenterGroup | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [centerTeacherId, setCenterTeacherId] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(STAGE_HIERARCHY[0].grades[0]);
    const [groupType, setGroupType] = useState<CenterGroupType>('PRIVATE');
    const [capacity, setCapacity] = useState('50');
    const [privatePrice, setPrivatePrice] = useState('');
    const [schedule, setSchedule] = useState<{ day: string; time: string }[]>([
        { day: 'السبت', time: '14:00' },
    ]);

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: allGroups = [], isLoading } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups', filterTeacher, filterType],
        queryFn: () =>
            fetchCenterGroups({
                centerTeacherId: filterTeacher !== 'ALL' ? filterTeacher : undefined,
                groupType: filterType !== 'ALL' ? filterType : undefined,
            }),
    });

    const groups = useMemo(() => {
        return allGroups.filter((g) => {
            if (filterGrade !== 'ALL') return g.gradeLevel === filterGrade;
            if (selectedStage !== 'ALL') return getStageForGrade(g.gradeLevel) === selectedStage;
            return true;
        });
    }, [allGroups, selectedStage, filterGrade]);

    const currentStageObj = useMemo(
        () => STAGE_HIERARCHY.find((s) => s.id === selectedStage) || null,
        [selectedStage]
    );

    const createMutation = useMutation({
        mutationFn: createCenterGroup,
        onSuccess: () => {
            toast.success('تم إنشاء الحصة الدراسية بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'sessions'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنشاء الحصة');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenterGroup(id, data),
        onSuccess: () => {
            toast.success('تم تعديل الحصة الدراسية بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
            queryClient.invalidateQueries({ queryKey: ['center', 'sessions'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعديل الحصة');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterGroup,
        onSuccess: (res: any) => {
            toast.success(res?.message || 'تم تعطيل الحصة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعطيل الحصة');
        },
    });

    const handleOpenAdd = () => {
        setEditingGroup(null);
        setName('');
        setCenterTeacherId(teachers[0]?._id || '');
        setGradeLevel(filterGrade !== 'ALL' ? filterGrade : STAGE_HIERARCHY[0].grades[0]);
        setGroupType('PRIVATE');
        setCapacity('50');
        setPrivatePrice('');
        setSchedule([{ day: 'السبت', time: '14:00' }]);
        setIsAddOpen(true);
    };

    const handleOpenEdit = (group: ICenterGroup) => {
        setEditingGroup(group);
        setName(group.name);
        setCenterTeacherId(
            typeof group.centerTeacherId === 'object' ? (group.centerTeacherId as any)._id : group.centerTeacherId
        );
        setGradeLevel(group.gradeLevel);
        setGroupType(group.groupType);
        setCapacity(group.capacity ? group.capacity.toString() : '50');
        setPrivatePrice(group.privateMonthlyPrice ? group.privateMonthlyPrice.toString() : '');
        setSchedule(group.schedule.length > 0 ? group.schedule : [{ day: 'السبت', time: '14:00' }]);
        setIsAddOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddOpen(false);
        setEditingGroup(null);
    };

    const addScheduleRow = () => {
        setSchedule([...schedule, { day: 'الأحد', time: '14:00' }]);
    };

    const removeScheduleRow = (index: number) => {
        if (schedule.length <= 1) return;
        setSchedule(schedule.filter((_, i) => i !== index));
    };

    const updateScheduleRow = (index: number, field: 'day' | 'time', value: string) => {
        const next = [...schedule];
        next[index][field] = value;
        setSchedule(next);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !centerTeacherId) {
            toast.error('يرجى تحديد اسم الحصة والمدرس');
            return;
        }

        const payload = {
            name: name.trim(),
            centerTeacherId,
            gradeLevel,
            groupType,
            schedule,
            capacity: Number(capacity) || 50,
            privateMonthlyPrice: privatePrice ? Number(privatePrice) : null,
        };

        if (editingGroup) {
            updateMutation.mutate({ id: editingGroup._id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <div className="space-y-5 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-primary shrink-0" />
                        <span>الحصص الدراسية بالسنتر</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        مقسمة حسب المرحلة وتحتها الصفوف الدراسية (حصص مواد الباكيدج، حصص البرايفت، والحصص المشتركة).
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button
                        onClick={handleOpenAdd}
                        className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إضافة حصة جديدة</span>
                    </Button>
                </div>
            </div>

            {/* Hierarchical Stage -> Grade Filter + Teacher/Type Filter */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                {/* Stage Row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-xs font-extrabold text-gray-500 shrink-0 ml-1 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        المرحلة:
                    </span>
                    <Button
                        variant={selectedStage === 'ALL' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            setSelectedStage('ALL');
                            setFilterGrade('ALL');
                        }}
                        className="rounded-xl text-xs font-bold shrink-0 h-8"
                    >
                        كل المراحل ({allGroups.length})
                    </Button>
                    {STAGE_HIERARCHY.map((st) => {
                        const count = allGroups.filter((g) => getStageForGrade(g.gradeLevel) === st.id).length;
                        return (
                            <Button
                                key={st.id}
                                variant={selectedStage === st.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setSelectedStage(st.id);
                                    setFilterGrade('ALL');
                                }}
                                className="rounded-xl text-xs font-bold shrink-0 h-8"
                            >
                                {st.label} ({count})
                            </Button>
                        );
                    })}
                </div>

                {/* Grades underneath Stage */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100 scrollbar-none">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 ml-1">الصف الدراسي:</span>
                    <button
                        type="button"
                        onClick={() => setFilterGrade('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${filterGrade === 'ALL'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        جميع الصفوف
                    </button>
                    {(currentStageObj ? currentStageObj.grades : ALL_GRADES).map((grade) => {
                        const count = allGroups.filter((g) => g.gradeLevel === grade).length;
                        return (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => setFilterGrade(grade)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${filterGrade === grade
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {grade} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Teacher & Class Type Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-1">تصفية بالمدرس</label>
                        <select
                            value={filterTeacher}
                            onChange={(e) => setFilterTeacher(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-700"
                        >
                            <option value="ALL">جميع المدرسين</option>
                            {teachers.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.name} ({t.subject})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-gray-400 block mb-1">نوع الحصة</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-700"
                        >
                            <option value="ALL">جميع الحصص</option>
                            <option value="PACKAGE">حصة باكيدج (Package Class)</option>
                            <option value="PRIVATE">حصة برايفت (Private Class)</option>
                            <option value="MIXED">حصة مشتركة باكيدج + برايفت (Mixed)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Classes Grouped by Stage -> Grade */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center px-4">
                    <Users className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا توجد حصص دراسية مطابقة للبحث</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بإنشاء حصة دراسية جديدة أو إنشاء باكيدج ليتم توليد حصص مواده تلقائياً.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إضافة حصة الآن
                    </Button>
                </div>
            ) : (
                <div className="space-y-8">
                    {STAGE_HIERARCHY.map((stageGroup) => {
                        const stageClasses = groups.filter(
                            (g) => getStageForGrade(g.gradeLevel) === stageGroup.id
                        );
                        if (stageClasses.length === 0) return null;

                        return (
                            <div key={stageGroup.id} className="space-y-4">
                                {/* Stage Header */}
                                <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        <h2 className="text-sm sm:text-base font-black">{stageGroup.label}</h2>
                                    </div>
                                    <Badge className="bg-white/15 text-white border-0 text-xs font-bold">
                                        {stageClasses.length} حصة
                                    </Badge>
                                </div>

                                {/* Sub-sections per Grade under Stage */}
                                <div className="space-y-5 pr-0 sm:pr-3">
                                    {stageGroup.grades.map((grade) => {
                                        const gradeClasses = stageClasses.filter((g) => g.gradeLevel === grade);
                                        if (gradeClasses.length === 0) return null;

                                        return (
                                            <div
                                                key={grade}
                                                className="bg-gray-50/60 border border-gray-200/70 rounded-2xl p-3.5 sm:p-4 space-y-3"
                                            >
                                                <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                                                        <h3 className="text-sm sm:text-base font-black text-gray-900">
                                                            {grade}
                                                        </h3>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-white text-gray-700 border-gray-200 text-xs font-bold"
                                                    >
                                                        {gradeClasses.length} حصة دراسية
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {gradeClasses.map((group) => {
                                                        const teacher =
                                                            typeof group.centerTeacherId === 'object'
                                                                ? group.centerTeacherId
                                                                : null;
                                                        const typeLabel =
                                                            group.groupType === 'PACKAGE'
                                                                ? 'حصة باكيدج'
                                                                : group.groupType === 'PRIVATE'
                                                                    ? 'حصة برايفت'
                                                                    : 'حصة مشتركة';
                                                        const typeColor =
                                                            group.groupType === 'PACKAGE'
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : group.groupType === 'PRIVATE'
                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200';

                                                        return (
                                                            <div
                                                                key={group._id}
                                                                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex flex-col justify-between overflow-hidden"
                                                            >
                                                                <div className="p-4 sm:p-5">
                                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                                        {(group as any).isPendingDelete ? (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="text-xs font-bold bg-rose-50 text-rose-700 border-rose-300"
                                                                            >
                                                                                معلق للحذف
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge
                                                                                variant="outline"
                                                                                className={`text-xs font-bold ${typeColor}`}
                                                                            >
                                                                                {typeLabel}
                                                                            </Badge>
                                                                        )}
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-[11px] bg-gray-50 text-gray-600 border-gray-200 font-bold"
                                                                        >
                                                                            {group.gradeLevel}
                                                                        </Badge>
                                                                    </div>

                                                                    <h4 className="text-base sm:text-lg font-black text-gray-900 mt-1">
                                                                        {group.name}
                                                                    </h4>

                                                                    <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-600">
                                                                        <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                                                                        <span>
                                                                            {teacher
                                                                                ? `أ/ ${teacher.name} (${teacher.subject})`
                                                                                : 'مدرس السنتر'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Schedule */}
                                                                    <div className="mt-3.5 pt-3 border-t border-gray-100">
                                                                        <span className="text-[11px] font-bold text-gray-400 block mb-1.5">
                                                                            مواعيد الحصة الأسبوعية:
                                                                        </span>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {group.schedule?.map((item, idx) => (
                                                                                <span
                                                                                    key={idx}
                                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/60 text-xs font-bold text-gray-700"
                                                                                >
                                                                                    <Clock className="h-3 w-3 text-primary" />
                                                                                    {item.day} — {item.time}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Price & Capacity info */}
                                                                    <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                                                        <span>
                                                                            السعة:{' '}
                                                                            <strong className="text-gray-900">
                                                                                {group.capacity || 50} طالب
                                                                            </strong>
                                                                        </span>
                                                                        {group.privateMonthlyPrice ? (
                                                                            <span className="font-black text-purple-700">
                                                                                {group.privateMonthlyPrice} ج.م / شهر
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[11px] font-bold text-blue-600">
                                                                                ضمن اشتراك الباكيدج
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="bg-gray-50/70 px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                                                                    <Link href={`/center/attendance?groupId=${group._id}`}>
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-8 gap-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/95 text-white"
                                                                        >
                                                                            <QrCode className="h-3.5 w-3.5" />
                                                                            تحضير الحصة
                                                                        </Button>
                                                                    </Link>

                                                                    <div className="flex items-center gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleOpenEdit(group)}
                                                                            className="h-8 px-2 text-xs font-bold text-gray-600 hover:text-primary rounded-lg"
                                                                        >
                                                                            <Edit2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        {(group as any).isPendingDelete ? (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={async () => {
                                                                                    await OfflineStorageService.undoCenterGroupPendingDelete(
                                                                                        group._id
                                                                                    );
                                                                                    queryClient.invalidateQueries({
                                                                                        queryKey: ['center', 'groups'],
                                                                                    });
                                                                                    toast.success('تم التراجع عن حذف الحصة');
                                                                                }}
                                                                                className="h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                                                            >
                                                                                تراجع
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    if (
                                                                                        confirm(
                                                                                            `هل أنت متأكد من تعطيل حصة ${group.name}؟`
                                                                                        )
                                                                                    ) {
                                                                                        deleteMutation.mutate(group._id);
                                                                                    }
                                                                                }}
                                                                                className="h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingGroup ? 'تعديل بيانات الحصة الدراسية' : 'إضافة حصة دراسية جديدة'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم الحصة *</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: حصة الفيزياء - السبت والثلاثاء"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المدرس المسؤول *</label>
                                <select
                                    value={centerTeacherId}
                                    onChange={(e) => setCenterTeacherId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    required
                                >
                                    <option value="" disabled>
                                        اختر المدرس
                                    </option>
                                    {teachers.map((t) => (
                                        <option key={t._id} value={t._id}>
                                            {t.name} ({t.subject})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">الصف الدراسي *</label>
                                <select
                                    value={gradeLevel}
                                    onChange={(e) => setGradeLevel(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    {STAGE_HIERARCHY.map((stg) => (
                                        <optgroup key={stg.id} label={stg.label}>
                                            {stg.grades.map((g) => (
                                                <option key={g} value={g}>
                                                    {g}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">نوع الحصة *</label>
                                <select
                                    value={groupType}
                                    onChange={(e) => setGroupType(e.target.value as CenterGroupType)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    <option value="PACKAGE">حصة باكيدج (Package)</option>
                                    <option value="PRIVATE">حصة برايفت (Private)</option>
                                    <option value="MIXED">مشتركة باكيدج + برايفت (Mixed)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">سعة القاعة (طالب)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="rounded-xl border-gray-200"
                                />
                            </div>
                        </div>

                        {(groupType === 'PRIVATE' || groupType === 'MIXED') && (
                            <div>
                                <label className="text-xs font-bold text-purple-700 block mb-1">
                                    سعر الحصة الشهري لطالب البرايفت (ج.م) *
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={privatePrice}
                                    onChange={(e) => setPrivatePrice(e.target.value)}
                                    placeholder="مثال: 350"
                                    className="rounded-xl border-purple-200"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-gray-700">
                                    المواعيد الأسبوعية للحصة (يوم أو يومين في الأسبوع) *
                                </label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addScheduleRow}
                                    className="h-7 px-2 text-xs font-bold rounded-lg"
                                >
                                    + إضافة موعد
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                {schedule.map((row, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <select
                                            value={row.day}
                                            onChange={(e) => updateScheduleRow(idx, 'day', e.target.value)}
                                            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold flex-1"
                                        >
                                            {DAYS_OF_WEEK.map((d) => (
                                                <option key={d} value={d}>
                                                    {d}
                                                </option>
                                            ))}
                                        </select>
                                        <Input
                                            type="time"
                                            value={row.time}
                                            onChange={(e) => updateScheduleRow(idx, 'time', e.target.value)}
                                            className="h-9 rounded-lg border-gray-200 text-xs font-bold w-32"
                                            required
                                        />
                                        {schedule.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeScheduleRow(idx)}
                                                className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 rounded-lg"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {(createMutation.isPending || updateMutation.isPending) && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                {editingGroup ? 'حفظ التعديلات' : 'إنشاء الحصة'}
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

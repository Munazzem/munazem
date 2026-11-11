'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    BookOpen,
    Plus,
    Edit2,
    Trash2,
    Check,
    Loader2,
    Layers,
} from 'lucide-react';
import {
    fetchCenterPackages,
    fetchCenterTeachers,
    createCenterPackage,
    updateCenterPackage,
    deleteCenterPackage,
} from '@/lib/api/centers';
import { ICenterPackage, ICenterTeacher } from '@/types/center.types';
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

export default function CenterPackagesPage() {
    const queryClient = useQueryClient();
    const [selectedStage, setSelectedStage] = useState<'ALL' | 'SECONDARY' | 'PREPARATORY' | 'PRIMARY'>('ALL');
    const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState<ICenterPackage | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(STAGE_HIERARCHY[0].grades[0]);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [monthlyPrice, setMonthlyPrice] = useState('');

    const { data: packages = [], isLoading } = useQuery<ICenterPackage[]>({
        queryKey: ['center', 'packages'],
        queryFn: () => fetchCenterPackages({}),
    });

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const filteredPackages = useMemo(() => {
        return packages.filter((pkg) => {
            if (selectedGrade !== 'ALL') return pkg.gradeLevel === selectedGrade;
            if (selectedStage !== 'ALL') return getStageForGrade(pkg.gradeLevel) === selectedStage;
            return true;
        });
    }, [packages, selectedStage, selectedGrade]);

    const currentStageObj = useMemo(
        () => STAGE_HIERARCHY.find((s) => s.id === selectedStage) || null,
        [selectedStage]
    );

    const createMutation = useMutation({
        mutationFn: createCenterPackage,
        onSuccess: () => {
            toast.success('تم إنشاء الباكيدج بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'packages'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنشاء الباكيدج');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenterPackage(id, data),
        onSuccess: () => {
            toast.success('تم تعديل الباكيدج بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'packages'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعديل الباكيدج');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterPackage,
        onSuccess: (res: any) => {
            toast.success(res?.message || 'تم تعطيل الباقة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'packages'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعطيل الباكيدج');
        },
    });

    const handleOpenAdd = () => {
        setEditingPackage(null);
        setName('');
        setGradeLevel(selectedGrade !== 'ALL' ? selectedGrade : STAGE_HIERARCHY[0].grades[0]);
        setSelectedTeacherIds([]);
        setMonthlyPrice('');
        setIsAddOpen(true);
    };

    const handleOpenEdit = (pkg: ICenterPackage) => {
        setEditingPackage(pkg);
        setName(pkg.name);
        setGradeLevel(pkg.gradeLevel);
        const ids = (pkg.teachers || [])
            .map((t) => (typeof t.teacherId === 'object' ? (t.teacherId as any)?._id : t.teacherId))
            .filter(Boolean);
        setSelectedTeacherIds(ids);
        setMonthlyPrice(pkg.monthlyPrice.toString());
        setIsAddOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddOpen(false);
        setEditingPackage(null);
    };

    const toggleTeacher = (teacherId: string) => {
        setSelectedTeacherIds((prev) =>
            prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !monthlyPrice || Number(monthlyPrice) <= 0) {
            toast.error('يرجى ملء اسم الباكيدج وتحديد سعر شهري صحيح');
            return;
        }

        if (selectedTeacherIds.length === 0) {
            toast.error('يجب اختيار مدرس واحد على الأقل في الباكيدج');
            return;
        }

        const packageTeachers = selectedTeacherIds.map((id) => {
            const teacherObj = teachers.find((t) => t._id === id);
            return {
                teacherId: id,
                subject: teacherObj?.subject || '',
            };
        });

        const payload = {
            name: name.trim(),
            gradeLevel,
            teachers: packageTeachers,
            monthlyPrice: Number(monthlyPrice),
        };

        if (editingPackage) {
            updateMutation.mutate({ id: editingPackage._id, data: payload });
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
                        <BookOpen className="h-6 w-6 text-amber-600 shrink-0" />
                        <span>باكيدجات الصفوف الدراسية</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        حدد المدرسين والمواد والسعر الشهري لكل باكيدج، ويتم إنشاء الحصص ومواعيدها من صفحة الحصص الدراسية.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button
                        onClick={handleOpenAdd}
                        className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إنشاء باكيدج جديد</span>
                    </Button>
                </div>
            </div>

            {/* Stage -> Grade Hierarchy Filter */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
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
                            setSelectedGrade('ALL');
                        }}
                        className="rounded-xl text-xs font-bold shrink-0 h-8"
                    >
                        كل المراحل ({packages.length})
                    </Button>
                    {STAGE_HIERARCHY.map((st) => {
                        const count = packages.filter((p) => getStageForGrade(p.gradeLevel) === st.id).length;
                        return (
                            <Button
                                key={st.id}
                                variant={selectedStage === st.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setSelectedStage(st.id);
                                    setSelectedGrade('ALL');
                                }}
                                className="rounded-xl text-xs font-bold shrink-0 h-8"
                            >
                                {st.label} ({count})
                            </Button>
                        );
                    })}
                </div>

                {/* Grades underneath selected stage */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100 scrollbar-none">
                    <span className="text-[11px] font-bold text-gray-400 shrink-0 ml-1">الصف الدراسي:</span>
                    <button
                        type="button"
                        onClick={() => setSelectedGrade('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                            selectedGrade === 'ALL'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        جميع الصفوف
                    </button>
                    {(currentStageObj ? currentStageObj.grades : ALL_GRADES).map((grade) => {
                        const count = packages.filter((p) => p.gradeLevel === grade).length;
                        return (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => setSelectedGrade(grade)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                                    selectedGrade === grade
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {grade} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Packages Grouped by Stage & Grade */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : filteredPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center px-4">
                    <BookOpen className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا توجد باكيدجات مسجلة في هذا الصف</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بإنشاء باكيدج للصف الدراسي وحدد المدرسين المشاركين والسعر الشهري للباكيدج.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إنشاء باكيدج الآن
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {STAGE_HIERARCHY.map((stageGroup) => {
                        const stagePackages = filteredPackages.filter(
                            (pkg) => getStageForGrade(pkg.gradeLevel) === stageGroup.id
                        );
                        if (stagePackages.length === 0) return null;

                        return (
                            <div key={stageGroup.id} className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-amber-400" />
                                        <h2 className="text-sm sm:text-base font-black">{stageGroup.label}</h2>
                                    </div>
                                    <Badge className="bg-white/15 text-white border-0 text-xs font-bold">
                                        {stagePackages.length} باكيدج
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                    {stagePackages.map((pkg) => (
                                        <div
                                            key={pkg._id}
                                            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col justify-between overflow-hidden"
                                        >
                                            <div className="p-4 sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs bg-amber-50 text-amber-800 border-amber-200 font-bold"
                                                            >
                                                                {pkg.gradeLevel}
                                                            </Badge>
                                                            {(pkg as any).isPendingDelete && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs bg-rose-50 text-rose-700 border-rose-300 font-bold"
                                                                >
                                                                    معلق للحذف
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <h3 className="text-base sm:text-lg font-black text-gray-900">
                                                            {pkg.name}
                                                        </h3>
                                                    </div>
                                                    <div className="text-left shrink-0 bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                                                        <span className="text-lg sm:text-xl font-black text-primary">
                                                            {pkg.monthlyPrice.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 block font-bold">
                                                            ج.م / شهرياً
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-gray-100">
                                                    <span className="text-xs font-extrabold text-gray-600 block mb-2.5">
                                                        المدرسون والمواد داخل الباكيدج ({pkg.teachers.length}):
                                                    </span>
                                                    <div className="space-y-1.5">
                                                        {pkg.teachers.map((t, idx) => {
                                                            const teacherObj =
                                                                typeof t.teacherId === 'object' ? t.teacherId : null;

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="bg-gray-50/90 border border-gray-100 px-3 py-2 rounded-xl flex items-center justify-between text-xs"
                                                                >
                                                                    <span className="font-bold text-gray-900">
                                                                        أ/ {teacherObj ? teacherObj.name : 'مدرس'}
                                                                    </span>
                                                                    <span className="text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                                                        {t.subject || teacherObj?.subject || 'مادة'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50/70 px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenEdit(pkg)}
                                                    className="h-8 px-2.5 text-xs font-bold text-gray-700 hover:text-primary rounded-lg"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5 ml-1" />
                                                    تعديل الباكيدج
                                                </Button>
                                                {(pkg as any).isPendingDelete ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={async () => {
                                                            await OfflineStorageService.undoCenterPackagePendingDelete(
                                                                pkg._id
                                                            );
                                                            queryClient.invalidateQueries({
                                                                queryKey: ['center', 'packages'],
                                                            });
                                                            toast.success('تم التراجع عن حذف الباقة واستعادتها');
                                                        }}
                                                        className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                                    >
                                                        تراجع عن الحذف
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (confirm(`هل أنت متأكد من تعطيل باقة ${pkg.name}؟`)) {
                                                                deleteMutation.mutate(pkg._id);
                                                            }
                                                        }}
                                                        className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                                                        تعطيل
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingPackage ? 'تعديل الباكيدج' : 'إنشاء باكيدج جديد'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">اسم الباكيدج *</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="مثال: باكيدج الصف الأول الثانوي الشامل"
                                    className="rounded-xl border-gray-200"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    السعر الشهري الموحد للباكيدج (ج.م) *
                                </label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={monthlyPrice}
                                    onChange={(e) => setMonthlyPrice(e.target.value)}
                                    placeholder="مثال: 1200"
                                    className="rounded-xl border-gray-200"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                الصف الدراسي (مقسم حسب المرحلة) *
                            </label>
                            <select
                                value={gradeLevel}
                                onChange={(e) => setGradeLevel(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
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

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1.5">
                                اختر مدرسي ومواد الباكيدج * ({selectedTeacherIds.length} مدرس محدد)
                            </label>
                            {teachers.length === 0 ? (
                                <p className="text-xs text-rose-500">يرجى إضافة مدرسين أولاً من صفحة المعلمين</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                                    {teachers.map((teacher) => {
                                        const isSelected = selectedTeacherIds.includes(teacher._id);
                                        return (
                                            <div
                                                key={teacher._id}
                                                onClick={() => toggleTeacher(teacher._id)}
                                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs font-bold border ${
                                                    isSelected
                                                        ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                                                        : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-100'
                                                }`}
                                            >
                                                <span>
                                                    {teacher.name} — <span className="text-amber-700">{teacher.subject}</span>
                                                </span>
                                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                {editingPackage ? 'حفظ التعديلات' : 'إنشاء الباكيدج'}
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

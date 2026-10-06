'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    BookOpen,
    Plus,
    Edit2,
    Trash2,
    GraduationCap,
    DollarSign,
    Users,
    Check,
    Loader2,
    Sparkles,
} from 'lucide-react';
import {
    fetchCenterPackages,
    fetchCenterTeachers,
    createCenterPackage,
    updateCenterPackage,
    deleteCenterPackage,
} from '@/lib/api/centers';
import { ICenterPackage, ICenterTeacher } from '@/types/center.types';
import { ALL_GRADES } from '@/lib/constants/grade.constants';
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
    const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState<ICenterPackage | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(ALL_GRADES[0]);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [monthlyPrice, setMonthlyPrice] = useState('');

    const { data: packages = [], isLoading } = useQuery<ICenterPackage[]>({
        queryKey: ['center', 'packages', selectedGrade],
        queryFn: () => fetchCenterPackages(selectedGrade !== 'ALL' ? { gradeLevel: selectedGrade } : {}),
    });

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

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
        onSuccess: () => {
            toast.success('تم تعطيل الباكيدج بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'packages'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعطيل الباكيدج');
        },
    });

    const handleOpenAdd = () => {
        setEditingPackage(null);
        setName('');
        setGradeLevel(ALL_GRADES[0]);
        setSelectedTeacherIds([]);
        setMonthlyPrice('');
        setIsAddOpen(true);
    };

    const handleOpenEdit = (pkg: ICenterPackage) => {
        setEditingPackage(pkg);
        setName(pkg.name);
        setGradeLevel(pkg.gradeLevel);
        setSelectedTeacherIds(
            pkg.teachers.map((t) => (typeof t.teacherId === 'object' ? (t.teacherId as any)._id : t.teacherId))
        );
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

        const packageTeachers = selectedTeacherIds.map((tid) => {
            const t = teachers.find((tch) => tch._id === tid);
            return {
                teacherId: tid,
                subject: t?.subject || '',
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
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-amber-600 shrink-0" />
                        <span>باقات السنتر التعليمية (Packages)</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        حزمة شاملة من المدرسين والمواد لكل مرحلة دراسية بسعر شهري موحد للطالب.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إنشاء باقة جديدة</span>
                    </Button>
                </div>
            </div>

            {/* Filter by Grade */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <Button
                    variant={selectedGrade === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedGrade('ALL')}
                    className="rounded-xl text-xs font-bold shrink-0"
                >
                    جميع المراحل
                </Button>
                {ALL_GRADES.map((grade) => (
                    <Button
                        key={grade}
                        variant={selectedGrade === grade ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedGrade(grade)}
                        className="rounded-xl text-xs font-bold shrink-0"
                    >
                        {grade}
                    </Button>
                ))}
            </div>

            {/* Packages Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : packages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center">
                    <BookOpen className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا توجد باقات دراسية مسجلة بعد</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بإنشاء باقة للمرحلة الدراسية تجمع مدرسين السنتر بسعر شهري محدد لتسهيل اشتراك الطلاب.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إنشاء باقة الآن
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {packages.map((pkg) => (
                        <div
                            key={pkg._id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col justify-between overflow-hidden"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-bold mb-2">
                                            {pkg.gradeLevel}
                                        </Badge>
                                        <h3 className="text-lg font-black text-gray-900">{pkg.name}</h3>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <span className="text-xl font-black text-primary">
                                            {pkg.monthlyPrice.toLocaleString()}
                                        </span>
                                        <span className="text-[11px] text-gray-400 block font-medium">ج.م / شهرياً</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100">
                                    <span className="text-xs font-bold text-gray-500 block mb-2">
                                        المدرسين المشمولين في الباقة ({pkg.teachers.length}):
                                    </span>
                                    <div className="space-y-2">
                                        {pkg.teachers.map((t, idx) => {
                                            const teacherObj = typeof t.teacherId === 'object' ? t.teacherId : null;
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-lg"
                                                >
                                                    <span className="font-bold text-gray-800">
                                                        {teacherObj ? teacherObj.name : 'مدرس'}
                                                    </span>
                                                    <span className="text-gray-500 font-medium">
                                                        {t.subject || (teacherObj ? teacherObj.subject : '')}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50/70 px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEdit(pkg)}
                                    className="h-8 px-2.5 text-xs font-bold text-gray-600 hover:text-primary rounded-lg"
                                >
                                    <Edit2 className="h-3.5 w-3.5 ml-1" />
                                    تعديل
                                </Button>
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
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingPackage ? 'تعديل الباقة التعليمية' : 'إنشاء باقة تعليمية جديدة'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم الباقة *</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: باقة الصف الأول الثانوي الشاملة"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">المرحلة الدراسية *</label>
                            <select
                                value={gradeLevel}
                                onChange={(e) => setGradeLevel(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                {ALL_GRADES.map((grade) => (
                                    <option key={grade} value={grade}>
                                        {grade}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                اختيار المدرسين في الباقة * ({selectedTeacherIds.length} محدد)
                            </label>
                            {teachers.length === 0 ? (
                                <p className="text-xs text-rose-500">يرجى إضافة مدرسين أولاً من صفحة المدرسين</p>
                            ) : (
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1.5 bg-gray-50/50">
                                    {teachers.map((teacher) => {
                                        const isSelected = selectedTeacherIds.includes(teacher._id);
                                        return (
                                            <div
                                                key={teacher._id}
                                                onClick={() => toggleTeacher(teacher._id)}
                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs font-bold ${
                                                    isSelected ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white hover:bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                <span>{teacher.name} ({teacher.subject})</span>
                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                                السعر الشهري الموحد للباقة (ج.م) *
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

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {(createMutation.isPending || updateMutation.isPending) && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                {editingPackage ? 'حفظ التعديلات' : 'إنشاء الباقة'}
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

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    GraduationCap,
    Plus,
    Search,
    Edit2,
    Trash2,
    BookOpen,
    CheckCircle2,
    XCircle,
    Loader2,
} from 'lucide-react';
import {
    fetchCenterTeachers,
    createCenterTeacher,
    updateCenterTeacher,
    deleteCenterTeacher,
} from '@/lib/api/centers';
import { ICenterTeacher } from '@/types/center.types';
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

export default function CenterTeachersPage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<ICenterTeacher | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');

    const { data: teachers = [], isLoading } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers', search],
        queryFn: () => fetchCenterTeachers({ search }),
    });

    const createMutation = useMutation({
        mutationFn: createCenterTeacher,
        onSuccess: () => {
            toast.success('تمت إضافة المدرس بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'teachers'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إضافة المدرس');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenterTeacher(id, data),
        onSuccess: () => {
            toast.success('تم تعديل بيانات المدرس بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'teachers'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء التعديل');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterTeacher,
        onSuccess: () => {
            toast.success('تم تعطيل المدرس بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'teachers'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
        },
    });

    const handleOpenAdd = () => {
        setEditingTeacher(null);
        setName('');
        setSubject('');
        setIsAddOpen(true);
    };

    const handleOpenEdit = (teacher: ICenterTeacher) => {
        setEditingTeacher(teacher);
        setName(teacher.name);
        setSubject(teacher.subject);
        setIsAddOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddOpen(false);
        setEditingTeacher(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !subject.trim()) {
            toast.error('يرجى ملء اسم المدرس والمادة');
            return;
        }

        const payload = {
            name: name.trim(),
            subject: subject.trim(),
        };

        if (editingTeacher) {
            updateMutation.mutate({ id: editingTeacher._id, data: payload });
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
                        <GraduationCap className="h-6 w-6 text-primary shrink-0" />
                        <span>طاقم المدرسين بالسنتر</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        دليل المدرسين المعتمدين في السنتر (المدرس في السنتر كيان مستقل بدون حساب دخول).
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إضافة مدرس جديد</span>
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ابحث باسم المدرس أو المادة..."
                        className="pr-10 border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:bg-white"
                    />
                </div>
            </div>

            {/* Teachers Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : teachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center">
                    <GraduationCap className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا يوجد مدرسين مسجلين بعد</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        أضف مدرسي السنتر لتتمكن من إنشاء باقات ومجموعات دراسية لهم وربط الطلاب بهم.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إضافة مدرس الآن
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.map((teacher) => (
                        <div
                            key={teacher._id}
                            className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary font-black text-lg flex items-center justify-center">
                                            {teacher.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                {teacher.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 font-semibold border-gray-200">
                                                    {teacher.subject}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={teacher.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}
                                    >
                                        {teacher.isActive ? 'نشط' : 'معطل'}
                                    </Badge>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <span className="text-gray-400">السعر يُحدد على مستوى المجموعة</span>
                                    <span className="text-[11px] font-medium text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full">
                                        حسب المجموعة والمرحلة
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEdit(teacher)}
                                    className="h-8 px-2.5 text-xs font-bold text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg"
                                >
                                    <Edit2 className="h-3.5 w-3.5 ml-1" />
                                    تعديل
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm(`هل أنت متأكد من حذف المدرس ${teacher.name}؟`)) {
                                            deleteMutation.mutate(teacher._id);
                                        }
                                    }}
                                    className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                >
                                    <Trash2 className="h-3.5 w-3.5 ml-1" />
                                    حذف
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingTeacher ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد بالسنتر'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم المدرس *</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: أ. محمد أحمد"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">المادة الدراسية *</label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="مثال: لغة عربية، فيزياء..."
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
                                {editingTeacher ? 'حفظ التعديلات' : 'إضافة المدرس'}
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

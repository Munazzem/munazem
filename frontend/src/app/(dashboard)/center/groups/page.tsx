'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    CalendarCheck,
    Clock,
    Filter,
    GraduationCap,
    DollarSign,
    Loader2,
    QrCode,
} from 'lucide-react';
import {
    fetchCenterGroups,
    fetchCenterTeachers,
    createCenterGroup,
    updateCenterGroup,
    deleteCenterGroup,
} from '@/lib/api/centers';
import { ICenterGroup, ICenterTeacher, CenterGroupType } from '@/types/center.types';
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
    const [filterGrade, setFilterGrade] = useState<string>('ALL');
    const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ICenterGroup | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [centerTeacherId, setCenterTeacherId] = useState('');
    const [gradeLevel, setGradeLevel] = useState<string>(ALL_GRADES[0]);
    const [groupType, setGroupType] = useState<CenterGroupType>('PACKAGE');
    const [capacity, setCapacity] = useState('50');
    const [privatePrice, setPrivatePrice] = useState('');
    const [schedule, setSchedule] = useState<{ day: string; time: string }[]>([
        { day: 'السبت', time: '14:00' },
    ]);

    const { data: teachers = [] } = useQuery<ICenterTeacher[]>({
        queryKey: ['center', 'teachers'],
        queryFn: () => fetchCenterTeachers({ isActive: true }),
    });

    const { data: groups = [], isLoading } = useQuery<ICenterGroup[]>({
        queryKey: ['center', 'groups', filterGrade, filterTeacher, filterType],
        queryFn: () =>
            fetchCenterGroups({
                gradeLevel: filterGrade !== 'ALL' ? filterGrade : undefined,
                centerTeacherId: filterTeacher !== 'ALL' ? filterTeacher : undefined,
                groupType: filterType !== 'ALL' ? filterType : undefined,
            }),
    });

    const createMutation = useMutation({
        mutationFn: createCenterGroup,
        onSuccess: () => {
            toast.success('تم إنشاء المجموعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنشاء المجموعة');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenterGroup(id, data),
        onSuccess: () => {
            toast.success('تم تعديل المجموعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعديل المجموعة');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCenterGroup,
        onSuccess: () => {
            toast.success('تم تعطيل المجموعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'groups'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء تعطيل المجموعة');
        },
    });

    const handleOpenAdd = () => {
        setEditingGroup(null);
        setName('');
        setCenterTeacherId(teachers[0]?._id || '');
        setGradeLevel(ALL_GRADES[0]);
        setGroupType('PACKAGE');
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

    const handleTeacherChange = (teacherId: string) => {
        setCenterTeacherId(teacherId);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !centerTeacherId) {
            toast.error('يرجى تحديد اسم المجموعة والمدرس');
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
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        المجموعات الدراسية بالسنتر
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إدارة الفصول والمجموعات للمدرسين (مجموعات باقات، مجموعات خاصة، أو مختلطة).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAdd} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold">
                        <Plus className="h-4 w-4" />
                        إضافة مجموعة جديدة
                    </Button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
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
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">المرحلة الدراسية</label>
                    <select
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-700"
                    >
                        <option value="ALL">جميع المراحل</option>
                        {ALL_GRADES.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">نوع المجموعة</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-700"
                    >
                        <option value="ALL">جميع الأنواع</option>
                        <option value="PACKAGE">مجموعة باقة (Package)</option>
                        <option value="PRIVATE">مجموعة برايفت (Private)</option>
                        <option value="MIXED">مجموعة مختلطة (Mixed)</option>
                    </select>
                </div>
            </div>

            {/* Groups Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-center">
                    <Users className="h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="text-base font-bold text-gray-800">لا توجد مجموعات مطابقة للبحث</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                        قم بإنشاء مجموعة دراسية جديدة وحدد مدرسها ومواعيد جدولها الأسبوعي.
                    </p>
                    <Button onClick={handleOpenAdd} variant="outline" className="mt-4 gap-2 font-bold text-xs rounded-xl">
                        <Plus className="h-4 w-4" />
                        إنشاء مجموعة الآن
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {groups.map((group) => {
                        const teacher = typeof group.centerTeacherId === 'object' ? group.centerTeacherId : null;
                        const typeLabel =
                            group.groupType === 'PACKAGE' ? 'باقة' : group.groupType === 'PRIVATE' ? 'برايفت' : 'مختلط';
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
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <Badge variant="outline" className={`text-xs font-bold ${typeColor}`}>
                                            {typeLabel}
                                        </Badge>
                                        <Badge variant="outline" className="text-[11px] bg-gray-50 text-gray-600 border-gray-200">
                                            {group.gradeLevel}
                                        </Badge>
                                    </div>

                                    <h3 className="text-lg font-black text-gray-900 mt-1">{group.name}</h3>

                                    <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-600">
                                        <GraduationCap className="h-4 w-4 text-primary" />
                                        <span>{teacher ? `${teacher.name} (${teacher.subject})` : 'مدرس السنتر'}</span>
                                    </div>

                                    {/* Schedule */}
                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 block mb-2">مواعيد الحصص:</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.schedule?.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/60 text-xs font-semibold text-gray-700"
                                                >
                                                    <Clock className="h-3 w-3 text-primary" />
                                                    {item.day} - {item.time}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Price & Capacity info */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                        <span>السعة: <strong className="text-gray-900">{group.capacity || 50} طالب</strong></span>
                                        {group.privateMonthlyPrice && (
                                            <span className="font-bold text-purple-700">
                                                {group.privateMonthlyPrice} ج.م / شهر
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50/70 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                                    <Link href={`/center/attendance?groupId=${group._id}`}>
                                        <Button size="sm" className="h-8 gap-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/95 text-white">
                                            <QrCode className="h-3.5 w-3.5" />
                                            التحضير
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                if (confirm(`هل أنت متأكد من تعطيل مجموعة ${group.name}؟`)) {
                                                    deleteMutation.mutate(group._id);
                                                }
                                            }}
                                            className="h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-lg text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingGroup ? 'تعديل بيانات المجموعة' : 'إنشاء مجموعة دراسية جديدة'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم المجموعة *</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثال: مجموعة السبت والثلاثاء - 1 ثانوي"
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المدرس المسؤول *</label>
                                <select
                                    value={centerTeacherId}
                                    onChange={(e) => handleTeacherChange(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                    required
                                >
                                    <option value="" disabled>اختر المدرس</option>
                                    {teachers.map((t) => (
                                        <option key={t._id} value={t._id}>
                                            {t.name} ({t.subject})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">المرحلة الدراسية *</label>
                                <select
                                    value={gradeLevel}
                                    onChange={(e) => setGradeLevel(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    {ALL_GRADES.map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">نوع المجموعة *</label>
                                <select
                                    value={groupType}
                                    onChange={(e) => setGroupType(e.target.value as CenterGroupType)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold"
                                >
                                    <option value="PACKAGE">مجموعة باقة (طلاب باقات فقط)</option>
                                    <option value="PRIVATE">مجموعة خاصة (طلاب برايفت فقط)</option>
                                    <option value="MIXED">مجموعة مختلطة (باقة + برايفت معاً)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">سعة الفصل (طالب)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="rounded-xl border-gray-200"
                                />
                            </div>
                        </div>

                        {groupType !== 'PACKAGE' && (
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">
                                    سعر البرايفت الشهري لهذه المجموعة (ج.م)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={privatePrice}
                                    onChange={(e) => setPrivatePrice(e.target.value)}
                                    placeholder="سعر اشتراك الطالب البرايفت شهرياً"
                                    className="rounded-xl border-gray-200"
                                />
                            </div>
                        )}

                        {/* Schedule Builder */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-gray-700">جدول مواعيد الحصص *</label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addScheduleRow}
                                    className="h-7 text-xs font-bold gap-1 rounded-lg"
                                >
                                    <Plus className="h-3 w-3" />
                                    إضافة موعد
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {schedule.map((row, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <select
                                            value={row.day}
                                            onChange={(e) => updateScheduleRow(idx, 'day', e.target.value)}
                                            className="w-1/2 h-9 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-bold"
                                        >
                                            {DAYS_OF_WEEK.map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                        <Input
                                            type="time"
                                            value={row.time}
                                            onChange={(e) => updateScheduleRow(idx, 'time', e.target.value)}
                                            className="w-1/2 h-9 text-xs rounded-lg border-gray-200"
                                            required
                                        />
                                        {schedule.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeScheduleRow(idx)}
                                                className="h-9 px-2 text-rose-500 hover:bg-rose-50"
                                            >
                                                ✕
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
                                {editingGroup ? 'حفظ التعديلات' : 'إنشاء المجموعة'}
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

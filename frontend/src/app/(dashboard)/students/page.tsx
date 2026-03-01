'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchStudents, deleteStudent } from '@/lib/api/students';
import type { StudentWithGroup } from '@/types/student.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { 
    Search, 
    Filter, 
    MoreVertical, 
    Edit, 
    Trash2, 
    FileText,
    Loader2,
    AlertCircle,
    Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddStudentModal } from '@/components/students/AddStudentModal';
import { BulkAddStudentsModal } from '@/components/students/BulkAddStudentsModal';
import { EditStudentModal } from '@/components/students/EditStudentModal';
import { StudentProfileModal } from '@/components/students/StudentProfileModal';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function StudentsPage() {
    const user = useAuthStore(state => state.user);
    const isAssistant = user?.role === 'assistant';

    const allowedGrades = getAllowedGrades(user?.stage);

    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;

    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [profileStudent, setProfileStudent] = useState<StudentWithGroup | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['students', { page, limit, search: searchTerm }],
        queryFn: () => fetchStudents({ page, limit, search: searchTerm }),
        placeholderData: keepPreviousData,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            toast.success('تم حذف الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
        onError: (error: { response?: { data?: { message?: string } } } | Error) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
        }
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`هل أنت متأكد من حذف الطالب ${name}؟`)) {
            deleteMutation.mutate(id);
        }
    };

    const handleEditClick = (student: StudentWithGroup) => {
        setSelectedStudent(student);
        setIsEditModalOpen(true);
    };

    const handleProfileClick = (student: StudentWithGroup) => {
        setProfileStudent(student);
        setIsProfileOpen(true);
    };

    const rawStudents = data?.data || [];
    const students = gradeFilter
        ? rawStudents.filter((s: StudentWithGroup) => s.gradeLevel === gradeFilter)
        : rawStudents;
    const pagination = data?.pagination;

    const ActionsMenu = ({ stu }: { stu: StudentWithGroup }) => (
        <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-primary">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 font-medium">
                <DropdownMenuLabel className="text-xs text-gray-500">الإجراءات</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="cursor-pointer text-gray-700 focus:text-primary"
                    onClick={() => handleProfileClick(stu)}
                >
                    <FileText className="mr-2 h-4 w-4 ml-2" /> بروفايل الطالب
                </DropdownMenuItem>
                {isAssistant && (
                    <>
                        <DropdownMenuItem 
                            className="cursor-pointer text-gray-700 focus:text-primary"
                            onClick={() => handleEditClick(stu)}
                        >
                            <Edit className="mr-2 h-4 w-4 ml-2" /> تعديل البيانات
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDelete(stu._id, stu.studentName)}
                        >
                            <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف الطالب
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">إدارة الطلاب</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {pagination?.total || 0} طالب مسجل
                    </p>
                </div>
                {isAssistant && (
                    <div className="flex gap-2 flex-wrap">
                        <BulkAddStudentsModal />
                        <AddStudentModal />
                    </div>
                )}
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={16} />
                    </div>
                    <Input 
                        type="text"
                        placeholder="ابحث بالاسم أو الهاتف أو الباركود..."
                        className="pl-4 pr-9 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white text-sm"
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <Select
                    value={gradeFilter}
                    onValueChange={(val) => { setGradeFilter(val === 'ALL' ? '' : val); setPage(1); }}
                    dir="rtl"
                >
                    <SelectTrigger className="w-full sm:w-48 border-gray-200 bg-gray-50 text-gray-700 text-sm">
                        <Filter size={14} className="ml-2 text-gray-400 shrink-0" />
                        <SelectValue placeholder="كل المراحل" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="ALL">كل المراحل</SelectItem>
                        {allowedGrades.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Loading / Error */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                    جاري تحميل البيانات...
                </div>
            )}
            {isError && (
                <div className="p-6 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100">
                    حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.
                </div>
            )}
            {!isLoading && !isError && students.length === 0 && (
                <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                    لا يوجد طلاب بناءً على معايير البحث الحالية.
                </div>
            )}

            {/* ── Mobile / Tablet: Card list (hidden on lg+) ── */}
            {!isLoading && !isError && students.length > 0 && (
                <div className="lg:hidden space-y-3">
                    {students.map((stu: StudentWithGroup) => {
                        const groupName = typeof stu.groupId === 'object' && stu.groupId !== null
                            ? (stu.groupId as { name: string }).name
                            : stu.groupDetails?.name || 'بدون مجموعة';
                        return (
                            <div
                                key={stu._id}
                                className="bg-white border border-gray-100 rounded-xl shadow-sm p-4"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    {/* Avatar + name */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="text-sm font-extrabold text-primary">
                                                {stu.studentName.charAt(0)}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => handleProfileClick(stu)}
                                                className="font-bold text-gray-900 hover:text-primary transition-colors text-right leading-tight block"
                                            >
                                                {stu.studentName}
                                            </button>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{stu.gradeLevel}</p>
                                        </div>
                                    </div>
                                    {/* Actions + status */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {stu.hasActiveSubscription === false && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                                                <AlertCircle className="h-2.5 w-2.5" />
                                                غير مشترك
                                            </span>
                                        )}
                                        <Badge className={cn(
                                            "text-xs font-medium pointer-events-none",
                                            stu.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                        )}>
                                            {stu.isActive ? 'نشط' : 'موقوف'}
                                        </Badge>
                                        <ActionsMenu stu={stu} />
                                    </div>
                                </div>

                                {/* Details row */}
                                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        <span dir="ltr">{stu.studentPhone}</span>
                                    </div>
                                    <div className="truncate">
                                        المجموعة: <span className="font-medium text-gray-700">{groupName}</span>
                                    </div>
                                    <div className="truncate col-span-2">
                                        ولي الأمر: <span className="font-medium text-gray-700">{stu.parentName}</span>
                                        <span dir="ltr" className="mr-2 text-gray-400">{stu.parentPhone}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Desktop: Full Table (hidden below lg) ── */}
            {!isLoading && !isError && students.length > 0 && (
                <div className="hidden lg:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="w-[80px] text-right font-bold text-gray-600">الباركود</TableHead>
                                    <TableHead className="text-right font-bold text-gray-600">اسم الطالب</TableHead>
                                    <TableHead className="text-right font-bold text-gray-600">المرحلة / المجموعة</TableHead>
                                    <TableHead className="text-right font-bold text-gray-600">رقم الطالب</TableHead>
                                    <TableHead className="text-right font-bold text-gray-600">ولي الأمر</TableHead>
                                    <TableHead className="text-right font-bold text-gray-600">الحالة</TableHead>
                                    <TableHead className="text-center font-bold text-gray-600 w-[60px]">إجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((stu: StudentWithGroup) => (
                                    <TableRow key={stu._id} className="hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="font-mono text-xs text-gray-500 font-medium">
                                            <Badge variant="outline" className="bg-gray-50 text-gray-600">{stu.barcode || '-'}</Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleProfileClick(stu)}
                                                    className="hover:text-primary hover:underline transition-colors text-right"
                                                >
                                                    {stu.studentName}
                                                </button>
                                                {stu.hasActiveSubscription === false && (
                                                    <span
                                                        title="غير مشترك هذا الشهر"
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 shrink-0"
                                                    >
                                                        <AlertCircle className="h-2.5 w-2.5" />
                                                        غير مشترك
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{stu.gradeLevel}</span>
                                                <span className="text-xs text-gray-500 mt-1">
                                                    {typeof stu.groupId === 'object' && stu.groupId !== null
                                                        ? (stu.groupId as { name: string }).name
                                                        : stu.groupDetails?.name || 'بدون مجموعة'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span dir="ltr" className="text-sm text-gray-600 inline-block">{stu.studentPhone}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-900">{stu.parentName}</span>
                                                <span dir="ltr" className="text-xs text-gray-500 mt-1 inline-block">{stu.parentPhone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={cn(
                                                    "font-medium pointer-events-none",
                                                    stu.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600"
                                                )}
                                            >
                                                {stu.isActive ? 'نشط' : 'موقوف'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <ActionsMenu stu={stu} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="p-3 sm:p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        صفحة <span className="font-bold text-gray-900">{pagination.page}</span> من <span className="font-bold text-gray-900">{pagination.totalPages}</span>
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                            السابق
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>
                            التالي
                        </Button>
                    </div>
                </div>
            )}

            <EditStudentModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} student={selectedStudent} />
            <StudentProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} student={profileStudent} />
        </div>
    );
}

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
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddStudentModal } from '@/components/students/AddStudentModal';
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

    const allowedGrades = getAllowedGrades(user?.stage);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;

    // Edit Modal State
    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Profile Modal State
    const [profileStudent, setProfileStudent] = useState<StudentWithGroup | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const queryClient = useQueryClient();

    // Fetch data via React Query
    const { data, isLoading, isError } = useQuery({
        queryKey: ['students', { page, limit, search: searchTerm }],
        queryFn: () => fetchStudents({ page, limit, search: searchTerm }),
        placeholderData: keepPreviousData, // Replaces keepPreviousData in v5
    });

    // Delete Mutation
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
        if (window.confirm(`هل أنت متأكد من حذف الطالب ${name}؟ لا يمكن التراجع عن هذا الإجراء.`)) {
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">إدارة الطلاب</h1>
                    <p className="text-gray-500 mt-1">عرض، إضافة، وتعديل بيانات الطلاب ({pagination?.total || 0} طالب).</p>
                </div>
                
                <AddStudentModal />
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full sm:w-96">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </div>
                    <Input 
                        type="text"
                        placeholder="ابحث برقم โ€«الهاتف أو الباركود..."
                        className="pl-4 pr-10 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white"
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setSearchTerm(e.target.value);
                            setPage(1); // Reset to first page on search
                        }}
                    />
                </div>

                <Select
                    value={gradeFilter}
                    onValueChange={(val) => { setGradeFilter(val === 'ALL' ? '' : val); setPage(1); }}
                    dir="rtl"
                >
                    <SelectTrigger className="w-full sm:w-52 border-gray-200 bg-gray-50 text-gray-700">
                        <Filter size={16} className="ml-2 text-gray-400" />
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

            {/* Students Data Table */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
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
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                                            جاري تحميل البيانات...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-red-500 font-medium">
                                        حدث خطأ أثناء تحميل بيانات الطلاب. يرجى المحاولة مرة أخرى.
                                    </TableCell>
                                </TableRow>
                            ) : students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-gray-500">
                                        لا يوجد طلاب لعرضهم بناءً على معايير البحث الحالية.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                students.map((stu: StudentWithGroup) => (
                                    <TableRow key={stu._id} className="hover:bg-gray-50/50 transition-colors">
                                        <TableCell className="font-mono text-xs text-gray-500 font-medium">
                                            <Badge variant="outline" className="bg-gray-50 text-gray-600">{stu.barcode || '-'}</Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-gray-900 border-r border-transparent">
                                            <button
                                                onClick={() => handleProfileClick(stu)}
                                                className="hover:text-primary hover:underline transition-colors text-right"
                                            >
                                                {stu.studentName}
                                            </button>
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
                                            <span dir="ltr" className="text-sm text-gray-600 inline-block text-right">{stu.studentPhone}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-900">{stu.parentName}</span>
                                                <span dir="ltr" className="text-xs text-gray-500 mt-1 inline-block text-right">{stu.parentPhone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={stu.isActive ? 'default' : 'secondary'} 
                                                className={cn(
                                                    "font-medium pointer-events-none",
                                                    stu.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600"
                                                )}>
                                                {stu.isActive ? 'نشط' : 'موقوف'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu dir="rtl">
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-primary">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 font-medium">
                                                    <DropdownMenuLabel className="text-xs text-gray-500">الإجراءات</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    
                                                    {/* Profile — visible to all roles */}
                                                    <DropdownMenuItem
                                                        className="cursor-pointer text-gray-700 focus:text-primary"
                                                        onClick={() => handleProfileClick(stu)}
                                                    >
                                                        <FileText className="mr-2 h-4 w-4 ml-2" /> بروفايل الطالب
                                                    </DropdownMenuItem>
                                                    
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
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            صفحة <span className="font-bold text-gray-900">{pagination.page}</span> من <span className="font-bold text-gray-900">{pagination.totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                السابق
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                            >
                                التالي
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal Component */}
            <EditStudentModal 
                open={isEditModalOpen} 
                onOpenChange={setIsEditModalOpen} 
                student={selectedStudent} 
            />

            {/* Profile Modal Component */}
            <StudentProfileModal
                open={isProfileOpen}
                onOpenChange={setIsProfileOpen}
                student={profileStudent}
            />
        </div>
    );
}

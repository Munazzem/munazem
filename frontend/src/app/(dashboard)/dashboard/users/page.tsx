'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUsers, deleteUser } from '@/lib/api/users';
import type { IUser } from '@/types/user.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { 
    Search, 
    MoreVertical, 
    Edit, 
    Trash2, 
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTeacherModal } from '@/components/users/AddTeacherModal';
import { EditTeacherModal } from '@/components/users/EditTeacherModal';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export default function UsersPage() {
    const user = useAuthStore(state => state.user);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState<IUser | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data: usersResponse, isLoading, isError } = useQuery({
        queryKey: ['users', { search: searchTerm }],
        queryFn: () => fetchUsers({ search: searchTerm }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            toast.success('تم حذف المعلم بنجاح');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء الحذف');
        }
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`هل أنت متأكد من حذف المعلم ${name}؟`)) {
            deleteMutation.mutate(id);
        }
    };

    const handleEditClick = (teacher: IUser) => {
        setSelectedTeacher(teacher);
        setIsEditModalOpen(true);
    };

    const users = usersResponse?.data || [];
    
    // Safety check - if not superAdmin, ideally they shouldn't even reach this page 
    // but in case they do via URL manipulation, we show a basic error or let the API reject it.
    if (user?.role !== 'superAdmin') {
        return (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                غير مصرح لك بالوصول إلى هذه الصفحة.
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">إدارة المعلمين</h1>
                    <p className="text-gray-500 mt-1">تتبع وإدارة حسابات المعلمين في النظام.</p>
                </div>
                
                <AddTeacherModal />
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </div>
                    <Input 
                        type="text"
                        placeholder="ابحث باسم المعلم..."
                        className="pl-4 pr-10 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64 text-primary">
                    <Loader2 className="h-10 w-10 animate-spin" />
                </div>
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                    حدث خطأ أثناء تحميل بيانات المعلمين.
                </div>
            ) : users.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                    لا يوجد معلمين متطابقين مع البحث.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map((teacher) => (
                        <div key={teacher._id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 min-w-0">
                                        <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                                            {teacher.stage === 'PREPARATORY' ? 'إعدادي' : teacher.stage === 'SECONDARY' ? 'ثانوي' : 'غير محدد'}
                                        </Badge>
                                        <h3 className="text-xl font-bold text-gray-900">{teacher.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1" dir="ltr">{teacher.phone}</p>
                                    </div>
                                    <DropdownMenu dir="rtl">
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-primary shrink-0">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild className="cursor-pointer focus:text-primary">
                                                <Link href={`/dashboard/users/${teacher._id}`}>
                                                    <ExternalLink className="mr-2 h-4 w-4 ml-2" /> عرض التفاصيل
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer focus:text-primary" onClick={() => handleEditClick(teacher)}>
                                                <Edit className="mr-2 h-4 w-4 ml-2" /> تعديل بيانات المعلم
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(teacher._id, teacher.name)}>
                                                <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف المعلم
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                <Badge variant={teacher.isActive ? 'default' : 'secondary'} className={cn("pointer-events-none", teacher.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600")}>
                                    {teacher.isActive ? 'نشط' : 'غير نشط'}
                                </Badge>
                                <Link
                                    href={`/dashboard/users/${teacher._id}`}
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    عرض التفاصيل
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <EditTeacherModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} teacher={selectedTeacher} />
        </div>
    );
}

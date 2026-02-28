'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchGroups, deleteGroup } from '@/lib/api/groups';
import type { Group } from '@/types/group.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { 
    Search, 
    Filter, 
    MoreVertical, 
    Edit, 
    Trash2, 
    Users,
    Clock,
    Loader2
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
import { AddGroupModal } from '@/components/groups/AddGroupModal';
import { EditGroupModal } from '@/components/groups/EditGroupModal';
import { getAllowedGrades } from '@/lib/utils/grades';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function GroupsPage() {
    const user = useAuthStore(state => state.user);

    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;
    const allowedGrades = getAllowedGrades(user?.stage);

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['groups', { page, limit, search: searchTerm }],
        queryFn: () => fetchGroups({ page, limit, search: searchTerm }),
        placeholderData: keepPreviousData,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteGroup,
        onSuccess: () => {
            toast.success('تم حذف المجموعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
        onError: (error: { response?: { data?: { message?: string } } } | Error) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء الحذف');
        }
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`هل أنت متأكد من حذف ${name}؟ سيؤدي ذلك إلى التأثير على الطلاب المسجلين بها.`)) {
            deleteMutation.mutate(id);
        }
    };

    const handleEditClick = (group: Group) => {
        setSelectedGroup(group);
        setIsEditModalOpen(true);
    };

    const rawGroups = data?.data || [];
    const groups = gradeFilter
        ? rawGroups.filter((g) => g.gradeLevel === gradeFilter)
        : rawGroups;
    const pagination = data?.pagination;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">إدارة المجموعات</h1>
                    <p className="text-gray-500 mt-1">تنسيق المجموعات الدراسية وإدارة المواعيد ({pagination?.total || 0} مجموعة).</p>
                </div>
                
                {/* Only assistants can add groups per backend logic. Allowing teacher for testing, but should be bounded. */}
                {(user?.role === 'assistant' || user?.role === 'teacher') && (
                    <AddGroupModal />
                )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </div>
                    <Input 
                        type="text"
                        placeholder="ابحث باسم المجموعة..."
                        className="pl-4 pr-10 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white"
                        value={searchTerm}
                        onChange={(e) => {
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

            {isLoading ? (
                <div className="flex justify-center items-center h-64 text-primary">
                    <Loader2 className="h-10 w-10 animate-spin" />
                </div>
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                    حدث خطأ أثناء تحميل بيانات المجموعات.
                </div>
            ) : groups.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                    لا توجد مجموعات لعرضها.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <div key={group._id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <Badge variant="outline" className="mb-2 bg-gray-50 text-gray-600">{group.gradeLevel}</Badge>
                                        <h3 className="text-xl font-bold text-gray-900">{group.name}</h3>
                                    </div>
                                    <DropdownMenu dir="rtl">
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-primary">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="cursor-pointer focus:text-primary" onClick={() => handleEditClick(group)}>
                                                <Edit className="mr-2 h-4 w-4 ml-2" /> تعديل المجموعة
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(group._id, group.name)}>
                                                <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف المجموعة
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                
                                <div className="space-y-3 mt-4">
                                    {group.schedule.map((slot, idx) => (
                                        <div key={idx} className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                            <Clock className="h-4 w-4 ml-2 text-primary" />
                                            <span className="font-bold ml-2">{slot.day}</span>
                                            <span>{slot.time}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex items-center text-gray-500 text-sm">
                                    <Users className="h-4 w-4 ml-1" />
                                    <span>الطلاب: {group.studentsCount || 0} / {group.capacity}</span>
                                </div>
                                <Badge variant={group.isActive ? 'default' : 'secondary'} className={cn("pointer-events-none", group.isActive ? "bg-green-100 text-green-700" : "")}>
                                    {group.isActive ? 'مفعلة' : 'موقوفة'}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-6">
                    <p className="text-sm text-gray-500">
                        صفحة <span className="font-bold text-gray-900">{pagination.page}</span> من <span className="font-bold text-gray-900">{pagination.totalPages}</span>
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>السابق</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>التالي</Button>
                    </div>
                </div>
            )}

            <EditGroupModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} group={selectedGroup} />
        </div>
    );
}

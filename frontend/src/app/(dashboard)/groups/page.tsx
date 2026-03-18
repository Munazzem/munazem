'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
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
    Loader2,
    FileText,
} from 'lucide-react';
import { CardSkeleton } from '@/components/layout/skeletons/CardSkeleton';
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
import { GroupReportModal } from '@/components/groups/GroupReportModal';
import { getAllowedGrades } from '@/lib/utils/grades';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default function GroupsPage() {
    const user = useAuthStore(state => state.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';

    const [searchTerm, setSearchTerm] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const limit = 20; // Lower limit for pagination is better for performance when infinite scroll is applied
    const allowedGrades = getAllowedGrades(user?.stage);

    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [reportGroupId, setReportGroupId] = useState<string | null>(null);
    const [reportGroupName, setReportGroupName] = useState('');

    const queryClient = useQueryClient();

    const { 
        data, 
        isLoading, 
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['groups', { limit, search: searchTerm }],
        queryFn: ({ pageParam = 1 }) => fetchGroups({ page: pageParam, limit, search: searchTerm }),
        getNextPageParam: (lastPage) => {
            if (lastPage.pagination.page < lastPage.pagination.totalPages) {
                return lastPage.pagination.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteGroup,
        onSuccess: () => {
            toast.success('تم حذف المجموعة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
        onError: (error: { response?: { data?: { message?: string } } } | Error) => {
            const err = error as { response?: { data?: { message?: string } } };
            
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

    const rawGroups = data?.pages.flatMap(page => page.data) || [];
    const filteredGroups = gradeFilter
        ? rawGroups.filter((g) => g.gradeLevel === gradeFilter)
        : rawGroups;
    const pagination = data?.pages[0]?.pagination;

    // Grouping the groups by Grade Level
    const groupsByGrade = filteredGroups.reduce((acc, group) => {
        const grade = group.gradeLevel || 'غير محدد';
        if (!acc[grade]) acc[grade] = [];
        acc[grade].push(group);
        return acc;
    }, {} as Record<string, Group[]>);

    const gradeKeys = Object.keys(groupsByGrade);

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500" dir="rtl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">إدارة المجموعات</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{pagination?.total || 0} مجموعة مسجلة</p>
                </div>
                {canWrite && <AddGroupModal />}
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={18} />
                    </div>
                    <Input 
                        type="text"
                        placeholder="ابحث باسم المجموعة..."
                        className="pl-4 pr-9 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white text-sm"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                        }}
                    />
                </div>
                <Select
                    value={gradeFilter}
                    onValueChange={(val) => { setGradeFilter(val === 'ALL' ? '' : val); }}
                    dir="rtl"
                >
                    <SelectTrigger className="w-full sm:w-48 border-gray-200 bg-gray-50 text-gray-700 text-sm">
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
                <CardSkeleton count={8} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" />
            ) : isError ? (
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 text-center font-bold">
                    حدث خطأ أثناء تحميل بيانات المجموعات.
                </div>
            ) : gradeKeys.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                    لا توجد مجموعات لعرضها.
                </div>
            ) : (
                <Accordion type="multiple" className="space-y-4" defaultValue={gradeKeys}>
                    {gradeKeys.map((grade) => (
                        <AccordionItem value={grade} key={grade} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4">
                            <AccordionTrigger className="hover:no-underline py-4">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-primary">{grade}</h2>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                        {groupsByGrade[grade].length} مجموعات
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-4">
                                    {groupsByGrade[grade].map((group) => (
                                        <div key={group._id} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
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
                                                            {canWrite ? (
                                                                <>
                                                                    <DropdownMenuItem className="cursor-pointer focus:text-primary" onClick={() => handleEditClick(group)}>
                                                                        <Edit className="mr-2 h-4 w-4 ml-2" /> تعديل المجموعة
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(group._id, group.name)}>
                                                                        <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف المجموعة
                                                                    </DropdownMenuItem>
                                                                </>
                                                            ) : (
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer focus:text-primary"
                                                                    onClick={() => { setReportGroupId(group._id); setReportGroupName(group.name); }}
                                                                >
                                                                    <FileText className="mr-2 h-4 w-4 ml-2" /> تقرير المجموعة
                                                                </DropdownMenuItem>
                                                            )}
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
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}

            {/* Load More Button */}
            {hasNextPage && (
                <div className="flex flex-col items-center mt-6 p-4">
                    <p className="text-sm text-gray-500 mb-3">
                        عرض {rawGroups.length} من {pagination?.total ?? 0} مجموعة
                    </p>
                    <Button 
                        variant="outline" 
                        onClick={() => fetchNextPage()} 
                        disabled={isFetchingNextPage}
                        className="w-full sm:w-auto min-w-[200px] border-primary/30 text-primary hover:bg-primary/5"
                    >
                        {isFetchingNextPage ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin ml-2" /> جاري التحميل...</>
                        ) : (
                            'عرض المزيد من المجموعات'
                        )}
                    </Button>
                </div>
            )}

            <EditGroupModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} group={selectedGroup} />

            <GroupReportModal
                groupId={reportGroupId}
                groupName={reportGroupName}
                open={reportGroupId !== null}
                onOpenChange={(v) => { if (!v) setReportGroupId(null); }}
            />
        </div>
    );
}

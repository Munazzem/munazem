'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { fetchStudents, deleteStudent } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import type { StudentWithGroup } from '@/types/student.types';
import type { Group } from '@/types/group.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { 
    Search, 
    MoreVertical, 
    Edit, 
    Trash2, 
    FileText,
    Loader2,
    AlertCircle,
    Phone,
    Users,
    ChevronRight,
    ArrowRight,
    Printer,
    CheckSquare,
    QrCode,
} from 'lucide-react';
import { TableSkeleton } from '@/components/layout/skeletons/TableSkeleton';
import { CardSkeleton } from '@/components/layout/skeletons/CardSkeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddStudentModal } from '@/components/students/AddStudentModal';
import { BulkAddStudentsModal } from '@/components/students/BulkAddStudentsModal';
import { EditStudentModal } from '@/components/students/EditStudentModal';
import { toast } from 'sonner';
import { fetchStudentReportHtml } from '@/lib/api/reports';
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';
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

// ─── Group Cards View ─────────────────────────────────────────────────────────
function GroupCardsView({
    onSelectGroup,
    canWrite,
}: {
    onSelectGroup: (group: Group) => void;
    canWrite: boolean;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ['groups', { limit: 100 }],
        queryFn: () => fetchGroups({ limit: 100 }),
    });

    const groups = data?.data ?? [];

    if (isLoading) {
        return <CardSkeleton count={6} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" />;
    }

    if (groups.length === 0) {
        return (
            <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                لا توجد مجموعات بعد.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
                <button
                    key={group._id}
                    onClick={() => onSelectGroup(group)}
                    className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-right flex flex-col gap-3 group"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs text-gray-400 font-medium mb-1">{group.gradeLevel}</p>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                                {group.name}
                            </h3>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                        <span className="text-sm text-gray-500">
                            {group.studentsCount ?? 0} / {group.capacity} طالب
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                </button>
            ))}
        </div>
    );
}

// ─── Students List (inside a group or from search) ───────────────────────────
function StudentsList({
    students,
    canWrite,
    onProfile,
    onEdit,
    onDelete,
    selectedIds,
    onToggleSelect,
    onToggleAll,
}: {
    students: StudentWithGroup[];
    canWrite: boolean;
    onProfile: (stu: StudentWithGroup) => void;
    onEdit: (stu: StudentWithGroup) => void;
    onDelete: (id: string, name: string) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: (ids: string[]) => void;
}) {
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
                    onClick={() => onProfile(stu)}
                >
                    <FileText className="mr-2 h-4 w-4 ml-2" /> بروفايل الطالب
                </DropdownMenuItem>
                {canWrite && (
                    <>
                        <DropdownMenuItem
                            className="cursor-pointer text-gray-700 focus:text-primary"
                            onClick={() => onEdit(stu)}
                        >
                            <Edit className="mr-2 h-4 w-4 ml-2" /> تعديل البيانات
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => onDelete(stu._id, stu.studentName)}
                        >
                            <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف الطالب
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (students.length === 0) {
        return (
            <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                لا يوجد طلاب.
            </div>
        );
    }

    const allSelected = students.length > 0 && students.every(s => selectedIds.has(s._id));

    return (
        <>
            {/* Mobile */}
            <div className="lg:hidden space-y-3">
                {students.map((stu) => {
                    const groupName = typeof stu.groupId === 'object' && stu.groupId !== null
                        ? (stu.groupId as { name: string }).name
                        : stu.groupDetails?.name || 'بدون مجموعة';
                    return (
                        <div key={stu._id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Checkbox */}
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer shrink-0"
                                        checked={selectedIds.has(stu._id)}
                                        onChange={() => onToggleSelect(stu._id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-extrabold text-primary">
                                            {stu.studentName.charAt(0)}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <button
                                            onClick={() => onProfile(stu)}
                                            className="font-bold text-gray-900 hover:text-primary transition-colors text-right leading-tight block"
                                        >
                                            {stu.studentName}
                                        </button>
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{stu.gradeLevel}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {stu.hasActiveSubscription === false && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                                            <AlertCircle className="h-2.5 w-2.5" /> غير مشترك
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
                            <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span dir="ltr">{stu.studentPhone}</span>
                                </div>
                                <div className="truncate flex-1 min-w-0">
                                    المجموعة: <span className="font-medium text-gray-700">{groupName}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="w-[40px] text-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer"
                                        checked={allSelected}
                                        onChange={() => onToggleAll(students.map(s => s._id))}
                                    />
                                </TableHead>
                                <TableHead className="text-right font-bold text-gray-600">اسم الطالب</TableHead>
                                <TableHead className="text-right font-bold text-gray-600">المرحلة / المجموعة</TableHead>
                                <TableHead className="text-right font-bold text-gray-600">رقم الطالب</TableHead>
                                <TableHead className="text-right font-bold text-gray-600">الحالة</TableHead>
                                <TableHead className="text-center font-bold text-gray-600 w-[60px]">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map((stu) => (
                                <TableRow key={stu._id} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell className="text-center">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer"
                                        checked={selectedIds.has(stu._id)}
                                        onChange={() => onToggleSelect(stu._id)}
                                    />
                                </TableCell>
                                    <TableCell className="font-bold text-gray-900">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onProfile(stu)}
                                                className="hover:text-primary hover:underline transition-colors text-right"
                                            >
                                                {stu.studentName}
                                            </button>
                                            {stu.hasActiveSubscription === false && (
                                                <span
                                                    title="غير مشترك هذا الشهر"
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 shrink-0"
                                                >
                                                    <AlertCircle className="h-2.5 w-2.5" /> غير مشترك
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
                                        <Badge className={cn(
                                            "font-medium pointer-events-none",
                                            stu.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600"
                                        )}>
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
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsPage() {
    const user = useAuthStore(state => state.user);
    const canWrite = user?.role === 'assistant' || user?.role === 'teacher';

    const [searchTerm, setSearchTerm] = useState('');
    const limit = 20;

    // Which group is selected (null = show group cards)
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

    const [selectedStudent, setSelectedStudent] = useState<StudentWithGroup | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const router = useRouter();

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkPrinting, setBulkPrinting] = useState(false);

    const handleToggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleToggleAll = (ids: string[]) => {
        setSelectedIds((prev) => {
            const allSelected = ids.every((id) => prev.has(id));
            if (allSelected) {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            } else {
                return new Set([...prev, ...ids]);
            }
        });
    };

    const handleBulkPrint = async () => {
        if (selectedIds.size === 0) return;
        setBulkPrinting(true);
        try {
            const htmlParts: string[] = [];
            for (const id of selectedIds) {
                try {
                    const html = await fetchStudentReportHtml(id);
                    htmlParts.push(html);
                } catch {
                    // skip failed reports
                }
            }
            if (htmlParts.length === 0) {
                toast.error('فشل تحميل التقارير');
                return;
            }
            const combined = htmlParts.join('<div style="page-break-after:always"></div>');
            printHtmlContent(combined);
            toast.success(`تم طباعة ${htmlParts.length} تقرير`);
        } catch {
            toast.error('حدث خطأ أثناء الطباعة');
        } finally {
            setBulkPrinting(false);
        }
    };

    const [bulkCardsPrinting, setBulkCardsPrinting] = useState(false);
    const handleBulkPrintCards = async () => {
        if (selectedIds.size === 0) return;
        setBulkCardsPrinting(true);
        try {
            // Find selected students from the current page's students list
            const selectedStudents = students.filter(s => selectedIds.has(s._id));
            if (selectedStudents.length === 0) {
                toast.error('لم يتم العثور على بيانات الطلاب المحددين');
                return;
            }
            const html = await generateIdCardsHtml(selectedStudents, user?.centerName, user?.logoUrl);
            printHtmlContent(html);
            toast.success(`تم طباعة ${selectedStudents.length} كارت`);
        } catch {
            toast.error('حدث خطأ أثناء طباعة الكروت');
        } finally {
            setBulkCardsPrinting(false);
        }
    };

    const queryClient = useQueryClient();

    // Show students when: searching OR a group is selected
    const isSearching = searchTerm.trim().length > 0;
    const showStudents = isSearching || !!selectedGroup;

    const { 
        data, 
        isLoading, 
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['students', { limit, search: searchTerm, groupId: selectedGroup?._id }],
        queryFn: ({ pageParam = 1 }) => fetchStudents({
            page: pageParam,
            limit,
            search: searchTerm || undefined,
            groupId: selectedGroup?._id,
        }),
        getNextPageParam: (lastPage) => {
            if (lastPage.pagination.page < lastPage.pagination.totalPages) {
                return lastPage.pagination.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        enabled: showStudents === true, // Only fetch when needed
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            toast.success('تم حذف الطالب بنجاح');
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
        onError: (error: { response?: { data?: { message?: string } } } | Error) => {
            const err = error as { response?: { data?: { message?: string } } };
            
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
        router.push(`/students/${student._id}`);
    };

    const handleSelectGroup = (group: Group) => {
        setSelectedGroup(group);
        setSelectedIds(new Set()); // clear selection on group change
    };

    const handleBack = () => {
        setSelectedGroup(null);
        setSelectedIds(new Set()); // clear selection on back
    };

    const students = data?.pages.flatMap(page => page.data) || [];
    const pagination = data?.pages[0]?.pagination;

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    {selectedGroup && !isSearching ? (
                        <div>
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-1"
                            >
                                <ArrowRight className="h-4 w-4" />
                                كل المجموعات
                            </button>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                                {selectedGroup.name}
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {selectedGroup.gradeLevel} · {pagination?.total ?? 0} طالب
                            </p>
                        </div>
                    ) : (
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">إدارة الطلاب</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {isSearching ? `${pagination?.total ?? 0} نتيجة` : 'اختر مجموعة'}
                            </p>
                        </div>
                    )}
                </div>
                {canWrite && (
                    <div className="flex gap-2 flex-wrap">
                        <BulkAddStudentsModal />
                        <AddStudentModal />
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="relative">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                        <Search size={16} />
                    </div>
                    <Input
                        type="text"
                        placeholder="ابحث بالاسم أو الهاتف أو الباركود في كل الطلاب..."
                        className="pl-4 pr-9 border-gray-200 bg-gray-50 focus-visible:ring-primary focus-visible:bg-white text-sm"
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setSearchTerm(e.target.value);
                            setSelectedIds(new Set());
                        }}
                    />
                </div>
            </div>

            {/* Bulk print toolbar — shown when students are selected */}
            {showStudents && selectedIds.size > 0 && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-primary">
                        <CheckSquare className="h-4 w-4 inline ml-1.5" />
                        {selectedIds.size} طالب محدد
                    </span>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1.5 border-primary/30 text-primary"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            إلغاء
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1.5 text-gray-700 bg-white border-gray-200 hover:bg-gray-50"
                            onClick={handleBulkPrintCards}
                            disabled={bulkCardsPrinting}
                        >
                            {bulkCardsPrinting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <QrCode className="h-3.5 w-3.5" />
                            )}
                            طباعة الكروت
                        </Button>
                        <Button
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={handleBulkPrint}
                            disabled={bulkPrinting}
                        >
                            {bulkPrinting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Printer className="h-3.5 w-3.5" />
                            )}
                            طباعة التقارير
                        </Button>
                    </div>
                </div>
            )}

            {/* Group Cards OR Students List */}
            {!showStudents ? (
                /* ── Groups view ── */
                <GroupCardsView onSelectGroup={handleSelectGroup} canWrite={canWrite} />
            ) : (
                /* ── Students list ── */
                <>
                    {isLoading && (
                        <div className="p-4 sm:p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <TableSkeleton rows={8} columns={6} />
                        </div>
                    )}
                    {isError && (
                        <div className="p-6 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100">
                            حدث خطأ أثناء تحميل البيانات.
                        </div>
                    )}
                    {!isLoading && !isError && (
                        <StudentsList
                            students={students}
                            canWrite={canWrite}
                            onProfile={handleProfileClick}
                            onEdit={handleEditClick}
                            onDelete={handleDelete}
                            selectedIds={selectedIds}
                            onToggleSelect={handleToggleSelect}
                            onToggleAll={handleToggleAll}
                        />
                    )}

                    {/* Load More Button */}
                    {hasNextPage && (
                        <div className="flex flex-col items-center mt-6 p-4">
                            <p className="text-sm text-gray-500 mb-3">
                                عرض {students.length} من {pagination?.total ?? 0} طالب
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
                                    'عرض المزيد من الطلاب'
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}

            <EditStudentModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} student={selectedStudent} />
        </div>
    );
}

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
    ChevronLeft,
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
import { GroupAccordionView } from '@/components/students/GroupAccordionView';
import { StudentsList } from '@/components/students/StudentsList';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fetchStudentReportHtml } from '@/lib/api/reports';
import { printHtmlContent } from '@/lib/utils/print';
import { generateIdCardsHtml } from '@/lib/utils/printIdCard';

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
    // Confirm delete dialog state
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [pendingDeleteStudent, setPendingDeleteStudent] = useState<{ id: string; name: string } | null>(null);

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
        setPendingDeleteStudent({ id, name });
        setConfirmDeleteOpen(true);
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
                <GroupAccordionView onSelectGroup={handleSelectGroup} canWrite={canWrite} />
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

            <ConfirmDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title={`حذف "${pendingDeleteStudent?.name}"؟`}
                description="سيتم حذف الطالب نهائياً ولا يمكن التراجع عن هذا الإجراء."
                confirmLabel="حذف"
                variant="danger"
                onConfirm={() => {
                    if (pendingDeleteStudent) deleteMutation.mutate(pendingDeleteStudent.id);
                    setConfirmDeleteOpen(false);
                    setPendingDeleteStudent(null);
                }}
            />
        </div>
    );
}

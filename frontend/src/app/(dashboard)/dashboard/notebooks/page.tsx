'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchNotebooks, deleteNotebook, restockNotebook, updateNotebook } from '@/lib/api/notebooks';
import type { INotebook } from '@/types/notebook.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import {
    Search,
    MoreVertical,
    Trash2,
    Loader2,
    BookOpen,
    Package,
    PackagePlus,
    Filter,
    Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AddNotebookModal } from '@/components/notebooks/AddNotebookModal';

// ── Restock Dialog ────────────────────────────────────────────────
function RestockDialog({
    notebook,
    open,
    onOpenChange,
}: {
    notebook: INotebook | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [qty, setQty] = useState(1);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (quantity: number) => restockNotebook(notebook!._id, quantity),
        onSuccess: () => {
            toast.success('تم تحديث المخزن بنجاح');
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            onOpenChange(false);
            setQty(1);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[360px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3">
                        إضافة مخزون — {notebook?.name}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">الكمية المضافة</label>
                        <Input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                            dir="ltr"
                            className="text-center"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => mutation.mutate(qty)}
                            disabled={mutation.isPending}
                            className="gap-2"
                        >
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            إضافة للمخزن
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Name/Price Dialog ─────────────────────────────────────────
function EditNotebookDialog({
    notebook,
    open,
    onOpenChange,
}: {
    notebook: INotebook | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [name, setName] = useState(notebook?.name ?? '');
    const [price, setPrice] = useState(notebook?.price ?? 0);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => updateNotebook(notebook!._id, { name, price }),
        onSuccess: () => {
            toast.success('تم تحديث المذكرة');
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            onOpenChange(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    // Sync when notebook changes
    if (open && notebook && name !== notebook.name && price !== notebook.price) {
        setName(notebook.name);
        setPrice(notebook.price);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold border-b pb-3">تعديل المذكرة</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">الاسم</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">السعر (ج.م)</label>
                        <Input
                            type="number"
                            min={0}
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            dir="ltr"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>إلغاء</Button>
                        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                            حفظ
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function NotebooksPage() {
    const user = useAuthStore((s) => s.user);
    const isTeacher = user?.role === 'teacher';
    const allowedGrades = getAllowedGrades(user?.stage);

    const [search, setSearch] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [restockNb, setRestockNb] = useState<INotebook | null>(null);
    const [editNb, setEditNb] = useState<INotebook | null>(null);
    const limit = 20;

    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['notebooks', { page, limit, search, gradeLevel: gradeFilter }],
        queryFn: () => fetchNotebooks({ page, limit, search, gradeLevel: gradeFilter || undefined }),
        placeholderData: keepPreviousData,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteNotebook,
        onSuccess: () => {
            toast.success('تم حذف المذكرة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
    });

    const handleDelete = (nb: INotebook) => {
        if (window.confirm(`هل أنت متأكد من حذف "${nb.name}"؟`)) {
            deleteMutation.mutate(nb._id);
        }
    };

    const notebooks: INotebook[] = (data as any)?.data ?? (data as any) ?? [];
    const pagination = (data as any)?.pagination;

    const lowStock = notebooks.filter((nb) => nb.stock <= 5).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">المتجر والمذكرات</h1>
                    <p className="text-gray-500 mt-1">
                        إدارة المذكرات والمخزون ({pagination?.total ?? 0} مذكرة
                        {lowStock > 0 && <span className="text-amber-600"> · {lowStock} مخزون منخفض</span>})
                    </p>
                </div>
                {isTeacher && <AddNotebookModal />}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute inset-y-0 right-3 h-full w-4 text-gray-400 pointer-events-none" />
                    <Input
                        placeholder="ابحث باسم المذكرة..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="pr-10 bg-gray-50 border-gray-200"
                    />
                </div>
                <Select
                    value={gradeFilter}
                    onValueChange={(v) => { setGradeFilter(v === 'ALL' ? '' : v); setPage(1); }}
                    dir="rtl"
                >
                    <SelectTrigger className="w-full sm:w-52 border-gray-200 bg-gray-50 text-gray-700">
                        <Filter size={14} className="ml-2 text-gray-400" />
                        <SelectValue placeholder="كل المراحل" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="ALL">كل المراحل</SelectItem>
                        {allowedGrades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <div className="p-8 text-center text-red-500 font-bold">حدث خطأ أثناء تحميل البيانات.</div>
                ) : notebooks.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookOpen className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400">لا توجد مذكرات بعد.</p>
                        {isTeacher && <p className="text-xs text-gray-400 mt-1">اضغط "إضافة مذكرة" لإضافة أول مذكرة.</p>}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-50 bg-gray-50/50">
                                    <th className="text-right font-semibold text-gray-500 px-6 py-3">المذكرة</th>
                                    <th className="text-right font-semibold text-gray-500 px-4 py-3">المرحلة</th>
                                    <th className="text-right font-semibold text-gray-500 px-4 py-3">السعر</th>
                                    <th className="text-right font-semibold text-gray-500 px-4 py-3">المخزون</th>
                                    <th className="text-center font-semibold text-gray-500 px-4 py-3 w-14">إجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {notebooks.map((nb) => (
                                    <tr key={nb._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                    <BookOpen className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="font-semibold text-gray-900">{nb.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="text-xs text-gray-500">{nb.gradeLevel}</Badge>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {nb.price.toLocaleString('ar-EG')} ج
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                'flex items-center gap-1 text-sm font-bold w-fit px-2 py-0.5 rounded-lg',
                                                nb.stock === 0
                                                    ? 'bg-red-100 text-red-600'
                                                    : nb.stock <= 5
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-green-100 text-green-700'
                                            )}>
                                                <Package className="h-3.5 w-3.5" />
                                                {nb.stock}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <DropdownMenu dir="rtl">
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-primary">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel className="text-xs text-gray-400">الإجراءات</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {isTeacher && (
                                                        <>
                                                            <DropdownMenuItem
                                                                className="cursor-pointer focus:text-primary"
                                                                onClick={() => setRestockNb(nb)}
                                                            >
                                                                <PackagePlus className="mr-2 h-4 w-4 ml-2" /> إضافة مخزون
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="cursor-pointer focus:text-primary"
                                                                onClick={() => { setEditNb(nb); }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4 ml-2" /> تعديل
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                onClick={() => handleDelete(nb)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4 ml-2" /> حذف
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {!isTeacher && (
                                                        <DropdownMenuItem disabled className="text-gray-400 text-xs">
                                                            لا توجد إجراءات متاحة
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                        <p className="text-sm text-gray-500">
                            صفحة <span className="font-bold text-gray-900">{pagination.page}</span> من{' '}
                            <span className="font-bold text-gray-900">{pagination.totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>السابق</Button>
                            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>التالي</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Dialogs */}
            <RestockDialog notebook={restockNb} open={restockNb !== null} onOpenChange={(v) => { if (!v) setRestockNb(null); }} />
            <EditNotebookDialog notebook={editNb} open={editNb !== null} onOpenChange={(v) => { if (!v) setEditNb(null); }} />
        </div>
    );
}

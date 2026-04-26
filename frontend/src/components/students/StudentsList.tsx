'use client';

import { 
    MoreVertical, 
    FileText, 
    Edit, 
    Trash2, 
    AlertCircle, 
    Phone 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StudentWithGroup } from '@/types/student.types';
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

interface StudentsListProps {
    students: StudentWithGroup[];
    canWrite: boolean;
    onProfile: (stu: StudentWithGroup) => void;
    onEdit: (stu: StudentWithGroup) => void;
    onDelete: (id: string, name: string) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: (ids: string[]) => void;
}

export function StudentsList({
    students,
    canWrite,
    onProfile,
    onEdit,
    onDelete,
    selectedIds,
    onToggleSelect,
    onToggleAll,
}: StudentsListProps) {
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
                {students.length > 0 && (
                    <div className="flex items-center gap-2 px-1 mb-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer shrink-0"
                            checked={allSelected}
                            onChange={() => onToggleAll(students.map(s => s._id))}
                        />
                        <span className="text-sm font-medium text-gray-700">تحديد الكل</span>
                    </div>
                )}
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
                                        <div className="flex items-center gap-2">
                                            <Badge className={cn(
                                                "font-medium pointer-events-none",
                                                stu.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-600"
                                            )}>
                                                {stu.isActive ? 'نشط' : 'موقوف'}
                                            </Badge>
                                            {stu.excusedSessionsCount && stu.excusedSessionsCount > 0 ? (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 animate-pulse pointer-events-none">
                                                    مُستأذن ({stu.excusedSessionsCount} حصص)
                                                </Badge>
                                            ) : (stu.excusedUntil && new Date(stu.excusedUntil) >= new Date()) && (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 pointer-events-none">
                                                    مُستأذن
                                                </Badge>
                                            )}
                                        </div>
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

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bulkCreateStudents, type BulkStudentInput, type BulkStudentResult } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Loader2,
    Users,
    CheckCircle2,
    XCircle,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Each row only needs name + phones (gradeLevel & groupId are shared)
interface StudentRow {
    id: string;
    fullName: string;
    studentPhone: string;
    parentPhone: string;
}

interface Group {
    _id: string;
    name: string;
    gradeLevel: string;
}

const PHONE_REGEX = /^01[0-2,5]{1}[0-9]{8}$/;

function emptyRow(): StudentRow {
    return {
        id: crypto.randomUUID(),
        fullName: '',
        studentPhone: '',
        parentPhone: '',
    };
}

function validateRow(row: StudentRow): string[] {
    const errors: string[] = [];
    if (row.fullName.trim().length < 5) errors.push('الاسم يجب 5 أحرف على الأقل');
    if (!PHONE_REGEX.test(row.studentPhone)) errors.push('هاتف الطالب غير صحيح');
    if (!PHONE_REGEX.test(row.parentPhone)) errors.push('هاتف ولي الأمر غير صحيح');
    return errors;
}

// ─── Single Row Component ─────────────────────────────────────────
function StudentRowForm({
    row,
    index,
    onChange,
    onRemove,
    canRemove,
    result,
}: {
    row: StudentRow;
    index: number;
    onChange: (id: string, field: keyof StudentRow, value: string) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
    result?: BulkStudentResult;
}) {
    const rowErrors = validateRow(row);
    const isDirty = !!(row.fullName || row.studentPhone || row.parentPhone);

    return (
        <div className={cn(
            'border rounded-xl p-3 sm:p-4 space-y-3 transition-colors',
            result
                ? result.success
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-red-200 bg-red-50/50'
                : 'border-gray-100 bg-white hover:border-gray-200'
        )}>
            {/* Row header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    {result && (
                        result.success ? (
                            <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                تمت الإضافة — كود: {result.studentCode}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                <XCircle className="h-3.5 w-3.5" />
                                {result.error}
                            </span>
                        )
                    )}
                </div>
                {canRemove && !result && (
                    <button
                        onClick={() => onRemove(row.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="حذف هذا الصف"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Fields — only name + phones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-3">
                    <Input
                        placeholder="الاسم الثلاثي أو الرباعي *"
                        value={row.fullName}
                        onChange={(e) => onChange(row.id, 'fullName', e.target.value)}
                        disabled={!!result}
                        className={cn('text-sm', isDirty && row.fullName.trim().length < 5 && 'border-red-300')}
                    />
                </div>
                <Input
                    placeholder="هاتف الطالب 01x..."
                    value={row.studentPhone}
                    onChange={(e) => onChange(row.id, 'studentPhone', e.target.value)}
                    disabled={!!result}
                    dir="ltr"
                    className={cn('text-sm text-right', isDirty && !PHONE_REGEX.test(row.studentPhone) && 'border-red-300')}
                />
                <Input
                    placeholder="هاتف ولي الأمر 01x..."
                    value={row.parentPhone}
                    onChange={(e) => onChange(row.id, 'parentPhone', e.target.value)}
                    disabled={!!result}
                    dir="ltr"
                    className={cn('text-sm text-right', isDirty && !PHONE_REGEX.test(row.parentPhone) && 'border-red-300')}
                />
            </div>

            {isDirty && !result && rowErrors.length > 0 && (
                <p className="text-xs text-red-500">{rowErrors.join(' · ')}</p>
            )}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────
export function BulkAddStudentsModal() {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);
    const [results, setResults] = useState<BulkStudentResult[] | null>(null);
    const [showAll, setShowAll] = useState(false);

    // Shared fields
    const [sharedGrade, setSharedGrade] = useState('');
    const [sharedGroupId, setSharedGroupId] = useState('');

    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stage);

    const { data: groupsData } = useQuery({
        queryKey: ['teacherGroups_bulk'],
        queryFn: () => fetchGroups({ limit: 100 }),
        enabled: open,
    });
    const rawGroupsData = groupsData as any;
    const groups: Group[] = Array.isArray(rawGroupsData?.data?.data)
        ? rawGroupsData.data.data
        : Array.isArray(rawGroupsData?.data)
            ? rawGroupsData.data
            : [];

    const availableGrades = Array.from(
        new Set(groups.map((g) => g.gradeLevel).filter((g) => allowedGrades.includes(g)))
    );

    const filteredGroups = sharedGrade
        ? groups.filter((g) => g.gradeLevel === sharedGrade)
        : [];

    const mutation = useMutation({
        mutationFn: bulkCreateStudents,
        onSuccess: (data) => {
            setResults(data.results);
            queryClient.invalidateQueries({ queryKey: ['students'] });
            if (data.failCount === 0) {
                toast.success(`تمت إضافة ${data.successCount} طالب بنجاح`);
            } else if (data.successCount === 0) {
                toast.error(`فشل إضافة جميع الطلاب (${data.failCount})`);
            } else {
                toast.warning(`تمت إضافة ${data.successCount} من ${data.total} طالب. ${data.failCount} فشلوا.`);
            }
        },
        onError: (err: any) => {
            
        },
    });

    const handleChange = (id: string, field: keyof StudentRow, value: string) => {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    };

    const addRow = () => {
        if (rows.length >= 50) {
            toast.warning('الحد الأقصى 50 طالب في المرة الواحدة');
            return;
        }
        setRows((prev) => [...prev, emptyRow()]);
    };

    const removeRow = (id: string) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const handleSubmit = () => {
        if (!sharedGrade) {
            toast.error('يرجى اختيار المرحلة الدراسية أولاً');
            return;
        }
        if (!sharedGroupId) {
            toast.error('يرجى اختيار المجموعة أولاً');
            return;
        }
        const invalidRows = rows.filter((r) => validateRow(r).length > 0);
        if (invalidRows.length > 0) {
            toast.error(`يوجد ${invalidRows.length} صف به بيانات ناقصة أو غير صحيحة`);
            return;
        }
        // Merge shared gradeLevel + groupId into each row
        const payload: BulkStudentInput[] = rows.map(({ id, ...rest }) => ({
            ...rest,
            gradeLevel: sharedGrade,
            groupId: sharedGroupId,
        }));
        mutation.mutate(payload);
    };

    const handleReset = () => {
        setRows([emptyRow()]);
        setResults(null);
        setShowAll(false);
        setSharedGrade('');
        setSharedGroupId('');
    };

    const handleClose = (v: boolean) => {
        if (!v) handleReset();
        setOpen(v);
    };

    const rowsValid = rows.every((r) => validateRow(r).length === 0);
    const isDone = results !== null;
    const successCount = results?.filter((r) => r.success).length ?? 0;
    const failCount    = results?.filter((r) => !r.success).length ?? 0;
    const displayedRows = isDone ? rows : showAll ? rows : rows.slice(0, 10);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/5 font-bold">
                    <Users className="h-4 w-4" />
                    إضافة طلاب متعددين
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col" dir="rtl">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Users className="h-5 w-5 text-primary" />
                        إضافة طلاب متعددين
                    </DialogTitle>
                    <p className="text-xs text-gray-500 mt-1">
                        اختر المرحلة والمجموعة مرة واحدة لجميع الطلاب، ثم أضف بياناتهم.
                    </p>
                </DialogHeader>

                {/* ── Shared gradeLevel + groupId ── */}
                {!isDone && (
                    <div className="shrink-0 bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-blue-700">إعدادات مشتركة لجميع الطلاب</p>
                        <div className="grid grid-cols-2 gap-3">
                            <Select
                                value={sharedGrade}
                                onValueChange={(v) => {
                                    setSharedGrade(v);
                                    setSharedGroupId('');
                                }}
                            >
                                <SelectTrigger className="h-9 text-sm bg-white">
                                    <SelectValue placeholder="المرحلة الدراسية *" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    {availableGrades.map((g) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={sharedGroupId}
                                onValueChange={setSharedGroupId}
                                disabled={!sharedGrade}
                            >
                                <SelectTrigger className="h-9 text-sm bg-white">
                                    <SelectValue placeholder={!sharedGrade ? 'اختر المرحلة أولاً' : 'المجموعة *'} />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    {filteredGroups.map((g) => (
                                        <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
                                    ))}
                                    {filteredGroups.length === 0 && sharedGrade && (
                                        <div className="p-2 text-xs text-center text-gray-400">لا توجد مجموعات</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Results Summary Bar */}
                {isDone && (
                    <div className={cn(
                        'shrink-0 flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium',
                        failCount === 0 ? 'bg-green-50 border border-green-200 text-green-800'
                            : successCount === 0 ? 'bg-red-50 border border-red-200 text-red-700'
                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                    )}>
                        <span>
                            {failCount === 0
                                ? `✓ تمت إضافة ${successCount} طالب بنجاح`
                                : successCount === 0
                                ? `✗ فشل إضافة جميع الطلاب`
                                : `تمت إضافة ${successCount} من ${rows.length} — ${failCount} طالب فشلوا`
                            }
                        </span>
                        <button onClick={handleReset} className="text-xs underline opacity-70 hover:opacity-100">
                            بدء من جديد
                        </button>
                    </div>
                )}

                {/* Scrollable rows area */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 py-1">
                    {displayedRows.map((row, idx) => (
                        <StudentRowForm
                            key={row.id}
                            row={row}
                            index={isDone ? idx : rows.indexOf(row)}
                            onChange={handleChange}
                            onRemove={removeRow}
                            canRemove={rows.length > 1}
                            result={results?.[rows.indexOf(row)]}
                        />
                    ))}

                    {!isDone && rows.length > 10 && !showAll && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="w-full text-xs text-gray-400 hover:text-primary py-2 flex items-center justify-center gap-1"
                        >
                            <ChevronDown className="h-3.5 w-3.5" />
                            عرض باقي الصفوف ({rows.length - 10} مخفية)
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-gray-100 pt-3 space-y-2">
                    {!isDone && (
                        <button
                            onClick={addRow}
                            disabled={rows.length >= 50}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                        >
                            <Plus className="h-4 w-4" />
                            إضافة صف جديد ({rows.length} / 50)
                        </button>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                            {isDone ? 'إغلاق' : 'إلغاء'}
                        </Button>
                        {!isDone && (
                            <Button
                                className="flex-1 gap-2 font-bold"
                                onClick={handleSubmit}
                                disabled={mutation.isPending || !rowsValid || rows.length === 0 || !sharedGrade || !sharedGroupId}
                            >
                                {mutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        جاري الإضافة...
                                    </>
                                ) : (
                                    <>
                                        <Users className="h-4 w-4" />
                                        إضافة {rows.length} طالب
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

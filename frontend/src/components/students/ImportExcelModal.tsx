'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
    Upload, Download, Loader2, FileSpreadsheet, X, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchGroups } from '@/lib/api/groups';
import { bulkCreateStudents } from '@/lib/api/students';
import type { BulkStudentInput, BulkCreateResponse } from '@/types/student.types';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import { QK } from '@/lib/query-keys';

// ─── Column headers in Arabic ────────────────────────────────────────────────
const COL_STUDENT_NAME  = 'اسم الطالب';
const COL_PARENT_PHONE  = 'رقم ولي الأمر';
const COL_STUDENT_PHONE = 'رقم الطالب';
const COL_GRADE_LEVEL   = 'المرحلة الدراسية';
const COL_GROUP_NAME    = 'المجموعة';

const HEADERS = [COL_STUDENT_NAME, COL_PARENT_PHONE, COL_STUDENT_PHONE, COL_GRADE_LEVEL, COL_GROUP_NAME];

interface Props {
    open:         boolean;
    onOpenChange: (v: boolean) => void;
}

// ─── Parsed row from Excel ───────────────────────────────────────────────────
interface ParsedRow {
    fullName:     string;
    parentPhone:  string;
    studentPhone: string;
    gradeLevel:   string;
    groupName:    string;
    groupId?:     string;
    error?:       string;
}

export function ImportExcelModal({ open, onOpenChange }: Props) {
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stage);
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file,        setFile]        = useState<File | null>(null);
    const [parsedRows,  setParsedRows]  = useState<ParsedRow[]>([]);
    const [results,     setResults]     = useState<BulkCreateResponse | null>(null);
    const [step,        setStep]        = useState<'upload' | 'preview' | 'results'>('upload');

    // Fetch teacher's groups (for template generation & name matching)
    const { data: groupsData } = useQuery({
        queryKey: QK.groups.forBulk,
        queryFn: () => fetchGroups({ limit: 100 }),
        enabled: open,
    });
    const groups: { _id: string; name: string; gradeLevel: string }[] =
        (groupsData as any)?.data ?? (groupsData as any) ?? [];

    // ── Download Template ────────────────────────────────────────────────────
    const handleDownloadTemplate = () => {
        if (groups.length === 0) {
            toast.error('يجب إنشاء مجموعة واحدة على الأقل أولاً');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Main data sheet with one example row
        const wsData = [
            HEADERS,
            ['أحمد محمد علي', '01012345678', '01112345678', allowedGrades[0] ?? '', groups[0]?.name ?? ''],
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths for readability
        ws['!cols'] = [
            { wch: 25 }, // اسم الطالب
            { wch: 18 }, // رقم ولي الأمر
            { wch: 18 }, // رقم الطالب
            { wch: 25 }, // المرحلة الدراسية
            { wch: 20 }, // المجموعة
        ];

        // Add Data Validation (dropdown lists) for grade level & group columns
        const gradesList = allowedGrades.join(',');
        const groupsList = groups.map(g => g.name).join(',');

        // Apply validation to rows 2-100 (row 1 is the header)
        ws['!dataValidation'] = [];
        for (let r = 1; r <= 100; r++) {
            // Grade Level column (D)
            (ws['!dataValidation'] as any[]).push({
                sqref: `D${r + 1}`,
                type: 'list',
                formula1: `"${gradesList}"`,
                showDropDown: true,
            });
            // Group Name column (E)
            (ws['!dataValidation'] as any[]).push({
                sqref: `E${r + 1}`,
                type: 'list',
                formula1: `"${groupsList}"`,
                showDropDown: true,
            });
        }

        XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');

        // Add a hidden reference sheet with valid values (alternative for longer lists)
        const refData = [
            ['المراحل المتاحة', 'المجموعات المتاحة'],
            ...Array.from({ length: Math.max(allowedGrades.length, groups.length) }, (_, i) => [
                allowedGrades[i] ?? '',
                groups[i]?.name ?? '',
            ]),
        ];
        const refWs = XLSX.utils.aoa_to_sheet(refData);
        XLSX.utils.book_append_sheet(wb, refWs, 'القيم المتاحة');

        XLSX.writeFile(wb, 'نموذج_إضافة_الطلاب.xlsx');
        toast.success('تم تحميل النموذج بنجاح');
    };

    // ── Handle File Upload ───────────────────────────────────────────────────
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;

        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
        ];
        if (!validTypes.includes(f.type) && !f.name.match(/\.(xlsx|xls|csv)$/i)) {
            toast.error('يرجى رفع ملف Excel (.xlsx, .xls) أو CSV');
            return;
        }
        if (f.size > 5 * 1024 * 1024) {
            toast.error('حجم الملف يجب أن يكون أقل من 5 MB');
            return;
        }

        setFile(f);
        parseExcelFile(f);
    };

    const parseExcelFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]!]!;
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

                if (jsonData.length === 0) {
                    toast.error('الملف فارغ — لم يتم العثور على بيانات');
                    return;
                }

                // Build a name → group map
                const groupMap = new Map(groups.map(g => [g.name.trim(), g]));

                const rows: ParsedRow[] = jsonData.map((row) => {
                    const fullName     = String(row[COL_STUDENT_NAME]  ?? '').trim();
                    const parentPhone  = String(row[COL_PARENT_PHONE]  ?? '').trim();
                    const studentPhone = String(row[COL_STUDENT_PHONE] ?? '').trim();
                    const gradeLevel   = String(row[COL_GRADE_LEVEL]   ?? '').trim();
                    const groupName    = String(row[COL_GROUP_NAME]    ?? '').trim();

                    const parsed: ParsedRow = { fullName, parentPhone, studentPhone, gradeLevel, groupName };

                    // Validation
                    if (!fullName || fullName.split(/\s+/).length < 2) {
                        parsed.error = 'الاسم يجب أن يكون ثنائي على الأقل';
                    } else if (!parentPhone) {
                        parsed.error = 'رقم ولي الأمر مطلوب';
                    } else if (!studentPhone) {
                        parsed.error = 'رقم الطالب مطلوب';
                    } else if (!gradeLevel) {
                        parsed.error = 'المرحلة الدراسية مطلوبة';
                    } else if (!groupName) {
                        parsed.error = 'المجموعة مطلوبة';
                    } else {
                        const matchedGroup = groupMap.get(groupName);
                        if (!matchedGroup) {
                            parsed.error = `المجموعة "${groupName}" غير موجودة`;
                        } else if (matchedGroup.gradeLevel !== gradeLevel) {
                            parsed.error = `المجموعة "${groupName}" مرحلتها "${matchedGroup.gradeLevel}" وليست "${gradeLevel}"`;
                        } else {
                            parsed.groupId = matchedGroup._id;
                        }
                    }

                    return parsed;
                });

                setParsedRows(rows);
                setStep('preview');
            } catch {
                toast.error('فشل في قراءة الملف — تأكد من صحة صيغة الملف');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // ── Submit to Backend ────────────────────────────────────────────────────
    const submitMutation = useMutation({
        mutationFn: async () => {
            const validRows = parsedRows.filter(r => !r.error && r.groupId);
            if (validRows.length === 0) throw new Error('لا توجد صفوف صالحة للإرسال');

            const payload: BulkStudentInput[] = validRows.map(r => ({
                fullName:     r.fullName,
                parentPhone:  r.parentPhone,
                studentPhone: r.studentPhone,
                gradeLevel:   r.gradeLevel,
                groupId:      r.groupId!,
            }));

            return bulkCreateStudents(payload);
        },
        onSuccess: (data) => {
            setResults(data);
            setStep('results');
            queryClient.invalidateQueries({ queryKey: QK.students.all });
            toast.success(`تم إضافة ${data.successCount} طالب بنجاح`);
        },
        onError: (err: any) => {
            toast.error(err?.message ?? 'حدث خطأ أثناء الإرسال');
        },
    });

    // ── Reset ────────────────────────────────────────────────────────────────
    const reset = () => {
        setFile(null);
        setParsedRows([]);
        setResults(null);
        setStep('upload');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const validCount = parsedRows.filter(r => !r.error).length;
    const errorCount = parsedRows.filter(r => !!r.error).length;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold border-b pb-3 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        استيراد الطلاب من Excel
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">

                    {/* ── Step 1: Upload ── */}
                    {step === 'upload' && (
                        <>
                            {/* Download Template */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-sm font-semibold text-green-800 mb-2">الخطوة الأولى: تحميل النموذج</p>
                                <p className="text-xs text-green-700 mb-3">
                                    قم بتحميل النموذج وملئه ببيانات الطلاب. ستجد قوائم جاهزة للمراحل والمجموعات في الأعمدة المخصصة.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadTemplate}
                                    className="gap-2 border-green-300 text-green-700 hover:bg-green-100"
                                    disabled={groups.length === 0}
                                >
                                    <Download className="h-4 w-4" />
                                    تحميل النموذج
                                </Button>
                                {groups.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        يجب إنشاء مجموعة واحدة على الأقل قبل التحميل
                                    </p>
                                )}
                            </div>

                            {/* Upload Area */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-2">الخطوة الثانية: رفع الملف</p>
                                {file ? (
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                        <FileSpreadsheet className="h-5 w-5 text-blue-600 shrink-0" />
                                        <span className="text-sm text-blue-800 flex-1 truncate">{file.name}</span>
                                        <button type="button" onClick={reset} className="text-blue-600 hover:text-red-500">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors"
                                    >
                                        <Upload className="h-8 w-8" />
                                        <span className="text-sm font-medium">اضغط لرفع ملف Excel</span>
                                        <span className="text-xs">.xlsx أو .xls أو .csv — الحد الأقصى 5 MB</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={handleFile}
                                />
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Preview ── */}
                    {step === 'preview' && (
                        <>
                            {/* Summary */}
                            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span className="font-semibold text-green-700">{validCount}</span>
                                    <span className="text-gray-500">صالح</span>
                                </div>
                                {errorCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        <span className="font-semibold text-red-700">{errorCount}</span>
                                        <span className="text-gray-500">خطأ</span>
                                    </div>
                                )}
                                <span className="text-xs text-gray-400 mr-auto">
                                    سيتم إرسال {validCount} طالب فقط (الصفوف الصالحة)
                                </span>
                            </div>

                            {/* Table */}
                            <div className="max-h-[40vh] overflow-y-auto border rounded-xl">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">#</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">الاسم</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">ولي الأمر</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">المرحلة</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">المجموعة</th>
                                            <th className="px-3 py-2 text-right font-semibold text-gray-500">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {parsedRows.map((row, i) => (
                                            <tr key={i} className={row.error ? 'bg-red-50/50' : ''}>
                                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-medium text-gray-900">{row.fullName}</td>
                                                <td className="px-3 py-2 text-gray-600 dir-ltr">{row.parentPhone}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.gradeLevel}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.groupName}</td>
                                                <td className="px-3 py-2">
                                                    {row.error ? (
                                                        <span className="text-red-600 text-[11px]">{row.error}</span>
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 justify-end pt-2 border-t">
                                <Button variant="outline" onClick={reset}>
                                    رجوع
                                </Button>
                                <Button
                                    onClick={() => submitMutation.mutate()}
                                    disabled={submitMutation.isPending || validCount === 0}
                                    className="gap-2 min-w-[140px]"
                                >
                                    {submitMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4" />
                                    )}
                                    إضافة {validCount} طالب
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Results ── */}
                    {step === 'results' && results && (
                        <>
                            <div className="text-center py-4">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                <p className="text-lg font-bold text-gray-900">تم الاستيراد بنجاح!</p>
                                <div className="flex justify-center gap-6 mt-3">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-green-600">{results.successCount}</p>
                                        <p className="text-xs text-gray-500">تم إضافتهم</p>
                                    </div>
                                    {results.failCount > 0 && (
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-red-500">{results.failCount}</p>
                                            <p className="text-xs text-gray-500">فشل</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Show failures if any */}
                            {results.failCount > 0 && (
                                <div className="max-h-[30vh] overflow-y-auto border rounded-xl">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-red-50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-right text-red-600">#</th>
                                                <th className="px-3 py-2 text-right text-red-600">السبب</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {results.results.filter(r => !r.success).map((r) => (
                                                <tr key={r.index} className="bg-red-50/30">
                                                    <td className="px-3 py-2 text-gray-500">{r.index + 1}</td>
                                                    <td className="px-3 py-2 text-red-600">{r.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end pt-2 border-t">
                                <Button onClick={() => { reset(); onOpenChange(false); }}>
                                    إغلاق
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

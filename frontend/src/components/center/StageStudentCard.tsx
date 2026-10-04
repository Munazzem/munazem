'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchCenterStudents } from '@/lib/api/centers';
import type { ICenterStudent } from '@/types/center.types';
import {
    Search,
    Plus,
    User,
    ClipboardList,
    Edit2,
    Trash2,
    Phone,
    Barcode,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Loader2,
    Users,
    X,
    Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface StageTheme {
    headerBg: string;
    headerBorder: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    pillActive: string;
    accentBorder: string;
}

export interface StageStudentCardProps {
    stageKey: 'SECONDARY' | 'PREPARATORY' | 'PRIMARY';
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    grades: readonly string[];
    defaultAddGrade: string;
    totalCountInStage: number;
    theme: StageTheme;
    isOpen: boolean;
    onToggle: () => void;
    onOpenAdd: (defaultGrade: string) => void;
    onOpenEdit: (student: ICenterStudent) => void;
    onDeleteStudent: (student: ICenterStudent) => void;
    onToggleActive: (student: ICenterStudent) => void;
    globalSearch?: string;
}

export function StageStudentCard({
    stageKey,
    title,
    subtitle,
    icon: StageIcon,
    grades,
    defaultAddGrade,
    totalCountInStage,
    theme,
    isOpen,
    onToggle,
    onOpenAdd,
    onOpenEdit,
    onDeleteStudent,
    onToggleActive,
    globalSearch = '',
}: StageStudentCardProps) {
    // Local Stage Page State
    const [localSearch, setLocalSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [page, setPage] = useState(1);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Sync with globalSearch if entered
    useEffect(() => {
        if (globalSearch.trim()) {
            setLocalSearch(globalSearch);
            setPage(1);
        }
    }, [globalSearch]);

    // Compute effective search query
    const effectiveSearch = localSearch.trim() || undefined;
    const isActiveParam = statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

    // Fetch students for this stage
    const { data: response, isLoading, isFetching } = useQuery({
        queryKey: [
            'center',
            'students',
            'stage-card',
            stageKey,
            effectiveSearch,
            selectedGrade,
            isActiveParam,
            page,
        ],
        queryFn: () =>
            fetchCenterStudents({
                stage: stageKey,
                gradeLevel: selectedGrade !== 'ALL' ? selectedGrade : undefined,
                isActive: isActiveParam,
                search: effectiveSearch,
                page,
                limit: 12,
            }),
        // Fetch only when opened or if global search is provided
        enabled: isOpen || !!globalSearch.trim(),
    });

    const students = response?.data || [];
    const totalResults = response?.total ?? totalCountInStage;
    const totalPages = response?.totalPages || 1;

    const handleCopy = (code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`تم نسخ كود الطالب: ${code}`);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div
            className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs ${
                isOpen ? `${theme.accentBorder} shadow-sm ring-1 ring-black/5` : 'border-gray-200 hover:border-gray-300'
            }`}
        >
            {/* ── CARD HEADER (Collapsible Trigger) ─────────────────────────────────── */}
            <div
                onClick={onToggle}
                className={`p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                    theme.headerBg
                } ${isOpen ? 'border-b ' + theme.headerBorder : ''}`}
            >
                {/* Right: Stage Icon & Titles */}
                <div className="flex items-center gap-3.5 min-w-0">
                    <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${theme.iconBg} ${theme.iconColor}`}
                    >
                        <StageIcon className="w-6 h-6" />
                    </div>
                    <div className="truncate">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                                {title}
                            </h2>
                            <span
                                className={`text-xs font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                            >
                                {totalCountInStage} طالب
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{subtitle}</p>
                    </div>
                </div>

                {/* Left: Quick Actions & Toggle Button */}
                <div className="flex items-center gap-2.5 shrink-0 mr-auto sm:mr-0">
                    <Button
                        type="button"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenAdd(defaultAddGrade);
                        }}
                        className="h-9 px-3 rounded-xl text-xs font-bold bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 shadow-2xs gap-1.5 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>إضافة طالب للمرحلة</span>
                    </Button>

                    <button
                        type="button"
                        aria-label={isOpen ? 'إغلاق البطاقة' : 'عرض طلاب المرحلة'}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                            isOpen
                                ? 'bg-gray-900 text-white hover:bg-gray-800'
                                : `${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} hover:brightness-95`
                        }`}
                    >
                        <span>{isOpen ? 'إغلاق البطاقة' : 'عرض طلاب المرحلة'}</span>
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* ── CARD BODY: DEDICATED STAGE PAGE (بيدج بتجمع الطلبة) ──────────────── */}
            {isOpen && (
                <div className="divide-y divide-gray-100 bg-white">
                    {/* Stage Toolbar (Search & Sub-grade Pills & Filters) */}
                    <div className="p-4 sm:p-5 bg-gray-50/50 space-y-3.5">
                        {/* Search and Status row */}
                        <div className="flex flex-col sm:flex-row items-center gap-2.5">
                            {/* Local Stage Search Input */}
                            <div className="relative flex-1 w-full">
                                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={localSearch}
                                    onChange={(e) => {
                                        setLocalSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder={`بحث في ${title} بالاسم، كود الطالب، رقم الهاتف، أو الباركود...`}
                                    className="pr-10 pl-9 border-gray-200 rounded-xl text-xs sm:text-sm bg-white focus:bg-white h-10 shadow-2xs"
                                />
                                {localSearch && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLocalSearch('');
                                            setPage(1);
                                        }}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Active Status Pills */}
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 self-stretch sm:self-auto shrink-0 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter('ALL');
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        statusFilter === 'ALL'
                                            ? 'bg-gray-900 text-white shadow-xs'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    الكل
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter('ACTIVE');
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        statusFilter === 'ACTIVE'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                                    }`}
                                >
                                    نشط
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter('INACTIVE');
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        statusFilter === 'INACTIVE'
                                            ? 'bg-red-600 text-white shadow-xs'
                                            : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
                                    }`}
                                >
                                    معطل
                                </button>
                            </div>
                        </div>

                        {/* Sub-Grade Pills Row */}
                        <div className="flex items-center justify-between gap-3 flex-wrap pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-gray-500 ml-1 flex items-center gap-1">
                                    <Filter className="w-3 h-3 text-gray-400" />
                                    الصفوف:
                                </span>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedGrade('ALL');
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                        selectedGrade === 'ALL'
                                            ? `${theme.pillActive} shadow-xs font-black`
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    جميع الصفوف
                                </button>

                                {grades.map((grade) => (
                                    <button
                                        key={grade}
                                        type="button"
                                        onClick={() => {
                                            setSelectedGrade(grade);
                                            setPage(1);
                                        }}
                                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                                            selectedGrade === grade
                                                ? `${theme.pillActive} shadow-xs font-black`
                                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        {grade}
                                    </button>
                                ))}
                            </div>

                            {/* Result Count and Refresh */}
                            <div className="text-[11px] font-bold text-gray-400 mr-auto sm:mr-0 flex items-center gap-2">
                                {isFetching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                                <span>
                                    النتائج: <strong className="text-gray-700">{totalResults}</strong> طالب
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Students Table or Empty State */}
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center space-y-2 text-gray-400">
                            <Loader2 className="w-7 h-7 animate-spin text-primary" />
                            <p className="text-xs font-bold text-gray-500">جاري تحميل طلاب {title}...</p>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="py-14 px-4 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-gray-800">
                                    {effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL'
                                        ? 'لا توجد نتائج مطابقة لخيارات البحث في هذه المرحلة'
                                        : `لا يوجد طلاب مسجلين في ${title} حتى الآن`}
                                </h3>
                                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                                    {effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL'
                                        ? 'جرّب إعادة ضبط الفلاتر أو البحث بكلمات أخرى.'
                                        : 'ابدأ بإضافة أول طالب لهذه المرحلة مباشرة لتوليد الأكواد وتفعيل الاشتراكات.'}
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-1">
                                {(effectiveSearch || selectedGrade !== 'ALL' || statusFilter !== 'ALL') && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setLocalSearch('');
                                            setSelectedGrade('ALL');
                                            setStatusFilter('ALL');
                                            setPage(1);
                                        }}
                                        className="h-8 text-xs rounded-xl font-bold"
                                    >
                                        إعادة ضبط الفلاتر
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => onOpenAdd(selectedGrade !== 'ALL' ? selectedGrade : defaultAddGrade)}
                                    className="h-8 text-xs rounded-xl font-bold bg-primary hover:bg-primary/95 text-white gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>إضافة طالب جديد</span>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 font-bold">
                                    <tr>
                                        <th className="py-3.5 px-4">الطالب</th>
                                        <th className="py-3.5 px-4">كود الطالب</th>
                                        <th className="py-3.5 px-4">الصف الدراسي</th>
                                        <th className="py-3.5 px-4">ولي الأمر والهواتف</th>
                                        <th className="py-3.5 px-4">الباركود</th>
                                        <th className="py-3.5 px-4">الحالة</th>
                                        <th className="py-3.5 px-4 text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {students.map((st) => (
                                        <tr key={st._id} className="hover:bg-gray-50/50 transition-colors">
                                            {/* Student Name & Avatar */}
                                            <td className="py-3.5 px-4 font-bold text-gray-900">
                                                <Link
                                                    href={`/center/students/${st._id}`}
                                                    className="flex items-center gap-2.5 group hover:text-primary transition-colors cursor-pointer"
                                                    title="عرض الملف التعريفي للطالب"
                                                >
                                                    <div
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
                                                    >
                                                        {st.studentName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-900 font-bold group-hover:text-primary transition-colors underline-offset-4 group-hover:underline">
                                                            {st.studentName}
                                                        </div>
                                                        {st.notes && (
                                                            <div className="text-[11px] text-gray-400 font-normal">
                                                                ملاحظات: {st.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            </td>

                                            {/* Student Code */}
                                            <td className="py-3.5 px-4">
                                                <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs shadow-2xs">
                                                    <span>{st.studentCode}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleCopy(st.studentCode, e)}
                                                        title="نسخ كود الطالب"
                                                        className="hover:text-blue-900 p-0.5 transition-colors"
                                                    >
                                                        {copiedCode === st.studentCode ? (
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="w-3 h-3 text-blue-400 hover:text-blue-700" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Grade Level */}
                                            <td className="py-3.5 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={`font-semibold ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                                                >
                                                    {st.gradeLevel}
                                                </Badge>
                                            </td>

                                            {/* Parent & Phone Numbers */}
                                            <td className="py-3.5 px-4">
                                                <div className="space-y-0.5">
                                                    <div className="text-gray-700 font-medium">{st.parentName}</div>
                                                    <div className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-wrap">
                                                        {st.studentPhone && (
                                                            <a
                                                                href={`tel:${st.studentPhone}`}
                                                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                                                title="اتصال بالطالب"
                                                            >
                                                                <Phone className="h-3 w-3 text-gray-400" />
                                                                طالب: {st.studentPhone}
                                                            </a>
                                                        )}
                                                        {st.parentPhone && (
                                                            <a
                                                                href={`tel:${st.parentPhone}`}
                                                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                                                title="اتصال بولي الأمر"
                                                            >
                                                                <Phone className="h-3 w-3 text-gray-400" />
                                                                ولي أمر: {st.parentPhone}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Barcode */}
                                            <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">
                                                {st.barcode ? (
                                                    <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                                                        <Barcode className="h-3 w-3" />
                                                        {st.barcode}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>

                                            {/* Active / Inactive Status Toggle */}
                                            <td className="py-3.5 px-4">
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleActive(st)}
                                                    title={`اضغط لـ ${st.isActive ? 'تعطيل' : 'تنشيط'} الطالب`}
                                                    className="cursor-pointer transition-transform hover:scale-105"
                                                >
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            st.isActive
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 font-bold'
                                                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-bold'
                                                        }
                                                    >
                                                        {st.isActive ? 'نشط' : 'معطل'}
                                                    </Badge>
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Link
                                                        href={`/center/students/${st._id}`}
                                                        title="عرض الملف التعريفي للطالب"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors"
                                                    >
                                                        <User className="h-3.5 w-3.5" />
                                                        <span>بروفايل</span>
                                                    </Link>

                                                    <Link
                                                        href={`/center/enrollments?studentId=${st._id}`}
                                                        title="تسجيل اشتراك"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors"
                                                    >
                                                        <ClipboardList className="h-3.5 w-3.5" />
                                                        <span>اشتراك</span>
                                                    </Link>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => onOpenEdit(st)}
                                                        className="h-7 w-7 text-gray-500 hover:text-gray-900 rounded-lg"
                                                        title="تعديل البيانات"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => onDeleteStudent(st)}
                                                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                                        title="حذف الطالب نهائياً"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3.5 sm:px-5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                            <div>
                                صفحة <strong className="text-gray-700 font-black">{page}</strong> من{' '}
                                <strong className="text-gray-700 font-black">{totalPages}</strong> (إجمالي{' '}
                                <strong className="text-gray-700 font-black">{totalResults}</strong> طالب)
                            </div>
                            <div className="flex gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="h-8 text-xs rounded-xl font-bold bg-white"
                                >
                                    السابق
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="h-8 text-xs rounded-xl font-bold bg-white"
                                >
                                    التالي
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

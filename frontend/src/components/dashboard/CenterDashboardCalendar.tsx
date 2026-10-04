'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Calendar as CalendarIcon,
    CalendarDays,
    CalendarCheck,
    ChevronLeft,
    ChevronRight,
    Clock,
    Users,
    GraduationCap,
    Sparkles,
    Filter,
    Search,
    ArrowUpRight,
    CheckCircle2,
    BookOpen,
    Layers,
    UserCheck,
} from 'lucide-react';
import type { ICenterGroup, ICenterTeacher } from '@/types/center.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CenterDashboardCalendarProps {
    groups: ICenterGroup[];
    teachers?: ICenterTeacher[];
    isLoading?: boolean;
}

const MONTHS_ARABIC = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
];

// Week days in standard Egyptian educational calendar (starts Saturday)
const WEEK_COLUMNS = [
    { id: 6, name: 'السبت', short: 'سبت' },
    { id: 0, name: 'الأحد', short: 'أحد' },
    { id: 1, name: 'الإثنين', short: 'إثنين' },
    { id: 2, name: 'الثلاثاء', short: 'ثلاثاء' },
    { id: 3, name: 'الأربعاء', short: 'أربعاء' },
    { id: 4, name: 'الخميس', short: 'خميس' },
    { id: 5, name: 'الجمعة', short: 'جمعة' },
];

const DAYS_ARABIC_INDEX = [
    'الأحد',
    'الإثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت',
];

export function CenterDashboardCalendar({
    groups,
    teachers = [],
    isLoading = false,
}: CenterDashboardCalendarProps) {
    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    // Filters
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Available Grade Levels from groups
    const availableGradeLevels = useMemo(() => {
        const set = new Set<string>();
        groups.forEach((g) => {
            if (g.gradeLevel) set.add(g.gradeLevel);
        });
        return Array.from(set);
    }, [groups]);

    // Filter groups by teacher, stage, and search query
    const filteredGroups = useMemo(() => {
        return groups.filter((g) => {
            if (selectedTeacherId !== 'all') {
                const tId =
                    typeof g.centerTeacherId === 'object' && g.centerTeacherId !== null
                        ? (g.centerTeacherId as any)._id
                        : g.centerTeacherId;
                if (String(tId) !== selectedTeacherId) return false;
            }

            if (selectedGradeLevel !== 'all' && g.gradeLevel !== selectedGradeLevel) {
                return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const teacherName =
                    typeof g.centerTeacherId === 'object' && g.centerTeacherId !== null
                        ? (g.centerTeacherId as any).name?.toLowerCase() || ''
                        : '';
                const matchName = g.name.toLowerCase().includes(q);
                const matchTeacher = teacherName.includes(q);
                const matchGrade = (g.gradeLevel || '').toLowerCase().includes(q);
                if (!matchName && !matchTeacher && !matchGrade) return false;
            }

            return true;
        });
    }, [groups, selectedTeacherId, selectedGradeLevel, searchQuery]);

    // Navigation functions
    const goToPreviousMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear((y) => y - 1);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    const goToToday = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth());
        setSelectedDate(now);
    };

    // Calculate calendar grid days
    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

        // Calculate offset for Saturday start
        // day.getDay(): 0=Sun, 1=Mon, ..., 6=Sat
        // Saturday offset: (day.getDay() + 1) % 7
        const startOffset = (firstDay.getDay() + 1) % 7;

        const days: Array<{
            day: number;
            month: number;
            year: number;
            isCurrentMonth: boolean;
            dateObj: Date;
        }> = [];

        // Previous month filler days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const m = currentMonth === 0 ? 11 : currentMonth - 1;
            const y = currentMonth === 0 ? currentYear - 1 : currentYear;
            days.push({
                day: d,
                month: m,
                year: y,
                isCurrentMonth: false,
                dateObj: new Date(y, m, d),
            });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({
                day: d,
                month: currentMonth,
                year: currentYear,
                isCurrentMonth: true,
                dateObj: new Date(currentYear, currentMonth, d),
            });
        }

        // Next month filler days to complete 7-day rows
        const remaining = (7 - (days.length % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            const m = currentMonth === 11 ? 0 : currentMonth + 1;
            const y = currentMonth === 11 ? currentYear + 1 : currentYear;
            days.push({
                day: i,
                month: m,
                year: y,
                isCurrentMonth: false,
                dateObj: new Date(y, m, i),
            });
        }

        return days;
    }, [currentYear, currentMonth]);

    // Helper: get groups scheduled on a specific date
    const getGroupsForDate = (dateObj: Date) => {
        const dayIndex = dateObj.getDay();
        const dayNameArabic = DAYS_ARABIC_INDEX[dayIndex];
        return filteredGroups.filter((g) =>
            g.schedule?.some((s) => s.day === dayNameArabic)
        );
    };

    // Helper check if date is today
    const isDateToday = (d: Date) => {
        return (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
        );
    };

    // Helper check if date is currently selected
    const isDateSelected = (d: Date) => {
        return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
        );
    };

    // Groups scheduled on the currently selected date
    const selectedDayGroups = useMemo(() => {
        return getGroupsForDate(selectedDate);
    }, [selectedDate, filteredGroups]);

    const selectedDayName = DAYS_ARABIC_INDEX[selectedDate.getDay()];

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-5 sm:p-6 space-y-6">
            {/* ── 1. Calendar Header & Controls ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                        <CalendarIcon className="w-4 h-4 text-emerald-600" />
                        <span>تقويم وحصص السنتر الذكي</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                        جدول وتقويم المجموعات (Center Calendar)
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        استعراض جدول الحصص اليومية، التنقل بين الأيام والشهور، ومتابعة قاعات ومدرسي السنتر
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* View mode toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('month')}
                            className={cn(
                                'px-3 py-1.5 rounded-lg transition-all',
                                viewMode === 'month'
                                    ? 'bg-white text-gray-900 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-900'
                            )}
                        >
                            عرض الشهر
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('week')}
                            className={cn(
                                'px-3 py-1.5 rounded-lg transition-all',
                                viewMode === 'week'
                                    ? 'bg-white text-gray-900 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-900'
                            )}
                        >
                            الجدول الأسبوعي الشامل
                        </button>
                    </div>

                    {/* Today button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        className="h-9 text-xs font-bold gap-1.5 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-gray-700"
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>اليوم</span>
                    </Button>
                </div>
            </div>

            {/* ── 2. Filters & Search Bar ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    {/* Teacher filter */}
                    <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="h-9 text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="all">كل المدرسين ({teachers.length})</option>
                        {teachers.map((t) => (
                            <option key={t._id} value={t._id}>
                                {t.name} ({t.subject || 'مدرس'})
                            </option>
                        ))}
                    </select>

                    {/* Grade Level filter */}
                    <select
                        value={selectedGradeLevel}
                        onChange={(e) => setSelectedGradeLevel(e.target.value)}
                        className="h-9 text-xs font-semibold bg-white border border-gray-200 rounded-xl px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="all">كل المراحل الدراسية</option>
                        {availableGradeLevels.map((lvl) => (
                            <option key={lvl} value={lvl}>
                                {lvl}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="بحث باسم المجموعة أو المدرس..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pr-9 pl-3 text-xs bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* ── 3. MONTH VIEW: Calendar Grid (7 cols) + Selected Day Agenda ── */}
            {viewMode === 'month' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Calendar Card (7 cols) */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs space-y-4">
                        {/* Month navigation header */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                                <span className="text-primary">{MONTHS_ARABIC[currentMonth]}</span>
                                <span className="font-mono text-gray-400">{currentYear}</span>
                            </h3>

                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={goToPreviousMonth}
                                    title="الشهر السابق"
                                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={goToNextMonth}
                                    title="الشهر القادم"
                                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Weekday column headers */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-gray-400 border-b border-gray-100 pb-2">
                            {WEEK_COLUMNS.map((col) => (
                                <div key={col.id} className="py-1">
                                    <span className="hidden sm:inline">{col.name}</span>
                                    <span className="sm:hidden">{col.short}</span>
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                            {calendarDays.map((cell, idx) => {
                                const dayGroups = getGroupsForDate(cell.dateObj);
                                const isCurrent = cell.isCurrentMonth;
                                const isSelected = isDateSelected(cell.dateObj);
                                const isTod = isDateToday(cell.dateObj);
                                const hasGroups = dayGroups.length > 0;

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedDate(cell.dateObj)}
                                        className={cn(
                                            'aspect-square rounded-xl p-1 flex flex-col items-center justify-between transition-all relative group cursor-pointer border',
                                            isSelected
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-102 z-10'
                                                : isTod
                                                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-black ring-2 ring-emerald-200'
                                                : isCurrent
                                                ? 'bg-white hover:bg-gray-50 border-gray-100 text-gray-800'
                                                : 'bg-gray-50/40 border-transparent text-gray-300 hover:bg-gray-100/50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full px-0.5">
                                            <span
                                                className={cn(
                                                    'text-xs font-bold leading-none',
                                                    isSelected ? 'text-white' : isCurrent ? 'text-gray-800' : 'text-gray-300'
                                                )}
                                            >
                                                {cell.day}
                                            </span>

                                            {isTod && !isSelected && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            )}
                                        </div>

                                        {/* Activity Dots / Badge */}
                                        {hasGroups && (
                                            <div className="w-full flex items-center justify-center gap-0.5 mt-auto">
                                                {isSelected ? (
                                                    <span className="text-[9px] font-bold text-emerald-100 leading-none">
                                                        {dayGroups.length} {dayGroups.length === 1 ? 'حصة' : 'حصص'}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        {dayGroups.length > 1 && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                        )}
                                                        {dayGroups.length > 2 && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Calendar Footer Legend */}
                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>مجموعات باقة</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span>مجموعات برايفت</span>
                                </div>
                            </div>
                            <span className="font-medium">اضغط على أي يوم لعرض حصصه المجدولة</span>
                        </div>
                    </div>

                    {/* Selected Day Agenda (5 cols) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
                        {/* Day Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-base font-black text-gray-900">
                                        حصص يوم {selectedDayName}
                                    </h4>
                                    {isDateToday(selectedDate) && (
                                        <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-[10px]">
                                            اليوم الحالي
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {selectedDate.getDate()} {MONTHS_ARABIC[selectedDate.getMonth()]}{' '}
                                    {selectedDate.getFullYear()}
                                </p>
                            </div>

                            <Badge variant="outline" className="text-xs font-bold bg-gray-50">
                                {selectedDayGroups.length} {selectedDayGroups.length === 1 ? 'مجموعة' : 'مجموعات'}
                            </Badge>
                        </div>

                        {/* Groups List for Selected Day */}
                        {selectedDayGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300">
                                    <CalendarCheck className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-bold text-gray-600">لا توجد حصص مجدولة في هذا اليوم</p>
                                <p className="text-[11px] text-gray-400 max-w-[220px]">
                                    يمكنك اختيار يوم آخر من التقويم أو جدولة مواعيد جديدة من إدارة المجموعات
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                {selectedDayGroups.map((group) => {
                                    const teacher =
                                        typeof group.centerTeacherId === 'object' && group.centerTeacherId !== null
                                            ? (group.centerTeacherId as any)
                                            : null;
                                    const daySchedule = group.schedule?.find((s) => s.day === selectedDayName);

                                    return (
                                        <div
                                            key={group._id}
                                            className="p-3.5 rounded-xl border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all space-y-2 group"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                                                        {group.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                            {group.name}
                                                        </h5>
                                                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                                                            <span>{teacher?.name || 'مدرس السنتر'}</span>
                                                            {teacher?.subject && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-emerald-700 font-semibold">{teacher.subject}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-[10px] font-bold shrink-0',
                                                        group.groupType === 'PACKAGE'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : group.groupType === 'PRIVATE'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    )}
                                                >
                                                    {group.groupType === 'PACKAGE'
                                                        ? 'باقة'
                                                        : group.groupType === 'PRIVATE'
                                                        ? 'برايفت'
                                                        : 'مختلط'}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                                                <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                    <span className="font-mono font-bold text-gray-900">
                                                        {daySchedule?.time || '—'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">({group.gradeLevel})</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Link href={`/center/attendance?groupId=${group._id}`}>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-[11px] font-bold px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                                        >
                                                            <UserCheck className="w-3 h-3" />
                                                            <span>تحضير</span>
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 4. WEEK VIEW: Full Timetable Matrix (الجدول الأسبوعي الشامل للسنتر) ── */}
            {viewMode === 'week' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span>جدول مواعيد الأسبوع الكامل للسنتر (Weekly Timetable)</span>
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">
                            إجمالي المجموعات النشطة: {filteredGroups.length} مجموعة
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                        {WEEK_COLUMNS.map((col) => {
                            const dayGroups = filteredGroups.filter((g) =>
                                g.schedule?.some((s) => s.day === col.name)
                            );
                            const isTodayCol = DAYS_ARABIC_INDEX[today.getDay()] === col.name;

                            return (
                                <div
                                    key={col.id}
                                    className={cn(
                                        'rounded-2xl border p-3 flex flex-col justify-between min-h-[320px] transition-all',
                                        isTodayCol
                                            ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-100 shadow-sm'
                                            : 'bg-white border-gray-100 shadow-2xs'
                                    )}
                                >
                                    <div>
                                        {/* Column Header */}
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-xs text-gray-900">{col.name}</span>
                                                {isTodayCol && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold font-mono bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-600">
                                                {dayGroups.length}
                                            </span>
                                        </div>

                                        {/* Column Groups List */}
                                        {dayGroups.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 text-center py-8">
                                                — لا توجد حصص —
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {dayGroups.map((g) => {
                                                    const s = g.schedule?.find((sch) => sch.day === col.name);
                                                    const teacher =
                                                        typeof g.centerTeacherId === 'object' && g.centerTeacherId !== null
                                                            ? (g.centerTeacherId as any)
                                                            : null;

                                                    return (
                                                        <div
                                                            key={g._id}
                                                            className="p-2 rounded-xl bg-gray-50/80 hover:bg-emerald-50/60 border border-gray-100 hover:border-emerald-200 transition-all text-right space-y-1"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                                                                    {s?.time || '—'}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[9px] py-0 px-1 bg-white text-gray-500"
                                                                >
                                                                    {g.groupType === 'PACKAGE' ? 'باقة' : 'برايفت'}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs font-bold text-gray-900 truncate">
                                                                {g.name}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 truncate">
                                                                {teacher?.name || 'مدرس'}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action link for the day */}
                                    <div className="pt-2 border-t border-gray-100/60 mt-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Find the date for this weekday in current week
                                                const diff = (col.id - today.getDay() + 7) % 7;
                                                const target = new Date();
                                                target.setDate(today.getDate() + diff);
                                                setSelectedDate(target);
                                                setViewMode('month');
                                            }}
                                            className="text-[10px] font-bold text-primary hover:underline"
                                        >
                                            معاينة اليوم بالتقويم ←
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

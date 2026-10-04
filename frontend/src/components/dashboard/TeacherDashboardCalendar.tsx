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
    Play,
} from 'lucide-react';
import type { Group } from '@/types/group.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TeacherDashboardCalendarProps {
    groups: Group[];
    todaySessions?: any[];
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

export function TeacherDashboardCalendar({
    groups,
    todaySessions = [],
}: TeacherDashboardCalendarProps) {
    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    // Filters
    const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Available Grade Levels from teacher groups
    const availableGradeLevels = useMemo(() => {
        const set = new Set<string>();
        groups.forEach((g) => {
            if (g.gradeLevel) set.add(g.gradeLevel);
        });
        return Array.from(set);
    }, [groups]);

    const filteredGroups = useMemo(() => {
        return groups.filter((g) => {
            if (selectedGradeLevel !== 'all' && g.gradeLevel !== selectedGradeLevel) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = g.name.toLowerCase().includes(q);
                const matchGrade = (g.gradeLevel || '').toLowerCase().includes(q);
                if (!matchName && !matchGrade) return false;
            }
            return true;
        });
    }, [groups, selectedGradeLevel, searchQuery]);

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

        // Next month filler days
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

    const getGroupsForDate = (dateObj: Date) => {
        const dayIndex = dateObj.getDay();
        const dayNameArabic = DAYS_ARABIC_INDEX[dayIndex];
        return filteredGroups.filter((g) =>
            g.schedule?.some((s) => s.day === dayNameArabic)
        );
    };

    const isDateToday = (d: Date) => {
        return (
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
        );
    };

    const isDateSelected = (d: Date) => {
        return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
        );
    };

    const selectedDayGroups = useMemo(() => {
        return getGroupsForDate(selectedDate);
    }, [selectedDate, filteredGroups]);

    const selectedDayName = DAYS_ARABIC_INDEX[selectedDate.getDay()];

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-5 sm:p-6 space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <span>تقويم وحصص الأستاذ</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                        تقويم وجدول الحصص (Teacher Calendar)
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        استعراض مواعيد الحصص الشهرية، التنقل بين الأيام، وبدء الحصص التفاعلية
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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
                            الجدول الأسبوعي
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        className="h-9 text-xs font-bold gap-1.5 border-gray-200 hover:border-primary/40 hover:bg-primary/5 text-gray-700"
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>اليوم</span>
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 w-full sm:w-auto">
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

                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="بحث باسم المجموعة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pr-9 pl-3 text-xs bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            {/* Month View */}
            {viewMode === 'month' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Calendar Grid (7 cols) */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs space-y-4">
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

                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-gray-400 border-b border-gray-100 pb-2">
                            {WEEK_COLUMNS.map((col) => (
                                <div key={col.id} className="py-1">
                                    <span className="hidden sm:inline">{col.name}</span>
                                    <span className="sm:hidden">{col.short}</span>
                                </div>
                            ))}
                        </div>

                        {/* Day cells */}
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
                                                ? 'bg-primary text-white border-primary shadow-md scale-102 z-10'
                                                : isTod
                                                ? 'bg-primary/10 border-primary/40 text-primary font-black ring-2 ring-primary/20'
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

                                        {hasGroups && (
                                            <div className="w-full flex items-center justify-center gap-0.5 mt-auto">
                                                {isSelected ? (
                                                    <span className="text-[9px] font-bold text-white/90 leading-none">
                                                        {dayGroups.length} {dayGroups.length === 1 ? 'حصة' : 'حصص'}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        {dayGroups.length > 1 && (
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
                    </div>

                    {/* Day Agenda Panel (5 cols) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
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
                                {selectedDayGroups.length} مجموعات
                            </Badge>
                        </div>

                        {selectedDayGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300">
                                    <CalendarCheck className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-bold text-gray-600">لا توجد حصص مجدولة لهذا اليوم</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                {selectedDayGroups.map((g) => {
                                    const sch = g.schedule?.find((s) => s.day === selectedDayName);
                                    return (
                                        <div
                                            key={g._id}
                                            className="p-3.5 rounded-xl border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all space-y-2 group"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h5 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                        {g.name}
                                                    </h5>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        {g.gradeLevel}
                                                    </p>
                                                </div>

                                                <Link href={`/sessions`}>
                                                    <Button
                                                        size="sm"
                                                        className="h-7 text-[11px] font-bold px-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white gap-1"
                                                    >
                                                        <Play className="w-3 h-3 fill-current" />
                                                        <span>بدء الحصة</span>
                                                    </Button>
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                    <span className="font-mono font-bold text-gray-900">
                                                        {sch?.time || '—'}
                                                    </span>
                                                </div>

                                                <Link
                                                    href={`/groups`}
                                                    className="text-[11px] font-bold text-primary hover:underline"
                                                >
                                                    إدارة المجموعة ←
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Week View */}
            {viewMode === 'week' && (
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
                                    'rounded-2xl border p-3 flex flex-col justify-between min-h-[300px] transition-all',
                                    isTodayCol
                                        ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/20 shadow-sm'
                                        : 'bg-white border-gray-100 shadow-2xs'
                                )}
                            >
                                <div>
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

                                    {dayGroups.length === 0 ? (
                                        <p className="text-[11px] text-gray-400 text-center py-8">
                                            — لا توجد حصص —
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {dayGroups.map((g) => {
                                                const s = g.schedule?.find((sch) => sch.day === col.name);
                                                return (
                                                    <div
                                                        key={g._id}
                                                        className="p-2 rounded-xl bg-gray-50/80 hover:bg-primary/10 border border-gray-100 transition-all text-right space-y-1"
                                                    >
                                                        <span className="text-[10px] font-mono font-bold text-primary bg-white px-1.5 py-0.5 rounded border border-gray-100 inline-block">
                                                            {s?.time || '—'}
                                                        </span>
                                                        <p className="text-xs font-bold text-gray-900 truncate">
                                                            {g.name}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 truncate">
                                                            {g.gradeLevel}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
